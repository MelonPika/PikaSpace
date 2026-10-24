$ErrorActionPreference = "Stop"

$installDir = Join-Path $env:LOCALAPPDATA "PikaNav\MediaHost"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.pikanav.media"

$uninstaller = Join-Path $installDir 'unins000.exe'
if (Test-Path -LiteralPath $uninstaller) {
  $removeProcess = Start-Process -FilePath $uninstaller -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -WindowStyle Hidden -Wait -PassThru
  if ($removeProcess.ExitCode -ne 0) { throw "Companion uninstall failed: $($removeProcess.ExitCode)" }
  Write-Host 'PikaNav Windows Companion uninstalled.'
  return
}

if (Test-Path $registryPath) {
  Remove-Item $registryPath -Recurse -Force
}

if (Test-Path $installDir) {
  $resolvedInstallDir = [IO.Path]::GetFullPath($installDir)
  $expectedInstallDir = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PikaNav\MediaHost'))
  if ($resolvedInstallDir -ne $expectedInstallDir -or !$env:LOCALAPPDATA) { throw 'Unsafe companion installation directory.' }
  Remove-Item -LiteralPath $resolvedInstallDir -Recurse -Force
}

Write-Host "PikaNav Windows Companion uninstalled."
