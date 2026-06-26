param(
  [switch]$Check
)

$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

Write-Host '[1/4] Checking Node.js...'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[ERROR] Node.js not found. Please install Node.js 20+ first.'
  exit 1
}

Write-Host '[2/4] Ensuring dependencies are installed...'
if (-not (Test-Path -LiteralPath 'node_modules')) {
  corepack pnpm install
}

if ($Check) {
  Write-Host '[CHECK] Environment looks good.'
  exit 0
}

Write-Host '[3/4] Opening browser...'
Start-Process 'http://localhost:5173'

Write-Host '[4/4] Starting dev server...'
corepack pnpm dev
