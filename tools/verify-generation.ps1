param([Parameter(Mandatory=$true)][string]$RuntimeRoot)
$ErrorActionPreference='Stop'
$python=Join-Path $RuntimeRoot 'workflow-python/Scripts/python.exe'
$module=Join-Path $RuntimeRoot 'modules/generation'
foreach($file in @('slot_jobs.py','providers.py','setup_provider.py','plan.py','resume.py','run.py')) {
  if (-not (Test-Path -LiteralPath (Join-Path $module $file))) {throw ('Missing generation entry: '+$file)}
}
# Only parse syntax. Do not import a provider, touch a credential, or probe a network service.
& $python -c "import ast,pathlib,sys; [ast.parse(p.read_text(encoding='utf-8')) for p in pathlib.Path(sys.argv[1]).glob('*.py')]; print('Generation entry syntax verified; no live provider or credential loaded.')" $module
if ($LASTEXITCODE -ne 0) {throw 'Generation offline verification failed.'}
Write-Host 'Live provider binding and generation remain separately verified capabilities.'
