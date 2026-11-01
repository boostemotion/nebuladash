# NebulaDash 本地启动脚本（Windows）。
# -Check 只做环境检查，不启动 dev server。
param(
  [switch]$Check
)

$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

Write-Host '[1/4] Checking Node.js...'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[ERROR] Node.js not found. NebulaDash (Zashboard 3.x base) needs Node.js 22+.'
  exit 1
}

$nodeVersion = (node --version).TrimStart('v')
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 22) {
  Write-Host "[ERROR] Node.js $nodeVersion is too old. Please install Node.js 22 or newer."
  exit 1
}

Write-Host '[2/4] Ensuring dependencies are installed...'
if (-not (Test-Path -LiteralPath 'node_modules')) {
  corepack pnpm install
}

if ($Check) {
  Write-Host "[CHECK] Node.js $nodeVersion, pnpm $(corepack pnpm --version) - environment looks good."
  exit 0
}

Write-Host '[3/4] Opening browser...'
Start-Process 'http://localhost:5173'

Write-Host '[4/4] Starting dev server...'
corepack pnpm dev
