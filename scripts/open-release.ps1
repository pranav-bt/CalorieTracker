param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^v[0-9]+\.[0-9]+\.[0-9]+-[a-z0-9.-]+$')]
    [string]$Tag
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$archiveRoot = Join-Path $repoRoot ".release-worktrees"
$destination = Join-Path $archiveRoot $Tag

& git -C $repoRoot rev-parse --verify "$Tag^{commit}" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Release tag '$Tag' does not exist." }

$resolvedArchive = [System.IO.Path]::GetFullPath($archiveRoot)
$resolvedDestination = [System.IO.Path]::GetFullPath($destination)
if (-not $resolvedDestination.StartsWith($resolvedArchive + [System.IO.Path]::DirectorySeparatorChar)) {
    throw "Resolved worktree path escaped the release-worktree directory."
}

if (Test-Path -LiteralPath $resolvedDestination) {
    Write-Output "Release worktree already exists: $resolvedDestination"
    exit 0
}

New-Item -ItemType Directory -Force -Path $resolvedArchive | Out-Null
& git -C $repoRoot worktree add --detach $resolvedDestination $Tag
if ($LASTEXITCODE -ne 0) { throw "Could not open release worktree for '$Tag'." }

$commit = (& git -C $resolvedDestination rev-parse HEAD).Trim()
Write-Output "Opened $Tag at $commit"
Write-Output "Source: $resolvedDestination"
Write-Output "Your current branch and working tree were not changed."
