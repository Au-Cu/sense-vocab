param([ValidateSet("debug","release")][string]$Variant = "debug")
$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$toolRoot = Join-Path $projectRoot "..\..\.tooling"
$jdkHome = Join-Path $toolRoot "jdk17"
if (Test-Path (Join-Path $jdkHome "bin\java.exe")) { $env:JAVA_HOME = (Resolve-Path $jdkHome).Path; $env:PATH = (Join-Path $env:JAVA_HOME "bin") + ";" + $env:PATH }
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Error "Node.js is required to package offline resources."; exit 2 }
$java = Get-Command java -ErrorAction SilentlyContinue
if (-not $java) { Write-Error "Java 17+ is required; install it under D:\Files\sense-vocab-mvp\.tooling."; exit 2 }
$sdkRoot = Join-Path $projectRoot "..\..\.tooling\android-sdk"
if (Test-Path $sdkRoot) { $env:ANDROID_HOME = (Resolve-Path $sdkRoot).Path; $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME }
if (-not $env:ANDROID_HOME) { Write-Error "Android SDK is required; set ANDROID_HOME or install it under D:\Files\sense-vocab-mvp\.tooling\android-sdk."; exit 2 }
$gradle = $null
if (Test-Path (Join-Path $projectRoot "gradlew.bat")) { $gradle = Join-Path $projectRoot "gradlew.bat" }
elseif (Get-Command gradle -ErrorAction SilentlyContinue) { $gradle = "gradle" }
elseif (Test-Path (Join-Path $toolRoot "gradle-8.7\bin\gradle.bat")) { $gradle = Join-Path $toolRoot "gradle-8.7\bin\gradle.bat" }
if (-not $gradle) { Write-Error "Gradle 8.7+ or gradlew.bat is required; no Gradle executable was found."; exit 2 }
node (Join-Path $projectRoot "..\..\tools\package-offline-resources.mjs") --target android --out "platform/.build/android"
Push-Location $projectRoot
try { & $gradle "assemble$($Variant.Substring(0,1).ToUpper())$($Variant.Substring(1))"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
finally { Pop-Location }
