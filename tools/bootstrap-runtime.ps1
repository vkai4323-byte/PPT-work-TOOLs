param([Parameter(Mandatory=$true)][string]$RuntimeRoot, [ValidateSet('python','officecli','webbridge')][string]$Component, [switch]$DownloadOnly)
$ErrorActionPreference='Stop'
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'This bootstrap targets Windows x64.' }
$lock=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'bootstrap-lock.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$entry=$lock.$Component
$cache=Join-Path $RuntimeRoot 'bootstrap-cache'
New-Item -ItemType Directory -Path $cache -Force | Out-Null
$filename=[IO.Path]::GetFileName(([Uri]$entry.url).AbsolutePath)
$archive=Join-Path $cache $filename
if (-not (Test-Path -LiteralPath $archive)) {
  $temp=$archive+'.'+[Guid]::NewGuid().ToString('N')+'.partial'
  Invoke-WebRequest -Uri $entry.url -OutFile $temp -UseBasicParsing -TimeoutSec 180
  if ((Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw 'Bootstrap download hash mismatch.' }
  Move-Item -LiteralPath $temp -Destination $archive
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw 'Bootstrap cache hash mismatch.' }
if ($DownloadOnly) { return $archive }
$directory=Join-Path $RuntimeRoot ('managed-tools/'+$Component+'-'+$entry.version)
$exeName=if($Component -eq 'python') {'python.exe'} elseif($Component -eq 'webbridge') {'kimi-webbridge.exe'} else {'officecli.exe'}
$exe=Join-Path $directory $exeName
if (-not (Test-Path -LiteralPath $exe)) {
  if (Test-Path -LiteralPath $directory) { throw 'Incomplete runtime directory retained; inspect before retry.' }
  $stage=$directory+'.stage-'+[Guid]::NewGuid().ToString('N')
  New-Item -ItemType Directory -Path $stage -Force | Out-Null
  if ($Component -eq 'python') { Expand-Archive -LiteralPath $archive -DestinationPath $stage }
  else { Copy-Item -LiteralPath $archive -Destination (Join-Path $stage $exeName) }
  Move-Item -LiteralPath $stage -Destination $directory
}
if ($Component -eq 'webbridge') {
  $help=& $exe --help
  if ($LASTEXITCODE -ne 0 -or ($help -join "`n") -notmatch 'kimi-webbridge') { throw 'WebBridge executable check failed.' }
} else {
  $version=& $exe --version
  if ($LASTEXITCODE -ne 0 -or $version -notmatch [regex]::Escape($entry.version)) { throw 'Managed executable version check failed.' }
}
if ($Component -ne 'python' -and (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw 'Managed binary hash mismatch.' }
return $exe
