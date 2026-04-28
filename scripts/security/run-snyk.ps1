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

$localWingetLink = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\snyk-win.exe"
$snyk = if (Test-Path $localWingetLink) {
  Get-Item $localWingetLink
} else {
  Get-Command snyk -ErrorAction SilentlyContinue
}

if (-not $snyk) {
  Write-Error "Snyk CLI is not installed or not on PATH. Install Snyk first, then rerun this script."
}

Clear-BrokenProxyEnvironment

if (-not $env:SNYK_TOKEN) {
  Write-Error "SNYK_TOKEN is not set in this shell. Export a valid token or run 'snyk auth' before rerunning the local Snyk gate."
}

& $snyk.FullName test --all-projects --exclude=legacy,apps/ml-service --severity-threshold=high --policy-path=.snyk
exit $LASTEXITCODE
