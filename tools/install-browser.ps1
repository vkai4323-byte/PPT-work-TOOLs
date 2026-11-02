param([Parameter(Mandatory=$true)][string]$RuntimeRoot)
$ErrorActionPreference='Stop'
$binary=& (Join-Path $PSScriptRoot 'bootstrap-runtime.ps1') -RuntimeRoot $RuntimeRoot -Component webbridge
# Windows PowerShell 5 turns native stderr into terminating NativeCommandError
# under Stop. Read JSON stdout separately; diagnostics are not a failed protocol.
function Invoke-BridgeCommand([string]$Action) {
$processInfo=New-Object Diagnostics.ProcessStartInfo
$processInfo.FileName=$binary
$processInfo.Arguments=$Action
$processInfo.UseShellExecute=$false
$processInfo.CreateNoWindow=$true
$processInfo.RedirectStandardOutput=$true
$processInfo.RedirectStandardError=$true
$statusProcess=New-Object Diagnostics.Process
$statusProcess.StartInfo=$processInfo
[void]$statusProcess.Start()
$stdoutTask=$statusProcess.StandardOutput.ReadToEndAsync()
$stderrTask=$statusProcess.StandardError.ReadToEndAsync()
if (-not $statusProcess.WaitForExit(30000)) { $statusProcess.Kill();throw ('WebBridge '+$Action+' timed out.') }
$statusText=$stdoutTask.GetAwaiter().GetResult()
[void]$stderrTask.GetAwaiter().GetResult()
if ($statusProcess.ExitCode -ne 0) {throw ('WebBridge '+$Action+' command failed.')}
return $statusText
}
$statusText=Invoke-BridgeCommand 'status'
try { $status=$statusText | ConvertFrom-Json } catch { throw 'WebBridge status protocol is unreadable.' }
if (-not $status.running) {
  # Idempotent start only. Never stop or replace an existing shared daemon.
  Invoke-BridgeCommand 'start' | Out-Host
}
$python=Join-Path $RuntimeRoot 'workflow-python/Scripts/python.exe'
& $python (Join-Path $RuntimeRoot 'modules/creator-workflow/scripts/browser_preflight.py') --binary $binary --output (Join-Path $RuntimeRoot 'browser-onboarding.json')
if ($LASTEXITCODE -ne 0) { throw 'Browser onboarding check failed.' }
Write-Host 'Browser onboarding state recorded; inspect customer_action_required or engineering_pending before platform tasks.'
