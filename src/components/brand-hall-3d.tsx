"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { kindMeta, type BrandFloor, type BrandRoom } from "@/lib/brand-hall";

type Props = {
  floor: BrandFloor;
  rooms: BrandRoom[];
  selectedId: string;
  onSelect: (id: string) => void;
};

type RoomVisual = {
  material: THREE.MeshStandardMaterial;
  outline: THREE.LineSegments;
  label: THREE.Sprite | null;
  visible: boolean;
};

const parseShape = (shape: string) => shape.split(" ").map((pair) => {
  const [x, y] = pair.split(",").map(Number);
  return { x, y };
});

function createLabel(room: BrandRoom) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 176;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = `${kindMeta[room.kind].color}ed`;
  context.strokeStyle = "rgba(31,43,53,.22)";
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(8, 8, 496, 160, 24);
  context.fill();
  context.stroke();
  context.textAlign = "center";
  context.fillStyle = "#1f2a30";
  context.font = room.name.length > 13 ? "800 29px Arial" : "800 42px Arial";
  context.fillText(room.name, 256, 72);
  context.fillStyle = "rgba(31,42,48,.78)";
  context.font = "750 30px Arial";
  context.fillText(room.area === null ? kindMeta[room.kind].label : `${room.area.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м²`, 256, 124);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.75, 0.96, 1);
  sprite.renderOrder = 30;
  return sprite;
}

export default function BrandHall3D({ floor, rooms, selectedId, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const refreshRef = useRef<(() => void) | null>(null);
  const paintRef = useRef<(() => void) | null>(null);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const floorRef = useRef(floor);
  const visibleKeyRef = useRef("");
  const [ready, setReady] = useState(false);

  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;
  floorRef.current = floor;
  const visibleKey = useMemo(() => rooms.map((room) => room.id).sort().join("|"), [rooms]);
  visibleKeyRef.current = visibleKey;
  const geometryKey = useMemo(() => `${floor.name}:${floor.rooms.map((room) => `${room.id}:${room.shape}`).join("|")}`, [floor]);
  const colorKey = floor.rooms.map((room) => `${room.id}:${room.kind}:${room.area ?? ""}`).join("|");

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !floor.rooms.length) return;
    setReady(false);

    const visibleIds = new Set(visibleKey.split("|").filter(Boolean));
    const allPoints = floor.rooms.flatMap((room) => parseShape(room.shape));
    const minX = Math.min(...allPoints.map((point) => point.x));
    const maxX = Math.max(...allPoints.map((point) => point.x));
    const minY = Math.min(...allPoints.map((point) => point.y));
    const maxY = Math.max(...allPoints.map((point) => point.y));
    const sourceWidth = Math.max(1, maxX - minX);
    const sourceDepth = Math.max(1, maxY - minY);
    const buildingWidth = 16;
    const scale = buildingWidth / sourceWidth;
    const buildingDepth = sourceDepth * scale;
    const toWorld = (x: number, y: number) => ({
      x: (x - minX) * scale - buildingWidth / 2,
      z: (y - minY) * scale - buildingDepth / 2,
    });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xedf0f1);
    scene.fog = new THREE.Fog(0xedf0f1, 30, 55);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute("aria-label", `Трёхмерный план: ${floor.name}`);
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.tabIndex = 0;
    host.prepend(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-10, 10, 8, -8, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.screenSpacePanning = true;
    controls.minZoom = 0.65;
    controls.maxZoom = 3;
    controls.minPolarAngle = 0.28;
    controls.maxPolarAngle = Math.PI / 2.04;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x87939c, 2.25));
    const sun = new THREE.DirectionalLight(0xfff7e9, 3.2);
    sun.position.set(12, 18, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.bias = -0.00045;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xcde2ff, 1.05);
    fill.position.set(-10, 9, -8);
    scene.add(fill);

    const world = new THREE.Group();
    scene.add(world);
    const addBox = (width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material, rotation = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotation;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      world.add(mesh);
      return mesh;
    };

    const slabMaterial = new THREE.MeshStandardMaterial({ color: floor.parking ? 0x5f686c : 0xd9dddc, roughness: 0.96 });
    addBox(buildingWidth + 0.8, 0.24, buildingDepth + 0.8, 0, -0.13, 0, slabMaterial);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e7e6, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.26;
    ground.receiveShadow = true;
    scene.add(ground);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.8 });
    const coreMaterial = new THREE.MeshStandardMaterial({ color: 0xbfc5c8, roughness: 0.92 });
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x68747b, roughness: 0.68, metalness: 0.18 });
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0xcab895, roughness: 0.88 });
    const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x69747a, roughness: 0.9 });
    const mannequinMaterial = new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 0.84 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xcfe8ee,
      transparent: true,
      opacity: 0.28,
      roughness: 0.12,
      metalness: 0.04,
      depthWrite: false,
    });
    const partitionGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb9dce3,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.03,
      depthWrite: false,
    });
    const partitionFrameMaterial = new THREE.LineBasicMaterial({ color: 0x5e737d, transparent: true, opacity: 0.82 });
    const garmentMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x456676, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xb86f59, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xd8c8a7, roughness: 0.9 }),
    ];
    const parkingLineMaterial = new THREE.MeshStandardMaterial({ color: 0xf0e8cf, roughness: 0.88 });
    const parkingCurbMaterial = new THREE.MeshStandardMaterial({ color: 0xd7d9d7, roughness: 0.94 });
    const parkingWheelMaterial = new THREE.MeshStandardMaterial({ color: 0x252b2e, roughness: 0.92 });
    const parkingWindowMaterial = new THREE.MeshStandardMaterial({ color: 0x263b46, roughness: 0.54, metalness: 0.08 });
    const parkingLightMaterial = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd774, emissiveIntensity: 0.28, roughness: 0.7 });
    const parkingCarMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xe4a52f, roughness: 0.82 }),
      new THREE.MeshStandardMaterial({ color: 0x4d82a5, roughness: 0.82 }),
    ];
    const wallHeight = 2.55;
    const wallThickness = 0.1;
    const roomVisuals = new Map<string, RoomVisual>();
    const interactive: THREE.Mesh[] = [];

    const addPart = (
      group: THREE.Group,
      width: number,
      height: number,
      depth: number,
      x: number,
      y: number,
      z: number,
      material: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = material !== glassMaterial;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    const addTablePair = (x: number, z: number, width: number, depth: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = width >= depth ? 0 : Math.PI / 2;
      const usableLength = Math.max(width, depth);
      const spacing = Math.min(0.82, Math.max(0.58, usableLength * 0.2));

      [-spacing, spacing].forEach((tableX) => {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.07, 12), tableMaterial);
        top.position.set(tableX, 0.74, 0);
        top.castShadow = true;
        group.add(top);

        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.1, 0.7, 10), frameMaterial);
        pedestal.position.set(tableX, 0.37, 0);
        pedestal.castShadow = true;
        group.add(pedestal);

        [-0.5, 0.5].forEach((chairZ) => {
          addPart(group, 0.34, 0.07, 0.34, tableX, 0.43, chairZ, seatMaterial);
          addPart(group, 0.34, 0.42, 0.06, tableX, 0.66, chairZ + Math.sign(chairZ) * 0.15, seatMaterial);
        });
      });
      world.add(group);
    };

    const addMannequin = (group: THREE.Group, x: number, z: number, accent: THREE.Material) => {
      const figure = new THREE.Group();
      figure.position.set(x, 0, z);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.04, 10), frameMaterial);
      base.position.y = 0.03;
      figure.add(base);

      [-0.07, 0.07].forEach((legX) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.58, 7), mannequinMaterial);
        leg.position.set(legX, 0.34, 0);
        leg.castShadow = true;
        figure.add(leg);
      });

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.21, 0.48, 7), accent);
      torso.position.y = 0.83;
      torso.castShadow = true;
      figure.add(torso);

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.11, 7), mannequinMaterial);
      neck.position.y = 1.12;
      figure.add(neck);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mannequinMaterial);
      head.position.y = 1.28;
      head.castShadow = true;
      figure.add(head);
      group.add(figure);
    };

    const addBoutique = (x: number, z: number, width: number, depth: number, roomIndex: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = width >= depth ? 0 : Math.PI / 2;
      const longSide = Math.max(width, depth);
      const shortSide = Math.min(width, depth);
      const fixtureScale = Math.min(1, Math.max(0.58, Math.min(longSide / 2.45, shortSide / 1.55)));
      group.scale.setScalar(fixtureScale);

      const windowWidth = Math.min(1.65, Math.max(1.1, longSide * 0.38));
      const windowZ = -0.46;
      addPart(group, windowWidth, 1.18, 0.045, 0, 0.66, windowZ, glassMaterial);
      addPart(group, windowWidth + 0.08, 0.055, 0.085, 0, 0.08, windowZ, frameMaterial);
      addPart(group, windowWidth + 0.08, 0.055, 0.085, 0, 1.25, windowZ, frameMaterial);
      [-windowWidth / 2, windowWidth / 2].forEach((postX) => addPart(group, 0.055, 1.23, 0.085, postX, 0.66, windowZ, frameMaterial));

      const rackWidth = Math.min(1.45, Math.max(0.9, longSide * 0.31));
      const rackZ = 0.45;
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, rackWidth, 8), frameMaterial);
      rail.position.set(0, 1.08, rackZ);
      rail.rotation.z = Math.PI / 2;
      rail.castShadow = true;
      group.add(rail);
      [-rackWidth / 2, rackWidth / 2].forEach((postX) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.04, 8), frameMaterial);
        post.position.set(postX, 0.56, rackZ);
        post.castShadow = true;
        group.add(post);
      });
      [-0.34, -0.11, 0.12, 0.35].forEach((garmentX, index) => {
        const garment = addPart(group, 0.16, 0.44, 0.035, garmentX * Math.min(1, rackWidth / 1.15), 0.82, rackZ, garmentMaterials[(roomIndex + index) % garmentMaterials.length]);
        garment.rotation.z = index % 2 ? 0.04 : -0.04;
      });

      addMannequin(group, -0.32, -0.02, garmentMaterials[roomIndex % garmentMaterials.length]);
      if (longSide * fixtureScale > 1.65 && shortSide * fixtureScale > 1.02) {
        addMannequin(group, 0.32, -0.02, garmentMaterials[(roomIndex + 1) % garmentMaterials.length]);
      }
      world.add(group);
    };

    const addVoxelCar = (x: number, z: number, material: THREE.Material, rotation = 0) => {
      const car = new THREE.Group();
      car.position.set(x, 0, z);
      car.rotation.y = rotation;
      addPart(car, 0.98, 0.34, 1.62, 0, 0.34, 0, material);
      addPart(car, 0.78, 0.34, 0.78, 0, 0.67, -0.02, material);
      addPart(car, 0.64, 0.21, 0.045, 0, 0.7, -0.42, parkingWindowMaterial);
      addPart(car, 0.64, 0.21, 0.045, 0, 0.7, 0.38, parkingWindowMaterial);
      addPart(car, 0.045, 0.21, 0.56, -0.405, 0.7, -0.02, parkingWindowMaterial);
      addPart(car, 0.045, 0.21, 0.56, 0.405, 0.7, -0.02, parkingWindowMaterial);
      [-0.52, 0.52].forEach((wheelX) => [-0.53, 0.53].forEach((wheelZ) => {
        addPart(car, 0.18, 0.28, 0.34, wheelX, 0.24, wheelZ, parkingWheelMaterial);
      }));
      [-0.27, 0.27].forEach((lightX) => addPart(car, 0.18, 0.14, 0.035, lightX, 0.37, 0.825, parkingLightMaterial));
      world.add(car);
    };

    const addParkingLayout = () => {
      const spacesPerRow = 5;
      const sideMargin = 1.25;
      const usableWidth = buildingWidth - sideMargin * 2;
      const spaceWidth = usableWidth / spacesPerRow;
      const spaceDepth = Math.min(2.55, buildingDepth * 0.31);
      const northZ = -buildingDepth / 2 + spaceDepth / 2 + 0.28;
      const southZ = buildingDepth / 2 - spaceDepth / 2 - 0.28;

      for (let index = 0; index <= spacesPerRow; index += 1) {
        const x = -buildingWidth / 2 + sideMargin + spaceWidth * index;
        addBox(0.045, 0.025, spaceDepth, x, 0.08, northZ, parkingLineMaterial);
        addBox(0.045, 0.025, spaceDepth, x, 0.08, southZ, parkingLineMaterial);
      }
      addBox(usableWidth, 0.025, 0.045, 0, 0.08, northZ + spaceDepth / 2, parkingLineMaterial);
      addBox(usableWidth, 0.025, 0.045, 0, 0.08, southZ - spaceDepth / 2, parkingLineMaterial);

      for (let index = 0; index < spacesPerRow; index += 1) {
        const x = -buildingWidth / 2 + sideMargin + spaceWidth * (index + 0.5);
        addBox(0.72, 0.13, 0.16, x, 0.13, -buildingDepth / 2 + 0.48, parkingCurbMaterial);
        addBox(0.72, 0.13, 0.16, x, 0.13, buildingDepth / 2 - 0.48, parkingCurbMaterial);
      }

      for (let x = -5.6; x <= 5.6; x += 2.8) {
        addBox(1.25, 0.025, 0.055, x, 0.08, 0, parkingLineMaterial);
      }

      const firstCarX = -buildingWidth / 2 + sideMargin + spaceWidth * 1.5;
      const secondCarX = -buildingWidth / 2 + sideMargin + spaceWidth * 3.5;
      addVoxelCar(firstCarX, northZ, parkingCarMaterials[0], 0);
      addVoxelCar(secondCarX, southZ, parkingCarMaterials[1], Math.PI);
    };

    const wallSegments = new Map<string, {
      start: { x: number; y: number };
      end: { x: number; y: number };
      rooms: BrandRoom[];
    }>();
    floor.rooms.forEach((room) => {
      const sourcePoints = parseShape(room.shape);
      sourcePoints.forEach((point, index) => {
        const next = sourcePoints[(index + 1) % sourcePoints.length];
        const pointKey = `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
        const nextKey = `${next.x.toFixed(3)},${next.y.toFixed(3)}`;
        const key = pointKey < nextKey ? `${pointKey}|${nextKey}` : `${nextKey}|${pointKey}`;
        const existing = wallSegments.get(key);
        if (existing) existing.rooms.push(room);
        else wallSegments.set(key, { start: point, end: next, rooms: [room] });
      });
    });

    floor.rooms.forEach((room, roomIndex) => {
      const sourcePoints = parseShape(room.shape);
      const points = sourcePoints.map((point) => toWorld(point.x, point.y));
      const roomWidth = Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
      const roomDepth = Math.max(...points.map((point) => point.z)) - Math.min(...points.map((point) => point.z));
      const shape = new THREE.Shape();
      shape.moveTo(points[0].x, -points[0].z);
      points.slice(1).forEach((point) => shape.lineTo(point.x, -point.z));
      shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.rotateX(-Math.PI / 2);
      const visible = visibleIds.has(room.id);
      const color = floor.parking ? 0x596267 : kindMeta[room.kind].threeColor;
      const material = new THREE.MeshStandardMaterial({
        color: visible ? color : 0xaeb5b8,
        emissive: color,
        emissiveIntensity: 0,
        roughness: 0.9,
        transparent: !visible,
        opacity: visible ? 0.92 : 0.16,
        depthWrite: visible,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.02;
      mesh.receiveShadow = true;
      mesh.userData.roomId = room.id;
      world.add(mesh);
      interactive.push(mesh);

      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: visible ? 0x52616a : 0xaab0b3, transparent: true, opacity: visible ? 0.75 : 0.18 }));
      outline.position.y = 0.045;
      world.add(outline);

      const label = visible && !floor.parking ? createLabel(room) : null;
      const labelPoint = toWorld(room.labelX, room.labelY);
      if (visible && room.id === "f1-106") {
        addTablePair(labelPoint.x, labelPoint.z, roomWidth, roomDepth);
      } else if (visible && room.kind === "trade" && Math.min(roomWidth, roomDepth) > 0.72) {
        addBoutique(labelPoint.x, labelPoint.z, roomWidth, roomDepth, roomIndex);
      }
      if (label) {
        label.position.set(labelPoint.x, 3.18, labelPoint.z);
        world.add(label);
      }
      roomVisuals.set(room.id, { material, outline, label, visible });
    });

    const sourceTolerance = 0.5;
    wallSegments.forEach(({ start, end, rooms: segmentRooms }) => {
      const point = toWorld(start.x, start.y);
      const next = toWorld(end.x, end.y);
      const dx = next.x - point.x;
      const dz = next.z - point.z;
      const length = Math.hypot(dx, dz);
      const rotation = -Math.atan2(dz, dx);
      const isEnvelope =
        (Math.abs(start.x - minX) < sourceTolerance && Math.abs(end.x - minX) < sourceTolerance)
        || (Math.abs(start.x - maxX) < sourceTolerance && Math.abs(end.x - maxX) < sourceTolerance)
        || (Math.abs(start.y - minY) < sourceTolerance && Math.abs(end.y - minY) < sourceTolerance)
        || (Math.abs(start.y - maxY) < sourceTolerance && Math.abs(end.y - maxY) < sourceTolerance);
      const isBasementUtility = floor.name === "Подвал" && segmentRooms.some((room) => room.kind === "service");

      if (floor.parking) {
        addBox(length + 0.02, 0.2, 0.14, (point.x + next.x) / 2, 0.1, (point.z + next.z) / 2, parkingCurbMaterial, rotation);
        return;
      }

      if (isEnvelope || isBasementUtility) {
        addBox(length + 0.03, wallHeight, wallThickness, (point.x + next.x) / 2, wallHeight / 2, (point.z + next.z) / 2, wallMaterial, rotation);
        return;
      }

      const glassHeight = 2.34;
      const panel = addBox(length + 0.02, glassHeight, 0.045, (point.x + next.x) / 2, glassHeight / 2, (point.z + next.z) / 2, partitionGlassMaterial, rotation);
      panel.castShadow = false;
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), partitionFrameMaterial);
      frame.position.copy(panel.position);
      frame.rotation.copy(panel.rotation);
      frame.renderOrder = 4;
      world.add(frame);
    });

    if (floor.parking) addParkingLayout();

    floor.cores.forEach((core) => {
      const center = toWorld(core.x + core.width / 2, core.y + core.height / 2);
      const width = core.width * scale;
      const depth = core.height * scale;
      addBox(width, 0.08, depth, center.x, 0.04, center.z, coreMaterial);
      const stepDepth = depth / 8;
      for (let step = 0; step < 7; step += 1) {
        addBox(width * 0.72, 0.06 + step * 0.045, stepDepth * 0.78, center.x, 0.09 + step * 0.0225, center.z - depth / 2 + stepDepth * (step + 0.7), coreMaterial);
      }
      addBox(width + wallThickness, wallHeight, wallThickness, center.x, wallHeight / 2, center.z - depth / 2, wallMaterial);
      addBox(wallThickness, wallHeight, depth, center.x - width / 2, wallHeight / 2, center.z, wallMaterial);
      addBox(wallThickness, wallHeight, depth, center.x + width / 2, wallHeight / 2, center.z, wallMaterial);
      const doorway = Math.min(1.05, width * 0.42);
      const frontSegment = Math.max(0.12, (width - doorway) / 2);
      addBox(frontSegment, wallHeight, wallThickness, center.x - (doorway + frontSegment) / 2, wallHeight / 2, center.z + depth / 2, wallMaterial);
      addBox(frontSegment, wallHeight, wallThickness, center.x + (doorway + frontSegment) / 2, wallHeight / 2, center.z + depth / 2, wallMaterial);
    });

    const repaint = () => {
      const plan = floorRef.current;
      const visibleIdsNow = new Set(visibleKeyRef.current.split("|").filter(Boolean));
      const byId = new Map(plan.rooms.map((room) => [room.id, room]));
      roomVisuals.forEach((visual, id) => {
        const room = byId.get(id);
        if (!room) return;
        const shown = visibleIdsNow.has(id);
        const color = plan.parking ? 0x596267 : kindMeta[room.kind].threeColor;
        visual.visible = shown;
        visual.material.color.set(shown ? color : 0xaeb5b8);
        visual.material.emissive.set(color);
        visual.material.transparent = !shown;
        visual.material.opacity = shown ? 0.92 : 0.16;
        visual.material.depthWrite = shown;
        const lineMaterial = visual.outline.material as THREE.LineBasicMaterial;
        lineMaterial.color.set(shown ? 0x52616a : 0xaab0b3);
        lineMaterial.opacity = shown ? 0.75 : 0.18;
        if (visual.label) {
          world.remove(visual.label);
          visual.label.material.map?.dispose();
          visual.label.material.dispose();
          visual.label = null;
        }
        if (shown && !plan.parking) {
          const label = createLabel(room);
          if (label) {
            const labelPoint = toWorld(room.labelX, room.labelY);
            label.position.set(labelPoint.x, 3.18, labelPoint.z);
            world.add(label);
            visual.label = label;
          }
        }
      });
    };
    paintRef.current = repaint;

    const refresh = () => {
      roomVisuals.forEach((visual, id) => {
        const active = id === selectedRef.current && visual.visible;
        visual.material.emissiveIntensity = active ? 0.23 : 0;
        const lineMaterial = visual.outline.material as THREE.LineBasicMaterial;
        lineMaterial.color.set(active ? 0x27323a : 0x52616a);
        lineMaterial.opacity = active ? 1 : visual.visible ? 0.75 : 0.18;
        if (visual.label) visual.label.scale.set(active ? 3.04 : 2.75, active ? 1.07 : 0.96, 1);
      });
    };
    refreshRef.current = refresh;
    refresh();

    const reset = () => {
      camera.position.set(14.5, 15.5, 17.5);
      controls.target.set(0, 0.55, 0);
      controls.update();
    };
    resetRef.current = reset;
    reset();

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const viewHeight = Math.max(buildingDepth * 1.52, buildingWidth / aspect * 1.18);
      camera.left = -viewHeight * aspect / 2;
      camera.right = viewHeight * aspect / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const updatePointer = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(interactive, false).find((item) => visibleKeyRef.current.split("|").includes(item.object.userData.roomId as string));
    };
    const handleMove = (event: PointerEvent) => { renderer.domElement.style.cursor = updatePointer(event) ? "pointer" : "grab"; };
    const handleClick = (event: PointerEvent) => {
      const hit = updatePointer(event);
      const id = hit?.object.userData.roomId as string | undefined;
      if (id) onSelectRef.current(id);
    };
    renderer.domElement.addEventListener("pointermove", handleMove);
    renderer.domElement.addEventListener("click", handleClick);

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
      renderer.domElement.removeEventListener("pointermove", handleMove);
      renderer.domElement.removeEventListener("click", handleClick);
      controls.dispose();
      world.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          child.geometry?.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => material.dispose());
        }
        if (child instanceof THREE.Sprite) {
          child.material.map?.dispose();
          child.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      refreshRef.current = null;
      paintRef.current = null;
      resetRef.current = null;
    };
  }, [geometryKey]);

  useEffect(() => { paintRef.current?.(); refreshRef.current?.(); }, [colorKey, visibleKey]);
  useEffect(() => { refreshRef.current?.(); }, [selectedId]);

  return <div ref={hostRef} className={`three-floor-stage brand-three-stage ${ready ? "ready" : ""}`}>
    {!ready && <div className="three-loading">Строим цифровой этаж…</div>}
    <div className="three-stage-topbar"><span><i />{floor.parking ? "Парковка · 10 мест · 2 автомобиля" : "Стеклянные перегородки · глухие ядра"}</span><button onClick={() => resetRef.current?.()}>↺ Исходный вид</button></div>
    <div className="three-stage-help"><strong>Вращение:</strong> потяните · <strong>Масштаб:</strong> колесо или жест · нажмите на помещение</div>
  </div>;
}
