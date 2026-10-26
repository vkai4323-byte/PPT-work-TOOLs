param([string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'PPTWorkbench'))
$ErrorActionPreference='Stop'
$runtimeRoot=Join-Path $InstallRoot '0.1.0'
$request=Get-Content -LiteralPath (Join-Path $runtimeRoot 'install-request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$previousBrowsers=$env:PLAYWRIGHT_BROWSERS_PATH
try {
  $env:PLAYWRIGHT_BROWSERS_PATH=$request.browsers
  & $request.node (Join-Path $runtimeRoot 'tools\smoke.mjs')
  if($LASTEXITCODE -ne 0) { throw 'PPT verification failed.' }
  & $request.node (Join-Path $runtimeRoot 'tools\verify-registration.mjs') (Join-Path $runtimeRoot 'install-request.json')
  if($LASTEXITCODE -ne 0) { throw 'Codex registration verification failed.' }
} finally {
  if($null -eq $previousBrowsers) {Remove-Item Env:PLAYWRIGHT_BROWSERS_PATH -ErrorAction SilentlyContinue} else {$env:PLAYWRIGHT_BROWSERS_PATH=$previousBrowsers}
}
