$ErrorActionPreference = "Stop"

$nodeDir = "C:\Users\91892\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.15.0-win-x64"
$nodeExe = Join-Path $nodeDir "node.exe"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$apiRoot = Join-Path $projectRoot "apps\api"
$apiLog = Join-Path $projectRoot ".tools\phase15-api-load.log"
$apiErr = Join-Path $projectRoot ".tools\phase15-api-load.err.log"
$workerPidFile = Join-Path $projectRoot ".tools\phase15-api-workers.json"
$workerPorts = 3102..3113

foreach ($path in @($apiLog, $apiErr)) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Force
  }
}

$api = Start-Process `
  -FilePath "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -ArgumentList "-NoProfile", "-File", (Join-Path $PSScriptRoot "start-phase15-api.ps1") `
  -RedirectStandardOutput $apiLog `
  -RedirectStandardError $apiErr `
  -PassThru

try {
  Start-Sleep -Seconds 12
  foreach ($port in $workerPorts) {
    Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/v1/health" -UseBasicParsing | Out-Null
  }

  $env:PATH = "$nodeDir;$env:PATH"
  $env:LOAD_BASE_URLS = (($workerPorts | ForEach-Object { "http://host.docker.internal:$_" }) -join ",")
  $env:PHASE15_AUTH_USERNAME = "admin@amdox.dev"
  $env:PHASE15_AUTH_PASSWORD = "Admin@123456"
  $env:PHASE15_TENANT_ID = "tenant-1"

  & (Join-Path $PSScriptRoot "run-k6.ps1")
  exit $LASTEXITCODE
} finally {
  if ($api -and -not $api.HasExited) {
    Stop-Process -Id $api.Id -Force
  }
  if (Test-Path $workerPidFile) {
    try {
      $workerPids = Get-Content $workerPidFile | ConvertFrom-Json
      foreach ($pidValue in $workerPids) {
        Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
      }
    } catch {
      # Ignore malformed pid files during cleanup.
    }
    Remove-Item -LiteralPath $workerPidFile -Force -ErrorAction SilentlyContinue
  }
}
