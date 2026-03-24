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
$ResourcesDir = Join-Path $ResolvedReleaseRoot "resources"

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

if (-not (Test-Path $ResourcesDir -PathType Container)) {
    throw "Staged Windows resources directory not found at $ResourcesDir"
}

Write-Host "Verifying Windows staged payload from: $ResourcesDir"
Write-Host "Confirmed NSIS installer exists at: $ResolvedInstaller"

& node (Join-Path $RepoRoot "scripts\verify-packaged-desktop-tree.mjs") $ResourcesDir
if ($LASTEXITCODE -ne 0) {
    throw "Packaged desktop tree verification failed for staged Windows payload."
}

Write-Host "Windows installer payload verified."
