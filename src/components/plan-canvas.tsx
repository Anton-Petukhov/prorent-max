import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import type { UseKind } from "@/lib/portfolio";
import { theme } from "@/lib/theme";

const FLOOR_H = 4.4;
const BOX_H = 3.15;

export type CanvasZone = {
  id: string;
  name: string;
  use: UseKind;
  x: number;
  y: number;
  w: number;
  h: number;
  level: number;
  active: boolean;
};

const FILL: Record<UseKind, string> = {
  office: theme.copper,
  retail: theme.copperDeep,
  warehouse: theme.pine,
  vacant: theme.vacant,
};

function Lights({ span }: { span: number }) {
  const reach = span * 0.95;
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[span * 0.8, span * 1.15, span * 0.45]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={span * 5}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
      />
    </>
  );
}

function Rig({ span, w, h }: { span: number; w: number; h: number }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.position.set(w * 0.15 + span * 0.72, span * 0.55, h * 0.2 + span * 0.78);
    camera.lookAt(w / 2, 3, h / 2);
    camera.updateProjectionMatrix();
  }, [camera, span, w, h]);
  return <OrbitControls makeDefault target={[w / 2, 3, h / 2]} maxPolarAngle={Math.PI / 2.08} enableDamping />;
}

function Building({
  zones,
  width,
  depth,
  selectedId,
  onSelect,
}: {
  zones: CanvasZone[];
  width: number;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const levels = [...new Set(zones.map((zone) => zone.level))].sort((a, b) => a - b);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.04, depth / 2]} receiveShadow>
        <planeGeometry args={[Math.max(width, depth) * 2.4, Math.max(width, depth) * 2.4]} />
        <meshStandardMaterial color={theme.bone} />
      </mesh>
      {levels.map((level) => (
        <mesh key={`slab-${level}`} position={[width / 2, level * FLOOR_H + 0.06, depth / 2]} receiveShadow>
          <boxGeometry args={[width, 0.12, depth]} />
          <meshStandardMaterial color={theme.slab} />
        </mesh>
      ))}
      {zones.map((zone) => {
        const selected = zone.id === selectedId;
        return (
          <mesh
            key={zone.id}
            position={[zone.x + zone.w / 2, zone.level * FLOOR_H + 0.12 + BOX_H / 2, zone.y + zone.h / 2]}
            castShadow={zone.active}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(zone.id);
            }}
          >
            <boxGeometry args={[Math.max(zone.w - 0.35, 0.4), BOX_H, Math.max(zone.h - 0.35, 0.4)]} />
            <meshStandardMaterial
              color={FILL[zone.use]}
              roughness={zone.use === "vacant" ? 0.95 : 0.72}
              metalness={0.02}
              transparent={!zone.active}
              opacity={zone.active ? 1 : 0.28}
              emissive={selected ? theme.ink : theme.black}
              emissiveIntensity={selected ? 0.22 : 0}
            />
            {zone.active ? <Edges threshold={20} color={theme.ink} /> : null}
          </mesh>
        );
      })}
    </group>
  );
}

export function PlanCanvas({
  zones,
  width,
  depth,
  selectedId,
  onSelect,
}: {
  zones: CanvasZone[];
  width: number;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const span = Math.max(width, depth, 28);
  return (
    <Canvas
      className="touch-none"
      shadows
      dpr={[1, 1.6]}
      camera={{ fov: 32, position: [span, span * 0.7, span], near: 0.1, far: 900 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[theme.paper]} />
      <Lights span={span} />
      <Rig span={span} w={width} h={depth} />
      <Building zones={zones} width={width} depth={depth} selectedId={selectedId} onSelect={onSelect} />
    </Canvas>
  );
}
