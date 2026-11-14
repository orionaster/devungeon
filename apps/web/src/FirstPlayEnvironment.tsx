/** One authored, licensed-art sample room. World facts and commands are external. */
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { geometry, type SceneDefinition } from "../../../packages/dungeon-engine/src";
import type { SampleActivityReader } from "./feature-sample";
import { firstPlayCrop } from "./first-play-art";
import { runtime } from "./runtime";

const instance = new THREE.Object3D();
const glowVertex = "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
const glowFragment = "varying vec2 vUv; void main(){vec2 p=floor(vUv*32.0)/32.0;float a=(1.0-smoothstep(0.04,0.5,length(p-0.5)))*0.16;gl_FragColor=vec4(1.0,0.57,0.19,a);}";
function LampGlow({ x, z, size = 3 }: { x: number; z: number; size?: number }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.016, z]}>
    <planeGeometry args={[size, size]} />
    <shaderMaterial vertexShader={glowVertex} fragmentShader={glowFragment} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
  </mesh>;
}
function TileLayer({ positions, map }: { positions: number[][]; map: THREE.Texture }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    positions.forEach(([x, y, z], i) => {
      instance.position.set(x, y, z);
      instance.rotation.set(-Math.PI / 2, 0, 0);
      instance.scale.set(1, 1, 1);
      instance.updateMatrix();
      ref.current.setMatrixAt(i, instance.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} frustumCulled={false}>
    <planeGeometry args={[1, 1]} />
    <meshBasicMaterial map={map} />
  </instancedMesh>;
}

function ArtSprite({ map, x = 0, y = 0, z = 0, width, height, onClick }: {
  map: THREE.Texture; x?: number; y?: number; z?: number; width: number; height: number; onClick?: () => void;
}) {
  return <sprite position={[x, y, z]} scale={[width, height, 1]} center={[0.5, 0]}
    onPointerDown={onClick ? (e) => e.stopPropagation() : undefined}
    onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}>
    <spriteMaterial map={map} transparent alphaTest={0.15} depthWrite />
  </sprite>;
}

function Station({ prop, activities, onSelectObject }: {
  prop: NonNullable<SceneDefinition["props"]>[number]; activities?: SampleActivityReader; onSelectObject?: (id: string) => void;
}) {
  const scan = useRef<THREE.Mesh>(null!);
  const test = useRef<THREE.Group>(null!);
  const paper = useRef<THREE.Mesh>(null!);
  const isDesk = prop.id === "source-desk", isCabinet = prop.id === "evidence-cabinet";
  const map = isDesk ? firstPlayCrop("furniture", 32, 160, 48, 16)
    : isCabinet ? firstPlayCrop("furniture", 128, 112, 32, 32)
      : firstPlayCrop("furniture", 96, 112, 32, 32);
  useFrame(({ clock }) => {
    const action = activities?.activity(prop.id);
    const moving = !runtime.reducedEffects;
    scan.current.visible = !!action && (action.kind === "scan" || action.kind === "read");
    // Reading follows the paper; DEMO scanning traverses the map. Testing instead
    // lowers two physical specimen markers onto the bench. These are separate
    // typed activities; idle / expired / replay events never animate a station.
    scan.current.position.x = moving ? Math.sin(clock.elapsedTime * 2.4) * 0.5 : 0;
    (scan.current.material as THREE.MeshBasicMaterial).color.set(action?.kind === "read" ? "#b6d8c4" : "#e4c87b");
    test.current.visible = action?.kind === "test";
    test.current.position.y = moving ? 0.88 + Math.abs(Math.sin(clock.elapsedTime * 4)) * 0.24 : 1.02;
    paper.current.rotation.y = action?.kind === "read" && moving ? Math.sin(clock.elapsedTime * 2) * 0.1 : 0;
  });
  return <group position={[prop.x, 0.025, prop.z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0.24]}>
      <planeGeometry args={[prop.width + 0.08, prop.depth + 0.15]} />
      <meshBasicMaterial color="#171d23" transparent opacity={0.38} depthWrite={false} />
    </mesh>
    <ArtSprite map={map} z={prop.depth / 2} width={prop.width} height={isDesk ? prop.width / 3 : prop.width}
      onClick={onSelectObject ? () => onSelectObject(prop.id) : undefined} />
    {isDesk && <ArtSprite map={firstPlayCrop("dungeon", 112, 32, 16, 16)} x={-0.7} y={0.53} z={0.15} width={0.42} height={0.42} />}
    <mesh ref={paper} rotation={[-Math.PI / 2, 0, 0]} position={[0, isDesk ? 0.53 : 0.82, 0.05]}>
      <planeGeometry args={[isDesk ? 0.72 : 0.5, isDesk ? 0.72 : 0.5]} />
      <meshBasicMaterial map={firstPlayCrop(isDesk ? "scroll" : "book", 0, 0, isDesk ? 14 : 16, isDesk ? 14 : 16)} transparent alphaTest={0.1} side={THREE.DoubleSide} />
    </mesh>
    <mesh ref={scan} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.57, 0.05]}>
      <planeGeometry args={[0.065, 0.72]} />
      <meshBasicMaterial color="#e4c87b" transparent opacity={0.8} depthWrite={false} />
    </mesh>
    <group ref={test} position={[0, 1, 0]}>
      <ArtSprite map={firstPlayCrop("gem", 0, 0, 16, 16)} x={-0.4} width={0.42} height={0.42} />
      <ArtSprite map={firstPlayCrop("book", 0, 0, 16, 16)} x={0.4} width={0.42} height={0.42} />
    </group>
  </group>;
}

export function FirstPlayEnvironment({ scene, activities, onSelectObject }: {
  scene: SceneDefinition; activities?: SampleActivityReader; onSelectObject?: (id: string) => void;
}) {
  const shape = useMemo(() => geometry(scene), [scene]);
  const variants = useMemo(() => {
    const buckets: number[][][] = Array.from({ length: 11 }, () => []);
    for (const tile of shape.tiles) {
      // Calm study floor, distinct stone training area, and a dark sealed annex.
      // A few structural borders carry detail; gameplay stays visually quiet.
      const column = ((Math.round(tile.x + 6.5) % 3) + 3) % 3;
      const row = ((Math.round(tile.z + 5.5) % 3) + 3) % 3;
      const group = tile.locked || tile.x > 6.5 ? 10 : tile.x > 1.5 && tile.z > -1 ? 9 : row * 3 + column;
      buckets[group].push([tile.x, 0, tile.z]);
    }
    return buckets;
  }, [shape]);
  return <group>
    {scene.rooms.map((room) => <mesh key={room.room_id} position={[room.x, -0.19, room.z]}>
      <boxGeometry args={[room.width + 0.3, 0.35, room.depth + 0.3]} />
      <meshBasicMaterial color="#22252c" />
    </mesh>)}
    {variants.slice(0, 9).map((positions, i) => <TileLayer key={i} positions={positions}
      map={firstPlayCrop("interior-floor", 176 + (i % 3) * 16, 96 + Math.floor(i / 3) * 16, 16, 16)} />)}
    <TileLayer positions={variants[9]} map={firstPlayCrop("interior-floor", 192, 208, 16, 16)} />
    <TileLayer positions={variants[10]} map={firstPlayCrop("interior-floor", 208, 208, 16, 16)} />
    {/* An actual woven reading rug, native64x48 /4x3world units. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3, 0.008, -2]}>
      <planeGeometry args={[4, 3]} />
      <meshBasicMaterial map={firstPlayCrop("furniture", 192, 64, 64, 48)} transparent alphaTest={0.1} />
    </mesh>
    {shape.walls.map((wall, i) => <group key={i} position={[wall.x, 0, wall.z]}>
      <mesh position={[0, 0.48, 0]}>
        <boxGeometry args={[wall.width, 0.96, wall.depth]} />
        <meshBasicMaterial color="#dfc9ab" map={firstPlayCrop("interior-floor", 192, 208, 16, 16)} />
      </mesh>
      <mesh position={[0, 0.99, 0]}>
        <boxGeometry args={[wall.width + 0.05, 0.12, wall.depth + 0.05]} />
        <meshBasicMaterial color="#9a8879" map={firstPlayCrop("interior-floor", 192, 240, 16, 16)} />
      </mesh>
    </group>)}
    {(scene.props ?? []).map((prop) => <Station key={prop.id} prop={prop} activities={activities} onSelectObject={onSelectObject} />)}
    <LampGlow x={-3} z={-2} size={4.5} />
    <LampGlow x={3} z={-3} size={2.5} />
    {/* Four structural corner piers are wholly outside movement clearance. */}
    {[-7, 7].flatMap((x) => [-6, 6].map((z) => <group key={`${x}:${z}`} position={[x, 0, z]}>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.42, 1.3, 0.42]} />
        <meshBasicMaterial color="#a28c78" map={firstPlayCrop("interior-floor", 192, 208, 16, 16)} />
      </mesh>
      <mesh position={[0, 1.32, 0]}>
        <boxGeometry args={[0.52, 0.16, 0.52]} />
        <meshBasicMaterial color="#a28c78" map={firstPlayCrop("interior-floor", 192, 240, 16, 16)} />
      </mesh>
    </group>))}
    {/* Pack-native grating and stone uprights make a spatial sealed door. */}
    {(scene.doors ?? []).filter((door) => door.locked).map((door) => <group key={door.room_id}
      position={[door.x, 0, door.z]} rotation={[0, door.axis === "z" ? Math.PI / 2 : 0, 0]}>
      <mesh position={[0, 0.84, 0]}>
        <planeGeometry args={[door.width ?? 1, 1.68]} />
        <meshBasicMaterial map={firstPlayCrop("dungeon", 80, 16, 16, 16)} transparent alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * ((door.width ?? 1) / 2 + 0.12), 0.9, 0]}>
        <boxGeometry args={[0.25, 1.8, 0.4]} />
        <meshBasicMaterial color="#bca68d" map={firstPlayCrop("interior-floor", 192, 208, 16, 16)} />
      </mesh>)}
      <mesh position={[0, 1.82, 0]}>
        <boxGeometry args={[(door.width ?? 1) + 0.5, 0.24, 0.4]} />
        <meshBasicMaterial color="#bca68d" map={firstPlayCrop("interior-floor", 192, 208, 16, 16)} />
      </mesh>
    </group>)}
    {scene.rooms.filter((room) => !room.enterable).map((room) => <ArtSprite key={room.room_id}
      map={firstPlayCrop("chest", 0, 0, 16, 14)} x={room.x + 0.5} z={room.z + 0.5} y={0.025} width={1.05} height={0.91875} />)}
    {/* Mounted ornaments sit outside the walkable rectangle, not on free floor. */}
    {[-4.5, 0, 4.5].map((x) => <group key={x}>
      <ArtSprite map={firstPlayCrop("dungeon", 112, 32, 16, 16)} x={x} y={0.95} z={-6.12} width={0.68} height={0.68} />
      <ArtSprite map={firstPlayCrop("dungeon", 112, 32, 16, 16)} x={x} y={0.95} z={6.12} width={0.68} height={0.68} />
      <LampGlow x={x} z={4.8} size={2.7} />
      <LampGlow x={x} z={-4.8} size={2.7} />
    </group>)}
  </group>;
}
