# Push current repo: git add -A, commit if needed, push to origin (current branch).
# First-time setup without remote: see GITHUB_UPLOAD.md
# Usage: .\push-to-github.ps1  OR  .\push-to-github.ps1 -Message "your message"

param(
  [string]$Message = "chore: sync local changes"
)

$ErrorActionPreference = "Stop"

function Get-GitExe {
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @(
      "C:\Program Files\Git\bin\git.exe",
      "C:\Program Files (x86)\Git\bin\git.exe"
    )) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

$git = Get-GitExe
if (-not $git) {
  Write-Host "Git not found. Install Git for Windows or add it to PATH." -ForegroundColor Red
  exit 1
}

Set-Location $PSScriptRoot

Write-Host "Using: $git" -ForegroundColor DarkGray
Write-Host "Checking remotes..." -ForegroundColor Cyan
$remotes = & $git remote 2>$null
if (-not $remotes) {
  Write-Host "No remote configured. Add origin first (see GITHUB_UPLOAD.md)." -ForegroundColor Yellow
  Write-Host "Example: git remote add origin https://github.com/USER/all-view-front.git" -ForegroundColor White
  exit 1
}

Write-Host ""
Write-Host "git add -A" -ForegroundColor Cyan
& $git add -A

$porcelain = & $git status --porcelain
if ($porcelain) {
  Write-Host "git commit ..." -ForegroundColor Cyan
  & $git commit -m $Message
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed. Set user: git config user.name / user.email" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}
else {
  Write-Host "Nothing to commit." -ForegroundColor Yellow
}

$branch = [string](& $git branch --show-current)
$branch = $branch.Trim()
if (-not $branch) {
  Write-Host "Could not detect current branch." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "git push -u origin $branch" -ForegroundColor Cyan
& $git push -u origin $branch
if ($LASTEXITCODE -ne 0) {
  Write-Host "Push failed. Try: gh auth login (HTTPS) or check credentials." -ForegroundColor Yellow
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Done: pushed to origin/$branch" -ForegroundColor Green
