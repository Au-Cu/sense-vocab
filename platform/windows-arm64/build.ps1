param([switch]$Publish)
$ErrorActionPreference = "Stop"
$toolRoot = Join-Path $PSScriptRoot "..\..\.tooling"
$dotnetHome = Join-Path $toolRoot "dotnet-full"
if (Test-Path (Join-Path $dotnetHome "dotnet.exe")) { $env:PATH = $dotnetHome + ";" + $env:PATH }
$sdk = @(dotnet --list-sdks 2>$null)
if ($LASTEXITCODE -ne 0 -or $sdk.Count -eq 0) { Write-Error "dotnet SDK is required; runtime-only installation cannot compile this target."; exit 2 }
$project = Join-Path $PSScriptRoot "SenseVocab.Windows.ARM64.csproj"
$configuration = if ($Publish) { "Release" } else { "Debug" }
dotnet build $project --configuration $configuration --runtime win-arm64
if ($Publish) { dotnet publish $project --configuration Release --runtime win-arm64 --output (Join-Path $PSScriptRoot "artifacts/win-arm64") }
