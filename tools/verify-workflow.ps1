param([Parameter(Mandatory=$true)][string]$RuntimeRoot, [Parameter(Mandatory=$true)][string]$UserHome)
$ErrorActionPreference='Stop'
$moduleRoot=Join-Path $RuntimeRoot 'modules/creator-workflow'
$python=Join-Path $RuntimeRoot 'workflow-python/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Workflow Python missing.' }
$tools=Get-Content -LiteralPath (Join-Path $RuntimeRoot 'workflow-tools.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not (Test-Path -LiteralPath $tools.officecli)) { throw 'Managed OfficeCLI missing.' }
& $tools.officecli --version
if ($LASTEXITCODE -ne 0) { throw 'Managed OfficeCLI cannot execute.' }
& $python (Join-Path $RuntimeRoot 'tools/workflow_doctor.py') $moduleRoot --officecli $tools.officecli
if ($LASTEXITCODE -ne 0) { throw 'Workflow source/dependency check failed.' }
& $python -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Workflow dependency graph is inconsistent.' }
$skill=Join-Path $UserHome '.agents/skills/workbench-creators'
if (-not (Test-Path -LiteralPath (Join-Path $skill '.workbench-creators-managed'))) { throw 'Creator skill not registered.' }
$runtime=Get-Content -LiteralPath (Join-Path $skill 'runtime.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ([IO.Path]::GetFullPath($runtime.root) -ne [IO.Path]::GetFullPath($moduleRoot)) { throw 'Creator skill points to another runtime.' }
if ([IO.Path]::GetFullPath($runtime.python) -ne [IO.Path]::GetFullPath($python)) { throw 'Creator Python registration mismatch.' }
foreach ($relative in @('SKILL.md','references/generation-rules.md','references/cover-generation.md')) {
  $expected=Join-Path $RuntimeRoot ('skills/workbench-creators/'+$relative)
  $actual=Join-Path $skill $relative
  if (-not (Test-Path -LiteralPath $actual) -or (Get-FileHash -LiteralPath $actual).Hash -ne (Get-FileHash -LiteralPath $expected).Hash) {throw ('Creator skill resource missing or changed: '+$relative)}
}
Write-Host 'Creator files, Python dependencies and registration verified. Platform login and live capture remain separate checks.'
& (Join-Path $PSScriptRoot 'verify-generation.ps1') -RuntimeRoot $RuntimeRoot
