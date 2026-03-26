#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ReleaseRoot,

    [Parameter(Mandatory = $false)]
    [int]$TimeoutSeconds = 120
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedReleaseRoot = (Resolve-Path $ReleaseRoot).Path
$desktopExe = Join-Path $resolvedReleaseRoot "elms-desktop.exe"

if (-not (Test-Path $desktopExe -PathType Leaf)) {
    throw ("Desktop executable not found at {0}" -f $desktopExe)
}

$healthUri = "http://127.0.0.1:7854/api/health"
$pollIntervalMs = 2000
$startTime = Get-Date
$desktopProcess = $null

try {
    Write-Host ("Starting desktop executable: {0}" -f $desktopExe)
    $desktopProcess = Start-Process -FilePath $desktopExe -PassThru -WindowStyle Hidden

    while ($true) {
        if ($desktopProcess.HasExited) {
            throw ("Desktop process exited early with code {0}" -f $desktopProcess.ExitCode)
        }

        $elapsedSeconds = ((Get-Date) - $startTime).TotalSeconds
        if ($elapsedSeconds -ge $TimeoutSeconds) {
            throw ("Desktop runtime health check timed out after {0} seconds" -f $TimeoutSeconds)
        }

        try {
            $response = Invoke-WebRequest -Uri $healthUri -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200 -and $response.Content -match '"ok"\s*:\s*true') {
                Write-Host ("Desktop runtime smoke check passed at {0}" -f $healthUri)
                break
            }
        } catch {
            # Service may still be booting; continue polling until timeout.
        }

        Start-Sleep -Milliseconds $pollIntervalMs
    }
} finally {
    if ($desktopProcess -and -not $desktopProcess.HasExited) {
        Write-Host ("Stopping desktop process (PID={0})" -f $desktopProcess.Id)
        Stop-Process -Id $desktopProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
