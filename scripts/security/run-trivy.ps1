$ErrorActionPreference = "Stop"

function Clear-BrokenProxyEnvironment {
  $proxyKeys = @("ALL_PROXY", "HTTP_PROXY", "HTTPS_PROXY", "GIT_HTTP_PROXY", "GIT_HTTPS_PROXY")
  foreach ($key in $proxyKeys) {
    $value = [System.Environment]::GetEnvironmentVariable($key)
    if ($value -and $value -match "127\.0\.0\.1:9") {
      [System.Environment]::SetEnvironmentVariable($key, $null)
      Remove-Item "Env:$key" -ErrorAction SilentlyContinue
    }
  }
}

$localWingetLink = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\trivy.exe"
$trivy = if (Test-Path $localWingetLink) {
  Get-Item $localWingetLink
} else {
  Get-Command trivy -ErrorAction SilentlyContinue
}

if (-not $trivy) {
  Write-Error "Trivy CLI is not installed or not on PATH. Install Trivy first, then rerun this script."
}

Clear-BrokenProxyEnvironment
$cacheDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")) ".cache\trivy"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

& $trivy.FullName fs `
  --cache-dir $cacheDir `
  --scanners vuln `
  --timeout 10m `
  --skip-dirs apps/ml-service/.venv `
  --skip-dirs legacy `
  --skip-dirs node_modules `
  --skip-dirs .next `
  --skip-dirs dist `
  --skip-dirs coverage `
  --skip-dirs test-results `
  --exit-code 1 `
  --severity HIGH,CRITICAL `
  --ignorefile .trivyignore.yaml `
  .
exit $LASTEXITCODE
