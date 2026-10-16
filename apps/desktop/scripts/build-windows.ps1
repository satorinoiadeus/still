$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run desktop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Find the installer in src-tauri/target/release/bundle/nsis/'
