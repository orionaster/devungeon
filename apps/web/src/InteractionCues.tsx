import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneDefinition } from "../../../packages/dungeon-engine/src";
import { interactionTargets, nearestInteraction } from "./interaction-targets";
import { runtime } from "./runtime";

/** Static world symbols. Names/evidence belong to a fixed HTML inspector. */
export function InteractionCues({
  scene,
  onSelect,
}: {
  scene: SceneDefinition;
  onSelect(id: string): void;
}) {
  const targets = useMemo(() => interactionTargets(scene), [scene]);
  const marks = useRef<(THREE.Mesh | null)[]>([]);
  const nearestId = useRef<string | undefined>(undefined);
  useFrame(() => {
    const player = runtime.frame?.player;
    const nearest = player
      ? nearestInteraction(targets, player, nearestId.current)
      : undefined;
    nearestId.current = nearest?.id;
    for (let i = 0; i < targets.length; i++) {
      const material = marks.current[i]?.material as
        | THREE.MeshBasicMaterial
        | undefined;
      material?.color.set(
        targets[i].id === nearest?.id ? "#f3cf8e" : "#9fae9f",
      );
    }
  });
  return (
    <group>
      {targets.map((target, i) => (
        <mesh
          key={target.id}
          ref={(node) => {
            marks.current[i] = node;
          }}
          position={[target.x, target.cueHeight, target.z]}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(target.id);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            (event.nativeEvent.target as HTMLCanvasElement).style.cursor =
              "pointer";
          }}
          onPointerOut={(event) => {
            (event.nativeEvent.target as HTMLCanvasElement).style.cursor = "";
          }}
        >
          <octahedronGeometry args={[0.1, 0]} />
          <meshBasicMaterial color="#9fae9f" />
        </mesh>
      ))}
    </group>
  );
}
