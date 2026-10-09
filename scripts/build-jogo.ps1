$ErrorActionPreference = 'Stop'
$game = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\Heroes_Trial\web-poc'))
. (Join-Path $game 'tools\build-lock.ps1')
$mutex = Enter-MaintenanceBuildLock
$previousBuildDirectory = $env:WEB_BUILD_DIR
$previousHarness = $env:WEB_INCLUDE_TEST_HARNESS
$env:WEB_BUILD_DIR = $null
$env:WEB_INCLUDE_TEST_HARNESS = $null
Push-Location $game
try {
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Typecheck do jogo falhou.' }
    & npx vite build --base ./
    if ($LASTEXITCODE -ne 0) { throw 'Build do jogo falhou.' }
    & node tools/build-offline-shell.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Build offline do jogo falhou.' }
} finally {
    Pop-Location
    $env:WEB_BUILD_DIR = $previousBuildDirectory
    $env:WEB_INCLUDE_TEST_HARNESS = $previousHarness
    Exit-MaintenanceBuildLock $mutex
}
