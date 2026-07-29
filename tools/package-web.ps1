$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$dist = (Resolve-Path -LiteralPath (Join-Path $root "dist")).Path
$output = Join-Path $root "sense-vocab-web.zip"

if (-not $dist.StartsWith($root + [IO.Path]::DirectorySeparatorChar)) {
  throw "Unexpected release directory: $dist"
}

if (Test-Path -LiteralPath $output) {
  Remove-Item -LiteralPath $output -Force
}

Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $output -CompressionLevel Optimal
Write-Output "Cloudflare upload archive created at $output"
