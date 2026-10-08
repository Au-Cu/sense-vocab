param([ValidateSet("debug","release")][string]$Variant = "debug")
$ErrorActionPreference = "Stop"
$hvigor = Get-Command hvigorw -ErrorAction SilentlyContinue
if (-not $hvigor) { $candidate = Join-Path $PSScriptRoot "hvigorw.bat"; if (Test-Path $candidate) { $hvigor = $candidate } }
if (-not $hvigor) { Write-Error "DevEco hvigorw is required; install DevEco/HarmonyOS SDK under D:\Files\sense-vocab-mvp\.tooling or provide hvigorw.bat."; exit 2 }
Push-Location $PSScriptRoot
try { & $hvigor "assembleApp" "--mode" $Variant; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
finally { Pop-Location }
