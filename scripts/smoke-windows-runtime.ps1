#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ReleaseRoot,

    [Parameter(Mandatory = $false)]
    [int]$TimeoutSeconds = 240,

    [Parameter(Mandatory = $false)]
    [string]$DiagnosticsDir = "artifacts/windows-runtime-diagnostics"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedReleaseRoot = (Resolve-Path $ReleaseRoot).Path
$desktopExe = Join-Path $resolvedReleaseRoot "elms-desktop.exe"

if (-not (Test-Path $desktopExe -PathType Leaf)) {
    throw ("Desktop executable not found at {0}" -f $desktopExe)
}

$repoRoot = (Get-Location).Path
$resolvedDiagnosticsDir = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $DiagnosticsDir))
if (Test-Path $resolvedDiagnosticsDir) {
    Remove-Item -Path $resolvedDiagnosticsDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $resolvedDiagnosticsDir -Force | Out-Null

$healthUri = "http://127.0.0.1:7854/api/health"
$pollIntervalMs = 2000
$startTime = Get-Date
$desktopProcess = $null
$failureMessage = $null
$fatalPatterns = @(
    "(?i)pg_ctl failed:.*system cannot find the path specified",
    "(?i)initdb failed:.*system cannot find the path specified",
    '(?i)program "postgres" is needed by pg_ctl but was not found',
    '(?i)program "postgres" is needed by initdb but was not found'
)

function Get-DesktopLogRoots {
    $roots = New-Object 'System.Collections.Generic.List[string]'
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

    $candidates = @(
        (Join-Path $env:APPDATA "com.elms.desktop"),
        (Join-Path $env:LOCALAPPDATA "com.elms.desktop"),
        (Join-Path $env:APPDATA "com.elms.desktop.workspace-dev"),
        (Join-Path $env:LOCALAPPDATA "com.elms.desktop.workspace-dev"),
        (Join-Path $env:APPDATA "ELMS"),
        (Join-Path $env:LOCALAPPDATA "ELMS")
    )

    foreach ($candidate in $candidates) {
        if (-not $candidate) {
            continue
        }
        if (Test-Path $candidate -PathType Container) {
            $resolved = (Resolve-Path $candidate).Path
            if ($seen.Add($resolved)) {
                $roots.Add($resolved) | Out-Null
            }
        }
    }

    foreach ($base in @($env:APPDATA, $env:LOCALAPPDATA)) {
        if (-not $base -or -not (Test-Path $base -PathType Container)) {
            continue
        }

        Get-ChildItem -Path $base -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '(?i)elms|com\.elms\.desktop' } |
            ForEach-Object {
                $resolved = $_.FullName
                if ($seen.Add($resolved)) {
                    $roots.Add($resolved) | Out-Null
                }
            }
    }

    return $roots
}

function Get-DesktopLogFiles {
    $files = New-Object 'System.Collections.Generic.List[string]'
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
    $nameMatcher = '^(desktop-bootstrap|postgres|backend(\.stdout|\.stderr)?)\.log$'

    foreach ($root in Get-DesktopLogRoots) {
        $logsDir = Join-Path $root "logs"
        if (Test-Path $logsDir -PathType Container) {
            Get-ChildItem -Path $logsDir -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match $nameMatcher -or $_.Name -like 'backend*.log' } |
                ForEach-Object {
                    if ($seen.Add($_.FullName)) {
                        $files.Add($_.FullName) | Out-Null
                    }
                }
        }
    }

    return $files
}

function Find-FatalBootstrapError {
    foreach ($logFile in Get-DesktopLogFiles) {
        $tail = @()
        try {
            $tail = Get-Content -Path $logFile -Tail 200 -ErrorAction SilentlyContinue
        } catch {
            continue
        }

        foreach ($line in $tail) {
            foreach ($pattern in $fatalPatterns) {
                if ($line -match $pattern) {
                    return ("Detected fatal PostgreSQL bootstrap error in {0}: {1}" -f $logFile, $line)
                }
            }
        }
    }

    return $null
}

function Write-LogTailToConsole {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $false)]
        [int]$Lines = 80
    )

    Write-Host ("----- LOG TAIL: {0} (last {1} lines) -----" -f $Path, $Lines)
    try {
        Get-Content -Path $Path -Tail $Lines -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
    } catch {
        Write-Host ("Unable to read log tail from {0}" -f $Path)
    }
    Write-Host "----- END LOG TAIL -----"
}

function Export-Diagnostics {
    param(
        [Parameter(Mandatory = $false)]
        [string]$FailureMessage,
        [Parameter(Mandatory = $false)]
        [bool]$Healthy = $false
    )

    $summaryPath = Join-Path $resolvedDiagnosticsDir "smoke-summary.txt"
    $failureSummary = ""
    if ($FailureMessage) {
        $failureSummary = $FailureMessage
    }
    $summaryLines = @(
        ("timestamp={0}" -f (Get-Date).ToString("o")),
        ("desktop_exe={0}" -f $desktopExe),
        ("health_uri={0}" -f $healthUri),
        ("timeout_seconds={0}" -f $TimeoutSeconds),
        ("healthy={0}" -f $Healthy),
        ("failure_message={0}" -f $failureSummary),
        ("runner_appdata={0}" -f $env:APPDATA),
        ("runner_localappdata={0}" -f $env:LOCALAPPDATA)
    )
    $summaryLines | Set-Content -Path $summaryPath -Encoding UTF8

    $logFiles = @(Get-DesktopLogFiles)
    $manifest = Join-Path $resolvedDiagnosticsDir "log-manifest.txt"
    if (-not $logFiles -or $logFiles.Count -eq 0) {
        "No ELMS desktop runtime log files discovered." | Set-Content -Path $manifest -Encoding UTF8
        Write-Host "No ELMS desktop runtime log files discovered under APPDATA/LOCALAPPDATA candidates."
        return
    }

    $copiedDir = Join-Path $resolvedDiagnosticsDir "logs"
    New-Item -ItemType Directory -Path $copiedDir -Force | Out-Null
    $manifestLines = New-Object 'System.Collections.Generic.List[string]'

    foreach ($logFile in $logFiles) {
        $safe = (($logFile -replace '[:\\\/ ]', '_') -replace '_+', '_').Trim('_')
        $destination = Join-Path $copiedDir ("{0}__{1}" -f $safe, (Split-Path -Leaf $logFile))
        try {
            Copy-Item -Path $logFile -Destination $destination -Force
            $manifestLines.Add(("{0} -> {1}" -f $logFile, $destination)) | Out-Null
            Write-LogTailToConsole -Path $logFile -Lines 80
        } catch {
            $manifestLines.Add(("{0} -> copy failed: {1}" -f $logFile, $_.Exception.Message)) | Out-Null
        }
    }

    $manifestLines | Set-Content -Path $manifest -Encoding UTF8
}

$healthy = $false

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

        $fatalError = Find-FatalBootstrapError
        if ($fatalError) {
            throw $fatalError
        }

        try {
            $response = Invoke-WebRequest -Uri $healthUri -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200 -and $response.Content -match '"ok"\s*:\s*true') {
                Write-Host ("Desktop runtime smoke check passed at {0}" -f $healthUri)
                $healthy = $true
                break
            }
        } catch {
            # Service may still be booting; continue polling until timeout.
        }

        Start-Sleep -Milliseconds $pollIntervalMs
    }
} catch {
    $failureMessage = $_.Exception.Message
    throw
} finally {
    Export-Diagnostics -FailureMessage $failureMessage -Healthy $healthy
    Write-Host ("Smoke diagnostics written to: {0}" -f $resolvedDiagnosticsDir)

    if ($desktopProcess -and -not $desktopProcess.HasExited) {
        Write-Host ("Stopping desktop process (PID={0})" -f $desktopProcess.Id)
        Stop-Process -Id $desktopProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
