param([switch]$ToolCache)

$ErrorActionPreference = 'Stop'
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$generatedPaths = @(
  'dist',
  '.verification',
  'companion\native-host\bin',
  'companion\native-host\obj',
  'node_modules\.vite',
  'node_modules\.vite-temp'
)
if ($ToolCache) { $generatedPaths += '.cache\installer-tools' }

[long]$removedBytes = 0
foreach ($relativePath in $generatedPaths) {
  $targetPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $relativePath))
  if (!$targetPath.StartsWith($workspaceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Cleanup target escaped the project: $relativePath"
  }
  if (!(Test-Path -LiteralPath $targetPath)) { continue }
  $target = Get-Item -LiteralPath $targetPath -Force
  if (($target.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Cleanup refuses to follow a linked directory: $relativePath"
  }
  $targetBytes = (Get-ChildItem -LiteralPath $targetPath -File -Recurse -Force | Measure-Object -Property Length -Sum).Sum
  Remove-Item -LiteralPath $targetPath -Recurse -Force
  $removedBytes += $targetBytes
  Write-Host "Removed $relativePath"
}
Write-Host ('Freed {0:N1} MiB of generated files.' -f ($removedBytes / 1MB))
