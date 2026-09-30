$ErrorActionPreference = "Stop"

$wranglerArgs = @($args)
$systemNode = (Get-Command node -ErrorAction Stop).Source
$systemArch = (& $systemNode -p "process.arch").Trim()

if ($systemArch -ne "arm64") {
  & npx.cmd --yes wrangler@latest @wranglerArgs
  exit $LASTEXITCODE
}

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$npmRoot = Split-Path -Parent (Get-Command npm.cmd -ErrorAction Stop).Source
$npmCli = Join-Path $npmRoot "node_modules\npm\bin\npm-cli.js"
$installRoot = Join-Path $root ".wrangler-x64"
$wranglerCli = Join-Path $installRoot "node_modules\wrangler\bin\wrangler.js"

$nodeCandidates = @()
if (-not [string]::IsNullOrWhiteSpace($env:SENSE_VOCAB_X64_NODE)) {
  $nodeCandidates += $env:SENSE_VOCAB_X64_NODE
}
$nodeCandidates += @(
  (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"),
  (Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe"),
  (Join-Path $env:ProgramFiles "nodejs\node.exe")
)
$tempNodeRoots = Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter "sense-vocab-node-x64-v*" -ErrorAction SilentlyContinue
foreach ($tempNodeRoot in $tempNodeRoots) {
  $nodeCandidates += Get-ChildItem -LiteralPath $tempNodeRoot.FullName -Filter "node.exe" -File -Recurse -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName
}

$x64Node = $null
foreach ($candidate in $nodeCandidates) {
  if (-not (Test-Path -LiteralPath $candidate)) {
    continue
  }
  try {
    $candidateArch = (& $candidate -p "process.arch").Trim()
  } catch {
    continue
  }
  if ($candidateArch -eq "x64") {
    $x64Node = $candidate
    break
  }
}

if (-not $x64Node) {
  throw "Wrangler does not support the active Windows ARM64 Node runtime, and no validated x64 Node runtime was found. Set SENSE_VOCAB_X64_NODE to an x64 node.exe path."
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
