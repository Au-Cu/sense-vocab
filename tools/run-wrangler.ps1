$ErrorActionPreference = "Stop"

$wranglerArgs = @($args)
$systemNode = (Get-Command node -ErrorAction Stop).Source
$systemArch = (& $systemNode -p "process.arch").Trim()

if ($systemArch -ne "arm64") {
  & npx.cmd --yes wrangler@latest @wranglerArgs
  exit $LASTEXITCODE
}

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$x64Node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$npmRoot = Split-Path -Parent (Get-Command npm.cmd -ErrorAction Stop).Source
$npmCli = Join-Path $npmRoot "node_modules\npm\bin\npm-cli.js"
$installRoot = Join-Path $root ".wrangler-x64"
$wranglerCli = Join-Path $installRoot "node_modules\wrangler\bin\wrangler.js"

if (-not (Test-Path -LiteralPath $x64Node)) {
  throw "Wrangler does not support the active Windows ARM64 Node runtime, and no x64 Node runtime was found."
}
if (-not (Test-Path -LiteralPath $npmCli)) {
  throw "Unable to locate npm-cli.js."
}

if (-not (Test-Path -LiteralPath $wranglerCli)) {
  $nodeDir = Split-Path -Parent $x64Node
  $env:PATH = "$nodeDir;$env:PATH"
  & $x64Node $npmCli install --prefix $installRoot --no-save wrangler@latest
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

& $x64Node $wranglerCli @wranglerArgs
exit $LASTEXITCODE
