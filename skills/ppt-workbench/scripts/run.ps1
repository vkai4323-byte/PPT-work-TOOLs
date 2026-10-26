$ErrorActionPreference='Stop'
$runtime=Get-Content -LiteralPath (Join-Path (Split-Path $PSScriptRoot) 'runtime.json') -Raw -Encoding UTF8 | ConvertFrom-Json
& $runtime.node (Join-Path $PSScriptRoot 'run.mjs') @args
exit $LASTEXITCODE
