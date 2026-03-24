#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "'$Name' is required but was not found in PATH."
    }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ResolvedInstaller = (Resolve-Path $InstallerPath).Path
$ExtractRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("elms-nsis-verify-" + [System.Guid]::NewGuid().ToString("N"))

Require-Command 7z

try {
    New-Item -ItemType Directory -Path $ExtractRoot -Force | Out-Null

    Write-Host "Extracting NSIS installer: $ResolvedInstaller"
    & 7z x "-o$ExtractRoot" -y $ResolvedInstaller | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "7z failed to extract $ResolvedInstaller"
    }

    & node (Join-Path $RepoRoot "scripts\verify-packaged-desktop-tree.mjs") --search-root $ExtractRoot
    if ($LASTEXITCODE -ne 0) {
        throw "Packaged desktop tree verification failed for extracted installer payload."
    }

    Write-Host "Windows installer payload verified."
} finally {
    if (Test-Path $ExtractRoot) {
        Remove-Item -Recurse -Force $ExtractRoot -ErrorAction SilentlyContinue
    }
}
