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
        [string]$BundleRoot
    )

    Write-Host "Checking packaged desktop root candidate: $BundleRoot"
    $output = & node $VerifyPackagedTreeScript $BundleRoot 2>&1
    if ($output) {
        $output | ForEach-Object { Write-Host $_ }
    }
    if ($LASTEXITCODE -ne 0) {
        $failureMessage = if ($output) {
            ($output | Select-Object -Last 1).ToString()
        } else {
            "Unknown verification failure."
        }

        throw ("Packaged desktop tree verification failed at {0}: {1}" -f $BundleRoot, $failureMessage)
    }
}

function Invoke-PackagedTreeSearch {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SearchRoot
    )

    Write-Host "Searching for packaged desktop resources under: $SearchRoot"
    $output = & node $VerifyPackagedTreeScript --search-root $SearchRoot 2>&1
    if ($output) {
        $output | ForEach-Object { Write-Host $_ }
    }
    if ($LASTEXITCODE -ne 0) {
        $failureMessage = if ($output) {
            ($output | Select-Object -Last 1).ToString()
        } else {
            "Unknown search failure."
        }

        throw ("Packaged desktop tree verification failed under {0}: {1}" -f $SearchRoot, $failureMessage)
    }
}

function Add-VerificationCandidate {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.List[string]]$Candidates,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.HashSet[string]]$Seen,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path $Path -PathType Container)) {
        return
    }

    $resolvedPath = (Resolve-Path $Path).Path
    if ($Seen.Add($resolvedPath)) {
        $Candidates.Add($resolvedPath) | Out-Null
    }
}

function Resolve-FrontEndBundleRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$IndexPath
    )

    $distDir = Split-Path -Parent $IndexPath
    $frontendDir = Split-Path -Parent $distDir
    $packagesDir = Split-Path -Parent $frontendDir
    return Split-Path -Parent $packagesDir
}

function Get-VerificationCandidates {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$PreferredRoots,

        [Parameter(Mandatory = $false)]
        [string]$ExtractionRoot
    )

    $candidates = New-Object 'System.Collections.Generic.List[string]'
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($preferredRoot in $PreferredRoots) {
        Add-VerificationCandidate -Candidates $candidates -Seen $seen -Path $preferredRoot
    }

    if ($ExtractionRoot -and (Test-Path $ExtractionRoot -PathType Container)) {
        Get-ChildItem -Path $ExtractionRoot -Directory -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq "resources" } |
            ForEach-Object { Add-VerificationCandidate -Candidates $candidates -Seen $seen -Path $_.FullName }

        Get-ChildItem -Path $ExtractionRoot -File -Recurse -Filter "index.html" -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -like "*packages\frontend\dist\index.html" } |
            ForEach-Object {
                $bundleRoot = Resolve-FrontEndBundleRoot -IndexPath $_.FullName
                Add-VerificationCandidate -Candidates $candidates -Seen $seen -Path $bundleRoot
            }
    }

    return $candidates
}

function Invoke-VerificationCandidates {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$Candidates
    )

    $attemptedRoots = New-Object 'System.Collections.Generic.List[string]'
    $failures = New-Object 'System.Collections.Generic.List[string]'

    if ($Candidates.Count -eq 0) {
        throw ("No packaged desktop root candidates were found for {0}." -f $Label)
    }

    Write-Host ("Attempting packaged desktop roots for {0}:" -f $Label)
    $Candidates | ForEach-Object { Write-Host " - $_" }

    foreach ($candidate in $Candidates) {
        $attemptedRoots.Add($candidate) | Out-Null

        try {
            Invoke-PackagedTreeVerification -BundleRoot $candidate
            return
        } catch {
            $failures.Add($_.Exception.Message) | Out-Null
        }
    }

    $attemptedSummary = ($attemptedRoots -join "; ")
    $failureSummary = if ($failures.Count -gt 0) {
        $failures[$failures.Count - 1]
    } else {
        "Unknown verification failure."
    }

    throw ("Tried packaged desktop roots for {0}: {1}. Last failure: {2}" -f $Label, $attemptedSummary, $failureSummary)
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
        throw ("NSIS installer not found under {0}" -f $NsisDir)
    }
}

$ResolvedInstaller = (Resolve-Path $InstallerPath).Path
if (-not (Test-Path $ResolvedInstaller -PathType Leaf)) {
    throw ("NSIS installer not found at {0}" -f $ResolvedInstaller)
}

Write-Host "Confirmed NSIS installer exists at: $ResolvedInstaller"
Write-Host "Verifying Windows installer payload from release root: $ResolvedReleaseRoot"

$releaseCandidates = Get-VerificationCandidates -PreferredRoots @(
    (Join-Path $ResolvedReleaseRoot "resources"),
    $ResolvedReleaseRoot
)

try {
    Invoke-VerificationCandidates -Label "release tree" -Candidates $releaseCandidates
    Write-Host "Windows installer payload verified from release tree."
    return
} catch {
    $directVerificationError = $_
    Write-Warning "Release-tree verification failed. Falling back to NSIS installer extraction. $($directVerificationError.Exception.Message)"
}

$sevenZip = Resolve-7ZipExecutable
if (-not $sevenZip) {
    throw ("NSIS installer exists at {0}, but the packaged payload could not be inspected because no 7-Zip extractor was found. Direct release-root verification failed: {1}" -f $ResolvedInstaller, $directVerificationError.Exception.Message)
}

$ExtractionRoot = $null
try {
    $ExtractionRoot = New-TemporaryDirectory
    Write-Host "Extracting NSIS installer to temporary directory: $ExtractionRoot"

    & $sevenZip x "-o$ExtractionRoot" "-y" $ResolvedInstaller | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw ("7-Zip failed to extract {0}" -f $ResolvedInstaller)
    }

    $extractedCandidates = Get-VerificationCandidates -PreferredRoots @() -ExtractionRoot $ExtractionRoot

    try {
        Invoke-VerificationCandidates -Label "extracted NSIS payload" -Candidates $extractedCandidates
    } catch {
        $candidateVerificationError = $_
        Write-Warning "Explicit extracted-root verification failed. Falling back to recursive search. $($candidateVerificationError.Exception.Message)"
        Invoke-PackagedTreeSearch -SearchRoot $ExtractionRoot
    }

    Write-Host "Windows installer payload verified from extracted NSIS payload."
} finally {
    if ($ExtractionRoot -and (Test-Path $ExtractionRoot -PathType Container)) {
        Remove-Item -Path $ExtractionRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
