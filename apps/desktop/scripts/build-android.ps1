$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not (Test-Path 'src-tauri/gen/android')) {
  npm run android:init
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
npm run android:build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Find the debug APK below src-tauri/gen/android/app/build/outputs/apk/'
