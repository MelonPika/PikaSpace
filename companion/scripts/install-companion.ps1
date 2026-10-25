param(
  [Parameter(Mandatory = $false)]
  [string[]]$ExtensionId
)

$ErrorActionPreference = "Stop"

if (!$ExtensionId -or !$ExtensionId.Count) {
  Write-Error "ExtensionId is required. Load the extension first at chrome://extensions, then copy its ID and run: .\scripts\install-companion.ps1 -ExtensionId `"YOUR_EXTENSION_ID`""
}

$ExtensionIds = @($ExtensionId | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique)
if (!$ExtensionIds.Count) { throw 'At least one extension ID is required.' }
foreach ($id in $ExtensionIds) {
  if ($id -cnotmatch "^[a-p]{32}$") {
    Write-Error "ExtensionId '$id' must look like a Chrome extension ID: 32 lowercase letters from a-p."
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$projectPath = Join-Path $repoRoot "native-host\PikaNav.MediaHost.csproj"
$publishDir = Join-Path $repoRoot "native-host\bin\Release\net8.0-windows10.0.19041.0\win-x64\publish"
$installDir = Join-Path $env:LOCALAPPDATA "PikaNav\MediaHost"
$manifestPath = Join-Path $installDir "com.pikanav.media.json"
$exePath = Join-Path $installDir "PikaNav.MediaHost.exe"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.pikanav.media"

if (Test-Path -LiteralPath (Join-Path $installDir 'unins000.exe')) {
  throw 'This companion is managed by the EXE installer. Run the newer Setup EXE to update it, or uninstall it from Windows Settings first.'
}

Write-Host "Publishing PikaSpace Windows Companion..."
dotnet publish $projectPath -c Release -r win-x64 --self-contained false
if ($LASTEXITCODE -ne 0) {
  throw "dotnet publish failed. Fix the build errors above and run the installer again."
}

if (!(Test-Path $publishDir)) {
  throw "Publish output was not found at $publishDir"
}

Get-Process -Name "PikaNav.MediaHost" -ErrorAction SilentlyContinue | Stop-Process -Force

if (Test-Path $installDir) {
  $resolvedInstallDir = [IO.Path]::GetFullPath($installDir)
  $expectedInstallDir = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PikaNav\MediaHost'))
  if ($resolvedInstallDir -ne $expectedInstallDir -or !$env:LOCALAPPDATA) { throw 'Unsafe companion installation directory.' }
  try {
    Remove-Item -LiteralPath $resolvedInstallDir -Recurse -Force
  } catch {
    throw "Could not replace $installDir. Close Chrome and any running PikaNav.MediaHost.exe process, then run this installer again. Details: $($_.Exception.Message)"
  }
}
New-Item -ItemType Directory -Path $installDir | Out-Null

Copy-Item -Path (Join-Path $publishDir "*") -Destination $installDir -Recurse -Force

$manifest = [ordered]@{
  name = "com.pikanav.media"
  description = "PikaSpace Windows media companion"
  path = $exePath
  type = "stdio"
  allowed_origins = @($ExtensionIds | ForEach-Object { "chrome-extension://$_/" })
}

$manifestJson = $manifest | ConvertTo-Json -Depth 4
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8NoBom)

New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $manifestPath

Write-Host "PikaSpace Windows Companion installed."
Write-Host "Native host manifest: $manifestPath"
Write-Host "Registered host: com.pikanav.media"
