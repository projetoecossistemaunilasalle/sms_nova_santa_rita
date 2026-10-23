param (
    [ValidateNotNullOrEmpty()]
    [string] $PortalOrigins = 'self',
    [ValidateNotNullOrEmpty()]
    [string] $GameRoot = $(if ($env:GAME_PROJECT_ROOT) { $env:GAME_PROJECT_ROOT } else { '..\Heroes_Trial\web-poc' }),
    [switch] $AllowDirty
)

$ErrorActionPreference = 'Stop'
$portalRoot = Split-Path -Parent $PSScriptRoot
if (![IO.Path]::IsPathRooted($GameRoot)) { $GameRoot = Join-Path $portalRoot $GameRoot }
$gameRoot = (Resolve-Path -LiteralPath $GameRoot).Path
$status = @(& git -C $gameRoot status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'Cannot read game repository status.' }
$dirty = $status.Count -gt 0
if ($dirty -and !$AllowDirty) { throw 'Game repository is dirty. Commit or stash changes, or pass -AllowDirty.' }
$commit = & git -C $gameRoot rev-parse --verify HEAD
if ($LASTEXITCODE -ne 0) { throw 'Cannot read game commit.' }
$branch = & git -C $gameRoot symbolic-ref --quiet --short HEAD
if ($LASTEXITCODE -eq 1) { $branch = $null }
elseif ($LASTEXITCODE -ne 0) { throw 'Cannot read game branch.' }

$package = Get-Content -LiteralPath (Join-Path $gameRoot 'package.json') -Raw | ConvertFrom-Json
$build = $package.scripts.build
# Follow referenced scripts read-only: the cross-process mutex is not reentrant.
$ownsLock = $build -match 'build-lock|HeroesTrialMaintenanceBuild|Enter-MaintenanceBuildLock'
foreach ($match in [regex]::Matches($build, '[\w./\\-]+\.ps1')) {
    $script = [IO.Path]::GetFullPath((Join-Path $gameRoot $match.Value))
    if (!$script.StartsWith($gameRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Build script escapes game root.' }
    $source = Get-Content -LiteralPath $script -Raw
    if ($source -match 'build-lock|HeroesTrialMaintenanceBuild|Enter-MaintenanceBuildLock') { $ownsLock = $true }
}
$mutex = $null
$oldOrigin = $env:VITE_PORTAL_ORIGINS
$oldBuildDir = $env:WEB_BUILD_DIR
$oldHarness = $env:WEB_INCLUDE_TEST_HARNESS
try {
    if (!$ownsLock) {
        if ($build -ne 'npm run typecheck && vite build && node tools/build-offline-shell.mjs') {
            throw 'Unrecognized unlocked build pipeline. Review package.json before updating this helper.'
        }
        . (Join-Path $gameRoot 'tools\build-lock.ps1')
        $mutex = Enter-MaintenanceBuildLock
    }
    $env:VITE_PORTAL_ORIGINS = $PortalOrigins
    $env:WEB_BUILD_DIR = 'dist'
    $env:WEB_INCLUDE_TEST_HARNESS = '0'
    Push-Location -LiteralPath $gameRoot
    try {
        if ($ownsLock) {
            # The game-owned wrapper must forward --base to Vite. Validation
            # below rejects absolute output; no outer mutex is held here.
            & npm.cmd run build -- --base=./
            if ($LASTEXITCODE -ne 0) { throw 'Game-owned build failed.' }
        } else {
            & npm.cmd run typecheck
            if ($LASTEXITCODE -ne 0) { throw 'Game typecheck failed.' }
            & node node_modules/vite/bin/vite.js build --base=./
            if ($LASTEXITCODE -ne 0) { throw 'Game Vite build failed.' }
            & node tools/build-offline-shell.mjs
            if ($LASTEXITCODE -ne 0) { throw 'Game offline shell generation failed.' }
        }
    } finally { Pop-Location }
    $dist = Join-Path $gameRoot 'dist'
    foreach ($name in @('index.html', 'offline-shell.json', 'content-manifest.json')) {
        if (!(Test-Path -LiteralPath (Join-Path $dist $name))) { throw "Missing build artifact: $name" }
    }
    $html = Get-Content -LiteralPath (Join-Path $dist 'index.html') -Raw
    if ($html -notmatch '(?:src|href)="\./assets/' -or $html -match '(?:src|href)="/assets/') {
        throw 'Game build must use a relative Vite base (./). Nothing copied.'
    }
    $manifest = Get-Content -LiteralPath (Join-Path $dist 'content-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $target = [IO.Path]::GetFullPath((Join-Path $portalRoot 'public\jogo-cliente'))
    $publicRoot = [IO.Path]::GetFullPath((Join-Path $portalRoot 'public'))
    $expected = $publicRoot + [IO.Path]::DirectorySeparatorChar
    if (!$target.StartsWith($expected, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $target -Leaf) -ne 'jogo-cliente') { throw 'Unsafe copy target.' }
    if ((Test-Path -LiteralPath $publicRoot) -and ((Get-Item -LiteralPath $publicRoot).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Public directory cannot be a junction/symlink.' }
    if ((Test-Path -LiteralPath $target) -and ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Copy target cannot be a junction/symlink.' }
    # Stage outside public/ and swap at the end, so an interrupted copy never
    # leaves a partial bundle that the next portal build would package.
    $staging = Join-Path $portalRoot '.jogo-cliente.staging'
    $backup = Join-Path $portalRoot '.jogo-cliente.previous'
    foreach ($dir in @($staging, $backup)) { if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force } }
    New-Item -ItemType Directory -Path $staging | Out-Null
    Get-ChildItem -LiteralPath $dist -Force | Copy-Item -Destination $staging -Recurse -Force
    $distCount = @(Get-ChildItem -LiteralPath $dist -Recurse -File -Force).Count
    $stagedCount = @(Get-ChildItem -LiteralPath $staging -Recurse -File -Force).Count
    if ($stagedCount -ne $distCount) { throw "Staged copy has $stagedCount files, build has $distCount." }
    $info = [ordered]@{
        source = 'Heroes_Trial/web-poc'
        commit = $commit
        branch = $branch
        dirty = $dirty
        portalOrigins = $PortalOrigins
        contentVersion = $manifest.content_version
        builtAt = [DateTime]::UtcNow.ToString('o')
    }
    # Serialize scalar values individually for identical two-space JSON in 5.1/7.
    $lines = @('{')
    $keys = @($info.Keys)
    for ($index = 0; $index -lt $keys.Count; $index++) {
        $key = $keys[$index]
        # Windows PowerShell 5.1 emits nothing for $null.
        $value = if ($null -eq $info[$key]) { 'null' } else { ConvertTo-Json -InputObject $info[$key] -Compress -Depth 20 }
        $comma = if ($index -lt $keys.Count - 1) { ',' } else { '' }
        $lines += '  "' + $key + '": ' + $value + $comma
    }
    $lines += '}'
    [IO.File]::WriteAllText((Join-Path $staging 'bundle-info.json'), ($lines -join "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))
    if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination $backup }
    try { Move-Item -LiteralPath $staging -Destination $target }
    catch {
        if (Test-Path -LiteralPath $backup) { Move-Item -LiteralPath $backup -Destination $target }
        throw
    }
    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
    Write-Output "Game copied. After deploy, import public/jogo-cliente/content-manifest.json in `"Vers$([char]0x00F5)es do jogo`"."
} finally {
    $env:VITE_PORTAL_ORIGINS = $oldOrigin
    $env:WEB_BUILD_DIR = $oldBuildDir
    $env:WEB_INCLUDE_TEST_HARNESS = $oldHarness
    if ($mutex) { Exit-MaintenanceBuildLock $mutex }
}
