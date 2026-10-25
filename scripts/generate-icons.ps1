# Generate Chrome icons and README wordmarks from the supplied mascot artwork.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$iconDir = Join-Path $repoRoot 'public\icons'
$assetDir = Join-Path $repoRoot 'docs\assets'
$sourcePath = Join-Path $assetDir 'pikadesk-mascot.png'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
if (!(Test-Path -LiteralPath $sourcePath)) { throw 'The original mascot PNG is missing from docs/assets/pikadesk-mascot.png.' }
$sourceImage = [System.Drawing.Bitmap]::FromFile($sourcePath)
try {
  if ($sourceImage.Width -ne $sourceImage.Height) { throw 'The mascot source must be square.' }
  foreach ($size in @(16, 32, 48, 64, 128, 256)) {
    $destination = Join-Path $iconDir "icon-$size.png"
    if ($size -eq 256) { $destination = Join-Path $assetDir 'mascot-256.png' }
    $icon = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($icon)
    $attributes = New-Object System.Drawing.Imaging.ImageAttributes
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
      $bounds = New-Object System.Drawing.Rectangle 0, 0, $size, $size
      $graphics.DrawImage($sourceImage, $bounds, 0, 0, $sourceImage.Width, $sourceImage.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
      $icon.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $attributes.Dispose()
      $graphics.Dispose()
      $icon.Dispose()
    }
    if ($size -in @(16, 48, 128)) {
      $encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($destination))
      $svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="{0}" height="{0}" viewBox="0 0 {0} {0}" role="img" aria-label="PikaDesk mascot"><image width="{0}" height="{0}" href="data:image/png;base64,{1}"/></svg>' -f $size, $encoded) + [Environment]::NewLine
      [IO.File]::WriteAllText((Join-Path $iconDir "icon-$size.svg"), $svg, $utf8NoBom)
    }
  }
} finally { $sourceImage.Dispose() }
$mascot = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $assetDir 'mascot-256.png')))
foreach ($theme in @('light', 'dark')) {
  if ($theme -eq 'dark') {
    $muted = '#b0b9cd'; $stroke = '#303a50'; $pika = '#FFD34D'; $desk = '#4D9BFF'
  } else {
    $muted = '#62708a'; $stroke = '#dce2ee'; $pika = '#A95C00'; $desk = '#1A65D1'
  }
  $wordmark = @"
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="188" viewBox="0 0 800 188" role="img" aria-labelledby="wordmark-title wordmark-description">
<title id="wordmark-title">PikaDesk &#183; &#30382;&#21345;&#26700;&#38754;</title>
<desc id="wordmark-description">The supplied PikaDesk mascot beside its English and Chinese names.</desc>
<image x="100" y="18" width="152" height="152" href="data:image/png;base64,$mascot"/>
<path d="M277 45v98" stroke="$stroke" stroke-width="1"/>
<text x="315" y="99" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="66" font-weight="750" letter-spacing="-2.5"><tspan fill="$pika">Pika</tspan><tspan fill="$desk">Desk</tspan></text>
<text x="319" y="140" fill="$muted" font-family="Segoe UI,Microsoft YaHei,PingFang SC,sans-serif" font-size="32" font-weight="500" letter-spacing="5">&#30382;&#21345;&#26700;&#38754;</text>
<circle cx="621" cy="53" r="5" fill="#7ED957"/>
</svg>
"@
  [IO.File]::WriteAllText((Join-Path $assetDir "wordmark-$theme.svg"), $wordmark + [Environment]::NewLine, $utf8NoBom)
}
Write-Host 'Generated mascot PNG icons (16/32/48/64/128), SVG compatibility assets, and README wordmarks.'
