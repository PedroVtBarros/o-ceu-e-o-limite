Add-Type -AssemblyName System.Drawing
$iconRoot = Join-Path $PSScriptRoot '../build'
[System.IO.Directory]::CreateDirectory($iconRoot) | Out-Null
$bitmap = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)
$background = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#2C695B'))
$shape = New-Object System.Drawing.Drawing2D.GraphicsPath
$shape.AddArc(2, 2, 88, 88, 180, 90)
$shape.AddArc(166, 2, 88, 88, 270, 90)
$shape.AddArc(166, 166, 88, 88, 0, 90)
$shape.AddArc(2, 166, 88, 88, 90, 90)
$shape.CloseFigure()
$graphics.FillPath($background, $shape)
$cloudBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#FAF8ED'))
$graphics.FillEllipse($cloudBrush, 43, 100, 78, 78)
$graphics.FillEllipse($cloudBrush, 76, 62, 107, 107)
$graphics.FillEllipse($cloudBrush, 143, 101, 74, 74)
$graphics.FillRectangle($cloudBrush, 82, 119, 95, 58)
$arrow = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#E4BE72')), 13
$arrow.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$arrow.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$arrow.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$graphics.DrawLine($arrow, 128, 205, 128, 135)
$graphics.DrawLine($arrow, 128, 135, 103, 159)
$graphics.DrawLine($arrow, 128, 135, 153, 159)
$pngPath = Join-Path $iconRoot 'icon.png'
$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$png = [System.IO.File]::ReadAllBytes($pngPath)
$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($stream)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]1)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([uint16]1)
$writer.Write([uint16]32)
$writer.Write([uint32]$png.Length)
$writer.Write([uint32]22)
$writer.Write($png)
[System.IO.File]::WriteAllBytes((Join-Path $iconRoot 'icon.ico'), $stream.ToArray())
$writer.Dispose()
$stream.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$background.Dispose()
$cloudBrush.Dispose()
$arrow.Dispose()
$shape.Dispose()
