<#
  Runs the whole app on this laptop for the live demo and shows a QR code for the phone.

  The phone and the laptop must be on the same network. The safest: turn on the phone's hotspot
  and connect the laptop to it (venue Wi-Fi often blocks devices from seeing each other).

  Usage (from the repository folder):
    .\run_demo.cmd                 or   powershell -ExecutionPolicy Bypass -File .\run_demo.ps1
    .\run_demo.cmd -Reset          start with the three example fixes again
    .\run_demo.cmd -Build          rebuild the app even if it looks up to date
    .\run_demo.cmd -Port 8080      another port

  Gemini keys for Ask AI: put them in a file named .env next to this script (it is not committed):
    GEMINI_API_KEY=...
    GEMINI_API_KEY_2=...
#>
param(
  [int]$Port = 8000,
  [switch]$Reset,
  [switch]$Build
)
$ErrorActionPreference = "Continue"   # native tools write warnings to stderr; exit codes are checked instead
$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Py = Join-Path $Backend ".venv\Scripts\python.exe"

function Step($text) { Write-Host "`n> $text" -ForegroundColor Cyan }

# 1. Keys from .env (KEY=VALUE lines); variables already set in the shell win.
$EnvFile = Join-Path $Root ".env"
if (Test-Path $EnvFile) {
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$' -and -not $line.TrimStart().StartsWith("#")) {
      $name = $Matches[1]; $value = $Matches[2].Trim('"').Trim("'")
      if (-not [Environment]::GetEnvironmentVariable($name)) { Set-Item "env:$name" $value }
    }
  }
}

# 2. Python environment for the backend.
if (-not (Test-Path $Py)) {
  Step "Creating the Python environment (first run only)"
  $base = if (Get-Command py -ErrorAction SilentlyContinue) { "py" } else { "python" }
  & $base -m venv (Join-Path $Backend ".venv")
  & $Py -m pip install -q -r (Join-Path $Backend "requirements.txt")
  if ($LASTEXITCODE -ne 0) { Write-Host "pip install failed" -ForegroundColor Red; exit 1 }
}
& $Py -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('qrcode') else 1)"
if ($LASTEXITCODE -ne 0) { & $Py -m pip install -q qrcode }

# 3. The phone app, built once and served by the backend.
$Index = Join-Path $Frontend "dist\index.html"
$newestSrc = Get-ChildItem (Join-Path $Frontend "src"), (Join-Path $Frontend "index.html") -Recurse -File |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($Build -or -not (Test-Path $Index) -or $newestSrc.LastWriteTime -gt (Get-Item $Index).LastWriteTime) {
  Step "Building the app"
  Push-Location $Frontend
  try {
    if (-not (Test-Path "node_modules")) { npm install --no-audit --no-fund }
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "npm run build failed" -ForegroundColor Red; exit 1 }
  } finally { Pop-Location }
}

# 4. Where the phone can reach this laptop.
$ips = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
  ForEach-Object { $_.IPv4Address.IPAddress })
if ($ips.Count -eq 0) {
  $ips = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
    ForEach-Object { $_.IPAddress })
}
$Url = if ($ips.Count) { "http://$($ips[0]):$Port" } else { "http://localhost:$Port" }

# 5. Settings for the demo.
$env:DEMO_SEED_ACTIONS = "1"
$env:ACTIONS_DB = Join-Path $Backend "demo-actions.db"
$env:STATIC_DIR = Join-Path $Frontend "dist"
Remove-Item env:ACCESS_KEY -ErrorAction SilentlyContinue      # no access key on the local network
if ($Reset -and (Test-Path $env:ACTIONS_DB)) { Remove-Item $env:ACTIONS_DB }

$Qr = Join-Path $env:TEMP "oee-engine-qr.svg"
& $Py -c "import qrcode, qrcode.image.svg, sys; q = qrcode.QRCode(border=2); q.add_data(sys.argv[1]); q.print_ascii(invert=True); q.make_image(image_factory=qrcode.image.svg.SvgPathFillImage).save(sys.argv[2])" $Url $Qr
Start-Process $Qr

Write-Host ""
Write-Host "  Open on the phone:  $Url" -ForegroundColor Green
if ($ips.Count -gt 1) { Write-Host "  Other addresses:    $(($ips | Select-Object -Skip 1 | ForEach-Object { "http://${_}:$Port" }) -join '   ')" }
Write-Host "  On this laptop:     http://localhost:$Port"
if (-not $env:GEMINI_API_KEY) { Write-Host "  Ask AI is off: no GEMINI_API_KEY (add it to .env)." -ForegroundColor Yellow }
Write-Host "  If Windows asks about Python and the network, allow it. Stop with Ctrl+C."
Write-Host ""

Set-Location $Backend
& $Py -m uvicorn app.main:app --host 0.0.0.0 --port $Port
