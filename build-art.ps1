# build-art.ps1 — downscale art/ and embed as data URIs in art.js.
# file:// pages can't load local images into WebGL, so the covers ride along in
# the JS. Zero deps: uses .NET System.Drawing only. Rerun after adding art.
# (GDI+ can't read webp — those tapes keep their text placeholder cover.)
Add-Type -AssemblyName System.Drawing
$W = 216; $H = 432; $Q = 72                       # cell is 144x288 at runtime; a bit of headroom
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$Q)
$out = New-Object System.Text.StringBuilder
[void]$out.Append("window.VAULT_ART={")
$i = 0
Get-ChildItem art -File | Where-Object { $_.Extension -match "^\.(jpg|jpeg|png|gif|webp)$" } | ForEach-Object {
  $img = $null
  foreach ($attempt in 1..2) {                                  # GDI+ throws transient OOMs; retry once
    try { $img = [System.Drawing.Image]::FromFile($_.FullName); break } catch { Start-Sleep -Milliseconds 200 }
  }
  if (-not $img) { Write-Host "skipped: $($_.Name)"; return }
  try {
    # ponytail: $ow/$oh, not $w/$h — PowerShell vars are case-insensitive, so
    # $w/$h would silently clobber the $W/$H target-box constants above and
    # shrink every subsequent cover (this is what was producing near-blank output)
    $scale = [Math]::Min(1.0, [Math]::Min($W / $img.Width, $H / $img.Height))
    $ow = [Math]::Max(1, [int]($img.Width * $scale)); $oh = [Math]::Max(1, [int]($img.Height * $scale))
    $bmp = New-Object System.Drawing.Bitmap $ow, $oh
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $ow, $oh); $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, $enc, $ep); $bmp.Dispose()
    if ($i -gt 0) { [void]$out.Append(",") }
    [void]$out.Append('"art/').Append($_.Name).Append('":"data:image/jpeg;base64,')
    [void]$out.Append([Convert]::ToBase64String($ms.ToArray())).Append('"')
    $i++
  } catch { Write-Host "skipped: $($_.Name) ($($_.Exception.Message))" }
  finally { $img.Dispose() }
}
[void]$out.Append("};")
[System.IO.File]::WriteAllText("$PWD\art.js", $out.ToString())
Write-Host "art.js: $([math]::Round((Get-Item art.js).Length / 1MB, 1)) MB from $i covers"