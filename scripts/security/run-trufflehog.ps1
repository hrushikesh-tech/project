$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$includePaths = Join-Path $PSScriptRoot "trufflehog-include.txt"
$excludePaths = Join-Path $PSScriptRoot "trufflehog-exclude.txt"
$localTrufflehog = Join-Path $PSScriptRoot "bin\trufflehog.exe"
$trufflehog = if (Test-Path $localTrufflehog) {
  Get-Item $localTrufflehog
} else {
  Get-Command trufflehog -ErrorAction SilentlyContinue
}

if (-not $trufflehog) {
  Write-Error "trufflehog is not installed or not on PATH. Install it first, then rerun this script."
}

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  Write-Error "git is required to enumerate tracked files for the local secrets scan."
}

$includePatterns = @()
if (Test-Path $includePaths) {
  $includePatterns = Get-Content -Path $includePaths |
    Where-Object { $_ -and -not $_.TrimStart().StartsWith("#") }
}

$excludePatterns = @()
if (Test-Path $excludePaths) {
  $excludePatterns = Get-Content -Path $excludePaths |
    Where-Object { $_ -and -not $_.TrimStart().StartsWith("#") }
}

$trackedFiles = & $git.Source -C $repoRoot ls-files
if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to enumerate tracked files with git ls-files."
}

$scanTargets = foreach ($relativePath in $trackedFiles) {
  $normalizedPath = $relativePath -replace "\\", "/"
  $isIncluded = $includePatterns.Count -eq 0
  foreach ($pattern in $includePatterns) {
    if ($normalizedPath -match $pattern) {
      $isIncluded = $true
      break
    }
  }

  if (-not $isIncluded) {
    continue
  }

  $isExcluded = $false
  foreach ($pattern in $excludePatterns) {
    if ($normalizedPath -match $pattern) {
      $isExcluded = $true
      break
    }
  }

  if ($isExcluded) {
    continue
  }

  Join-Path $repoRoot $relativePath
}

if (-not $scanTargets -or $scanTargets.Count -eq 0) {
  Write-Host "No tracked files matched the secrets scan scope."
  exit 0
}

$findingFiles = New-Object System.Collections.Generic.List[string]
$scanErrors = New-Object System.Collections.Generic.List[string]
$previousErrorActionPreference = $ErrorActionPreference
$previousNativePreference = $null
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $previousNativePreference = $PSNativeCommandUseErrorActionPreference
  $global:PSNativeCommandUseErrorActionPreference = $false
}
$ErrorActionPreference = "Continue"

Write-Host "Running trufflehog secrets scan against $($scanTargets.Count) tracked files"

foreach ($path in $scanTargets) {
  if (-not (Test-Path -LiteralPath $path)) {
    continue
  }

  $invokeScan = {
    & $trufflehog.FullName filesystem $path `
      --fail `
      --json `
      --results=verified,unverified,unknown `
      --no-verification `
      --no-update `
      --force-skip-binaries `
      --force-skip-archives
    return $LASTEXITCODE
  }

  $exitCode = & $invokeScan

  if ($exitCode -ne 0 -and $exitCode -ne 183) {
    Start-Sleep -Milliseconds 200
    $exitCode = & $invokeScan
  }

  if ($exitCode -eq 183) {
    $findingFiles.Add($path) | Out-Null
    continue
  }

  if ($exitCode -ne 0) {
    $scanErrors.Add($path) | Out-Null
    Write-Warning "trufflehog scan error in $path"
  }
}

$ErrorActionPreference = $previousErrorActionPreference
if ($null -ne $previousNativePreference) {
  $global:PSNativeCommandUseErrorActionPreference = $previousNativePreference
}

if ($scanErrors.Count -gt 0) {
  Write-Error ("trufflehog encountered scan errors in {0} file(s)." -f $scanErrors.Count)
}

if ($findingFiles.Count -gt 0) {
  Write-Host ("trufflehog found potential secrets in {0} file(s)." -f $findingFiles.Count)
  $findingFiles | Sort-Object -Unique | ForEach-Object { Write-Host $_ }
  exit 183
}

Write-Host ("trufflehog completed cleanly across {0} tracked files." -f $scanTargets.Count)
