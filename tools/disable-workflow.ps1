param([Parameter(Mandatory=$true)][string]$RuntimeRoot, [Parameter(Mandatory=$true)][string]$UserHome)
$ErrorActionPreference='Stop'
$userRoot=[IO.Path]::GetFullPath($UserHome)
$skillRoot=[IO.Path]::GetFullPath((Join-Path $userRoot '.agents/skills'))
$destination=[IO.Path]::GetFullPath((Join-Path $skillRoot 'workbench-creators'))
if (-not $destination.StartsWith(($skillRoot+[IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected skill path.' }
if (-not (Test-Path -LiteralPath $destination)) { Write-Host 'Creator skill already disabled.'; return }
if (-not (Test-Path -LiteralPath (Join-Path $destination '.workbench-creators-managed'))) { throw 'Unmanaged skill retained.' }
$backupRoot=[IO.Path]::GetFullPath((Join-Path $RuntimeRoot 'workflow-backups'))
$backup=[IO.Path]::GetFullPath((Join-Path $backupRoot ('disabled-'+[Guid]::NewGuid().ToString('N'))))
if (-not $backup.StartsWith(($backupRoot+[IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected backup path.' }
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Move-Item -LiteralPath $destination -Destination (Join-Path $backup 'workbench-creators')
Write-Host ('Creator skill disabled; original retained at '+$backup)
