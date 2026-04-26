$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workerScript = Join-Path $PSScriptRoot "start-phase15-api-worker.ps1"
$workerPorts = 3102..3113
$pidFile = Join-Path $projectRoot ".tools\phase15-api-workers.json"

function Stop-ListenerOnPort {
  param([int]$Port)

  $listener = netstat -ano | Select-String ":$Port\s+.*LISTENING" | Select-Object -First 1
  if ($listener) {
    $listenerPid = [int](($listener.ToString() -split "\s+")[-1])
    Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  }
}

foreach ($port in $workerPorts) {
  Stop-ListenerOnPort -Port $port
}

if (Test-Path $pidFile) {
  try {
    $previousPids = Get-Content $pidFile | ConvertFrom-Json
    foreach ($pidValue in $previousPids) {
      Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
    }
  } catch {
    # Ignore malformed pid files from previous runs.
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

$workerPids = @()
foreach ($port in $workerPorts) {
  $process = Start-Process `
    -FilePath "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -ArgumentList "-NoProfile", "-File", $workerScript, "-Port", "$port" `
    -PassThru
  $workerPids += $process.Id
}

$workerPids | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding ASCII

Start-Sleep -Seconds 12

foreach ($port in $workerPorts) {
  $healthy = $false
  for ($attempt = 0; $attempt -lt 20 -and -not $healthy; $attempt += 1) {
    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/v1/health" -UseBasicParsing | Out-Null
      $healthy = $true
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $healthy) {
    foreach ($pidValue in $workerPids) {
      Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    throw "Worker on port $port did not become healthy."
  }
}

Write-Host "Phase 15 API workers are healthy on ports: $($workerPorts -join ', ')"
