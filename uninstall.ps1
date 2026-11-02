param([string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'PPTWorkbench'))
$ErrorActionPreference='Stop'
$runtimeRoot=Join-Path $InstallRoot '0.4.0-dev'
$requestFile=Join-Path $runtimeRoot 'install-request.json'
$request=Get-Content -LiteralPath $requestFile -Raw -Encoding UTF8 | ConvertFrom-Json
& (Join-Path $runtimeRoot 'tools/disable-workflow.ps1') -RuntimeRoot $runtimeRoot -UserHome $request.userHome
& $request.node (Join-Path $runtimeRoot 'tools\unconfigure.mjs') $requestFile
if ($LASTEXITCODE -ne 0) { throw 'Could not remove managed configuration; inspect the reported error.' }
Write-Host 'Disabled. Runtime and all user PPT projects are preserved. Restart Codex.'
