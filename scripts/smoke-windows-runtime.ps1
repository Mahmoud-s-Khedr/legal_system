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
$corsProbeOrigin = "http://tauri.localhost"
$pollIntervalMs = 2000
$startTime = Get-Date
$lastProbeSnapshotAt = Get-Date "1970-01-01"
$desktopProcess = $null
$failureMessage = $null
$lastHealthError = ""
$corsProbePassed = $false
$corsProbeStatusCode = 0
$corsProbeAllowOrigin = ""
$corsProbeError = ""
$fatalPatterns = @(
    "(?i)pg_ctl failed:.*system cannot find the path specified",
    "(?i)initdb failed:.*system cannot find the path specified",
    '(?i)program "postgres" is needed by pg_ctl but was not found',
    '(?i)program "postgres" is needed by initdb but was not found',
    "(?i)missing bundled prisma query engine library",
    "(?i)missing bundled prisma engines package",
    "(?i)database migration failed:.*p3018",
    "(?i)sqlstate\(e22p05\)",
    "(?i)encoding mismatch \(p3018/22p05\)",
    "(?i)backend spawn failed",
    "(?i)backend health check failed"
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

function Get-BackendConnectionFiles {
    $files = New-Object 'System.Collections.Generic.List[string]'
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($root in Get-DesktopLogRoots) {
        $candidate = Join-Path $root "backend-connection.json"
        if (Test-Path $candidate -PathType Leaf) {
            $resolved = (Resolve-Path $candidate).Path
            if ($seen.Add($resolved)) {
                $files.Add($resolved) | Out-Null
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

function Get-BootstrapPhaseSnapshot {
    $snapshot = @{
        phase = "unknown"
        lastLine = ""
        postgresReadySeen = $false
        migrationStartedSeen = $false
        backendSpawnAttemptedSeen = $false
        backendHealthSeen = $false
        postgresCommandStallDetected = $false
    }

    $bootstrapLog = $null
    foreach ($logFile in Get-DesktopLogFiles) {
        if ((Split-Path -Leaf $logFile) -ieq "desktop-bootstrap.log") {
            $bootstrapLog = $logFile
            break
        }
    }

    if (-not $bootstrapLog) {
        return $snapshot
    }

    $tail = @()
    try {
        $tail = Get-Content -Path $bootstrapLog -Tail 250 -ErrorAction SilentlyContinue
    } catch {
        return $snapshot
    }

    if (-not $tail -or $tail.Count -eq 0) {
        return $snapshot
    }

    $snapshot.lastLine = $tail[-1]

    $pgCtlStartSeen = $false
    $pgCtlEndSeen = $false

    foreach ($line in $tail) {
        if ($line -match "Embedded PostgreSQL startup path completed|database system is ready to accept connections") {
            $snapshot.postgresReadySeen = $true
        }
        if ($line -match "Applying database migrations|Skipping database migrations") {
            $snapshot.migrationStartedSeen = $true
        }
        if ($line -match "Launching backend program=|checkpoint stage=backend step=spawn") {
            $snapshot.backendSpawnAttemptedSeen = $true
        }
        if ($line -match "Desktop runtime bootstrap completed|checkpoint stage=backend step=health action=probe result=ok") {
            $snapshot.backendHealthSeen = $true
        }
        if ($line -match "checkpoint stage=postgres step=pg_ctl action=command result=start") {
            $pgCtlStartSeen = $true
        }
        if ($line -match "checkpoint stage=postgres step=pg_ctl action=command result=(ok|failed)") {
            $pgCtlEndSeen = $true
        }
    }

    if ($pgCtlStartSeen -and -not $pgCtlEndSeen) {
        $snapshot.postgresCommandStallDetected = $true
    }

    if ($snapshot.backendHealthSeen) {
        $snapshot.phase = "backend_healthy"
    } elseif ($snapshot.backendSpawnAttemptedSeen) {
        $snapshot.phase = "backend_launch"
    } elseif ($snapshot.migrationStartedSeen) {
        $snapshot.phase = "migrations"
    } elseif ($snapshot.postgresReadySeen) {
        $snapshot.phase = "postgres_ready"
    } elseif ($snapshot.postgresCommandStallDetected) {
        $snapshot.phase = "postgres_command_stall"
    } elseif ($snapshot.lastLine -match "checkpoint stage=postgres") {
        $snapshot.phase = "postgres_starting"
    } elseif ($snapshot.lastLine -match "Initializing embedded PostgreSQL") {
        $snapshot.phase = "postgres_starting"
    }

    return $snapshot
}

function Write-ProbeSnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [double]$ElapsedSeconds,
        [Parameter(Mandatory = $true)]
        [bool]$ProcessAlive
    )

    $snapshot = Get-BootstrapPhaseSnapshot
    Write-Host (
        "probe elapsed={0:n1}s process_alive={1} phase={2} postgres_ready_seen={3} migration_started_seen={4} backend_spawn_attempted_seen={5} backend_health_seen={6} last_health_error={7}" -f `
        $ElapsedSeconds,
        $ProcessAlive,
        $snapshot.phase,
        $snapshot.postgresReadySeen,
        $snapshot.migrationStartedSeen,
        $snapshot.backendSpawnAttemptedSeen,
        $snapshot.backendHealthSeen,
        $lastHealthError
    )
}

function Export-Diagnostics {
    param(
        [Parameter(Mandatory = $false)]
        [string]$FailureMessage,
        [Parameter(Mandatory = $false)]
        [bool]$Healthy = $false
    )

    $summaryPath = Join-Path $resolvedDiagnosticsDir "smoke-summary.txt"
    $summaryJsonPath = Join-Path $resolvedDiagnosticsDir "smoke-summary.json"
    $failureSummary = ""
    if ($FailureMessage) {
        $failureSummary = $FailureMessage
    }
    $snapshot = Get-BootstrapPhaseSnapshot
    $backendConnectionFiles = @(Get-BackendConnectionFiles)
    $backendConnectionFile = if ($backendConnectionFiles.Count -gt 0) { $backendConnectionFiles[0] } else { "" }
    $backendConnectionContent = ""
    if ($backendConnectionFile) {
      try {
        $backendConnectionContent = (Get-Content -Path $backendConnectionFile -Raw -ErrorAction SilentlyContinue)
      } catch {
        $backendConnectionContent = ""
      }
    }
    $summaryLines = @(
        ("timestamp={0}" -f (Get-Date).ToString("o")),
        ("desktop_exe={0}" -f $desktopExe),
        ("health_uri={0}" -f $healthUri),
        ("timeout_seconds={0}" -f $TimeoutSeconds),
        ("healthy={0}" -f $Healthy),
        ("failure_message={0}" -f $failureSummary),
        ("last_health_error={0}" -f $lastHealthError),
        ("bootstrap_phase={0}" -f $snapshot.phase),
        ("bootstrap_last_line={0}" -f $snapshot.lastLine),
        ("postgres_ready_seen={0}" -f $snapshot.postgresReadySeen),
        ("migration_started_seen={0}" -f $snapshot.migrationStartedSeen),
        ("backend_spawn_attempted_seen={0}" -f $snapshot.backendSpawnAttemptedSeen),
        ("backend_health_seen={0}" -f $snapshot.backendHealthSeen),
        ("postgres_command_stall_detected={0}" -f $snapshot.postgresCommandStallDetected),
        ("cors_probe_origin={0}" -f $corsProbeOrigin),
        ("cors_probe_passed={0}" -f $corsProbePassed),
        ("cors_probe_status_code={0}" -f $corsProbeStatusCode),
        ("cors_probe_allow_origin={0}" -f $corsProbeAllowOrigin),
        ("cors_probe_error={0}" -f $corsProbeError),
        ("backend_connection_file={0}" -f $backendConnectionFile),
        ("backend_connection_json={0}" -f $backendConnectionContent),
        ("runner_appdata={0}" -f $env:APPDATA),
        ("runner_localappdata={0}" -f $env:LOCALAPPDATA)
    )
    $summaryLines | Set-Content -Path $summaryPath -Encoding UTF8

    $summaryObject = [ordered]@{
        timestamp = (Get-Date).ToString("o")
        desktopExe = $desktopExe
        healthUri = $healthUri
        timeoutSeconds = $TimeoutSeconds
        healthy = $Healthy
        failureMessage = $failureSummary
        lastHealthError = $lastHealthError
        bootstrapPhase = $snapshot.phase
        bootstrapLastLine = $snapshot.lastLine
        postgresReadySeen = $snapshot.postgresReadySeen
        migrationStartedSeen = $snapshot.migrationStartedSeen
        backendSpawnAttemptedSeen = $snapshot.backendSpawnAttemptedSeen
        backendHealthSeen = $snapshot.backendHealthSeen
        postgresCommandStallDetected = $snapshot.postgresCommandStallDetected
        corsProbeOrigin = $corsProbeOrigin
        corsProbePassed = $corsProbePassed
        corsProbeStatusCode = $corsProbeStatusCode
        corsProbeAllowOrigin = $corsProbeAllowOrigin
        corsProbeError = $corsProbeError
        backendConnectionFile = $backendConnectionFile
        backendConnectionJson = $backendConnectionContent
        runnerAppData = $env:APPDATA
        runnerLocalAppData = $env:LOCALAPPDATA
    }
    $summaryObject | ConvertTo-Json -Depth 5 | Set-Content -Path $summaryJsonPath -Encoding UTF8

    $corsProbePath = Join-Path $resolvedDiagnosticsDir "cors-origin-probe.json"
    $corsProbeObject = [ordered]@{
        timestamp = (Get-Date).ToString("o")
        healthUri = $healthUri
        origin = $corsProbeOrigin
        passed = $corsProbePassed
        statusCode = $corsProbeStatusCode
        accessControlAllowOrigin = $corsProbeAllowOrigin
        error = $corsProbeError
    }
    $corsProbeObject | ConvertTo-Json -Depth 5 | Set-Content -Path $corsProbePath -Encoding UTF8

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

    foreach ($connectionFile in $backendConnectionFiles) {
        $safe = (($connectionFile -replace '[:\\\/ ]', '_') -replace '_+', '_').Trim('_')
        $destination = Join-Path $copiedDir ("{0}__{1}" -f $safe, (Split-Path -Leaf $connectionFile))
        try {
            Copy-Item -Path $connectionFile -Destination $destination -Force
            $manifestLines.Add(("{0} -> {1}" -f $connectionFile, $destination)) | Out-Null
        } catch {
            $manifestLines.Add(("{0} -> copy failed: {1}" -f $connectionFile, $_.Exception.Message)) | Out-Null
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
            $snapshot = Get-BootstrapPhaseSnapshot
            $backendLaunchState = if ($snapshot.backendSpawnAttemptedSeen) { "reached" } else { "not-reached" }
            throw (
                "Desktop runtime health check timed out after {0} seconds (phase={1}, backend_launch={2}, last_bootstrap_line={3})" -f `
                $TimeoutSeconds,
                $snapshot.phase,
                $backendLaunchState,
                $snapshot.lastLine
            )
        }

        if ((Get-Date) - $lastProbeSnapshotAt -ge [TimeSpan]::FromSeconds(15)) {
            Write-ProbeSnapshot -ElapsedSeconds $elapsedSeconds -ProcessAlive $true
            $lastProbeSnapshotAt = Get-Date
        }

        $fatalError = Find-FatalBootstrapError
        if ($fatalError) {
            throw $fatalError
        }

        try {
            $response = Invoke-WebRequest -Uri $healthUri -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200 -and $response.Content -match '"ok"\s*:\s*true') {
                try {
                    $corsResponse = Invoke-WebRequest -Uri $healthUri -UseBasicParsing -TimeoutSec 2 -Headers @{ Origin = $corsProbeOrigin }
                    $corsProbeStatusCode = [int]$corsResponse.StatusCode
                    $corsProbeAllowOrigin = [string]$corsResponse.Headers["Access-Control-Allow-Origin"]
                    if ($corsProbeStatusCode -ne 200 -or $corsProbeAllowOrigin -ne $corsProbeOrigin) {
                        throw ("Unexpected CORS probe response (status={0}, access-control-allow-origin={1})" -f $corsProbeStatusCode, $corsProbeAllowOrigin)
                    }
                    $corsProbePassed = $true
                    Write-Host ("Desktop runtime CORS probe passed for Origin={0}" -f $corsProbeOrigin)
                } catch {
                    $corsProbeError = $_.Exception.Message
                    throw ("Desktop runtime CORS probe failed for Origin={0}: {1}" -f $corsProbeOrigin, $corsProbeError)
                }

                Write-Host ("Desktop runtime smoke check passed at {0}" -f $healthUri)
                $healthy = $true
                break
            }
        } catch {
            $lastHealthError = $_.Exception.Message
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
