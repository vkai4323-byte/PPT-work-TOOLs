param([string]$RuntimeRoot, [string]$UserHome, [string]$PythonCommand = 'python')
$ErrorActionPreference = 'Stop'
$moduleRoot = Join-Path $RuntimeRoot 'modules/creator-workflow'
$python = Get-Command $PythonCommand -ErrorAction SilentlyContinue
$pythonPath=$null
if ($python -and $python.Source -notlike '*WindowsApps*') {
  & $python.Source -c "import sys; raise SystemExit(0 if sys.version_info[:3] == (3,13,17) else 1)"
  if ($LASTEXITCODE -eq 0) { $pythonPath=$python.Source }
}
if (-not $pythonPath) { $pythonPath=& (Join-Path $PSScriptRoot 'bootstrap-runtime.ps1') -RuntimeRoot $RuntimeRoot -Component python }
$officecli=& (Join-Path $PSScriptRoot 'bootstrap-runtime.ps1') -RuntimeRoot $RuntimeRoot -Component officecli
[IO.File]::WriteAllText((Join-Path $RuntimeRoot 'workflow-tools.json'), (@{pythonBase=$pythonPath;officecli=$officecli} | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
$venv = Join-Path $RuntimeRoot 'workflow-python'
if (Test-Path -LiteralPath (Join-Path $venv 'Scripts/python.exe')) {
  & (Join-Path $venv 'Scripts/python.exe') -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3,13) else 1)"
  if ($LASTEXITCODE -ne 0) {
    $resolvedRoot=[IO.Path]::GetFullPath($RuntimeRoot)+[IO.Path]::DirectorySeparatorChar
    $resolvedVenv=[IO.Path]::GetFullPath($venv)
    $backup=[IO.Path]::GetFullPath((Join-Path $RuntimeRoot ('workflow-backups/python-'+[Guid]::NewGuid().ToString('N'))))
    if (-not $resolvedVenv.StartsWith($resolvedRoot,[StringComparison]::OrdinalIgnoreCase) -or -not $backup.StartsWith($resolvedRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected environment backup path.' }
    New-Item -ItemType Directory -Path (Split-Path $backup) -Force | Out-Null
    Move-Item -LiteralPath $resolvedVenv -Destination $backup
  }
}
if (-not (Test-Path -LiteralPath (Join-Path $venv 'Scripts/python.exe'))) {
  & $pythonPath -m venv $venv
  if ($LASTEXITCODE -ne 0) { throw 'Workflow Python environment creation failed.' }
}
$runtimePython = Join-Path $venv 'Scripts/python.exe'
& $runtimePython -m pip --isolated install --disable-pip-version-check --index-url https://pypi.org/simple --only-binary=:all: --require-hashes -r (Join-Path $moduleRoot 'build-requirements.lock')
if ($LASTEXITCODE -ne 0) { throw 'Fixed Python build tools failed.' }
# qrcode-terminal is a small pure-Python source release. Its source hash and
# build tools are fixed; all other dependencies use official prebuilt wheels.
& $runtimePython -m pip --isolated install --disable-pip-version-check --index-url https://pypi.org/simple --only-binary=:all: --no-binary=qrcode-terminal --no-build-isolation --require-hashes -r (Join-Path $moduleRoot 'requirements-pypi-win-py313.lock')
if ($LASTEXITCODE -ne 0) { throw 'Workflow Python dependencies failed.' }
& $runtimePython (Join-Path $RuntimeRoot 'tools/workflow_doctor.py') $moduleRoot --officecli $officecli
if ($LASTEXITCODE -ne 0) { throw 'Workflow integrity check failed.' }
$destination = Join-Path $UserHome '.agents/skills/workbench-creators'
if (Test-Path -LiteralPath $destination) {
  if (-not (Test-Path -LiteralPath (Join-Path $destination '.workbench-creators-managed'))) {
    throw 'Unmanaged workbench-creators skill exists; original retained.'
  }
  $backup = Join-Path $RuntimeRoot ('workflow-backups/' + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  Copy-Item -LiteralPath $destination -Destination $backup -Recurse
}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $RuntimeRoot 'skills/workbench-creators/SKILL.md') -Destination (Join-Path $destination 'SKILL.md') -Force
Copy-Item -LiteralPath (Join-Path $RuntimeRoot 'skills/workbench-creators/references') -Destination $destination -Recurse -Force
[IO.File]::WriteAllText((Join-Path $destination 'runtime.json'), (@{root=$moduleRoot;python=$runtimePython} | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $destination '.workbench-creators-managed'), '1')
Write-Host 'Creator sources and dependencies installed. Browser authorization and platform validation remain separate.'
& (Join-Path $PSScriptRoot 'install-browser.ps1') -RuntimeRoot $RuntimeRoot
