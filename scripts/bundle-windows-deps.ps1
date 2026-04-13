#Requires -Version 5.1
<#
.SYNOPSIS
    Downloads and extracts PostgreSQL 16 and Node.js 22 LTS Windows binaries
    into apps/desktop/resources/ for the ELMS desktop Windows installer.

.DESCRIPTION
    - PostgreSQL 16 Windows x64 zip  → apps/desktop/resources/postgres/
      (keeps only bin/, lib/, share/ — strips installer, docs, and symbols)
    - Node.js 22 LTS Windows x64 zip → apps/desktop/resources/node/
      (keeps node.exe and required runtime DLLs)

    Both downloads are skipped when the target directory already contains a
    .bundle-complete sentinel file (idempotent — safe to re-run in CI).

.PARAMETER PgVersion
    PostgreSQL version to download (default: "16.9").

.PARAMETER NodeVersion
    Node.js LTS version to download (default: "22.14.0").

.EXAMPLE
    .\scripts\bundle-windows-deps.ps1
    .\scripts\bundle-windows-deps.ps1 -PgVersion 16.9 -NodeVersion 22.14.0
#>

[CmdletBinding()]
param(
    [string]$PgVersion   = "16.9",
    [string]$NodeVersion = "22.14.0"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Paths ─────────────────────────────────────────────────────────────────────
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot    = Split-Path -Parent $ScriptDir
$ResourceDir = Join-Path $RepoRoot "apps\desktop\resources"
$TmpDir      = Join-Path ([System.IO.Path]::GetTempPath()) "elms-bundle-$PID"

$PgDestDir   = Join-Path $ResourceDir "postgres"
$NodeDestDir = Join-Path $ResourceDir "node"
$PgLayoutFile = Join-Path $PgDestDir ".layout.env"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Download-File {
    param([string]$Url, [string]$Dest)
    Write-Host "  Downloading $Url ..."
    $ProgressPreference = 'SilentlyContinue'   # avoids slow progress-bar rendering on Windows CI
    Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing
}

function Expand-ZipTo {
    param([string]$ZipFile, [string]$DestDir)
    Write-Host "  Extracting $(Split-Path -Leaf $ZipFile) ..."
    Expand-Archive -Path $ZipFile -DestinationPath $DestDir -Force
}

function Test-BundledPostgresLayout {
    param([string]$BundleRoot, [string]$LayoutFile)

    if (-not (Test-Path $LayoutFile)) {
        return $false
    }

    $manifest = @{}
    foreach ($line in Get-Content $LayoutFile) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
            continue
        }

        $parts = $line -split "=", 2
        if ($parts.Count -ne 2) {
            continue
        }

        $manifest[$parts[0].Trim()] = $parts[1].Trim().Trim("'").Trim('"')
    }

    foreach ($key in @("POSTGRES_BIN_DIR", "POSTGRES_SHARE_DIR", "POSTGRES_PKGLIB_DIR", "POSTGRES_RUNTIME_LIB_DIR")) {
        $relative = $manifest[$key]
        if ([string]::IsNullOrWhiteSpace($relative)) {
            return $false
        }

        $resolved = Join-Path $BundleRoot $relative
        if (-not (Test-Path $resolved)) {
            return $false
        }
    }

    return $true
}

function Assert-BundledPostgresResources {
    param([string]$BundleRoot)

    $binDir = Join-Path $BundleRoot "bin"
    $shareDir = Join-Path $BundleRoot "share"
    $libDir = Join-Path $BundleRoot "lib"

    foreach ($exe in @("postgres.exe", "pg_ctl.exe", "initdb.exe", "createdb.exe", "pg_isready.exe")) {
        if (-not (Test-Path (Join-Path $binDir $exe))) {
            throw "Bundled PostgreSQL executable missing: $exe"
        }
    }

    foreach ($runtimeDll in @("vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll")) {
        if (-not (Test-Path (Join-Path $binDir $runtimeDll))) {
            throw "Bundled PostgreSQL VC++ runtime dependency missing: $runtimeDll"
        }
    }

    if (-not (Test-Path (Join-Path $shareDir "timezonesets"))) {
        throw "Bundled PostgreSQL timezone data missing under $shareDir"
    }

    $dlls = Get-ChildItem -Path $libDir -Filter "*.dll" -File -ErrorAction SilentlyContinue
    if (-not $dlls -or $dlls.Count -eq 0) {
        throw "Bundled PostgreSQL runtime libraries are missing from $libDir"
    }
}

function Copy-AppLocalMsVcRuntimeDlls {
    param([string]$PgBinDir)

    $requiredDlls = @("vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll")
    $sourceDirectories = @(
        (Join-Path $env:SystemRoot "System32"),
        (Join-Path $env:SystemRoot "SysWOW64")
    )

    foreach ($dll in $requiredDlls) {
        $sourcePath = $null
        foreach ($sourceDir in $sourceDirectories) {
            $candidate = Join-Path $sourceDir $dll
            if (Test-Path $candidate -PathType Leaf) {
                $sourcePath = $candidate
                break
            }
        }

        if (-not $sourcePath) {
            throw "Unable to locate required VC++ runtime DLL '$dll' in System32/SysWOW64."
        }

        Copy-Item -Path $sourcePath -Destination (Join-Path $PgBinDir $dll) -Force
    }
}

# ── PostgreSQL ─────────────────────────────────────────────────────────────────
$PgSentinel = Join-Path $PgDestDir ".bundle-complete"
$PgBundleReady = $false
if ((Test-Path $PgSentinel) -and (Test-BundledPostgresLayout -BundleRoot $PgDestDir -LayoutFile $PgLayoutFile)) {
    try {
        Assert-BundledPostgresResources -BundleRoot $PgDestDir
        $PgBundleReady = $true
    } catch {
        $PgBundleReady = $false
    }
}

if ($PgBundleReady) {
    Write-Host "[PG] PostgreSQL $PgVersion already bundled — skipping."
} else {
    if (Test-Path $PgDestDir) {
        Write-Host "[PG] Existing PostgreSQL bundle is missing the layout manifest or required resources — rebuilding."
        Remove-Item -Recurse -Force $PgDestDir
    }

    Write-Host "[PG] Bundling PostgreSQL $PgVersion ..."

    $PgZipName = "postgresql-$PgVersion-1-windows-x64-binaries.zip"
    # Official EnterpriseDB direct download — stable URL pattern since PG 9.
    $PgUrl     = "https://get.enterprisedb.com/postgresql/$PgZipName"
    $PgZip     = Join-Path $TmpDir $PgZipName
    $PgExtract = Join-Path $TmpDir "pg-extract"

    New-Item -ItemType Directory -Path $TmpDir    -Force | Out-Null
    New-Item -ItemType Directory -Path $PgExtract -Force | Out-Null

    Download-File -Url $PgUrl -Dest $PgZip
    Expand-ZipTo  -ZipFile $PgZip -DestDir $PgExtract

    # The zip contains a single top-level "pgsql/" directory.
    $PgSource = Join-Path $PgExtract "pgsql"
    if (-not (Test-Path $PgSource)) {
        throw "Unexpected PostgreSQL zip layout — 'pgsql/' not found inside $PgZipName"
    }

    # Copy only the directories the ELMS desktop runtime needs at run time.
    # bin/  — pg_ctl.exe, initdb.exe, pg_isready.exe, createdb.exe, postgres.exe
    # lib/  — required DLLs (libpq.dll, etc.)
    # share/ — locale and timezone data used by initdb
    foreach ($Dir in @("bin", "lib", "share")) {
        $Src = Join-Path $PgSource $Dir
        $Dst = Join-Path $PgDestDir $Dir
        if (Test-Path $Src) {
            Write-Host "  Copying $Dir\ ..."
            Copy-Item -Path $Src -Destination $Dst -Recurse -Force
        } else {
            Write-Warning "PostgreSQL zip does not contain a '$Dir' directory — skipping."
        }
    }

    Write-Host "  Copying MSVC runtime DLLs beside PostgreSQL executables ..."
    Copy-AppLocalMsVcRuntimeDlls -PgBinDir (Join-Path $PgDestDir "bin")

    @"
POSTGRES_BIN_DIR=bin
POSTGRES_SHARE_DIR=share
POSTGRES_PKGLIB_DIR=lib
POSTGRES_RUNTIME_LIB_DIR=lib
"@ | Set-Content $PgLayoutFile -Encoding UTF8

    Assert-BundledPostgresResources -BundleRoot $PgDestDir

    # Write sentinel so subsequent runs skip the download.
    "PostgreSQL $PgVersion bundled on $(Get-Date -Format 'yyyy-MM-dd')" |
        Set-Content $PgSentinel -Encoding UTF8

    Write-Host "[PG] Done."
}

# ── Node.js ───────────────────────────────────────────────────────────────────
$NodeSentinel = Join-Path $NodeDestDir ".bundle-complete"
if ((Test-Path $NodeSentinel) -and (Test-Path (Join-Path $NodeDestDir "node.exe"))) {
    Write-Host "[Node] Node.js $NodeVersion already bundled — skipping."
} else {
    if (Test-Path $NodeDestDir) {
        Write-Host "[Node] Existing Node.js bundle is missing the expected runtime binary — rebuilding."
        Remove-Item -Recurse -Force $NodeDestDir
    }

    Write-Host "[Node] Bundling Node.js $NodeVersion ..."

    $NodeZipName = "node-v$NodeVersion-win-x64.zip"
    $NodeUrl     = "https://nodejs.org/dist/v$NodeVersion/$NodeZipName"
    $NodeZip     = Join-Path $TmpDir $NodeZipName
    $NodeExtract = Join-Path $TmpDir "node-extract"

    New-Item -ItemType Directory -Path $TmpDir      -Force | Out-Null
    New-Item -ItemType Directory -Path $NodeExtract -Force | Out-Null
    New-Item -ItemType Directory -Path $NodeDestDir -Force | Out-Null

    Download-File -Url $NodeUrl -Dest $NodeZip
    Expand-ZipTo  -ZipFile $NodeZip -DestDir $NodeExtract

    # The zip top-level dir is "node-v<version>-win-x64".
    $NodeSource = Join-Path $NodeExtract "node-v$NodeVersion-win-x64"
    if (-not (Test-Path $NodeSource)) {
        throw "Unexpected Node.js zip layout — expected 'node-v$NodeVersion-win-x64' inside $NodeZipName"
    }

    # Copy node.exe and the ICU / zlib DLLs that it requires at runtime.
    # We do NOT copy npm, npx, or node_modules — only the runtime is needed.
    Write-Host "  Copying node.exe and runtime DLLs ..."
    Get-ChildItem -Path $NodeSource -Filter "node.exe" |
        Copy-Item -Destination $NodeDestDir -Force
    Get-ChildItem -Path $NodeSource -Filter "*.dll" |
        Copy-Item -Destination $NodeDestDir -Force

    "Node.js $NodeVersion bundled on $(Get-Date -Format 'yyyy-MM-dd')" |
        Set-Content $NodeSentinel -Encoding UTF8

    Write-Host "[Node] Done."
}

if (-not (Test-Path (Join-Path $NodeDestDir "node.exe"))) {
    throw "Bundled Node.js runtime missing node.exe under $NodeDestDir"
}

# ── Cleanup ───────────────────────────────────────────────────────────────────
if (Test-Path $TmpDir) {
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Bundle complete."
Write-Host "  PostgreSQL : $PgDestDir"
Write-Host "  Node.js    : $NodeDestDir"
