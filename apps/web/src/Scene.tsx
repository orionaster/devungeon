import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";
import {
  DEMO_SCENE,
  geometry,
  visibleDoorSeals,
  type Actor,
  type Enemy,
  type GameSnapshot,
  type SceneDefinition,
  type AgentProjection,
  type SceneDoor,
} from "../../../packages/dungeon-engine/src";
import { spriteTexture, tileTexture, type SpriteKind } from "./art";
import {
  cameraControl,
  pointer,
  projection,
  readInput,
  runtime,
} from "./runtime";
const SceneContext = createContext<SceneDefinition>(DEMO_SCENE);
/** Read-only event port: the host owns source scope, provenance and command permissions. */
type AgentEventReader = Pick<AgentProjection, "actor">;
const AgentEventsContext = createContext<AgentEventReader>(projection);
const INACTIVE_EVENTS: AgentEventReader = {
  actor: () => ({ event: undefined, stale: true }),
};
const SelectAgentContext = createContext<(id: string) => void>((id) =>
  runtime.selectAgent?.(id),
);
const temp = new THREE.Object3D();
const EMPTY: GameSnapshot = {
  player: {
    x: -8,
    z: 1,
    facing: { x: 1, z: 0 },
    moving: false,
    hp: 100,
    maxHp: 100,
    hurt: 0,
  },
  enemies: [],
  effects: [],
  projectiles: [],
  attackTime: 0,
  attackDirection: { x: 1, z: 0 },
  dodgeTime: 0,
  dodgeCooldown: 0,
  phase: "ready",
  kills: 0,
  total: 0,
  rewardClaimed: false,
  stats: {
    attacks: 0,
    dodges: 0,
    hitsTaken: 0,
    damageDealt: 0,
    blockedMoves: 0,
  },
  time: 0,
};
function Instanced({
  positions,
  size,
  color,
  texture,
}: {
  positions: number[][];
  size: [number, number, number];
  color: string;
  texture?: THREE.Texture;
}) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    positions.forEach((p, i) => {
      temp.position.set(p[0], p[1], p[2]);
      temp.rotation.set(0, 0, 0);
      temp.scale.set(1, 1, 1);
      temp.updateMatrix();
      ref.current.setMatrixAt(i, temp.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, positions.length]}
      frustumCulled={false}
    >
      <boxGeometry args={size} />
      <meshLambertMaterial map={texture} color={color} />
    </instancedMesh>
  );
}
function Environment() {
  const scene = useContext(SceneContext),
    worldGeometry = useMemo(() => geometry(scene), [scene]);
  const floors = useMemo(
    () =>
      worldGeometry.tiles
        .filter((t) => !t.locked)
        .map((t) => [t.x, -0.16, t.z]),
    [worldGeometry],
  );
  const locked = useMemo(
    () =>
      worldGeometry.tiles.filter((t) => t.locked).map((t) => [t.x, -0.16, t.z]),
    [worldGeometry],
  );
  const walls = useMemo(
    () =>
      worldGeometry.walls
        .filter((w) => w.width < 0.5)
        .map((w) => [w.x, 0.35, w.z]),
    [worldGeometry],
  );
  const others = useMemo(
    () =>
      worldGeometry.walls
        .filter((w) => w.depth < 0.5)
        .map((w) => [w.x, 0.35, w.z]),
    [worldGeometry],
  );
  return (
    <>
      <Instanced
        positions={floors}
        size={[1, 0.3, 1]}
        texture={tileTexture("floor")}
        color="#ffffff"
      />
      <Instanced
        positions={locked}
        size={[1, 0.3, 1]}
        texture={tileTexture("locked")}
        color="#9b8aba"
      />
      <Instanced
        positions={walls}
        size={[0.22, 1, 1.22]}
        texture={tileTexture("wall")}
        color="#adc0cf"
      />
      <Instanced
        positions={others}
        size={[1.22, 1, 0.22]}
        texture={tileTexture("wall")}
        color="#adc0cf"
      />
      {/* Low outer walls retain solid collision height: all camera headings remain readable. */}
      {scene.rooms.map((r) => (
        <mesh key={r.room_id} position={[r.x, -0.44, r.z]}>
          <boxGeometry args={[r.width + 0.5, 0.35, r.depth + 0.5]} />
          <meshLambertMaterial color={r.enterable ? "#182a36" : "#2b253b"} />
        </mesh>
      ))}
      {scene.obstacles.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, p.kind === "pillar" ? 0.65 : 0.36, 0]}>
            <boxGeometry
              args={[p.width, p.kind === "pillar" ? 1.3 : 0.72, p.depth]}
            />
            <meshLambertMaterial
              color={p.kind === "pillar" ? "#64808b" : "#9a6b44"}
              map={tileTexture("wall")}
            />
          </mesh>
          <mesh position={[0, p.kind === "pillar" ? 1.35 : 0.75, 0]}>
            <boxGeometry args={[1.18, 0.14, 1.18]} />
            <meshLambertMaterial
              color={p.kind === "pillar" ? "#73928d" : "#d49a58"}
            />
          </mesh>
        </group>
      ))}
      {visibleDoorSeals(scene).map((door, i) => (
        <Gate key={`${door.room_id}:${i}`} door={door} />
      ))}
      {scene.rooms
        .filter((r) => !r.enterable)
        .map((room) => (
          <group key={room.room_id}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[room.x, 0.015, room.z]}
            >
              <ringGeometry args={[2, 2.1, 4]} />
              <meshBasicMaterial color="#b89ae1" />
            </mesh>
            <Pixel kind="chest" position={[room.x, 0.1, room.z]} scale={1.5} />
          </group>
        ))}
      {scene.rooms
        .flatMap((r) => [
          [r.x - r.width / 2 + 1, r.z - r.depth / 2 + 1],
          [r.x + r.width / 2 - 1, r.z + r.depth / 2 - 1],
        ])
        .map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[0.32, 0.9, 0.32]} />
              <meshLambertMaterial color="#b07846" />
            </mesh>
            <Pixel kind="flame" position={[0, 0.9, 0]} scale={0.7} animate />
            <pointLight
              position={[0, 1.1, 0]}
              intensity={2}
              distance={4}
              color="#ffb35e"
            />
          </group>
        ))}
      {/* Original rune inlay and room edges, built from world geometry. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[
          (scene.reward ?? scene.spawn).x,
          0.012,
          (scene.reward ?? scene.spawn).z,
        ]}
      >
        <ringGeometry args={[2.7, 2.75, 32]} />
        <meshBasicMaterial color="#977749" transparent opacity={0.5} />
      </mesh>
      {scene.worldId === DEMO_SCENE.worldId && (
        <>
          <mesh position={[-12, 0.3, -3.5]}>
            <boxGeometry args={[2.2, 0.6, 0.9]} />
            <meshLambertMaterial color="#6a4e46" />
          </mesh>
          <mesh position={[-12, 0.68, -3.5]}>
            <boxGeometry args={[2.35, 0.16, 1]} />
            <meshLambertMaterial color="#b58554" />
          </mesh>
        </>
      )}
    </>
  );
}
function Gate({ door }: { door: SceneDoor }) {
  const width = door.width ?? 1;
  const bars = useMemo(() => {
    const n = Math.max(3, Math.ceil(width / 0.43));
    return Array.from({ length: n }, (_, i) => [
      0,
      0.95,
      ((i - (n - 1) / 2) * width) / n,
    ]);
  }, [width]);
  const glow = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (glow.current)
      (glow.current.material as THREE.MeshBasicMaterial).opacity =
        runtime.reducedEffects
          ? 0.12
          : 0.15 + Math.sin(clock.elapsedTime * 2) * 0.04;
  });
  return (
    <group>
      <group
        position={[door.x, 0, door.z]}
        rotation={[0, door.axis === "z" ? 0 : Math.PI / 2, 0]}
      >
        <Instanced positions={bars} size={[0.16, 1.9, 0.1]} color="#bd91df" />
        <mesh position={[0, 1.9, 0]}>
          <boxGeometry args={[0.4, 0.22, width + 0.1]} />
          <meshLambertMaterial color="#8d699c" />
        </mesh>
        <mesh ref={glow} position={[0, 0.95, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[width, 1.9]} />
          <meshBasicMaterial
            color="#b18bdd"
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
function Pixel({
  kind,
  position = [0, 0, 0],
  scale = 1,
  animate = false,
  onClick,
}: {
  kind: SpriteKind;
  position?: [number, number, number];
  scale?: number;
  animate?: boolean;
  onClick?: () => void;
}) {
  const ref = useRef<THREE.Sprite>(null!);
  useFrame(({ clock }) => {
    if (
      animate &&
      (ref.current.material as THREE.SpriteMaterial).map !==
        spriteTexture(kind, Math.floor(clock.elapsedTime * 6) % 4)
    )
      (ref.current.material as THREE.SpriteMaterial).map = spriteTexture(
        kind,
        Math.floor(clock.elapsedTime * 6) % 4,
      );
  });
  return (
    <sprite
      ref={ref}
      position={position}
      scale={[scale, scale * 1.5, 1]}
      center={[0.5, 0]}
      onPointerDown={onClick ? (e) => e.stopPropagation() : undefined}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      <spriteMaterial
        map={spriteTexture(kind)}
        transparent
        alphaTest={0.1}
        depthWrite={false}
      />
    </sprite>
  );
}
function Character({ enemyIndex }: { enemyIndex?: number }) {
  const scene = useContext(SceneContext);
  const ref = useRef<THREE.Group>(null!);
  const sprite = useRef<THREE.Sprite>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const bar = useRef<THREE.Mesh>(null!);
  const windup = useRef<THREE.Mesh>(null!);
  useFrame(({ camera }) => {
    const s = runtime.frame ?? EMPTY;
    const a: Actor | Enemy | undefined =
      enemyIndex === undefined ? s.player : s.enemies[enemyIndex];
    if (!a) return;
    ref.current.visible = a.hp > 0;
    ref.current.position.set(a.x, 0.02, a.z);
    const kind = enemyIndex === undefined ? "hero" : (a as Enemy).kind;
    const heading = (cameraControl.heading * Math.PI) / 2;
    const dx = a.facing.x * Math.cos(heading) - a.facing.z * Math.sin(heading),
      dz = a.facing.x * Math.sin(heading) + a.facing.z * Math.cos(heading);
    const facing =
      Math.abs(dx) > Math.abs(dz)
        ? dx > 0
          ? "right"
          : "left"
        : dz > 0
          ? "front"
          : "back";
    const frame = Math.floor(s.time * (a.moving ? 10 : 4)) % 4;
    const mat = sprite.current.material as THREE.SpriteMaterial;
    mat.map = spriteTexture(kind, frame, facing);
    mat.color.set(
      a.hurt > 0
        ? "#ffffff"
        : enemyIndex === undefined && s.dodgeTime > 0
          ? "#88ffe3"
          : "#ffffff",
    );
    mat.opacity = a.hurt > 0 ? 0.6 : 1;
    sprite.current.position.y =
      (runtime.reducedEffects
        ? 0
        : Math.sin(s.time * (a.moving ? 20 : 5)) * (a.moving ? 0.055 : 0.018)) +
      (enemyIndex === undefined && s.dodgeTime > 0 ? 0.16 : 0);
    shadow.current.scale.set(
      enemyIndex === undefined && s.dodgeTime > 0 ? 1.3 : 1,
      1,
      1,
    );
    if (bar.current) {
      bar.current.visible = a.hp < a.maxHp && a.hp > 0;
      bar.current.scale.x = a.hp / a.maxHp;
      bar.current.quaternion.copy(camera.quaternion);
    }
    if (windup.current) {
      const e = a as Enemy;
      windup.current.visible = e.state === "windup" || e.state === "strike";
      windup.current.scale.setScalar(
        e.state === "windup"
          ? 0.55 + (1 - Math.max(0, e.timer) / 0.8) * 0.65
          : 1.2,
      );
    }
  });
  return (
    <group ref={ref}>
      <mesh
        ref={shadow}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 0]}
      >
        <circleGeometry args={[0.4, 12]} />
        <meshBasicMaterial
          color="#06141d"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <sprite
        ref={sprite}
        scale={enemyIndex === undefined ? [1.1, 1.65, 1] : [1.15, 1.725, 1]}
        center={[0.5, 0]}
      >
        <spriteMaterial
          map={spriteTexture(
            enemyIndex === undefined ? "hero" : scene.enemies[enemyIndex].kind,
          )}
          transparent
          alphaTest={0.15}
          depthWrite={false}
        />
      </sprite>
      {enemyIndex !== undefined && (
        <>
          <mesh ref={bar} position={[0, 1.75, 0]}>
            <planeGeometry args={[0.8, 0.065]} />
            <meshBasicMaterial color="#e5939d" side={THREE.DoubleSide} />
          </mesh>
          <mesh
            ref={windup}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.035, 0]}
          >
            <ringGeometry args={[0.65, 0.72, 24]} />
            <meshBasicMaterial
              color="#f39b77"
              transparent
              opacity={0.75}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </group>
  );
}
function Agent({ index }: { index: number }) {
  const agentEvents = useContext(AgentEventsContext),
    selectAgent = useContext(SelectAgentContext);
  const a = useContext(SceneContext).agents[index],
    g = useRef<THREE.Group>(null!),
    spark = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const event = agentEvents.actor(a.agent_id);
    const age = event.event
      ? (Date.now() - Date.parse(event.event.observed_at)) / 1000
      : 99;
    const working =
      age < 3 &&
      !event.stale &&
      !!event.event &&
      ["started", "progress", "tool_call", "tested", "completed"].includes(
        event.event.event_type,
      );
    g.current.position.set(
      a.x +
        (working && !runtime.reducedEffects
          ? Math.sin(clock.elapsedTime * 3) * 0.15
          : 0),
      0.03,
      a.z,
    );
    spark.current.visible = working;
    spark.current.rotation.z = clock.elapsedTime;
    spark.current.position.y =
      1.8 +
      (runtime.reducedEffects ? 0 : Math.sin(clock.elapsedTime * 5) * 0.15);
  });
  return (
    <group ref={g}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.5, 0.55, 16]} />
        <meshBasicMaterial
          color={a.role === "wizard" ? "#b29cda" : "#71d2bc"}
          transparent
          opacity={0.5}
        />
      </mesh>
      <Pixel
        kind={a.role}
        scale={1.1}
        animate
        onClick={() => selectAgent(a.agent_id)}
      />
      <mesh ref={spark} position={[0, 1.8, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshBasicMaterial
          color={a.role === "wizard" ? "#d2b2ff" : "#f4bc69"}
        />
      </mesh>
    </group>
  );
}
function Effects() {
  const slash = useRef<THREE.Mesh>(null!),
    particles = useRef<THREE.InstancedMesh>(null!),
    bolts = useRef<THREE.InstancedMesh>(null!);
  const color = new THREE.Color();
  useFrame(() => {
    const s = runtime.frame ?? EMPTY;
    slash.current.visible = s.attackTime > 0;
    slash.current.position.set(s.player.x, 0.4, s.player.z);
    slash.current.rotation.set(
      -Math.PI / 2,
      0,
      Math.atan2(-s.attackDirection.z, s.attackDirection.x) -
        1.2 +
        (1 - s.attackTime / 0.23) * 1.3,
    );
    (slash.current.material as THREE.MeshBasicMaterial).opacity = Math.min(
      1,
      s.attackTime * 8,
    );
    let count = 0;
    for (const e of s.effects) {
      if (runtime.reducedEffects && count > 10) break;
      const t = 1 - e.life / e.maxLife;
      for (let j = 0; j < (runtime.reducedEffects ? 2 : 8); j++) {
        const a = (j * Math.PI) / 4;
        temp.position.set(
          e.x + Math.cos(a) * t * 1.2,
          0.3 + Math.sin(t * Math.PI) * 0.7,
          e.z + Math.sin(a) * t * 1.2,
        );
        temp.rotation.set(t * 3, j, t * 3);
        temp.scale.setScalar((1 - t) * 0.12);
        temp.updateMatrix();
        particles.current.setMatrixAt(count, temp.matrix);
        color.set(
          e.kind === "hurt"
            ? "#f3838c"
            : e.kind === "dash"
              ? "#7fe7d2"
              : "#ffd382",
        );
        particles.current.setColorAt(count++, color);
        if (count >= 320) break;
      }
      if (count >= 320) break;
    }
    particles.current.count = count;
    particles.current.instanceMatrix.needsUpdate = true;
    if (particles.current.instanceColor)
      particles.current.instanceColor.needsUpdate = true;
    s.projectiles.forEach((b, i) => {
      temp.position.set(b.x, 0.55, b.z);
      temp.scale.setScalar(1);
      temp.rotation.set(0, s.time * 5, 0);
      temp.updateMatrix();
      bolts.current.setMatrixAt(i, temp.matrix);
    });
    bolts.current.count = s.projectiles.length;
    bolts.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <mesh ref={slash}>
        <ringGeometry args={[0.95, 1.9, 16, 1, 0, 2.3]} />
        <meshBasicMaterial
          color="#ffe0a2"
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
        />
      </mesh>
      <instancedMesh
        ref={particles}
        args={[undefined, undefined, 320]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh
        ref={bolts}
        args={[undefined, undefined, 100]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[0.18, 0]} />
        <meshBasicMaterial color="#f89dab" />
      </instancedMesh>
    </>
  );
}
function CameraAndLoop() {
  const scene = useContext(SceneContext);
  const { camera, gl, size } = useThree();
  const notify = useRef(0),
    samples = useRef<number[]>([]),
    cameraPos = useMemo(() => new THREE.Vector3(), []),
    target = useMemo(() => new THREE.Vector3(), []);
  const bounds = useMemo(() => {
    const minX = Math.min(...scene.rooms.map((r) => r.x - r.width / 2)),
      maxX = Math.max(...scene.rooms.map((r) => r.x + r.width / 2)),
      minZ = Math.min(...scene.rooms.map((r) => r.z - r.depth / 2)),
      maxZ = Math.max(...scene.rooms.map((r) => r.z + r.depth / 2));
    return {
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
      width: maxX - minX,
      depth: maxZ - minZ,
    };
  }, [scene]);
  useFrame((_, dt) => {
    if (runtime.game) {
      if (!runtime.paused) runtime.game.step(readInput(), dt);
      runtime.frame = runtime.game.snapshot();
      notify.current += dt;
      if (notify.current >= 0.1) {
        notify.current = 0;
        runtime.onFrame?.(runtime.frame);
      }
    }
    const s = runtime.frame ?? EMPTY;
    const control = cameraControl;
    let tx = control.target.x,
      tz = control.target.z;
    if (control.mode === "follow") {
      tx = s.player.x;
      tz = s.player.z;
    } else if (control.mode === "overview") {
      tx = bounds.x;
      tz = bounds.z;
    } else if (control.mode === "preview") {
      const locked =
        scene.rooms.find(
          (r) => !r.enterable && r.room_id === control.previewRoomId,
        ) ?? scene.rooms.find((r) => !r.enterable);
      tx = locked?.x ?? bounds.x;
      tz = locked?.z ?? bounds.z;
    }
    control.target = { x: tx, z: tz };
    target.set(tx, 0, tz);
    const h = (control.heading * Math.PI) / 2;
    cameraPos.set(tx + Math.sin(h) * 21, 26, tz + Math.cos(h) * 21);
    const smoothing = runtime.reducedEffects ? 1 : 1 - Math.exp(-dt * 9);
    camera.position.lerp(cameraPos, smoothing);
    camera.lookAt(target);
    const cam = camera as THREE.OrthographicCamera;
    const fit = Math.min(
      size.width / ((control.heading % 2 ? bounds.depth : bounds.width) + 12),
      size.height / ((control.heading % 2 ? bounds.width : bounds.depth) + 10),
    );
    const zoom =
      control.mode === "overview" ? Math.min(control.zoom, fit) : control.zoom;
    cam.zoom = THREE.MathUtils.lerp(cam.zoom, zoom, smoothing);
    cam.updateProjectionMatrix();
    if (document.visibilityState === "visible" && dt > 0) {
      samples.current.push(dt * 1000);
      if (samples.current.length > 900) samples.current.shift();
      const sorted = [...samples.current].sort((a, b) => a - b);
      runtime.metrics.fps =
        1000 /
        (samples.current.reduce((a, b) => a + b, 0) / samples.current.length);
      runtime.metrics.p95Ms = sorted[Math.floor(sorted.length * 0.95)];
      runtime.metrics.worstMs = Math.max(runtime.metrics.worstMs, dt * 1000);
      runtime.metrics.frames++;
      runtime.metrics.drawCalls = gl.info.render.calls;
      runtime.metrics.triangles = gl.info.render.triangles;
    }
  });
  useEffect(() => {
    const ctx = gl.getContext(),
      ext = ctx.getExtension("WEBGL_debug_renderer_info");
    runtime.metrics.renderer = ext
      ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : ctx.getParameter(ctx.RENDERER);
  }, [gl]);
  return null;
}
export function DungeonScene({
  scene = DEMO_SCENE,
  agentEvents = projection,
  agentActivityEnabled = true,
  onSelectAgent,
  fallback,
}: {
  scene?: SceneDefinition;
  agentEvents?: AgentEventReader;
  /** A source disconnect/stale state must suppress even a still-fresh cached animation. */
  agentActivityEnabled?: boolean;
  onSelectAgent?: (id: string) => void;
  fallback?: React.ReactNode;
}) {
  return (
    <SceneContext.Provider value={scene}>
      <AgentEventsContext.Provider
        value={agentActivityEnabled ? agentEvents : INACTIVE_EVENTS}
      >
        <SelectAgentContext.Provider
          value={onSelectAgent ?? ((id) => runtime.selectAgent?.(id))}
        >
          <Canvas
            orthographic
            camera={{ position: [3, 26, 21], zoom: 27, near: 0.1, far: 150 }}
            dpr={0.75}
            gl={{ antialias: false, powerPreference: "high-performance" }}
            fallback={
              fallback ?? (
                <div className="webgl-fallback">
                  WebGL 不可用，请通过探索手记查看房间和 Agent。 / WebGL
                  unavailable. Use the field notes to inspect rooms and agents.
                </div>
              )
            }
          >
            <color attach="background" args={["#101820"]} />
            <ambientLight intensity={1.6} color="#c3daea" />
            <directionalLight
              position={[-10, 20, 5]}
              intensity={2.0}
              color="#ffe2b1"
            />
            <Suspense fallback={null}>
              <Environment />
              <Character />
              {scene.enemies.map((_, i) => (
                <Character key={i} enemyIndex={i} />
              ))}
              {scene.agents.map((_, i) => (
                <Agent key={i} index={i} />
              ))}
              <Effects />
              <Reward />
              <CameraAndLoop />
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.03, 0]}
                onPointerMove={(e) => {
                  pointer.aim = { x: e.point.x, z: e.point.z };
                }}
              >
                <planeGeometry args={[200, 200]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </Suspense>
          </Canvas>
        </SelectAgentContext.Provider>
      </AgentEventsContext.Provider>
    </SceneContext.Provider>
  );
}
function Reward() {
  const scene = useContext(SceneContext),
    p = scene.reward ?? scene.spawn;
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    ref.current.visible = runtime.frame?.phase === "won";
  });
  return (
    <group ref={ref} position={[p.x, 0.05, p.z]}>
      <Pixel kind="chest" scale={1.3} />
      <pointLight
        position={[0, 1, 0]}
        color="#eabb72"
        intensity={4}
        distance={5}
      />
    </group>
  );
}
