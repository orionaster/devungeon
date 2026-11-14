import tinyFixture from "../../../examples/tiny-landing-page.json";
import workbenchFixture from "../../../examples/agent-workbench-synthetic.json";
import {
  compileWorld,
  describeHeroRooms,
  describeWorld,
  toHeroScene,
  type CompiledWorld,
  type Diagnostic,
  type HeroScene,
  type ProjectGraph,
  type ProjectSnapshot,
  type WorldDisplay,
  type WorldRoomDisplay,
} from "../../../packages/world-generator/src/index";
import {
  canonical,
  GenerationError,
} from "../../../packages/world-generator/src/util";

export type DemoProjectSelection = "tiny" | "workbench";
export const DEMO_EXTENSION_ID = "forge-demo-extension";

/** Source fixtures stay canonical; the locale is a presentation concern. */
export const DEMO_PROJECTS = [
  { id: "tiny", snapshot: tinyFixture as ProjectSnapshot },
  { id: "workbench", snapshot: workbenchFixture as ProjectSnapshot },
] as const;

export interface ProjectWorld {
  ok: true;
  snapshot: ProjectSnapshot;
  world: CompiledWorld;
  scene: HeroScene;
  /** HERO App's roomDisplay prop consumes this renderer-neutral sidecar. */
  roomDisplay: WorldRoomDisplay[];
  display: WorldDisplay;
}
export interface ProjectWorldFailure {
  ok: false;
  diagnostics: Diagnostic[];
  fallback_graph: ProjectGraph | null;
}
export type ProjectWorldResult = ProjectWorld | ProjectWorldFailure;

const freeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};

const projectIdOf = (input: unknown): string | undefined => {
  if (!input || typeof input !== "object" || !("project" in input)) return;
  const project = input.project;
  if (
    project &&
    typeof project === "object" &&
    "id" in project &&
    typeof project.id === "string"
  )
    return project.id;
};

/** An observation clock alone must not replace a running game scene. Canonical
 * graph order makes equivalent inputs stable even when API arrays are reordered.
 * Revision and every source fact, including Agent identity/status, are retained.
 */
const factKey = (world: CompiledWorld) => {
  const { observed_at: _observedAt, ...facts } = world.graph;
  return canonical(facts);
};

/** First-pack adapter with one persistent layout per source project. It owns no
 * game state, command capability, React lifecycle, locale, I/O or wall clock.
 * Its lifetime belongs above the selected-project/game component lifecycle.
 */
export function createProjectWorldStore(seed = 1337) {
  const projects = new Map<string, ProjectWorld>();
  const keys = new Map<string, string>();

  const compile = (input: unknown): ProjectWorldResult => {
    const id = projectIdOf(input);
    const previous = id ? projects.get(id) : undefined;
    const result = compileWorld(input, {
      seed,
      previous: previous?.world.layout,
    });
    if (!result.ok) return result;
    const key = factKey(result.world);
    if (previous && keys.get(result.world.graph.project.id) === key)
      return previous;
    try {
      const scene = toHeroScene(result.world, {
        includeEnemies: true,
        includeAgents: true,
      });
      const value: ProjectWorld = freeze({
        ok: true,
        snapshot: structuredClone(input) as ProjectSnapshot,
        world: result.world,
        scene,
        roomDisplay: describeHeroRooms(result.world, scene),
        display: describeWorld(result.world),
      });
      projects.set(value.snapshot.project.id, value);
      keys.set(value.snapshot.project.id, key);
      return value;
    } catch (error) {
      if (error instanceof GenerationError)
        return {
          ok: false,
          diagnostics: [error.diagnostic()],
          fallback_graph: result.world.graph,
        };
      throw error;
    }
  };

  return {
    compile,
    get: (projectId: string) => projects.get(projectId),
    /** Switching back to a DEMO project preserves its incrementally extended map. */
    getBySelection: (selection: DemoProjectSelection): ProjectWorldResult => {
      const source = DEMO_PROJECTS.find((entry) => entry.id === selection)!;
      return (
        projects.get(source.snapshot.project.id) ?? compile(source.snapshot)
      );
    },
    /** Explicit, repeatable DEMO input change. Never acts on a real source and
     * never changes any existing feature status or acceptance evidence.
     */
    addDemoFeature: (projectId: string): ProjectWorldResult => {
      const previous = projects.get(projectId);
      if (
        !previous ||
        previous.snapshot.project.source.kind !== "synthetic" ||
        !previous.snapshot.project.source.is_demo
      ) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "DEMO_PROJECT_REQUIRED",
              severity: "error",
              message:
                "The incremental example requires a selected synthetic DEMO project.",
            },
          ],
          fallback_graph: previous?.world.graph ?? null,
        };
      }
      if (previous.snapshot.rooms.some((room) => room.id === DEMO_EXTENSION_ID))
        return previous;
      const next = structuredClone(previous.snapshot);
      next.revision = `${next.revision}-forge-extension`;
      next.rooms.push({
        id: DEMO_EXTENSION_ID,
        zone_id: next.zones[0]!.id,
        name: "DEMO incremental feature",
        summary: "Synthetic example only; no source project has been modified.",
        status: "planned",
        depends_on: [previous.world.graph.topological_order[0]!],
        acceptance_criteria: [
          "Synthetic example only; separate acceptance evidence is still required.",
        ],
        evidence: [],
      });
      return compile(next);
    },
  };
}
