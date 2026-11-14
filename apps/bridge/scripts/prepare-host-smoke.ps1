param(
  [string]$HostRevision = 'fb953cacc55e8d12d5750c959bb20452c0954cd6',
  [int]$HostPort = 4178,
  [int]$BridgePort = 4318
)
$ErrorActionPreference = 'Stop'
if ($HostRevision -notmatch '^[0-9a-f]{40}$') { throw 'Select an exact reviewed host revision' }
if ($HostPort -lt 1024 -or $HostPort -gt 65535 -or $BridgePort -lt 1024 -or $BridgePort -gt 65535) { throw 'Invalid loopback port' }
$scoutRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../..')).Path
$scoutScratch = Join-Path $scoutRoot '.devungeon-scout/host-smoke'
$scoutExport = Join-Path $scoutScratch $HostRevision
New-Item -ItemType Directory -Force -Path $scoutScratch | Out-Null
if (Test-Path -LiteralPath $scoutExport) { throw "Export already exists; preserve it and select a new directory/revision deliberately: $scoutExport" }
$scoutArchive = Join-Path $scoutScratch ($HostRevision + '.zip')
git -C $scoutRoot archive --format=zip "--output=$scoutArchive" $HostRevision
if ($LASTEXITCODE -ne 0) { throw 'Cannot export reviewed host source' }
Expand-Archive -LiteralPath $scoutArchive -DestinationPath $scoutExport
$scoutBridgeSource = Join-Path $scoutExport 'apps/bridge/src'
New-Item -ItemType Directory -Force -Path $scoutBridgeSource | Out-Null
Copy-Item -LiteralPath (Join-Path $scoutRoot 'apps/bridge/src/same-origin.ts') -Destination $scoutBridgeSource
# No repository/worktree/branch is created. This config selects the existing real
# HERO scene + WIZARD host and the new read-only middleware; no Codex server plugin.
$scoutConfig = @"
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {createScoutMiddleware} from '../../apps/bridge/src/same-origin.ts';
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), {name:'scout-wave2-readonly', configureServer(server) {
    server.middlewares.use(createScoutMiddleware({hostOrigin:'http://127.0.0.1:$HostPort', bridgePort:$BridgePort}));
  }}],
  publicDir:'../../apps/web/public',
  resolve:{dedupe:['react','react-dom','three','@react-three/fiber']},
  server:{host:'127.0.0.1',port:$HostPort,strictPort:true}
});
"@
[IO.File]::WriteAllText((Join-Path $scoutExport 'packages/workspace-ui/vite.scout-smoke.config.ts'), $scoutConfig, [Text.UTF8Encoding]::new($false))
$scoutRecord = @{
  host_revision=$HostRevision
  scout_revision=(git -C $scoutRoot rev-parse HEAD)
  middleware_sha256=(Get-FileHash -LiteralPath (Join-Path $scoutBridgeSource 'same-origin.ts')).Hash.ToLowerInvariant()
  host_origin="http://127.0.0.1:$HostPort"
  bridge_port=$BridgePort
  note='Isolated tracked-source export with a replacement development config only; no source/app rewrite, provider process, global hook or new worktree.'
}
$scoutRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $scoutExport 'scout-smoke-source.json') -Encoding utf8
Write-Output "Prepared isolated host export: $scoutExport"
Write-Output 'Next: npm ci --ignore-scripts in that export, then:'
Write-Output 'node node_modules/vite/bin/vite.js --config packages/workspace-ui/vite.scout-smoke.config.ts'
Write-Output "Existing HERO/WIZARD scene: http://127.0.0.1:$HostPort/?source=hero&connection=scout"
