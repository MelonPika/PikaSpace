param(
  [string[]]$ExtensionId = @(),
  [string]$InnoSetupCompilerPath,
  [switch]$BootstrapCompiler,
  [switch]$TestBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$projectPath = Join-Path $repoRoot 'companion\native-host\PikaNav.MediaHost.csproj'
$workDir = Join-Path $repoRoot '.verification\companion'
$publishDir = Join-Path $workDir 'publish'
$releaseDir = Join-Path $repoRoot 'releases\companion'
if ($TestBuild) { $releaseDir = Join-Path $workDir 'test-installer' }
[xml]$project = Get-Content -LiteralPath $projectPath
$version = [string]$project.Project.PropertyGroup.Version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'The companion project needs a three-part Version.' }
if ($ExtensionId.Count -gt 10) { throw 'At most 10 extension IDs may be paired.' }
$ids = @($ExtensionId | ForEach-Object { $_.Trim() } | Select-Object -Unique)
foreach ($id in $ids) {
  if ($id -cnotmatch '^[a-p]{32}$') { throw "Invalid Chrome extension ID: $id" }
}

if (!$InnoSetupCompilerPath) {
  $candidates = @(
    (Join-Path $repoRoot '.cache\installer-tools\inno\ISCC.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 7\ISCC.exe')
  )
  $InnoSetupCompilerPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (!$InnoSetupCompilerPath -and $BootstrapCompiler) {
  # Official, pinned portable toolchain. No toolchain registry entries or shortcuts.
  $toolDir = Join-Path $repoRoot '.cache\installer-tools'
  New-Item -ItemType Directory -Path $toolDir -Force | Out-Null
  $downloadPath = Join-Path $toolDir 'innosetup-6.7.3.exe'
  if (!(Test-Path -LiteralPath $downloadPath)) {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe' -OutFile $downloadPath
  }
  $expectedHash = '9C73C3BAE7ED48D44112A0F48E66742C00090BDB5BEF71D9D3C056C66E97B732'
  if ((Get-FileHash -LiteralPath $downloadPath -Algorithm SHA256).Hash -ne $expectedHash) {
    throw 'Inno Setup download checksum mismatch. No downloaded program was executed.'
  }
  $signature = Get-AuthenticodeSignature -LiteralPath $downloadPath
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notlike '*Pyrsys B.V.*') {
    throw 'Inno Setup publisher signature verification failed.'
  }
  $toolTarget = Join-Path $toolDir 'inno'
  $toolArgs = @('/PORTABLE=1', '/CURRENTUSER', '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', ('/DIR="' + $toolTarget + '"'))
  $toolProcess = Start-Process -FilePath $downloadPath -ArgumentList $toolArgs -WindowStyle Hidden -Wait -PassThru
  if ($toolProcess.ExitCode -ne 0) { throw "Inno Setup portable extraction failed: $($toolProcess.ExitCode)" }
  $InnoSetupCompilerPath = Join-Path $toolTarget 'ISCC.exe'
}
if (!$InnoSetupCompilerPath -or !(Test-Path -LiteralPath $InnoSetupCompilerPath)) {
  throw 'Install Inno Setup 6.3+ or pass -InnoSetupCompilerPath. Use -BootstrapCompiler to download a verified portable compiler into .cache/installer-tools.'
}

New-Item -ItemType Directory -Path $workDir, $releaseDir -Force | Out-Null
# Clear only this script's staging directory; a stale DLL must not enter a release.
$resolvedPublishDir = [IO.Path]::GetFullPath($publishDir)
if (!$resolvedPublishDir.StartsWith($workDir + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Publish directory escaped the companion workspace.'
}
if (Test-Path -LiteralPath $resolvedPublishDir) { Remove-Item -LiteralPath $resolvedPublishDir -Recurse -Force }

Write-Host 'Publishing the self-contained, on-demand Windows helper...'
# Multiple loose runtime files start directly from the install folder without
# single-file extraction on every launch. Inno compresses them into one installer.
# Preserve reflection/WinRT metadata: do not apply unsafe linker trimming.
dotnet publish $projectPath -c Release -r win-x64 --self-contained true -o $publishDir -p:PublishSingleFile=false -p:PublishTrimmed=false -p:DebugType=None -p:DebugSymbols=false
if ($LASTEXITCODE -ne 0) { throw 'Companion publish failed.' }
if (!(Test-Path -LiteralPath (Join-Path $publishDir 'PikaNav.MediaHost.exe'))) { throw 'Published helper is missing.' }

# A tiny setup-only detector uses Windows' built-in .NET Framework. It can run
# before the self-contained companion is extracted, without a PowerShell launch.
$detectorDir = Join-Path $workDir 'detector'
New-Item -ItemType Directory -Path $detectorDir -Force | Out-Null
$detectorExe = Join-Path $detectorDir 'PikaNav.ExtensionDetector.exe'
$frameworkCompiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
& $frameworkCompiler /nologo /target:winexe /optimize+ /reference:System.Web.Extensions.dll "/out:$detectorExe" (Join-Path $repoRoot 'companion\installer\ExtensionDetector.cs')
if ($LASTEXITCODE -ne 0) { throw 'Extension detector compilation failed.' }
$stableId = (& node (Join-Path $repoRoot 'scripts\extension-identity.mjs') | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $stableId -cnotmatch '^[a-p]{32}$') { throw 'Could not determine the stable release extension ID.' }

# Self-contained publish output does not copy the runtime's redistribution notices.
$runtimeConfig = Get-Content -LiteralPath (Join-Path $publishDir 'PikaNav.MediaHost.runtimeconfig.json') -Raw | ConvertFrom-Json
$runtimeVersion = ($runtimeConfig.runtimeOptions.includedFrameworks | Where-Object { $_.name -eq 'Microsoft.NETCore.App' }).version
$assetsPath = Join-Path (Split-Path $projectPath) 'obj\project.assets.json'
$assets = Get-Content -LiteralPath $assetsPath -Raw | ConvertFrom-Json
$packageRoots = $assets.packageFolders.PSObject.Properties.Name
$runtimePackage = $packageRoots | ForEach-Object { Join-Path $_ "microsoft.netcore.app.runtime.win-x64\$runtimeVersion" } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$runtimePackage) { throw 'Cannot locate the bundled runtime redistribution notices.' }
foreach ($notice in @('LICENSE.TXT', 'THIRD-PARTY-NOTICES.TXT')) {
  Copy-Item -LiteralPath (Join-Path $runtimePackage $notice) -Destination (Join-Path $publishDir $notice) -Force
}

$installerSource = Join-Path $repoRoot 'companion\installer\companion.iss'
$compilerArgs = @('/Qp', "/DAppVersion=$version", "/DHostSource=$publishDir", "/DDetectorSource=$detectorExe", "/DReleaseDir=$releaseDir", "/DDefaultExtensionIds=$($ids -join ',')", "/DStableExtensionId=$stableId")
if ($TestBuild) { $compilerArgs += '/DInstallerTestMode=1' }
& $InnoSetupCompilerPath @compilerArgs $installerSource
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }

$installer = Join-Path $releaseDir "PikaDesk-Companion-$version-Setup-x64.exe"
Copy-Item -LiteralPath (Join-Path $repoRoot 'companion\installer\INSTALL.txt') -Destination (Join-Path $releaseDir 'INSTALL.txt') -Force
$hash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $releaseDir 'SHA256SUMS.txt') -Encoding Ascii -Value "$hash  $([IO.Path]::GetFileName($installer))"
$installedBytes = (Get-ChildItem -LiteralPath $publishDir -File -Recurse | Measure-Object -Property Length -Sum).Sum
Write-Host ("Installer: {0} ({1:N1} MiB); bundled files: {2:N1} MiB" -f $installer, ((Get-Item -LiteralPath $installer).Length / 1MB), ($installedBytes / 1MB))
Write-Host 'The build is unsigned. Sign the helper and installer with your publisher certificate before public distribution.'
