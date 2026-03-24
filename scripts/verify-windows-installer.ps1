#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ReleaseRoot,

    [Parameter(Mandatory = $false)]
    [string]$InstallerPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ResolvedReleaseRoot = (Resolve-Path $ReleaseRoot).Path
$NsisDir = Join-Path $ResolvedReleaseRoot "bundle\nsis"
$VerifyPackagedTreeScript = Join-Path $RepoRoot "scripts\verify-packaged-desktop-tree.mjs"

function Invoke-PackagedTreeVerification {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SearchRoot
    )

    Write-Host "Searching for packaged desktop resources under: $SearchRoot"
    & node $VerifyPackagedTreeScript --search-root $SearchRoot
    if ($LASTEXITCODE -ne 0) {
        throw "Packaged desktop tree verification failed under $SearchRoot"
    }
}

function Resolve-7ZipExecutable {
    $command = Get-Command "7z" -ErrorAction SilentlyContinue
    if ($command -and $command.Source) {
        return $command.Source
    }

    foreach ($candidate in @(
        "C:\Program Files\7-Zip\7z.exe",
        "C:\Program Files (x86)\7-Zip\7z.exe"
    )) {
        if (Test-Path $candidate -PathType Leaf) {
            return $candidate
        }
    }

    return $null
}

function New-TemporaryDirectory {
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString("N"))
    $null = New-Item -ItemType Directory -Path $tempDir -Force
    return $tempDir
}

if (-not $InstallerPath) {
    $InstallerPath = Get-ChildItem -Path $NsisDir -Filter "*.exe" -File |
        Select-Object -First 1 -ExpandProperty FullName

    if (-not $InstallerPath) {
        throw "NSIS installer not found under $NsisDir"
    }
}

$ResolvedInstaller = (Resolve-Path $InstallerPath).Path
if (-not (Test-Path $ResolvedInstaller -PathType Leaf)) {
    throw "NSIS installer not found at $ResolvedInstaller"
}

Write-Host "Confirmed NSIS installer exists at: $ResolvedInstaller"
Write-Host "Verifying Windows installer payload from release root: $ResolvedReleaseRoot"

try {
    Invoke-PackagedTreeVerification -SearchRoot $ResolvedReleaseRoot
    Write-Host "Windows installer payload verified from release tree."
    return
} catch {
    $directVerificationError = $_
    Write-Warning "No packaged desktop tree was found directly under $ResolvedReleaseRoot. Falling back to NSIS installer extraction."
}

$sevenZip = Resolve-7ZipExecutable
if (-not $sevenZip) {
    throw "NSIS installer exists at $ResolvedInstaller, but the packaged payload could not be inspected because no 7-Zip extractor was found. Direct release-root verification failed: $($directVerificationError.Exception.Message)"
}

$ExtractionRoot = $null
try {
    $ExtractionRoot = New-TemporaryDirectory
    Write-Host "Extracting NSIS installer to temporary directory: $ExtractionRoot"

    & $sevenZip x "-o$ExtractionRoot" "-y" $ResolvedInstaller | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "7-Zip failed to extract $ResolvedInstaller"
    }

    Invoke-PackagedTreeVerification -SearchRoot $ExtractionRoot
    Write-Host "Windows installer payload verified from extracted NSIS payload."
} finally {
    if ($ExtractionRoot -and (Test-Path $ExtractionRoot -PathType Container)) {
        Remove-Item -Path $ExtractionRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
