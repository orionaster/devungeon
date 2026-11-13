// This is a consumer entry for the actual HERO App/DungeonScene. No renderer,
// combat, locale store or Agent command implementation is duplicated here.
import { createRoot } from 'react-dom/client';
import { useRef, useState } from 'react';
import App from '@hero/App';
import { runtime } from '@hero/runtime';
import { AgentProjection } from '@hero/engine';
import { I18nProvider, useI18n } from '@shared-i18n';
import '@hero/style.css';
import { compileWorld, describeHeroRooms, renderWorldMessage, renderWorldName, toHeroScene, type CompiledWorld, type HeroScene, type ProjectSnapshot } from '../../src/index.js';
import tiny from '../../../../examples/tiny-landing-page.json';
import complex from '../../../../examples/agent-workbench-synthetic.json';
import expanded from '../../examples/tiny-landing-page-expanded.snapshot.json';

const fixtures: Record<string, ProjectSnapshot> = { tiny: tiny as ProjectSnapshot, complex: complex as ProjectSnapshot, expanded: expanded as ProjectSnapshot };
interface Bundle { fixture: string; snapshot: ProjectSnapshot; world: CompiledWorld; scene: HeroScene; events: AgentProjection }
const observedGames = new WeakMap<object, number>(); let gameSequence = 0;
function ProofHost() {
  const { t, formatDateTime } = useI18n();
  const saved = useRef(new Map<string, CompiledWorld['layout']>());
  function load(id: string): Bundle {
    const snapshot = structuredClone(fixtures[id]!);
    const result = compileWorld(snapshot, { seed: 1337, previous: saved.current.get(snapshot.project.id) });
    if (!result.ok) throw Error(JSON.stringify(result.diagnostics));
    saved.current.set(snapshot.project.id, result.world.layout);
    const scene = toHeroScene(result.world, { includeEnemies: true, includeAgents: true });
    return { fixture: id, snapshot, world: result.world, scene, events: new AgentProjection(snapshot.project.id, scene.agents.map(a => a.agent_id)) };
  }
  const initial = new URLSearchParams(window.location.search).get('fixture');
  const [bundle, setBundle] = useState(() => load(initial && Object.hasOwn(fixtures, initial) ? initial : 'tiny'));
  const display = describeHeroRooms(bundle.world, bundle.scene);
  // Read-only source/engine identity observations for reproducible keyboard QA.
  Object.defineProperty(window, '__BUILDER_INTEGRATION__', { configurable: true, value: {
    snapshot: () => {
      const game = runtime.game;
      if (game && !observedGames.has(game)) observedGames.set(game, ++gameSequence);
      return structuredClone({ fixture: bundle.fixture, project: bundle.snapshot, world: bundle.world, scene: bundle.scene, engine_instance_id: game ? observedGames.get(game) : null, game: game?.snapshot() });
    }
  } });
  const panel = <section data-builder-source="true" style={{ padding: 10, color: '#c7d8e4', fontFamily: 'system-ui, sans-serif' }}>
    <label>{t('game.inspector.source')} · BUILDER → HERO
      <select aria-label={t('game.inspector.source')} data-testid="builder-fixture" value={bundle.fixture}
        onChange={event => setBundle(load(event.target.value))} style={{ width: '100%', marginTop: 8, padding: 8 }}>
        {Object.entries(fixtures).map(([id, s]) => <option key={id} value={id}>{s.project.name} · {s.revision}</option>)}
      </select>
    </label>
    <p>{t('world.source.original')}: {bundle.snapshot.project.name}</p>
    <p>{bundle.snapshot.project.id} · {bundle.snapshot.revision}</p>
    <p><time dateTime={bundle.snapshot.observed_at}>{formatDateTime(bundle.snapshot.observed_at)}</time></p>
    <p>{t('game.journal.acceptanceNotice')}</p>
  </section>;
  return <App key={bundle.scene.worldId} scene={bundle.scene} agentEvents={bundle.events} demoEvents={false}
    sourcePanel={panel} roomDisplay={room => {
      const ref = display.find(r => r.room_id === room.room_id)!;
      return { name: renderWorldName(ref.name, t), status: renderWorldMessage(ref.status, t), reason: ref.reasons.map(reason => renderWorldMessage(reason, t)).join(' ') };
    }} />;
}
createRoot(document.getElementById('root')!).render(<I18nProvider><ProofHost /></I18nProvider>);
