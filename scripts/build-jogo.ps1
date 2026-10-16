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
    $sourceCommit = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel identificar a versao do jogo.' }
    $sourceDirty = [bool](& git status --porcelain)
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Typecheck do jogo falhou.' }
    & npx vite build --base ./
    if ($LASTEXITCODE -ne 0) { throw 'Build do jogo falhou.' }
    if ((& git rev-parse HEAD).Trim() -ne $sourceCommit -or [bool](& git status --porcelain) -ne $sourceDirty) {
        throw 'A fonte do jogo mudou durante o build; gere novamente antes de publicar.'
    }
    $identity = @{
        schemaVersion = 1
        sourceRepository = 'VictorCardosoPDev/Heroes_Trial'
        sourceCommit = $sourceCommit
        sourceDirty = $sourceDirty
        engine = 'phaser'
        integration = 'catalog-local-v3'
        base = './'
    } | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $game 'dist\pages-source.json'), $identity + "`n", [Text.UTF8Encoding]::new($false))
    & node tools/build-offline-shell.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Build offline do jogo falhou.' }
    & node (Join-Path $PSScriptRoot 'prune-jogo-dist.mjs') (Join-Path $game 'dist')
    if ($LASTEXITCODE -ne 0) { throw 'Limpeza do bundle do jogo falhou.' }
} finally {
    Pop-Location
    $env:WEB_BUILD_DIR = $previousBuildDirectory
    $env:WEB_INCLUDE_TEST_HARNESS = $previousHarness
    Exit-MaintenanceBuildLock $mutex
}
