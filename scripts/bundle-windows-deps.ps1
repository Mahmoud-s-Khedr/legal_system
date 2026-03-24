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

# ── PostgreSQL ─────────────────────────────────────────────────────────────────
$PgSentinel = Join-Path $PgDestDir ".bundle-complete"
if (Test-Path $PgSentinel) {
    Write-Host "[PG] PostgreSQL $PgVersion already bundled — skipping."
} else {
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

    # Write sentinel so subsequent runs skip the download.
    "PostgreSQL $PgVersion bundled on $(Get-Date -Format 'yyyy-MM-dd')" |
        Set-Content $PgSentinel -Encoding UTF8

    Write-Host "[PG] Done."
}

# ── Node.js ───────────────────────────────────────────────────────────────────
$NodeSentinel = Join-Path $NodeDestDir ".bundle-complete"
if (Test-Path $NodeSentinel) {
    Write-Host "[Node] Node.js $NodeVersion already bundled — skipping."
} else {
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

# ── Cleanup ───────────────────────────────────────────────────────────────────
if (Test-Path $TmpDir) {
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Bundle complete."
Write-Host "  PostgreSQL : $PgDestDir"
Write-Host "  Node.js    : $NodeDestDir"
