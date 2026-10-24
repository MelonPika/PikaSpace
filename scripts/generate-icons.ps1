# Rasterize the existing icon-128.svg geometry using Windows drawing APIs.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"
$iconDir = Join-Path (Split-Path $PSScriptRoot -Parent) "public\icons"
$canvas = New-Object System.Drawing.Bitmap 512, 512
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = "AntiAlias"
$graphics.ScaleTransform(4, 4)
$background = New-Object System.Drawing.Drawing2D.GraphicsPath
$background.AddArc(0, 0, 64, 64, 180, 90)
$background.AddArc(64, 0, 64, 64, 270, 90)
$background.AddArc(64, 64, 64, 64, 0, 90)
$background.AddArc(0, 64, 64, 64, 90, 90)
$background.CloseFigure()
$dark = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#070a10'))
$graphics.FillPath($dark, $background)
$letter = New-Object System.Drawing.Drawing2D.GraphicsPath
$letter.StartFigure()
$letter.AddLine(38, 96, 38, 32)
$letter.AddLine(38, 32, 71.5, 32)
$letter.AddBezier(71.5, 32, 87.3, 32, 97, 41.3, 97, 55.5)
$letter.AddBezier(97, 55.5, 97, 69.7, 87.3, 79, 71.5, 79)
$letter.AddLine(71.5, 79, 54.8, 79)
$letter.AddLine(54.8, 79, 54.8, 96)
$letter.CloseFigure()
$letter.StartFigure()
$letter.AddLine(54.8, 65.9, 69.8, 65.9)
$letter.AddBezier(69.8, 65.9, 76.4, 65.9, 80.3, 62, 80.3, 55.5)
$letter.AddBezier(80.3, 55.5, 80.3, 49, 76.4, 45.2, 69.8, 45.2)
$letter.AddLine(69.8, 45.2, 54.8, 45.2)
$letter.CloseFigure()
$gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.Point]::new(30, 24)), ([System.Drawing.Point]::new(103, 103)), ([System.Drawing.Color]::Purple), ([System.Drawing.Color]::Cyan)
$blend = New-Object System.Drawing.Drawing2D.ColorBlend 3
$blend.Colors = @('#8b5cf6', '#22d3ee', '#34d399') | ForEach-Object { [System.Drawing.ColorTranslator]::FromHtml($_) }
$blend.Positions = [single[]]@(0, 0.55, 1)
$gradient.InterpolationColors = $blend
$graphics.FillPath($gradient, $letter)
$green = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(209, 52, 211, 153))
$graphics.FillEllipse($green, 85, 21, 22, 22)
$mountain = New-Object System.Drawing.Drawing2D.GraphicsPath
$mountain.AddBezier(16, 100, 36, 72, 51, 71, 71, 93)
$mountain.AddBezier(71, 93, 87, 77, 99, 78, 112, 100)
$mountain.CloseFigure()
$mountainBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(230, 16, 35, 31))
$graphics.FillPath($mountainBrush, $mountain)
foreach ($size in @(16, 48, 128)) {
  $icon = New-Object System.Drawing.Bitmap $size, $size
  $scaled = [System.Drawing.Graphics]::FromImage($icon)
  $scaled.InterpolationMode = "HighQualityBicubic"
  $scaled.DrawImage($canvas, 0, 0, $size, $size)
  $icon.Save((Join-Path $iconDir "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $scaled.Dispose()
  $icon.Dispose()
}
$graphics.Dispose()
$canvas.Dispose()
@($background, $letter, $mountain, $gradient, $dark, $green, $mountainBrush) | ForEach-Object { $_.Dispose() }
Write-Host "Generated Chrome-compatible PNG icons."
