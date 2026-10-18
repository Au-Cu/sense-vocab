$ErrorActionPreference = "Stop"
if ($args.Count -lt 1) { throw "An executable is required." }
$executable = $args[0]
$commandArgs = @($args | Select-Object -Skip 1)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class VerificationAwakeLease {
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern uint SetThreadExecutionState(uint flags);
}
'@

# Prevent idle system sleep, not display sleep; the assertion dies with this process.
if ([VerificationAwakeLease]::SetThreadExecutionState([UInt32]2147483649) -eq 0) {
  throw "Unable to acquire a temporary verification power assertion."
}
$exitCode = 1
try {
  & $executable @commandArgs
  $exitCode = $LASTEXITCODE
} finally {
  [void][VerificationAwakeLease]::SetThreadExecutionState([UInt32]2147483648)
}
exit $exitCode
