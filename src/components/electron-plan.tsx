import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { deriveWalls, type ElectronFloor } from "@/lib/electron";

const WALL_H = 2.55 * 0.8;
const GLASS_H = 2.34 * 0.8;

type Props = {
  floor: ElectronFloor;
  selectedId: string | null;
  visibleIds: string[];
  onSelect: (id: string) => void;
};

export default function ElectronPlan({ floor, selectedId, visibleIds, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<(() => void) | null>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const selectedRef = useRef(selectedId);
  const visibleRef = useRef(visibleIds);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  selectedRef.current = selectedId;
  visibleRef.current = visibleIds;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setReady(false);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", `Трёхмерный план: ${floor.name}`);
    host.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xefeae2);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 180);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 8;
    controls.maxDistance = 75;
    controls.maxPolarAngle = Math.PI / 2.12;
    controls.screenSpacePanning = true;

    const reset = () => {
      camera.position.set(22, 34, 30);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    reset();
    resetRef.current = reset;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xa1c2b5, 2.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-15, 30, 10);
    scene.add(sun);

    const [cropX, cropY, cropW, cropH] = floor.crop;
    const scale = 24 / Math.max(cropW, cropH);
    const originX = cropX + cropW / 2;
    const originY = cropY + cropH / 2;
    const toShape = (ring: Array<[number, number]>) => {
      const unique = ring.filter((point, index) => {
        const next = ring[(index + 1) % ring.length];
        return next && (point[0] !== next[0] || point[1] !== next[1]);
      });
      if (unique.length < 3) return null;
      const shape = new THREE.Shape(unique.map(([x, y]) => new THREE.Vector2((x - originX) * scale, -(y - originY) * scale)));
      return shape;
    };

    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(cropW * scale, cropH * scale),
      new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.92 }),
    );
    slab.rotation.x = -Math.PI / 2;
    scene.add(slab);
    const loader = new THREE.TextureLoader();
    let texture: THREE.Texture | null = null;
    loader.load(`/electron/floor-${floor.number}.webp`, (map) => {
      texture = map;
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      slab.material.map = map;
      slab.material.needsUpdate = true;
    });

    const { solidWalls, partitions } = deriveWalls(floor);
    const extrusions = solidWalls
      .map((ring) => {
        const shape = toShape(ring);
        if (!shape) return null;
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: WALL_H, bevelEnabled: false, steps: 1, curveSegments: 1 });
        geometry.rotateX(-Math.PI / 2);
        return geometry.getAttribute("position").count > 0 ? geometry : null;
      })
      .filter((geometry): geometry is THREE.ExtrudeGeometry => geometry !== null);
    const merged = extrusions.length > 0 ? mergeGeometries(extrusions, false) : null;
    extrusions.forEach((geometry) => geometry.dispose());
    if (merged) {
      scene.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0xe4ecee, roughness: 0.9 })));
    }

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb9d7d3,
      transparent: true,
      opacity: 0.28,
      roughness: 0.12,
      metalness: 0.03,
      depthWrite: false,
    });
    for (const part of partitions) {
      const dx = (part.end[0] - part.start[0]) * scale;
      const dz = (part.end[1] - part.start[1]) * scale;
      const length = Math.hypot(dx, dz);
      if (length < 0.05) continue;
      const pane = new THREE.Mesh(new THREE.BoxGeometry(length, GLASS_H, 0.045), glassMaterial);
      pane.position.set(((part.start[0] + part.end[0]) / 2 - originX) * scale, GLASS_H / 2, ((part.start[1] + part.end[1]) / 2 - originY) * scale);
      pane.rotation.y = -Math.atan2(dz, dx);
      scene.add(pane);
    }

    const hits: THREE.Mesh[] = [];
    const outlines = new Map<string, THREE.LineLoop>();
    for (const room of floor.rooms) {
      for (const ring of room.shapes) {
        const shape = toShape(ring);
        if (!shape) continue;
        const geometry = new THREE.ShapeGeometry(shape);
        geometry.rotateX(-Math.PI / 2);
        const material = new THREE.MeshBasicMaterial({
          color: 0xc0562a,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 0.04;
        mesh.userData.roomId = room.id;
        scene.add(mesh);
        hits.push(mesh);
        const loop = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(
            ring.map(([x, y]) => new THREE.Vector3((x - originX) * scale, 0.08, (y - originY) * scale)),
          ),
          new THREE.LineBasicMaterial({ color: 0x1a1814 }),
        );
        loop.visible = false;
        scene.add(loop);
        outlines.set(room.id, loop);
      }
    }

    const refresh = () => {
      const visible = new Set(visibleRef.current);
      for (const mesh of hits) {
        const id = mesh.userData.roomId as string;
        const material = mesh.material as THREE.MeshBasicMaterial;
        const shown = visible.has(id);
        const active = shown && selectedRef.current === id;
        material.opacity = active ? 0.28 : 0;
        material.color.set(active ? 0xc0562a : 0xffffff);
        const outline = outlines.get(id);
        if (outline) outline.visible = active;
      }
    };
    refreshRef.current = refresh;
    refresh();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = { x: 0, y: 0, t: 0 };
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY, t: Date.now() };
    };
    const onUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7 || Date.now() - down.t > 700) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hits).find((item) => visibleRef.current.includes(item.object.userData.roomId as string));
      const id = hit?.object.userData.roomId as string | undefined;
      if (id) onSelectRef.current(id);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    setReady(true);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      texture?.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineLoop) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      refreshRef.current = null;
      resetRef.current = null;
    };
  }, [floor]);

  useEffect(() => {
    refreshRef.current?.();
  }, [selectedId, visibleIds]);

  return (
    <div ref={hostRef} className={`three-floor-stage ${ready ? "ready" : ""}`}>
      {!ready && <div className="three-loading">Собираем план «Электрона»…</div>}
      <div className="three-stage-topbar">
        <span>ТЦ «Электрон» · {floor.name}</span>
        <button type="button" onClick={() => resetRef.current?.()}>
          Исходный вид
        </button>
      </div>
    </div>
  );
}
