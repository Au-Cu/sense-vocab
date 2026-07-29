$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$PreferredPort = 4173
$MaxPort = 4199

function Test-PortListening {
  param([int]$Port)

  try {
    $connection = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $connection
  } catch {
    try {
      $client = [System.Net.Sockets.TcpClient]::new()
      $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
      $connected = $async.AsyncWaitHandle.WaitOne(250)
      if ($connected) {
        $client.EndConnect($async)
      }
      $client.Close()
      return $connected
    } catch {
      return $false
    }
  }
}

function Test-AppServing {
  param([int]$Port)

  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match "app\.js"
  } catch {
    return $false
  }
}

function Find-FreePort {
  for ($port = $PreferredPort; $port -le $MaxPort; $port += 1) {
    if (-not (Test-PortListening -Port $port)) {
      return $port
    }
  }

  throw "No free local port found between $PreferredPort and $MaxPort."
}

function Show-Message {
  param(
    [string]$Message,
    [string]$Title = "Sense Vocab"
  )

  try {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($Message, $Title) | Out-Null
  } catch {
    Write-Host $Message
  }
}

function Start-StaticServer {
  param([int]$Port)

  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    Start-Process -FilePath $py.Source -ArgumentList @("-3", "-m", "http.server", "$Port", "--bind", "127.0.0.1") -WorkingDirectory $ProjectRoot -WindowStyle Hidden
    return
  }

  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) {
    Start-Process -FilePath $python.Source -ArgumentList @("-m", "http.server", "$Port", "--bind", "127.0.0.1") -WorkingDirectory $ProjectRoot -WindowStyle Hidden
    return
  }

  Show-Message "Python was not found, so the local app server cannot be started."
  exit 1
}

$portToOpen = $PreferredPort

if (-not (Test-AppServing -Port $PreferredPort)) {
  $portToOpen = Find-FreePort
  Start-StaticServer -Port $portToOpen

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-AppServing -Port $portToOpen) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Show-Message "The local server started, but the page did not respond yet. Try again in a few seconds."
  }
}

Start-Process "http://127.0.0.1:$portToOpen/"
