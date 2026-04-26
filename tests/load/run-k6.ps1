$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scenario = Join-Path $scriptDir "api-mixed.js"

$k6 = Get-Command k6 -ErrorAction SilentlyContinue
if ($k6) {
  & $k6.Source run $scenario
  exit $LASTEXITCODE
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Error "k6 is not installed and Docker is unavailable. Install k6 or start Docker Desktop to run tests/load/api-mixed.js."
}

& $docker.Source info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker is installed but the daemon is not running. Start Docker Desktop or install k6 to run the load suite."
}

$envArgs = @()
foreach ($name in @(
  "LOAD_BASE_URLS",
  "LOAD_BASE_URL",
  "LOAD_AUTH_USERNAME",
  "LOAD_AUTH_PASSWORD",
  "LOAD_TENANT_ID",
  "LOAD_TARGET_VUS",
  "LOAD_RAMP_UP",
  "LOAD_HOLD",
  "LOAD_RAMP_DOWN",
  "PHASE15_AUTH_USERNAME",
  "PHASE15_AUTH_PASSWORD",
  "PHASE15_TENANT_ID",
  "PHASE12_AUTH_USERNAME",
  "PHASE12_AUTH_PASSWORD"
)) {
  if (Test-Path "Env:$name") {
    $envArgs += "-e"
    $envArgs += "${name}=$((Get-Item "Env:$name").Value)"
  }
}

& $docker.Source run --rm -i -v "${scriptDir}:/scripts" @envArgs grafana/k6 run /scripts/api-mixed.js
exit $LASTEXITCODE
