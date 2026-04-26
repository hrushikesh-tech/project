param(
  [Parameter(Mandatory = $true)]
  [int]$Port
)

$ErrorActionPreference = "Stop"

$nodeExe = "C:\Users\91892\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.15.0-win-x64\node.exe"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$apiRoot = Join-Path $projectRoot "apps\api"

Set-Location $apiRoot

$env:DATABASE_URL = "postgresql://root:rootpassword@localhost:5432/amdox_erp"
$env:REDIS_URL = "redis://localhost:6379"
$env:KEYCLOAK_URL = "http://localhost:8080"
$env:KEYCLOAK_REALM = "amdox-erp"
$env:KEYCLOAK_CLIENT_ID = "amdox-api"
$env:KEYCLOAK_CLIENT_SECRET = "amdox-api-dev-secret"
$env:AUTH_SECRET = "phase15-local-test-secret"
$env:AUTH_MAX_CONCURRENT_SESSIONS = "10000"
$env:NODE_ENV = "production"
$env:API_DOCS_ENABLED = "false"
$env:PERF_VALIDATION_MODE = "true"
$env:CLUSTER_WORKERS = "1"
$env:UV_THREADPOOL_SIZE = "64"
$env:PORT_API = "$Port"
$env:SECURITY_RATE_LIMIT_ENABLED = "false"
$env:AUTH_TOKEN_BLACKLIST_ENABLED = "false"

& $nodeExe "dist/src/main.js"
