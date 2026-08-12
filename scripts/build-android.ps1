param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("stable", "development")]
    [string]$Channel
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $repoRoot "frontend"
$releaseRoot = Join-Path $repoRoot "releases"
$currentBranch = (& git -C $repoRoot branch --show-current).Trim()
$requiredBranch = if ($Channel -eq "stable") { "stable" } else { "development" }

if ($currentBranch -ne $requiredBranch) {
    throw "Build channel '$Channel' must be built from branch '$requiredBranch' (current: '$currentBranch')."
}

$jdkRoot = Get-ChildItem (Join-Path $repoRoot ".tools\jdk21") -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1
if (-not $jdkRoot) {
    throw "Project-local JDK 21 was not found under .tools\jdk21."
}

$env:JAVA_HOME = $jdkRoot.FullName
$env:Path = "$($env:JAVA_HOME)\bin;$($env:Path)"
$env:NEXT_PUBLIC_APP_CHANNEL = $Channel
$env:FITNESS_COMPANION_CHANNEL = $Channel

$flavor = if ($Channel -eq "stable") { "Stable" } else { "Dev" }
$outputFlavor = if ($Channel -eq "stable") { "stable" } else { "dev" }
$gradleText = Get-Content (Join-Path $frontendRoot "android\app\build.gradle") -Raw
$versionMatch = [regex]::Match($gradleText, 'versionName\s+"([^"]+)"')
if (-not $versionMatch.Success) { throw "Could not read versionName from Android build.gradle." }
$versionName = $versionMatch.Groups[1].Value
$outputName = "FitnessCompanion-$versionName-$outputFlavor.apk"

Push-Location $frontendRoot
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Next.js build failed." }

    & npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) { throw "Capacitor Android sync failed." }

    Push-Location "android"
    try {
        & .\gradlew.bat "assemble${flavor}Debug" --no-daemon --no-parallel --max-workers=1
        if ($LASTEXITCODE -ne 0) { throw "Android Gradle build failed." }
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}

$apk = Join-Path $frontendRoot "android\app\build\outputs\apk\$outputFlavor\debug\app-$outputFlavor-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) { throw "Expected APK was not created: $apk" }

New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
$destination = Join-Path $releaseRoot $outputName
Copy-Item -LiteralPath $apk -Destination $destination -Force
$hash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash

Write-Output "Built: $destination"
Write-Output "SHA256: $hash"
