"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

type RoomStatus = "vacant" | "occupied" | "reserved";

type FloorRoom = {
  id: number;
  name: string;
  area: number;
  status: RoomStatus;
  shape: string;
};

type ThreeFloorPlanProps = {
  rooms: FloorRoom[];
  allFloorRooms: FloorRoom[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

type RoomVisual = {
  material: THREE.MeshStandardMaterial;
  outline: THREE.LineSegments;
  visible: boolean;
};

const statusColors: Record<RoomStatus, number> = {
  vacant: 0x78d3aa,
  occupied: 0xf19a93,
  reserved: 0xeec36f,
};

const parseShape = (shape: string) => shape.split(" ").map((pair) => {
  const [x, y] = pair.split(",").map(Number);
  return { x, y };
});

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

function createRoomLabel(room: FloorRoom) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 164;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,.94)";
  context.strokeStyle = "rgba(38,50,61,.16)";
  context.lineWidth = 3;
  roundedRect(context, 8, 8, 496, 148, 26);
  context.fill();
  context.stroke();
  context.fillStyle = "#26333f";
  context.textAlign = "center";
  context.font = "700 34px Arial";
  context.fillText(room.name.replace("Торговое ", "Помещение "), 256, 67);
  context.fillStyle = "#6b7782";
  context.font = "600 27px Arial";
  context.fillText(`${room.area.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м²`, 256, 112);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.25, 1.04, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export default function ThreeFloorPlan({ rooms, allFloorRooms, selectedId, onSelect }: ThreeFloorPlanProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const refreshSelectionRef = useRef<(() => void) | null>(null);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const editModeRef = useRef(false);
  const selectedWallRef = useRef<THREE.Mesh | null>(null);
  const transformRef = useRef<TransformControls | null>(null);

  editModeRef.current = editMode;

  selectedIdRef.current = selectedId;
  onSelectRef.current = onSelect;

  const visibleKey = useMemo(() => rooms.map((room) => room.id).sort((a, b) => a - b).join(","), [rooms]);
  const geometryKey = useMemo(() => allFloorRooms.map((room) => `${room.id}:${room.shape}:${room.status}:${room.area}`).join("|"), [allFloorRooms]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !allFloorRooms.length) return;

    const visibleIds = new Set(visibleKey.split(",").filter(Boolean).map(Number));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f1ec);
    scene.fog = new THREE.Fog(0xf3f1ec, 28, 50);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.setAttribute("aria-label", "Интерактивная трёхмерная модель этажа");
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.tabIndex = 0;
    host.prepend(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-10, 10, 8, -8, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minZoom = 0.7;
    controls.maxZoom = 2.5;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI / 2.08;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8f9aa2, 2.2));
    const keyLight = new THREE.DirectionalLight(0xfff7e9, 3.4);
    keyLight.position.set(10, 18, 13);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 16;
    keyLight.shadow.camera.bottom = -16;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xcfe3ff, 1.1);
    fillLight.position.set(-10, 8, -10);
    scene.add(fillLight);

    const planPoints = allFloorRooms.flatMap((room) => parseShape(room.shape));
    const minX = Math.min(...planPoints.map((point) => point.x));
    const maxX = Math.max(...planPoints.map((point) => point.x));
    const minY = Math.min(...planPoints.map((point) => point.y));
    const maxY = Math.max(...planPoints.map((point) => point.y));
    const sourceWidth = Math.max(1, maxX - minX);
    const sourceDepth = Math.max(1, maxY - minY);
    const buildingWidth = 15.5;
    const buildingDepth = 8.3;
    const scaleX = buildingWidth / sourceWidth;
    const scaleZ = buildingDepth / sourceDepth;
    const world = new THREE.Group();
    scene.add(world);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d5ca, roughness: 0.93, metalness: 0 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(buildingWidth + 0.7, 0.35, buildingDepth + 0.7), floorMaterial);
    slab.position.y = -0.22;
    slab.receiveShadow = true;
    world.add(slab);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.78 });
    const wallCapMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.82 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0xddeeff, transparent: true, opacity: 0.24, roughness: 0.12, metalness: 0.05, depthWrite: false });
    const corridorMaterial = new THREE.MeshStandardMaterial({ color: 0xc8c4bb, roughness: 0.96 });

    const wallMeshes: THREE.Mesh[] = [];
    const addBox = (width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material, castShadow = true, editableWall = false) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      world.add(mesh);
      if (editableWall) {
        mesh.userData.editableWall = true;
        wallMeshes.push(mesh);
      }
      return mesh;
    };

    const wallHeight = 2.55;
    const wallThickness = 0.16;
    addBox(buildingWidth + 0.35, wallHeight, wallThickness, 0, wallHeight / 2, -buildingDepth / 2, wallMaterial, true, true);
    addBox(wallThickness, wallHeight, buildingDepth + 0.35, -buildingWidth / 2, wallHeight / 2, 0, wallMaterial, true, true);
    addBox(wallThickness, wallHeight, buildingDepth + 0.35, buildingWidth / 2, wallHeight / 2, 0, wallMaterial, true, true);
    addBox(buildingWidth + 0.2, 1.45, 0.08, 0, 0.73, buildingDepth / 2, glassMaterial, false);
    addBox(buildingWidth, 0.12, 1.35, 0, 0.03, buildingDepth / 2 - 0.68, corridorMaterial, false);

    for (let index = 0; index <= 8; index += 1) {
      const x = -buildingWidth / 2 + (buildingWidth / 8) * index;
      addBox(0.045, 1.55, 0.06, x, 0.78, buildingDepth / 2 - 0.02, wallCapMaterial, false);
    }

    const roomVisuals = new Map<number, RoomVisual>();
    const interactiveMeshes: THREE.Mesh[] = [];
    const roomBounds = allFloorRooms.map((room) => {
      const points = parseShape(room.shape);
      const sourceMinX = Math.min(...points.map((point) => point.x));
      const sourceMaxX = Math.max(...points.map((point) => point.x));
      const sourceMinY = Math.min(...points.map((point) => point.y));
      const sourceMaxY = Math.max(...points.map((point) => point.y));
      const width = (sourceMaxX - sourceMinX) * scaleX;
      const depth = (sourceMaxY - sourceMinY) * scaleZ;
      const x = -buildingWidth / 2 + ((sourceMinX + sourceMaxX) / 2 - minX) * scaleX;
      const z = -buildingDepth / 2 + ((sourceMinY + sourceMaxY) / 2 - minY) * scaleZ;
      return { room, width, depth, x, z, sourceMinX, sourceMaxX };
    });

    const deskTopMaterial = new THREE.MeshStandardMaterial({ color: 0xc9b491, roughness: 0.86 });
    const deskLegMaterial = new THREE.MeshStandardMaterial({ color: 0x8e8172, roughness: 0.82 });
    const chairMaterial = new THREE.MeshStandardMaterial({ color: 0x6f777a, roughness: 0.88 });
    const monitorMaterial = new THREE.MeshStandardMaterial({ color: 0x30363a, roughness: 0.55, metalness: 0.12 });
    const planterMaterial = new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.92 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x4e8058, roughness: 0.9 });

    const addDesk = (x: number, z: number, rotation = 0) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = rotation;
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.09, 0.64), deskTopMaterial);
      top.position.y = 0.76;
      top.castShadow = true;
      group.add(top);
      [-0.54, 0.54].forEach((legX) => {
        [-0.22, 0.22].forEach((legZ) => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.07), deskLegMaterial);
          leg.position.set(legX, 0.37, legZ);
          leg.castShadow = true;
          group.add(leg);
        });
      });
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 0.05), monitorMaterial);
      monitor.position.set(0, 1.02, -0.05);
      monitor.castShadow = true;
      group.add(monitor);
      const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.46), chairMaterial);
      chairSeat.position.set(0, 0.48, 0.68);
      chairSeat.castShadow = true;
      group.add(chairSeat);
      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.08), chairMaterial);
      chairBack.position.set(0, 0.75, 0.88);
      chairBack.castShadow = true;
      group.add(chairBack);
      world.add(group);
    };

    const addPlant = (x: number, z: number) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.36, 14), planterMaterial);
      pot.position.set(x, 0.18, z);
      pot.castShadow = true;
      world.add(pot);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), leafMaterial);
      leaves.scale.set(0.85, 1.25, 0.85);
      leaves.position.set(x, 0.68, z);
      leaves.castShadow = true;
      world.add(leaves);
    };

    roomBounds.forEach(({ room, width, depth, x, z }, roomIndex) => {
      const visible = visibleIds.has(room.id);
      const color = statusColors[room.status];
      const material = new THREE.MeshStandardMaterial({
        color: visible ? color : 0xbfc2c2,
        emissive: color,
        emissiveIntensity: 0,
        roughness: 0.9,
        transparent: !visible,
        opacity: visible ? 0.76 : 0.18,
      });
      const roomFloor = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.25, width - 0.14), 0.16, Math.max(0.25, depth - 0.16)), material);
      roomFloor.position.set(x, 0.02, z);
      roomFloor.receiveShadow = true;
      roomFloor.userData.roomId = room.id;
      world.add(roomFloor);
      if (visible) interactiveMeshes.push(roomFloor);

      const edges = new THREE.EdgesGeometry(roomFloor.geometry);
      const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2367a1, transparent: true, opacity: 0.95 }));
      outline.position.copy(roomFloor.position);
      outline.scale.set(1.008, 1.18, 1.008);
      outline.visible = room.id === selectedIdRef.current;
      outline.renderOrder = 5;
      world.add(outline);
      roomVisuals.set(room.id, { material, outline, visible });

      const label = createRoomLabel(room);
      if (label) {
        label.position.set(x, 3.18, z - 0.15);
        world.add(label);
      }

      const usableDepth = Math.max(2.2, depth - 1.7);
      const deskColumns = Math.max(1, Math.min(3, Math.floor(width / 2.25)));
      const deskRows = usableDepth > 5.2 ? 2 : 1;
      for (let row = 0; row < deskRows; row += 1) {
        for (let column = 0; column < deskColumns; column += 1) {
          const deskX = x + (column - (deskColumns - 1) / 2) * Math.min(2.05, width / deskColumns);
          const deskZ = z - usableDepth * 0.19 + row * 2.25;
          addDesk(deskX, deskZ, roomIndex % 2 ? Math.PI : 0);
        }
      }
      addPlant(x - width / 2 + 0.48, z - depth / 2 + 0.48);
      if (width > 5.2) addPlant(x + width / 2 - 0.48, z - depth / 2 + 0.48);

      const shelfWidth = Math.max(1.2, Math.min(2.3, width - 0.8));
      addBox(shelfWidth, 1.45, 0.26, x, 0.73, z - depth / 2 + 0.22, wallCapMaterial);
    });

    const sortedBoundaries = [...new Set(roomBounds.flatMap((room) => [room.sourceMinX, room.sourceMaxX]))]
      .filter((sourceX) => sourceX > minX + 0.1 && sourceX < maxX - 0.1)
      .sort((a, b) => a - b);
    sortedBoundaries.forEach((sourceX) => {
      const x = -buildingWidth / 2 + (sourceX - minX) * scaleX;
      const partitionDepth = buildingDepth - 1.35;
      addBox(wallThickness, wallHeight, partitionDepth, x, wallHeight / 2, -0.67, wallMaterial, true, true);
    });

    roomBounds.forEach(({ width, x }) => {
      const backLineZ = buildingDepth / 2 - 1.37;
      const doorWidth = Math.min(1.05, width * 0.32);
      const segmentWidth = Math.max(0.15, (width - doorWidth) / 2);
      addBox(segmentWidth, wallHeight, wallThickness, x - (doorWidth + segmentWidth) / 2, wallHeight / 2, backLineZ, wallMaterial, true, true);
      addBox(segmentWidth, wallHeight, wallThickness, x + (doorWidth + segmentWidth) / 2, wallHeight / 2, backLineZ, wallMaterial, true, true);
    });

    const entranceMat = new THREE.MeshStandardMaterial({ color: 0x365c78, roughness: 0.64, metalness: 0.2 });
    addBox(1.45, 0.06, 0.65, 0, 0.05, buildingDepth / 2 + 0.52, entranceMat, false);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.42;
    ground.receiveShadow = true;
    scene.add(ground);

    const defaultPosition = new THREE.Vector3(14.5, 15.5, 17.5);
    const defaultTarget = new THREE.Vector3(0, 0.55, 0);
    const resetView = () => {
      camera.position.copy(defaultPosition);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.target.copy(defaultTarget);
      controls.update();
    };
    resetViewRef.current = resetView;
    resetView();

    let hoveredId: number | null = null;
    const refreshSelection = () => {
      roomVisuals.forEach((visual, id) => {
        const selected = id === selectedIdRef.current;
        const hovered = id === hoveredId;
        visual.material.emissiveIntensity = visual.visible ? (selected ? 0.28 : hovered ? 0.14 : 0) : 0;
        visual.material.opacity = visual.visible ? (selected || hovered ? 0.96 : 0.76) : 0.14;
        visual.outline.visible = selected && visual.visible;
      });
    };
    refreshSelectionRef.current = refreshSelection;
    refreshSelection();

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setMode("translate");
    transform.setSpace("world");
    transform.setSize(0.72);
    transform.showY = false;
    scene.add(transform.getHelper());
    transform.addEventListener("dragging-changed", (event) => {
      controls.enabled = !event.value;
    });
    transformRef.current = transform;

    const clearWallSelection = () => {
      selectedWallRef.current = null;
      transform.detach();
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPoint: { x: number; y: number } | null = null;
    const findRoom = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactiveMeshes, false)[0];
      return hit?.object.userData.roomId as number | undefined;
    };
    const findWall = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(wallMeshes, false)[0]?.object as THREE.Mesh | undefined;
    };
    const handlePointerMove = (event: PointerEvent) => {
      const roomId = editModeRef.current ? null : (findRoom(event) ?? null);
      const wall = editModeRef.current ? findWall(event) : undefined;
      if (roomId !== hoveredId) {
        hoveredId = roomId;
        renderer.domElement.style.cursor = wall ? "crosshair" : roomId ? "pointer" : "grab";
        refreshSelection();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      downPoint = { x: event.clientX, y: event.clientY };
      renderer.domElement.style.cursor = "grabbing";
    };
    const handlePointerUp = (event: PointerEvent) => {
      renderer.domElement.style.cursor = hoveredId ? "pointer" : "grab";
      if (!downPoint || Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y) > 6) return;
      if (editModeRef.current) {
        const wall = findWall(event);
        if (wall) {
          selectedWallRef.current = wall;
          transform.attach(wall);
        } else if (!(transform.axis)) {
          clearWallSelection();
        }
        return;
      }
      const roomId = findRoom(event);
      if (roomId) onSelectRef.current(roomId);
    };
    const handlePointerLeave = () => {
      hoveredId = null;
      downPoint = null;
      renderer.domElement.style.cursor = "grab";
      refreshSelection();
    };
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    const resize = () => {
      const width = Math.max(320, host.clientWidth);
      const height = Math.max(360, host.clientHeight);
      const aspect = width / height;
      const verticalSize = Math.max(12.5, (buildingWidth + 7) / aspect);
      camera.left = -verticalSize * aspect / 2;
      camera.right = verticalSize * aspect / 2;
      camera.top = verticalSize / 2;
      camera.bottom = -verticalSize / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });
    setReady(true);

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      transform.dispose();
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
            material.dispose();
          });
        }
        if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      resetViewRef.current = null;
      refreshSelectionRef.current = null;
      transformRef.current = null;
      selectedWallRef.current = null;
    };
  }, [geometryKey, visibleKey, allFloorRooms]);

  useEffect(() => {
    refreshSelectionRef.current?.();
  }, [selectedId]);

  useEffect(() => {
    if (!editMode) {
      transformRef.current?.detach();
      selectedWallRef.current = null;
    }
  }, [editMode]);

  const changeSelectedWallHeight = (delta: number) => {
    const wall = selectedWallRef.current;
    if (!wall) return;
    const oldHeight = wall.geometry.boundingBox
      ? wall.geometry.boundingBox.max.y - wall.geometry.boundingBox.min.y
      : 2.55;
    if (!wall.geometry.boundingBox) wall.geometry.computeBoundingBox();
    const baseHeight = wall.geometry.boundingBox
      ? wall.geometry.boundingBox.max.y - wall.geometry.boundingBox.min.y
      : oldHeight;
    const currentHeight = baseHeight * wall.scale.y;
    const nextHeight = Math.min(5, Math.max(0.8, currentHeight + delta));
    wall.scale.y = nextHeight / baseHeight;
    wall.position.y = nextHeight / 2;
  };

  return <div className={`three-floor-stage ${ready ? "ready" : ""}`} ref={hostRef}>
    {!ready && <div className="three-loading">Собираем объёмный план…</div>}
    <div className="three-stage-topbar">
      <span><i /> {editMode ? "Редактор 3D" : "Настоящий 3D"}</span>
      <div className="three-stage-actions">
        <button className={editMode ? "active" : ""} onClick={() => setEditMode((value) => !value)} type="button">{editMode ? "✓ Редактирование" : "✎ Редактировать 3D"}</button>
        <button onClick={() => resetViewRef.current?.()} type="button">↺ Исходный ракурс</button>
      </div>
    </div>
    {editMode && <div className="three-edit-panel">
      <strong>Стена</strong><span>Нажмите стену и тяните стрелки</span>
      <button onClick={() => changeSelectedWallHeight(0.25)} type="button">Высота +</button>
      <button onClick={() => changeSelectedWallHeight(-0.25)} type="button">Высота −</button>
    </div>}
    <div className="three-stage-help">
      {editMode ? <><strong>Редактор:</strong> выберите стену · тяните красную/синюю стрелку · высоту меняйте кнопками</> : <><strong>Вращение</strong> — потяните план · <strong>Масштаб</strong> — колесо или два пальца</>}
    </div>
  </div>;
}
