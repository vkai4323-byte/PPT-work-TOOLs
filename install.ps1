param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'PPTWorkbench'),
  [string]$UserHome = $env:USERPROFILE,
  [string]$CodexProfile = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }),
  [string]$BrowserCache = '',
  [switch]$RuntimeOnly
)
$ErrorActionPreference = 'Stop'
$sourceRoot = $PSScriptRoot
$runtimeRoot = Join-Path ([IO.Path]::GetFullPath($InstallRoot)) '0.3.0'
$InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
$browserRoot = if ($BrowserCache) { [IO.Path]::GetFullPath($BrowserCache) } else { Join-Path $InstallRoot 'browsers' }
if (-not [Environment]::Is64BitOperatingSystem) { throw 'This package requires Windows x64.' }
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
foreach ($name in @('src','tools','skills','docs')) {
  $from = Join-Path $sourceRoot $name
  $to = Join-Path $runtimeRoot $name
  if ([IO.Path]::GetFullPath($from) -ne [IO.Path]::GetFullPath($to)) {
    New-Item -ItemType Directory -Path $to -Force | Out-Null
    Get-ChildItem -LiteralPath $from -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $to -Recurse -Force }
  }
}
foreach ($name in @('package.json','package-lock.json','PROVENANCE.json','README.md','验收说明.md')) {
  if ((Join-Path $sourceRoot $name) -ne (Join-Path $runtimeRoot $name)) { Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination (Join-Path $runtimeRoot $name) -Force }
}
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }
$goodNode = $false
if ($nodePath) {
  $nodeVersionText = & $nodePath --version
  if ($LASTEXITCODE -eq 0 -and $nodeVersionText -match '^v(\d+)\.(\d+)\.') {
    $goodNode = ([int]$Matches[1] -gt 22 -or ([int]$Matches[1] -eq 22 -and [int]$Matches[2] -ge 12))
  }
}
if (-not $goodNode) {
  $nodeVersion = '24.14.0'
  $nodeDir = Join-Path $InstallRoot ('node-v' + $nodeVersion + '-win-x64')
  $nodePath = Join-Path $nodeDir 'node.exe'
  if (-not (Test-Path -LiteralPath $nodePath)) {
    $archiveName = 'node-v' + $nodeVersion + '-win-x64.zip'
    $archivePath = Join-Path $InstallRoot $archiveName
    $baseUrl = 'https://nodejs.org/dist/v' + $nodeVersion
    Write-Host '[1/5] Downloading pinned Node runtime...'
    Invoke-WebRequest -Uri ($baseUrl + '/' + $archiveName) -OutFile $archivePath -UseBasicParsing
    $sums = (Invoke-WebRequest -Uri ($baseUrl + '/SHASUMS256.txt') -UseBasicParsing).Content
    $line = ($sums -split "`n") | Where-Object { $_.Trim().EndsWith('  ' + $archiveName) }
    if (-not $line) { throw 'Node archive checksum entry missing.' }
    $expected = ($line.Trim() -split '\s+')[0]
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected.ToLowerInvariant()) { throw 'Node checksum mismatch.' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $InstallRoot -Force
  }
}
$npmCli = Join-Path (Split-Path $nodePath) 'node_modules\npm\bin\npm-cli.js'
if (-not (Test-Path -LiteralPath $npmCli)) { throw 'npm runtime is missing beside node.exe. Install a complete Node.js 22.12+ distribution.' }
$previousPath = $env:PATH
$previousBrowsers = $env:PLAYWRIGHT_BROWSERS_PATH
try {
  $env:PATH = (Split-Path $nodePath) + ';' + $env:PATH
  $env:PLAYWRIGHT_BROWSERS_PATH = $browserRoot
  Push-Location $runtimeRoot
  try {
    Write-Host '[2/5] Installing locked dependencies...'
    & $nodePath $npmCli ci --omit=dev --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    Write-Host '[3/5] Installing Chromium...'
    & $nodePath (Join-Path $runtimeRoot 'node_modules\playwright\cli.js') install chromium
    if ($LASTEXITCODE -ne 0) { throw 'Chromium installation failed.' }
    Write-Host '[4/5] Checking native PPTX export and error detection...'
    & $nodePath (Join-Path $runtimeRoot 'tools\smoke.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'PPT smoke test failed; Codex configuration was not changed.' }
    $request = @{runtimeRoot=$runtimeRoot;node=$nodePath;browsers=$browserRoot;userHome=[IO.Path]::GetFullPath($UserHome);codexHome=[IO.Path]::GetFullPath($CodexProfile)}
    $requestFile = Join-Path $runtimeRoot 'install-request.json'
    [IO.File]::WriteAllText($requestFile,($request | ConvertTo-Json),[Text.UTF8Encoding]::new($false))
    if (-not $RuntimeOnly) {
      Write-Host '[5/5] Registering user-level Codex tools and skill...'
      & $nodePath (Join-Path $runtimeRoot 'tools\configure.mjs') $requestFile
      if ($LASTEXITCODE -ne 0) { throw 'Codex registration failed.' }
      & $nodePath (Join-Path $runtimeRoot 'tools\verify-registration.mjs') $requestFile
      if ($LASTEXITCODE -ne 0) { throw 'Configuration was written, but fresh MCP sessions failed. See error above; backups are in ppt-workbench-backups.' }
    }
  } finally { Pop-Location }
} finally {
  $env:PATH = $previousPath
  if ($null -eq $previousBrowsers) { Remove-Item Env:PLAYWRIGHT_BROWSERS_PATH -ErrorAction SilentlyContinue } else { $env:PLAYWRIGHT_BROWSERS_PATH=$previousBrowsers }
}
if ($RuntimeOnly) { Write-Host 'Runtime installed. Codex configuration was not changed.' }
else { Write-Host 'Installed. Restart Codex and open a new chat; invoke $ppt-workbench for the first task.' }
