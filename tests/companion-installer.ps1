param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
[xml]$project = Get-Content -LiteralPath (Join-Path $repoRoot 'companion\native-host\PikaNav.MediaHost.csproj')
$version = [string]$project.Project.PropertyGroup.Version
$workDir = Join-Path $repoRoot '.verification\companion'
$installer = Join-Path $workDir "test-installer\PikaNav-Companion-$version-Setup-x64.exe"
# Include Unicode and an apostrophe to exercise JSON paths and executable quoting.
$installDir = Join-Path $workDir "installer-smoke's-$([char]0x732b)"
$hostPath = Join-Path $installDir 'PikaNav.MediaHost.exe'
$testKey = 'HKCU:\Software\PikaNav\InstallerTests'
$hostKey = Join-Path $testKey 'NativeMessagingHosts\com.pikanav.media'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PikaNav.WindowsCompanion.InstallerTest_is1'
$idOne = 'a' * 32
$idTwo = 'b' * 32
$chromeFixture = Join-Path $workDir 'installer-chrome-fixture'
if ((Test-Path -LiteralPath $testKey) -or (Test-Path -LiteralPath $uninstallKey) -or (Test-Path -LiteralPath $installDir)) {
  throw 'A previous installer test is present. Inspect it before running again.'
}
if (!$SkipBuild) {
  & (Join-Path $repoRoot 'companion\scripts\build-companion.ps1') -BootstrapCompiler -TestBuild
}
if (!(Test-Path -LiteralPath $installer)) { throw 'Test installer is missing.' }
& node --test (Join-Path $repoRoot 'tests\extension-detector.test.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Extension detector tests failed.' }

function Assert-True([bool]$Condition, [string]$Message) {
  if (!$Condition) { throw $Message }
}
function Run-Setup([string]$Pairing, [string]$LogName, [string]$ChromeDataDir = '', [bool]$UseStableDefault = $false) {
  $setupArgs = @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', ('/DIR="' + $installDir + '"'), ('/LOG="' + (Join-Path $workDir $LogName) + '"'))
  if ($Pairing) { $setupArgs += "/EXTENSIONID=$Pairing" }
  if ($ChromeDataDir) { $setupArgs += ('/CHROMEDATADIR="' + $ChromeDataDir + '"') }
  if (!$UseStableDefault) { $setupArgs += '/NODEFAULTID=1' }
  $setupProcess = Start-Process -FilePath $installer -ArgumentList $setupArgs -WindowStyle Hidden -Wait -PassThru
  return $setupProcess.ExitCode
}
function Read-Pairing {
  $manifestPath = Join-Path $installDir 'com.pikanav.media.json'
  $manifestBytes = [IO.File]::ReadAllBytes($manifestPath)
  Assert-True (!($manifestBytes[0] -eq 0xEF -and $manifestBytes[1] -eq 0xBB)) 'Chrome manifest has a UTF-8 BOM.'
  $manifest = [Text.Encoding]::UTF8.GetString($manifestBytes) | ConvertFrom-Json
  Assert-True ($manifest.name -eq 'com.pikanav.media') 'Wrong native host name.'
  Assert-True ($manifest.path -ceq $hostPath) 'JSON did not preserve the install path.'
  Assert-True ($manifest.type -eq 'stdio') 'Wrong native transport.'
  Assert-True ((Get-Item -LiteralPath $hostKey).GetValue('') -ceq $manifestPath) 'Wrong Chrome registration path.'
  return $manifest
}
try {
  Assert-True ((Run-Setup 'INVALID' 'install-invalid.log') -ne 0) 'Invalid extension ID was accepted.'
  Assert-True (!(Test-Path -LiteralPath $hostKey)) 'Invalid setup changed registration.'
  Assert-True (!(Test-Path -LiteralPath $installDir)) 'Invalid setup installed files.'
  Assert-True ((Run-Setup '' 'install-missing-id.log') -ne 0) 'Missing extension ID was accepted.'
  Assert-True (!(Test-Path -LiteralPath $hostKey)) 'Missing-ID setup changed registration.'

  Assert-True ((Run-Setup "$idOne,$idTwo" 'install-valid.log') -eq 0) 'Installation failed.'
  $manifest = Read-Pairing
  Assert-True ($manifest.allowed_origins.Count -eq 2) 'Expected exactly two explicitly paired origins.'
  Assert-True ($manifest.allowed_origins[0] -ceq "chrome-extension://$idOne/") 'Wrong first extension origin.'
  Assert-True ($manifest.allowed_origins[1] -ceq "chrome-extension://$idTwo/") 'Wrong second extension origin.'
  Assert-True (Test-Path -LiteralPath $uninstallKey) 'Windows Apps uninstall entry is missing.'

  $runtime = Get-Content -LiteralPath (Join-Path $installDir 'PikaNav.MediaHost.runtimeconfig.json') -Raw | ConvertFrom-Json
  Assert-True ($null -ne $runtime.runtimeOptions.includedFrameworks) 'The runtime was not bundled.'
  Assert-True (Test-Path -LiteralPath (Join-Path $installDir 'coreclr.dll')) 'The bundled runtime is missing.'
  $exeBytes = [IO.File]::ReadAllBytes($hostPath)
  $peOffset = [BitConverter]::ToInt32($exeBytes, 0x3C)
  Assert-True ([BitConverter]::ToUInt16($exeBytes, $peOffset + 24 + 68) -eq 2) 'Helper would open a console window.'
  & node (Join-Path $repoRoot 'tests\native-smoke.mjs') --host $hostPath --result-path (Join-Path $workDir 'installed-native-results.json')
  if ($LASTEXITCODE -ne 0) { throw 'Installed native helper protocol test failed.' }

  Assert-True ((Run-Setup '' 'install-upgrade.log') -eq 0) 'Upgrade with saved pairing failed.'
  $manifest = Read-Pairing
  Assert-True ($manifest.allowed_origins.Count -eq 2) 'Upgrade lost the saved pairing.'
  Assert-True ((Run-Setup $idTwo 'install-repair.log') -eq 0) 'Changing the paired extension failed.'
  $manifest = Read-Pairing
  Assert-True ($manifest.allowed_origins.Count -eq 1) 'Repair retained an old extension origin.'
  Assert-True ($manifest.allowed_origins[0] -ceq "chrome-extension://$idTwo/") 'Repair wrote the wrong origin.'

  $uninstaller = Join-Path $installDir 'unins000.exe'
  $removeProcess = Start-Process -FilePath $uninstaller -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -WindowStyle Hidden -Wait -PassThru
  Assert-True ($removeProcess.ExitCode -eq 0) 'Uninstall failed.'
  Assert-True (!(Test-Path -LiteralPath $hostKey)) 'Uninstall left the Chrome registration.'
  Assert-True (!(Test-Path -LiteralPath $hostPath)) 'Uninstall left the executable.'
  Assert-True (!(Test-Path -LiteralPath (Join-Path $installDir 'com.pikanav.media.json'))) 'Uninstall left the Chrome manifest.'
  Assert-True (!(Test-Path -LiteralPath $uninstallKey)) 'Uninstall left its Windows Apps entry.'

  # Exercise automatic setup with Chrome's actual preference schema and no ID
  # argument. Unpacked records do not cache their manifest; read it on disk.
  $fixtureProfile = Join-Path $chromeFixture 'Default'
  New-Item -ItemType Directory -Path $fixtureProfile -Force | Out-Null
  $fixturePrefs = @{ extensions = @{ settings = @{ $idOne = @{ path = (Join-Path $repoRoot 'releases\PikaNav-0.2.0\extension'); state = 1 } } } }
  $fixtureJson = $fixturePrefs | ConvertTo-Json -Depth 8
  [IO.File]::WriteAllText((Join-Path $fixtureProfile 'Secure Preferences'), $fixtureJson, (New-Object Text.UTF8Encoding $false))
  Assert-True ((Run-Setup '' 'install-auto-detect.log' $chromeFixture) -eq 0) 'Automatic installation failed.'
  $manifest = Read-Pairing
  Assert-True ($manifest.allowed_origins.Count -eq 1) 'Automatic pairing authorized an unexpected ID.'
  Assert-True ($manifest.allowed_origins[0] -ceq "chrome-extension://$idOne/") 'Automatic pairing missed the unpacked extension.'
  $removeProcess = Start-Process -FilePath $uninstaller -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -WindowStyle Hidden -Wait -PassThru
  Assert-True ($removeProcess.ExitCode -eq 0) 'Uninstall after auto-detection failed.'

  Assert-True ((Run-Setup '' 'install-stable-default.log' '' $true) -eq 0) 'Automatic stable-ID installation failed.'
  $manifest = Read-Pairing
  $stableId = (& node (Join-Path $repoRoot 'scripts\extension-identity.mjs') | Out-String).Trim()
  Assert-True ($manifest.allowed_origins.Count -eq 1) 'Stable-ID setup authorized an unexpected ID.'
  Assert-True ($manifest.allowed_origins[0] -ceq "chrome-extension://$stableId/") 'Stable-ID setup wrote the wrong ID.'
  $removeProcess = Start-Process -FilePath $uninstaller -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -WindowStyle Hidden -Wait -PassThru
  Assert-True ($removeProcess.ExitCode -eq 0) 'Uninstall after stable-ID setup failed.'

  Assert-True ((Run-Setup $idOne 'install-ownership.log') -eq 0) 'Reinstallation failed.'
  Set-Item -LiteralPath $hostKey -Value 'C:\OtherInstallation\com.pikanav.media.json'
  $removeProcess = Start-Process -FilePath $uninstaller -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -WindowStyle Hidden -Wait -PassThru
  Assert-True ($removeProcess.ExitCode -eq 0) 'Second uninstall failed.'
  Assert-True ((Get-Item -LiteralPath $hostKey).GetValue('') -eq 'C:\OtherInstallation\com.pikanav.media.json') 'Uninstall deleted a registration now owned by another installation.'

  $results = [ordered]@{ install = 'passed'; automaticDetection = 'passed with no extension-ID argument'; stableIdDefault = 'passed with no extension-ID argument'; invalidAndMissingIds = 'rejected when defaults explicitly disabled in test builds'; utf8AndQuotedPath = 'passed'; pairedOrigins = 'passed'; selfContainedRuntime = 'passed'; noConsole = 'passed'; upgradeAndRepair = 'passed'; uninstall = 'passed'; registrationOwnership = 'passed'; registryScope = 'isolated test registration only'; liveDesktopControls = 'not invoked' }
  $results | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $workDir 'installer-results.json') -Encoding UTF8
  $results | ConvertTo-Json | Write-Output
} finally {
  if (Test-Path -LiteralPath (Join-Path $installDir 'unins000.exe')) {
    Start-Process -FilePath (Join-Path $installDir 'unins000.exe') -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -WindowStyle Hidden -Wait | Out-Null
  }
  # Only the test-owned paths are removed. Never touch the real Chrome host key.
  if (Test-Path -LiteralPath $testKey) { Remove-Item -LiteralPath $testKey -Recurse -Force }
  $checkedDir = [IO.Path]::GetFullPath($installDir)
  if (!$checkedDir.StartsWith($workDir + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Test cleanup escaped its workspace.' }
  if (Test-Path -LiteralPath $checkedDir) { Remove-Item -LiteralPath $checkedDir -Recurse -Force }
}
