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

function Get-ScanTargets {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root,
    [switch]$DockerStyle
  )

  $relativeTargets = @(
    "apps/api/src"
    "apps/api/test"
    "apps/web/app"
    "apps/web/src"
    "apps/web/tests"
    "infra/keycloak"
    "package.json"
    "packages/db/prisma"
    "packages/db/src"
    "packages/ui/src"
    "scripts"
    ".env.example"
  )

  foreach ($relativeTarget in $relativeTargets) {
    if ($DockerStyle) {
      "/pwd/$($relativeTarget -replace '\\', '/')"
      continue
    }

    Join-Path $Root $relativeTarget
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$excludePaths = Join-Path $PSScriptRoot "trufflehog-exclude.txt"

Clear-BrokenProxyEnvironment

Write-Host "Running trufflehog secrets scan against active repository paths"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker -and $IsWindows) {
  $dockerArguments = @(
    "run"
    "--rm"
    "-v"
    ("{0}:/pwd" -f $repoRoot.Path)
    "trufflesecurity/trufflehog:latest"
    "filesystem"
  )

  $dockerArguments += Get-ScanTargets -Root $repoRoot.Path -DockerStyle
  $dockerArguments += @(
    "--fail"
    "--fail-on-scan-errors"
    "--json"
    "--results=verified,unverified,unknown"
    "--no-verification"
    "--no-update"
    "--force-skip-binaries"
    "--force-skip-archives"
    "--exclude-paths=/pwd/scripts/security/trufflehog-exclude.txt"
  )

  & $docker.Source @dockerArguments
  exit $LASTEXITCODE
}

$localTrufflehog = Join-Path $PSScriptRoot "bin\trufflehog.exe"
$trufflehogPath = if (Test-Path $localTrufflehog) {
  $localTrufflehog
} else {
  (Get-Command trufflehog -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
}

if (-not $trufflehogPath) {
  Write-Error "trufflehog is not installed or not on PATH. Install it first, then rerun this script."
}

$arguments = @(
  "filesystem"
)

$arguments += Get-ScanTargets -Root $repoRoot.Path
$arguments += @(
  "--fail"
  "--fail-on-scan-errors"
  "--json"
  "--results=verified,unverified,unknown"
  "--no-verification"
  "--no-update"
  "--force-skip-binaries"
  "--force-skip-archives"
)

if (Test-Path $excludePaths) {
  $arguments += "--exclude-paths=$excludePaths"
}

& $trufflehogPath @arguments
exit $LASTEXITCODE
