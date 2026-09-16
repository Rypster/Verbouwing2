import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlannerState, Opening, Wall } from '../types';
import { FURNITURE_DEFINITIONS } from '../utils/furniture';
import {
  Eye,
  Camera,
  Sun,
  Sunset,
  Moon,
  RotateCcw,
  Layers,
  Download,
  Maximize2,
  Minimize2,
  Compass,
  DoorOpen,
  DoorClosed,
  MousePointer,
  Crosshair,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Move,
} from 'lucide-react';

interface View3DProps {
  state: PlannerState;
  setState: React.Dispatch<React.SetStateAction<PlannerState>>;
}

type LightingPreset = 'midday' | 'golden' | 'evening';
type CameraViewPreset = 'dollhouse' | 'interior' | 'top';

interface DoorController {
  id: string;
  opening: Opening;
  pivot: THREE.Group;
  doorMesh: THREE.Mesh;
  openAngle: number;
  currentAngle: number;
  targetAngle: number;
  isOpen: boolean;
}

export const View3D: React.FC<View3DProps> = ({ state, setState }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // User controls state
  const [lighting, setLighting] = useState<LightingPreset>('midday');
  const [cameraPreset, setCameraPreset] = useState<CameraViewPreset>('dollhouse');
  const [cutawayWalls, setCutawayWalls] = useState<boolean>(false);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [aimedDoorPrompt, setAimedDoorPrompt] = useState<string | null>(null);
  const [allDoorsOpen, setAllDoorsOpen] = useState<boolean>(false);

  // Three.js instances refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const buildingGroupRef = useRef<THREE.Group | null>(null);

  // FPS Controller refs
  const yawRef = useRef<number>(0);
  const pitchRef = useRef<number>(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const doorsMapRef = useRef<Map<string, DoorController>>(new Map());
  const interactiveDoorMeshesRef = useRef<THREE.Mesh[]>([]);
  const aimedDoorIdRef = useRef<string | null>(null);

  // Keep camera preset in sync with ref to avoid stale closures in animate() loop
  const cameraPresetRef = useRef<CameraViewPreset>(cameraPreset);
  cameraPresetRef.current = cameraPreset;

  // Drag-to-look support (for seamless 360 mouse look even without iframe pointer-lock)
  const isDraggingLookRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Animation frame id ref
  const animFrameIdRef = useRef<number | null>(null);

  // Scale px per meter
  const scale = state.scalePxPerMeter > 10 ? state.scalePxPerMeter : 50;

  // Calculate building center and bounds
  const getCenter = () => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    if (state.walls.length > 0) {
      state.walls.forEach((w) => {
        minX = Math.min(minX, w.x1, w.x2);
        maxX = Math.max(maxX, w.x1, w.x2);
        minY = Math.min(minY, w.y1, w.y2);
        maxY = Math.max(maxY, w.y1, w.y2);
      });
    } else if (state.zones.length > 0) {
      state.zones.forEach((z) => {
        z.points.forEach((p) => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        });
      });
    } else if (state.furniture && state.furniture.length > 0) {
      state.furniture.forEach((f) => {
        minX = Math.min(minX, f.x);
        maxX = Math.max(maxX, f.x);
        minY = Math.min(minY, f.y);
        maxY = Math.max(maxY, f.y);
      });
    } else {
      return { cx: 400, cy: 300, spanX: 10, spanZ: 8 };
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const spanX = Math.max(6, (maxX - minX) / scale);
    const spanZ = Math.max(6, (maxY - minY) / scale);

    return { cx, cy, spanX, spanZ };
  };

  // Convert 2D world coords to 3D Three.js coords (in meters)
  const to3D = (px: number, py: number, cx: number, cy: number) => {
    return {
      x: (px - cx) / scale,
      z: (py - cy) / scale,
    };
  };

  // Find a safe room interior spawn point so the camera never spawns embedded inside a wall or ceiling
  const getSafeInteriorSpawnPoint = () => {
    const { cx, cy } = getCenter();

    // 1. If zones exist, find the zone with the largest area and use its centroid
    if (state.zones && state.zones.length > 0) {
      let bestZone = state.zones[0];
      let maxArea = 0;

      state.zones.forEach((z) => {
        if (!z.points || z.points.length < 3) return;
        let area = 0;
        for (let i = 0; i < z.points.length; i++) {
          const j = (i + 1) % z.points.length;
          area += z.points[i].x * z.points[j].y;
          area -= z.points[j].x * z.points[i].y;
        }
        area = Math.abs(area) / 2;
        if (area > maxArea) {
          maxArea = area;
          bestZone = z;
        }
      });

      if (bestZone && bestZone.points.length >= 3) {
        let sumX = 0;
        let sumY = 0;
        bestZone.points.forEach((p) => {
          sumX += p.x;
          sumY += p.y;
        });
        const avgX = sumX / bestZone.points.length;
        const avgY = sumY / bestZone.points.length;
        const pt3D = to3D(avgX, avgY, cx, cy);
        return { x: pt3D.x, z: pt3D.z };
      }
    }

    // 2. If furniture exists, spawn near the first piece of furniture
    if (state.furniture && state.furniture.length > 0) {
      const f = state.furniture[0];
      const pt3D = to3D(f.x, f.y, cx, cy);
      return { x: pt3D.x + 0.6, z: pt3D.z + 0.8 };
    }

    // 3. Fallback: slight offset from center to avoid center-wall intersections
    return { x: 0.8, z: 0.8 };
  };

  // 1. Setup Three.js Scene, Camera, OrbitControls, and Animation Loop
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Sky blue background
    scene.background = new THREE.Color(0x60a5fa);
    scene.fog = new THREE.FogExp2(0x93c5fd, 0.007);

    // Camera (Euler order YXZ for natural FPS mouse-look)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.rotation.order = 'YXZ';
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Stay above ground
    controls.minDistance = 1.5;
    controls.maxDistance = 85;
    controlsRef.current = controls;

    // Groups
    const lightsGroup = new THREE.Group();
    scene.add(lightsGroup);
    lightsGroupRef.current = lightsGroup;

    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);
    buildingGroupRef.current = buildingGroup;

    // Sky Dome & Landscape Ground
    addSkyAndGround(scene);

    // Initial dollhouse camera placement
    const { spanX, spanZ } = getCenter();
    const dist = Math.max(spanX, spanZ) * 1.5;
    camera.position.set(dist * 0.85, dist * 0.9, dist * 0.95);
    controls.target.set(0, 1.2, 0);
    controls.update();

    // Main Animation & Physics Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = Math.min(0.08, clockRef.current.getDelta());

      // 1. Smooth Door Swing Animation
      doorsMapRef.current.forEach((door) => {
        if (Math.abs(door.currentAngle - door.targetAngle) > 0.001) {
          door.currentAngle = THREE.MathUtils.lerp(door.currentAngle, door.targetAngle, 0.14);
          door.pivot.rotation.y = door.currentAngle;
        }
      });

      // 2. First-Person Walk / WASD Movement when in FPS mode
      if (cameraPresetRef.current === 'interior' && cameraRef.current) {
        // Compute horizontal movement
        const speed = (keysPressed.current['ShiftLeft'] || keysPressed.current['ShiftRight']) ? 4.8 : 2.5; // m/s
        const moveVector = new THREE.Vector3();

        // Forward vector projected on horizontal XZ plane
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);

        if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) moveVector.add(forward);
        if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) moveVector.sub(forward);
        if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) moveVector.add(right);
        if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) moveVector.sub(right);

        if (moveVector.lengthSq() > 0) {
          moveVector.normalize();
          const nextPos = camera.position.clone().addScaledVector(moveVector, speed * delta);
          nextPos.y = 1.65; // Natural eye height (walls are 2.65m)

          // Wall collision detection: prevent walking through solid walls
          const { cx, cy } = getCenter();
          let canMove = true;

          for (const wall of state.walls) {
            const p1 = to3D(wall.x1, wall.y1, cx, cy);
            const p2 = to3D(wall.x2, wall.y2, cx, cy);
            const wallDx = p2.x - p1.x;
            const wallDz = p2.z - p1.z;
            const wallLenSq = wallDx * wallDx + wallDz * wallDz;
            if (wallLenSq < 0.001) continue;

            // Project nextPos on wall segment
            const t = Math.max(0, Math.min(1, ((nextPos.x - p1.x) * wallDx + (nextPos.z - p1.z) * wallDz) / wallLenSq));
            const closeX = p1.x + t * wallDx;
            const closeZ = p1.z + t * wallDz;
            const distSq = (nextPos.x - closeX) * (nextPos.x - closeX) + (nextPos.z - closeZ) * (nextPos.z - closeZ);

            // If player approaches within 0.28m of a wall segment
            if (distSq < 0.28 * 0.28) {
              // Allow passage if there is a door/opening at this wall position
              const wallOpenings = (state.openings || []).filter((o) => o.wallId === wall.id);
              let inOpening = false;
              for (const op of wallOpenings) {
                const opLen = Math.sqrt(wallLenSq);
                const halfRatio = (op.widthMeters || 0.9) / (2 * (opLen || 1));
                if (Math.abs(t - op.offsetRatio) <= halfRatio * 1.1) {
                  // If opening is a door, only pass if open
                  if (op.type === 'Door') {
                    const doorCtrl = doorsMapRef.current.get(op.id);
                    if (doorCtrl?.isOpen) {
                      inOpening = true;
                      break;
                    }
                  } else if (op.type !== 'Window') {
                    inOpening = true;
                    break;
                  }
                }
              }

              if (!inOpening) {
                canMove = false;
                break;
              }
            }
          }

          if (canMove) {
            camera.position.copy(nextPos);
          }
        }

        // Raycast from camera center to detect doors in front of player
        if (interactiveDoorMeshesRef.current.length > 0) {
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
          const intersects = raycaster.intersectObjects(interactiveDoorMeshesRef.current, false);

          if (intersects.length > 0 && intersects[0].distance < 3.2) {
            const hitMesh = intersects[0].object as THREE.Mesh;
            const doorId = hitMesh.userData?.doorId;
            if (doorId) {
              aimedDoorIdRef.current = doorId;
              const doorCtrl = doorsMapRef.current.get(doorId);
              setAimedDoorPrompt(doorCtrl?.isOpen ? 'Deur sluiten [E / Klik]' : 'Deur openen [E / Klik]');
            }
          } else {
            aimedDoorIdRef.current = null;
            setAimedDoorPrompt(null);
          }
        }
      } else {
        controls.update();
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Helper to add Sky Dome and outdoor landscape
  const addSkyAndGround = (scene: THREE.Scene) => {
    // Sky Dome with subtle gradient
    const skyGeo = new THREE.SphereGeometry(320, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa, // Crisp bright sky blue
      side: THREE.BackSide,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);

    // Distant horizon haze ring
    const horizonGeo = new THREE.CylinderGeometry(310, 310, 45, 32, 1, true);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0xcbe2fb,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.8,
    });
    const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
    horizonMesh.position.y = 15;
    scene.add(horizonMesh);

    // Outdoor Lawn / Meadow
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4a6741,
      roughness: 0.9,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Paved Terrace / Perimeter patio
    const patioGeo = new THREE.BoxGeometry(50, 0.08, 50);
    const patioMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.7,
      metalness: 0.1,
    });
    const patio = new THREE.Mesh(patioGeo, patioMat);
    patio.position.y = -0.04;
    patio.receiveShadow = true;
    scene.add(patio);
  };

  // 2. Setup Dynamic Lighting
  useEffect(() => {
    const lightsGroup = lightsGroupRef.current;
    const scene = sceneRef.current;
    if (!lightsGroup || !scene) return;

    while (lightsGroup.children.length > 0) {
      lightsGroup.remove(lightsGroup.children[0]);
    }

    const { spanX, spanZ } = getCenter();
    const lightDist = Math.max(spanX, spanZ, 12);

    if (lighting === 'midday') {
      scene.background = new THREE.Color(0x60a5fa);
      scene.fog = new THREE.FogExp2(0xa5cbf7, 0.005);

      const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x5a6d55, 0.85);
      lightsGroup.add(hemiLight);

      const sun = new THREE.DirectionalLight(0xfffaea, 1.55);
      sun.position.set(lightDist * 1.2, lightDist * 1.6, lightDist * 0.9);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = lightDist * 4;
      sun.shadow.camera.left = -lightDist * 1.3;
      sun.shadow.camera.right = lightDist * 1.3;
      sun.shadow.camera.top = lightDist * 1.3;
      sun.shadow.camera.bottom = -lightDist * 1.3;
      sun.shadow.bias = -0.0003;
      lightsGroup.add(sun);

      const warmInterior = new THREE.PointLight(0xffecd2, 1.3, 30, 1.5);
      warmInterior.position.set(0, 2.5, 0);
      lightsGroup.add(warmInterior);

    } else if (lighting === 'golden') {
      scene.background = new THREE.Color(0x3b82f6);
      scene.fog = new THREE.FogExp2(0xfbcfe8, 0.007);

      const hemiLight = new THREE.HemisphereLight(0xfde047, 0x3f3d56, 0.75);
      lightsGroup.add(hemiLight);

      const sun = new THREE.DirectionalLight(0xffb74d, 1.9);
      sun.position.set(lightDist * 1.8, lightDist * 0.65, lightDist * 1.1);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      sun.shadow.bias = -0.0003;
      lightsGroup.add(sun);

      const warmInterior = new THREE.PointLight(0xffd8a8, 1.7, 30, 1.5);
      warmInterior.position.set(0, 2.4, 0);
      lightsGroup.add(warmInterior);

    } else {
      // Evening
      scene.background = new THREE.Color(0x1e3a8a);
      scene.fog = new THREE.FogExp2(0x172554, 0.009);

      const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x1e293b, 0.4);
      lightsGroup.add(hemiLight);

      const moon = new THREE.DirectionalLight(0x93c5fd, 0.45);
      moon.position.set(-lightDist, lightDist * 1.5, -lightDist);
      moon.castShadow = true;
      lightsGroup.add(moon);

      const warmInterior = new THREE.PointLight(0xffaa44, 2.4, 30, 1.2);
      warmInterior.position.set(0, 2.4, 0);
      warmInterior.castShadow = true;
      lightsGroup.add(warmInterior);
    }
  }, [lighting, state.walls, state.zones]);

  // 3. Rebuild 3D Building (Open Window Casings, Realistic Swing Doors, Floors, Furniture)
  useEffect(() => {
    const buildingGroup = buildingGroupRef.current;
    if (!buildingGroup) return;

    // Reset door controllers and interactive meshes
    doorsMapRef.current.clear();
    interactiveDoorMeshesRef.current = [];

    // Clear previous meshes
    while (buildingGroup.children.length > 0) {
      const child = buildingGroup.children[0];
      buildingGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }

    const { cx, cy } = getCenter();
    const wallHeight = cutawayWalls ? 1.15 : 2.65;

    // Materials
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf3f4f6, // Warm light off-white plaster
      roughness: 0.85,
      metalness: 0.05,
    });

    // Sleek architectural anthracite casing for door & window frames
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Clean dark slate
      roughness: 0.4,
      metalness: 0.2,
    });

    // White door leaf material
    const doorLeafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
    });

    // Chrome hardware (door handle / kruk)
    const chromeHardwareMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1,
    });

    // Crystal Clear Transparent Glass Pane for windows
    const windowGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf0f9ff, // Crisp airy glass
      transparent: true,
      opacity: 0.18,
      roughness: 0.05,
      metalness: 0.05,
      transmission: 0.94,
      ior: 1.5,
    });

    // Wooden windowsill board
    const sillBoardMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
    });

    // Parquet Floor Texture
    const parquetCanvas = createParquetCanvas();
    const parquetTexture = new THREE.CanvasTexture(parquetCanvas);
    parquetTexture.wrapS = THREE.RepeatWrapping;
    parquetTexture.wrapT = THREE.RepeatWrapping;
    parquetTexture.repeat.set(1.2, 1.2);

    const floorWoodMat = new THREE.MeshStandardMaterial({
      map: parquetTexture,
      roughness: 0.45,
      metalness: 0.05,
    });

    const floorTileMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.25,
      metalness: 0.1,
    });

    // A. FLOORS (Zones)
    if (state.zones && state.zones.length > 0) {
      state.zones.forEach((zone) => {
        if (zone.points.length < 3) return;

        const shape = new THREE.Shape();
        zone.points.forEach((pt, idx) => {
          const { x, z } = to3D(pt.x, pt.y, cx, cy);
          if (idx === 0) shape.moveTo(x, -z);
          else shape.lineTo(x, -z);
        });
        shape.closePath();

        const geom = new THREE.ShapeGeometry(shape);
        const isBathOrToilet = /bad|toilet|wc|douche/i.test(zone.label || '');
        const mesh = new THREE.Mesh(geom, isBathOrToilet ? floorTileMat : floorWoodMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.005;
        mesh.receiveShadow = true;
        buildingGroup.add(mesh);
      });
    } else {
      const defaultFloorGeo = new THREE.BoxGeometry(20, 0.05, 16);
      const defaultFloor = new THREE.Mesh(defaultFloorGeo, floorWoodMat);
      defaultFloor.position.y = 0.02;
      defaultFloor.receiveShadow = true;
      buildingGroup.add(defaultFloor);
    }

    // B. WALLS WITH REAL OPENINGS & ACCURATE SWING DOORS
    state.walls.forEach((wall) => {
      const p1 = to3D(wall.x1, wall.y1, cx, cy);
      const p2 = to3D(wall.x2, wall.y2, cx, cy);

      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const wallLen = Math.hypot(dx, dz);
      if (wallLen < 0.05) return;

      const angle = Math.atan2(dz, dx);
      const thickness = Math.max(0.12, (wall.thicknessPx || 12) / scale);

      const wallOpenings = (state.openings || []).filter((o) => o.wallId === wall.id);

      if (wallOpenings.length === 0 || cutawayWalls) {
        // Solid wall segment
        const wallGeo = new THREE.BoxGeometry(wallLen, wallHeight, thickness);
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;

        wallMesh.position.set((p1.x + p2.x) / 2, wallHeight / 2, (p1.z + p2.z) / 2);
        wallMesh.rotation.y = -angle;
        buildingGroup.add(wallMesh);
      } else {
        // Sorted openings along wall
        const sortedOpenings = wallOpenings
          .map((op) => {
            const opWidth = Math.max(0.6, Math.min(wallLen * 0.9, op.widthMeters || 0.9));
            const centerDist = op.offsetRatio * wallLen;
            const startDist = Math.max(0, centerDist - opWidth / 2);
            const endDist = Math.min(wallLen, centerDist + opWidth / 2);
            return {
              ...op,
              opWidth: endDist - startDist,
              centerDist,
              startDist,
              endDist,
            };
          })
          .sort((a, b) => a.startDist - b.startDist);

        let currentDist = 0;

        sortedOpenings.forEach((op) => {
          // 1. Solid wall segment before opening
          const solidLen = op.startDist - currentDist;
          if (solidLen > 0.02) {
            const solidGeo = new THREE.BoxGeometry(solidLen, wallHeight, thickness);
            const solidMesh = new THREE.Mesh(solidGeo, wallMat);
            solidMesh.castShadow = true;
            solidMesh.receiveShadow = true;

            const midDist = currentDist + solidLen / 2;
            const segX = p1.x + (dx / wallLen) * midDist;
            const segZ = p1.z + (dz / wallLen) * midDist;

            solidMesh.position.set(segX, wallHeight / 2, segZ);
            solidMesh.rotation.y = -angle;
            buildingGroup.add(solidMesh);
          }

          // 2. The opening itself
          const opMidDist = (op.startDist + op.endDist) / 2;
          const opCenterX = p1.x + (dx / wallLen) * opMidDist;
          const opCenterZ = p1.z + (dz / wallLen) * opMidDist;

          if (op.type === 'Window') {
            // WINDOW: Open Casing with Crystal-Clear Glass
            const sillHeight = 0.9;
            const windowHeight = Math.min(1.4, wallHeight - sillHeight - 0.25);
            const lintelHeight = Math.max(0.1, wallHeight - (sillHeight + windowHeight));

            // Sill wall underneath
            if (sillHeight > 0.05) {
              const sillGeo = new THREE.BoxGeometry(op.opWidth, sillHeight, thickness);
              const sillMesh = new THREE.Mesh(sillGeo, wallMat);
              sillMesh.castShadow = true;
              sillMesh.receiveShadow = true;
              sillMesh.position.set(opCenterX, sillHeight / 2, opCenterZ);
              sillMesh.rotation.y = -angle;
              buildingGroup.add(sillMesh);
            }

            // Lintel wall above
            if (lintelHeight > 0.05) {
              const lintelGeo = new THREE.BoxGeometry(op.opWidth, lintelHeight, thickness);
              const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
              lintelMesh.castShadow = true;
              lintelMesh.receiveShadow = true;
              lintelMesh.position.set(opCenterX, wallHeight - lintelHeight / 2, opCenterZ);
              lintelMesh.rotation.y = -angle;
              buildingGroup.add(lintelMesh);
            }

            // Window Kozijn / Open Frame Assembly Group
            const winGroup = new THREE.Group();
            winGroup.position.set(opCenterX, sillHeight + windowHeight / 2, opCenterZ);
            winGroup.rotation.y = -angle;

            const casingBarThick = 0.045; // 4.5cm slim modern frame
            const casingDepth = thickness * 1.02;

            // Left Post
            const leftPostGeo = new THREE.BoxGeometry(casingBarThick, windowHeight, casingDepth);
            const leftPost = new THREE.Mesh(leftPostGeo, casingMat);
            leftPost.position.set(-op.opWidth / 2 + casingBarThick / 2, 0, 0);
            winGroup.add(leftPost);

            // Right Post
            const rightPostGeo = new THREE.BoxGeometry(casingBarThick, windowHeight, casingDepth);
            const rightPost = new THREE.Mesh(rightPostGeo, casingMat);
            rightPost.position.set(op.opWidth / 2 - casingBarThick / 2, 0, 0);
            winGroup.add(rightPost);

            // Top Transom
            const topBarGeo = new THREE.BoxGeometry(op.opWidth, casingBarThick, casingDepth);
            const topBar = new THREE.Mesh(topBarGeo, casingMat);
            topBar.position.set(0, windowHeight / 2 - casingBarThick / 2, 0);
            winGroup.add(topBar);

            // Bottom Sill Bar
            const botBarGeo = new THREE.BoxGeometry(op.opWidth, casingBarThick, casingDepth);
            const botBar = new THREE.Mesh(botBarGeo, casingMat);
            botBar.position.set(0, -windowHeight / 2 + casingBarThick / 2, 0);
            winGroup.add(botBar);

            // Slim Center Mullion if wide window (>1.3m)
            if (op.opWidth >= 1.3) {
              const mullionGeo = new THREE.BoxGeometry(casingBarThick * 0.8, windowHeight, casingDepth * 0.95);
              const mullion = new THREE.Mesh(mullionGeo, casingMat);
              winGroup.add(mullion);
            }

            // Crystal-Clear Open Glass Pane
            const glassGeo = new THREE.BoxGeometry(
              op.opWidth - casingBarThick * 2,
              windowHeight - casingBarThick * 2,
              0.015
            );
            const glassMesh = new THREE.Mesh(glassGeo, windowGlassMat);
            winGroup.add(glassMesh);

            // Interior Wooden Window Sill Board
            const boardGeo = new THREE.BoxGeometry(op.opWidth + 0.1, 0.025, thickness + 0.12);
            const boardMesh = new THREE.Mesh(boardGeo, sillBoardMat);
            boardMesh.position.set(0, -windowHeight / 2 + 0.01, 0.02);
            winGroup.add(boardMesh);

            buildingGroup.add(winGroup);

          } else {
            // DOOR: Realistic Open Passage with Interactive Swing Door
            const doorHeight = Math.min(2.15, wallHeight - 0.15);
            const lintelHeight = Math.max(0.08, wallHeight - doorHeight);

            // Lintel wall above door
            if (lintelHeight > 0.05) {
              const lintelGeo = new THREE.BoxGeometry(op.opWidth, lintelHeight, thickness);
              const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
              lintelMesh.castShadow = true;
              lintelMesh.receiveShadow = true;
              lintelMesh.position.set(opCenterX, wallHeight - lintelHeight / 2, opCenterZ);
              lintelMesh.rotation.y = -angle;
              buildingGroup.add(lintelMesh);
            }

            // Door Frame Assembly Group (Placed at doorway center at floor level y=0)
            const doorAssemblyGroup = new THREE.Group();
            doorAssemblyGroup.position.set(opCenterX, 0, opCenterZ);
            doorAssemblyGroup.rotation.y = -angle;

            const casingBarThick = 0.05; // 5cm frame profile
            const casingDepth = thickness * 1.02;

            // Left Door Frame Jamb
            const leftJambGeo = new THREE.BoxGeometry(casingBarThick, doorHeight, casingDepth);
            const leftJamb = new THREE.Mesh(leftJambGeo, casingMat);
            leftJamb.position.set(-op.opWidth / 2 + casingBarThick / 2, doorHeight / 2, 0);
            doorAssemblyGroup.add(leftJamb);

            // Right Door Frame Jamb
            const rightJambGeo = new THREE.BoxGeometry(casingBarThick, doorHeight, casingDepth);
            const rightJamb = new THREE.Mesh(rightJambGeo, casingMat);
            rightJamb.position.set(op.opWidth / 2 - casingBarThick / 2, doorHeight / 2, 0);
            doorAssemblyGroup.add(rightJamb);

            // Top Header Jamb
            const topHeaderGeo = new THREE.BoxGeometry(op.opWidth, casingBarThick, casingDepth);
            const topHeader = new THREE.Mesh(topHeaderGeo, casingMat);
            topHeader.position.set(0, doorHeight - casingBarThick / 2, 0);
            doorAssemblyGroup.add(topHeader);

            // Realistic Door Leaf Mounted on Precision Hinge Pivot!
            const leafWidth = op.opWidth - casingBarThick * 2 - 0.01;
            const leafHeight = doorHeight - casingBarThick - 0.01;
            const leafThick = 0.04;

            // Calculate exact hinge position based on 2D flipHand & flipSide
            // flipHand: false = hinge on left, true = hinge on right
            const hingeLocalX = op.flipHand
              ? (op.opWidth / 2 - casingBarThick)
              : (-op.opWidth / 2 + casingBarThick);

            // flipSide: sets whether the door swings inside (+Z) or outside (-Z)
            const hingeLocalZ = op.flipSide ? (thickness / 2 - 0.02) : (-thickness / 2 + 0.02);

            // Hinge Pivot Group
            const hingePivot = new THREE.Group();
            hingePivot.position.set(hingeLocalX, 0, hingeLocalZ);

            // Door Leaf Mesh
            const leafGeo = new THREE.BoxGeometry(leafWidth, leafHeight, leafThick);
            const doorLeafMesh = new THREE.Mesh(leafGeo, doorLeafMat);
            doorLeafMesh.castShadow = true;
            doorLeafMesh.receiveShadow = true;

            // Offset door leaf so its edge sits exactly on the hinge pivot:
            // If hinge on left (!flipHand): leaf extends to the right (+X), so mesh center is +leafWidth / 2
            // If hinge on right (flipHand): leaf extends to the left (-X), so mesh center is -leafWidth / 2
            const leafOffsetX = op.flipHand ? (-leafWidth / 2) : (leafWidth / 2);
            doorLeafMesh.position.set(leafOffsetX, leafHeight / 2, 0);

            // Attach door ID for raycasting interaction
            doorLeafMesh.userData = { doorId: op.id };
            interactiveDoorMeshesRef.current.push(doorLeafMesh);

            // Chrome Modern Door Handle (Kruk & Schild) at height 1.05m near free edge
            const handleSideX = op.flipHand ? (-leafWidth + 0.07) : (leafWidth - 0.07);
            const handleHeight = 1.02;

            // Both sides handles
            [-leafThick / 2 - 0.01, leafThick / 2 + 0.01].forEach((handleZ, hIdx) => {
              const rosetGeo = new THREE.BoxGeometry(0.045, 0.16, 0.008);
              const roset = new THREE.Mesh(rosetGeo, chromeHardwareMat);
              roset.position.set(handleSideX, handleHeight, handleZ);
              hingePivot.add(roset);

              const leverGeo = new THREE.BoxGeometry(0.12, 0.018, 0.018);
              const lever = new THREE.Mesh(leverGeo, chromeHardwareMat);
              const leverDir = op.flipHand ? 1 : -1;
              lever.position.set(handleSideX + leverDir * 0.05, handleHeight + 0.02, handleZ + (hIdx === 0 ? -0.04 : 0.04));
              hingePivot.add(lever);
            });

            hingePivot.add(doorLeafMesh);
            doorAssemblyGroup.add(hingePivot);
            buildingGroup.add(doorAssemblyGroup);

            // Compute open angle: 85 degrees (1.48 rad)
            // Invert angle so that 3D swing direction perfectly matches the 2D blueprint swing arc:
            // When flipSide is true, door swings towards +Z (inward, matching +Y in 2D)
            // When flipSide is false, door swings towards -Z (outward, matching -Y in 2D)
            let openAngleRad = 1.48;
            if (!op.flipHand) {
              openAngleRad = op.flipSide ? -1.48 : 1.48;
            } else {
              openAngleRad = op.flipSide ? 1.48 : -1.48;
            }

            // Register door controller in ref
            doorsMapRef.current.set(op.id, {
              id: op.id,
              opening: op,
              pivot: hingePivot,
              doorMesh: doorLeafMesh,
              openAngle: openAngleRad,
              currentAngle: 0,
              targetAngle: 0,
              isOpen: false,
            });
          }

          currentDist = op.endDist;
        });

        // 3. Final solid wall segment
        const finalLen = wallLen - currentDist;
        if (finalLen > 0.02) {
          const finalGeo = new THREE.BoxGeometry(finalLen, wallHeight, thickness);
          const finalMesh = new THREE.Mesh(finalGeo, wallMat);
          finalMesh.castShadow = true;
          finalMesh.receiveShadow = true;

          const midDist = currentDist + finalLen / 2;
          const segX = p1.x + (dx / wallLen) * midDist;
          const segZ = p1.z + (dz / wallLen) * midDist;

          finalMesh.position.set(segX, wallHeight / 2, segZ);
          finalMesh.rotation.y = -angle;
          buildingGroup.add(finalMesh);
        }
      }
    });

    // C. FURNITURE (Bed, Shower, Toilet, Bath, Sink, Desk)
    (state.furniture || []).forEach((item) => {
      const { x, z } = to3D(item.x, item.y, cx, cy);
      const rotRad = -(item.rotation || 0) * (Math.PI / 180);
      const def = FURNITURE_DEFINITIONS[item.type] || FURNITURE_DEFINITIONS.bed;
      const w = item.widthMeters || def.defaultWidthMeters;
      const l = item.lengthMeters || def.defaultLengthMeters;

      const fGroup = new THREE.Group();
      fGroup.position.set(x, 0, z);
      fGroup.rotation.y = rotRad;

      switch (item.type) {
        case 'bed':
          build3DBed(fGroup, w, l);
          break;
        case 'shower':
          build3DShower(fGroup, w, l, windowGlassMat);
          break;
        case 'toilet':
          build3DToilet(fGroup, w, l);
          break;
        case 'bath':
          build3DBath(fGroup, w, l);
          break;
        case 'sink':
          build3DSink(fGroup, w, l);
          break;
        case 'desk':
          build3DDesk(fGroup, w, l);
          break;
      }

      buildingGroup.add(fGroup);
    });
  }, [state.walls, state.openings, state.zones, state.furniture, state.scalePxPerMeter, cutawayWalls]);

  // Procedural Parquet Floor Texture
  const createParquetCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = '#d7b48c';
    ctx.fillRect(0, 0, 512, 512);

    const plankH = 64;
    const plankW = 170;

    for (let y = 0; y < 512; y += plankH) {
      const offsetX = ((y / plankH) % 2) * (plankW / 2);
      for (let x = -plankW; x < 512 + plankW; x += plankW) {
        const px = x + offsetX;
        const shade = 205 + Math.floor(Math.random() * 25);
        ctx.fillStyle = `rgb(${shade + 10}, ${shade - 10}, ${shade - 40})`;
        ctx.fillRect(px, y, plankW - 2, plankH - 2);

        ctx.strokeStyle = 'rgba(120, 80, 40, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px, y, plankW - 2, plankH - 2);
      }
    }
    return canvas;
  };

  // Toggle Door Open/Close
  const toggleDoor = (doorId: string) => {
    const door = doorsMapRef.current.get(doorId);
    if (!door) return;

    door.isOpen = !door.isOpen;
    door.targetAngle = door.isOpen ? door.openAngle : 0;
    setAimedDoorPrompt(door.isOpen ? 'Deur sluiten [E / Klik]' : 'Deur openen [E / Klik]');
  };

  // Toggle All Doors
  const toggleAllDoors = () => {
    const nextState = !allDoorsOpen;
    setAllDoorsOpen(nextState);
    doorsMapRef.current.forEach((door) => {
      door.isOpen = nextState;
      door.targetAngle = nextState ? door.openAngle : 0;
    });
  };

  // 4. Pointer Lock & FPS Event Listeners (WASD, Mouse Look, Drag-to-Look, Escape)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Pointer Lock Change listener
    const onPointerLockChange = () => {
      const isLocked = document.pointerLockElement === canvas;
      setIsPointerLocked(isLocked);
    };

    // Mouse Movement for FPS Mouse-Look & Drag-to-Look
    const onMouseMove = (e: MouseEvent) => {
      if (cameraPresetRef.current !== 'interior' || !cameraRef.current) return;

      let deltaX = 0;
      let deltaY = 0;

      if (document.pointerLockElement === canvas) {
        // Hardware pointer lock (e.g. fullscreen or top-level window)
        deltaX = e.movementX || 0;
        deltaY = e.movementY || 0;
      } else if (isDraggingLookRef.current) {
        // Drag-to-look in iframe preview sandbox
        deltaX = e.clientX - lastMousePosRef.current.x;
        deltaY = e.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      }

      if (deltaX !== 0 || deltaY !== 0) {
        const sensitivity = 0.0028;
        yawRef.current -= deltaX * sensitivity;
        pitchRef.current -= deltaY * sensitivity;

        // Clamp vertical pitch between -85 and +85 degrees
        pitchRef.current = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, pitchRef.current));

        cameraRef.current.rotation.set(pitchRef.current, yawRef.current, 0, 'YXZ');
      }
    };

    // Touch support for mobile/trackpads
    const onTouchStart = (e: TouchEvent) => {
      if (cameraPresetRef.current === 'interior' && e.touches.length === 1) {
        isDraggingLookRef.current = true;
        lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (cameraPresetRef.current === 'interior' && isDraggingLookRef.current && e.touches.length === 1 && cameraRef.current) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastMousePosRef.current.x;
        const deltaY = touch.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: touch.clientX, y: touch.clientY };

        const sensitivity = 0.0035;
        yawRef.current -= deltaX * sensitivity;
        pitchRef.current -= deltaY * sensitivity;
        pitchRef.current = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, pitchRef.current));
        cameraRef.current.rotation.set(pitchRef.current, yawRef.current, 0, 'YXZ');
      }
    };

    const onTouchEnd = () => {
      isDraggingLookRef.current = false;
    };

    // Keyboard WASD Movement and 'E' key for Door
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;

      // 'E' key toggles aimed door in FPS mode
      if (e.code === 'KeyE' && aimedDoorIdRef.current) {
        toggleDoor(aimedDoorIdRef.current);
      }

      // ESC key exits interior FPS mode back to Dollhouse
      if (e.code === 'Escape' && cameraPresetRef.current === 'interior') {
        handleCameraPreset('dollhouse');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    // Mouse Click Handler: click on doors to toggle in both Orbit and FPS mode
    const onPointerDown = (e: MouseEvent) => {
      if (!cameraRef.current || !canvasRef.current) return;

      if (cameraPresetRef.current === 'interior') {
        isDraggingLookRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        // Attempt pointer lock on click, silently catch if iframe policy blocks it
        if (document.pointerLockElement !== canvas) {
          try {
            const res = canvas.requestPointerLock?.() as any;
            if (res && res.catch) res.catch(() => {});
          } catch (err) {}
        }

        // In FPS mode, clicking also toggles aimed door
        if (aimedDoorIdRef.current) {
          toggleDoor(aimedDoorIdRef.current);
        }
      } else {
        // In Orbit mode, raycast from mouse coordinates to click doors
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
        const intersects = raycaster.intersectObjects(interactiveDoorMeshesRef.current, false);

        if (intersects.length > 0) {
          const doorId = intersects[0].object.userData?.doorId;
          if (doorId) toggleDoor(doorId);
        }
      }
    };

    const onPointerUp = () => {
      isDraggingLookRef.current = false;
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Manual Turn & Walk buttons for on-screen D-Pad
  const turnPlayer = (radDelta: number) => {
    yawRef.current += radDelta;
    if (cameraRef.current) {
      cameraRef.current.rotation.set(pitchRef.current, yawRef.current, 0, 'YXZ');
    }
  };

  const stepPlayer = (forwardAmt: number, strafeAmt: number) => {
    if (!cameraRef.current) return;
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
    const move = forward.multiplyScalar(forwardAmt).add(right.multiplyScalar(strafeAmt));
    cameraRef.current.position.add(move);
    cameraRef.current.position.y = 1.65;
  };

  // Camera Preset Switcher
  const handleCameraPreset = (preset: CameraViewPreset) => {
    setCameraPreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const canvas = canvasRef.current;
    if (!camera || !controls || !canvas) return;

    const { spanX, spanZ } = getCenter();
    const dist = Math.max(spanX, spanZ) * 1.5;

    if (preset === 'dollhouse') {
      controls.enabled = true;
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
      }
      camera.position.set(dist * 0.85, dist * 0.9, dist * 0.95);
      controls.target.set(0, 1.2, 0);
      controls.update();

    } else if (preset === 'top') {
      controls.enabled = true;
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
      }
      camera.position.set(0.01, dist * 1.6, 0);
      controls.target.set(0, 0, 0);
      controls.update();

    } else if (preset === 'interior') {
      // First Person Walkthrough (FPS) mode
      controls.enabled = false;

      // Safe spawn point inside room at natural standing eye level (1.65m)
      const spawn = getSafeInteriorSpawnPoint();
      camera.position.set(spawn.x, 1.65, spawn.z);
      yawRef.current = 0;
      pitchRef.current = 0;
      camera.rotation.set(0, 0, 0, 'YXZ');

      // Request Pointer Lock on canvas (safely caught if blocked in iframe)
      try {
        const promise = canvas.requestPointerLock?.() as any;
        if (promise && promise.catch) {
          promise.catch(() => {});
        }
      } catch (err) {}
    }
  };

  // Reset Camera
  const resetCamera = () => {
    handleCameraPreset(cameraPreset);
  };

  // Screenshot Capture
  const handleCaptureScreenshot = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${state.projectName || 'verbouwing'}-3d-weergave.png`;
    a.click();
  };

  // 3D FURNITURE BUILDERS
  const build3DBed = (group: THREE.Group, w: number, l: number) => {
    const frameH = 0.3;
    const frameGeo = new THREE.BoxGeometry(w, frameH, l);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = frameH / 2;
    frame.castShadow = true;
    group.add(frame);

    const hbH = 0.95;
    const hbThick = 0.12;
    const hbGeo = new THREE.BoxGeometry(w, hbH, hbThick);
    const hbMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
    const headboard = new THREE.Mesh(hbGeo, hbMat);
    headboard.position.set(0, hbH / 2, -l / 2 + hbThick / 2);
    headboard.castShadow = true;
    group.add(headboard);

    const mattH = 0.22;
    const mattGeo = new THREE.BoxGeometry(w - 0.08, mattH, l - 0.14);
    const mattMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const mattress = new THREE.Mesh(mattGeo, mattMat);
    mattress.position.set(0, frameH + mattH / 2, 0.04);
    mattress.castShadow = true;
    group.add(mattress);

    const pillowW = Math.min(0.65, (w - 0.2) / 2);
    const pillowL = 0.4;
    const pillowH = 0.12;
    const pillowGeo = new THREE.BoxGeometry(pillowW, pillowH, pillowL);
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });

    const pY = frameH + mattH + pillowH / 2;
    const pZ = -l / 2 + hbThick + pillowL / 2 + 0.08;

    if (w >= 1.15) {
      const p1 = new THREE.Mesh(pillowGeo, pillowMat);
      p1.position.set(-w / 4, pY, pZ);
      p1.rotation.x = 0.15;
      p1.castShadow = true;
      group.add(p1);

      const p2 = new THREE.Mesh(pillowGeo, pillowMat);
      p2.position.set(w / 4, pY, pZ);
      p2.rotation.x = 0.15;
      p2.castShadow = true;
      group.add(p2);
    } else {
      const p = new THREE.Mesh(pillowGeo, pillowMat);
      p.position.set(0, pY, pZ);
      p.rotation.x = 0.15;
      p.castShadow = true;
      group.add(p);
    }

    const duvetL = l * 0.65;
    const duvetGeo = new THREE.BoxGeometry(w - 0.04, 0.16, duvetL);
    const duvetMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
    const duvet = new THREE.Mesh(duvetGeo, duvetMat);
    duvet.position.set(0, frameH + mattH + 0.08, l / 2 - duvetL / 2);
    duvet.castShadow = true;
    group.add(duvet);
  };

  const build3DShower = (group: THREE.Group, w: number, l: number, glassMat: THREE.Material) => {
    const trayGeo = new THREE.BoxGeometry(w, 0.03, l);
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3 });
    const tray = new THREE.Mesh(trayGeo, trayMat);
    tray.position.y = 0.015;
    tray.receiveShadow = true;
    group.add(tray);

    const drainGeo = new THREE.BoxGeometry(w * 0.7, 0.005, 0.07);
    const drainMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.9, roughness: 0.2 });
    const drain = new THREE.Mesh(drainGeo, drainMat);
    drain.position.set(0, 0.032, -l / 2 + 0.15);
    group.add(drain);

    const screenGeo = new THREE.BoxGeometry(0.012, 2.05, l * 0.75);
    const screen = new THREE.Mesh(screenGeo, glassMat);
    screen.position.set(w / 2 - 0.01, 1.025, 0);
    screen.castShadow = true;
    group.add(screen);

    const clampGeo = new THREE.CylinderGeometry(0.015, 0.015, w * 0.5);
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.95, roughness: 0.1 });
    const clamp = new THREE.Mesh(clampGeo, chromeMat);
    clamp.rotation.z = Math.PI / 2;
    clamp.position.set(w / 4, 2.0, 0);
    group.add(clamp);

    const riserGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2);
    const riser = new THREE.Mesh(riserGeo, chromeMat);
    riser.position.set(0, 1.5, -l / 2 + 0.08);
    group.add(riser);

    const headGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.02, 24);
    const head = new THREE.Mesh(headGeo, chromeMat);
    head.position.set(0, 2.1, -l / 2 + 0.25);
    group.add(head);
  };

  const build3DToilet = (group: THREE.Group, w: number, l: number) => {
    const cisH = 1.15;
    const cisGeo = new THREE.BoxGeometry(w, cisH, 0.18);
    const cisMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });
    const cistern = new THREE.Mesh(cisGeo, cisMat);
    cistern.position.set(0, cisH / 2, -l / 2 + 0.09);
    cistern.castShadow = true;
    group.add(cistern);

    const flushGeo = new THREE.BoxGeometry(0.2, 0.12, 0.01);
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
    const flush = new THREE.Mesh(flushGeo, chromeMat);
    flush.position.set(0, cisH - 0.15, -l / 2 + 0.185);
    group.add(flush);

    const bowlGeo = new THREE.BoxGeometry(w * 0.85, 0.35, l - 0.18);
    const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
    const bowl = new THREE.Mesh(bowlGeo, ceramicMat);
    bowl.position.set(0, 0.42, 0.05);
    bowl.castShadow = true;
    group.add(bowl);

    const seatGeo = new THREE.BoxGeometry(w * 0.86, 0.03, l - 0.16);
    const seat = new THREE.Mesh(seatGeo, ceramicMat);
    seat.position.set(0, 0.61, 0.06);
    group.add(seat);
  };

  const build3DBath = (group: THREE.Group, w: number, l: number) => {
    const tubH = 0.58;
    const tubGeo = new THREE.BoxGeometry(w, tubH, l);
    const tubMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const tub = new THREE.Mesh(tubGeo, tubMat);
    tub.position.y = tubH / 2;
    tub.castShadow = true;
    group.add(tub);

    const waterGeo = new THREE.BoxGeometry(w - 0.14, 0.02, l - 0.16);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.65,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = tubH - 0.08;
    group.add(water);

    const faucetGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25);
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.1 });
    const faucet = new THREE.Mesh(faucetGeo, chromeMat);
    faucet.position.set(0, tubH + 0.12, -l / 2 + 0.08);
    group.add(faucet);
  };

  const build3DSink = (group: THREE.Group, w: number, l: number) => {
    const cabH = 0.45;
    const cabGeo = new THREE.BoxGeometry(w, cabH, l);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const cabinet = new THREE.Mesh(cabGeo, cabMat);
    cabinet.position.set(0, 0.65, 0);
    cabinet.castShadow = true;
    group.add(cabinet);

    const topGeo = new THREE.BoxGeometry(w + 0.02, 0.05, l + 0.02);
    const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
    const top = new THREE.Mesh(topGeo, ceramicMat);
    top.position.set(0, 0.89, 0);
    top.castShadow = true;
    group.add(top);

    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.1 });
    const faucetCount = w >= 1.15 ? 2 : 1;

    for (let i = 0; i < faucetCount; i++) {
      const xOff = faucetCount === 2 ? (i === 0 ? -w / 4 : w / 4) : 0;
      const faucetGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.18);
      const faucet = new THREE.Mesh(faucetGeo, chromeMat);
      faucet.position.set(xOff, 0.99, -l / 2 + 0.1);
      group.add(faucet);
    }

    const mirrorW = Math.min(w, 1.2);
    const mirrorH = 0.75;
    const mirrorGeo = new THREE.BoxGeometry(mirrorW, mirrorH, 0.03);
    const mirrorMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.05,
      metalness: 0.9,
    });
    const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
    mirror.position.set(0, 1.55, -l / 2 - 0.01);
    group.add(mirror);

    const mirrorGlow = new THREE.PointLight(0xffedd5, 0.8, 4);
    mirrorGlow.position.set(0, 1.55, -l / 2 + 0.2);
    group.add(mirrorGlow);
  };

  const build3DDesk = (group: THREE.Group, w: number, l: number) => {
    const topH = 0.04;
    const deskH = 0.75;
    const topGeo = new THREE.BoxGeometry(w, topH, l);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, deskH, 0);
    top.castShadow = true;
    group.add(top);

    const legGeo = new THREE.BoxGeometry(0.04, deskH, 0.04);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });

    const xOff = w / 2 - 0.05;
    const zOff = l / 2 - 0.05;

    [
      [-xOff, -zOff],
      [xOff, -zOff],
      [-xOff, zOff],
      [xOff, zOff],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, deskH / 2, lz);
      leg.castShadow = true;
      group.add(leg);
    });

    const laptopGeo = new THREE.BoxGeometry(0.32, 0.01, 0.22);
    const laptopMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
    const laptop = new THREE.Mesh(laptopGeo, laptopMat);
    laptop.position.set(0, deskH + 0.02, 0);
    laptop.castShadow = true;
    group.add(laptop);

    const screenGeo = new THREE.BoxGeometry(0.32, 0.2, 0.008);
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, deskH + 0.12, -0.1);
    screen.rotation.x = -0.2;
    group.add(screen);

    const seatGeo = new THREE.BoxGeometry(0.45, 0.06, 0.45);
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const seat = new THREE.Mesh(seatGeo, chairMat);
    seat.position.set(0, 0.48, l / 2 + 0.18);
    seat.castShadow = true;
    group.add(seat);

    const backGeo = new THREE.BoxGeometry(0.42, 0.45, 0.05);
    const back = new THREE.Mesh(backGeo, chairMat);
    back.position.set(0, 0.72, l / 2 + 0.38);
    back.castShadow = true;
    group.add(back);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full block ${
          cameraPreset === 'interior' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
        onClick={() => {
          if (cameraPreset === 'interior' && !isPointerLocked && canvasRef.current) {
            canvasRef.current.requestPointerLock();
          }
        }}
      />

      {/* Crosshair & Prompt in FPS Walk Mode */}
      {cameraPreset === 'interior' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {/* Subtle reticle */}
          <div className="relative flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full border border-white/80 bg-white/20 shadow-sm" />
            <div className="absolute w-6 h-[1px] bg-white/40" />
            <div className="absolute h-6 w-[1px] bg-white/40" />
          </div>

          {/* Interactive Door Prompt */}
          {aimedDoorPrompt && (
            <div className="absolute top-[56%] bg-slate-950/90 text-amber-300 font-semibold text-xs px-3.5 py-1.5 rounded-xl border border-amber-500/40 shadow-2xl backdrop-blur-md animate-bounce">
              {aimedDoorPrompt}
            </div>
          )}
        </div>
      )}

      {/* Floating Top Control HUD */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-2xl shadow-2xl">
        {/* Camera Views */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => handleCameraPreset('dollhouse')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              cameraPreset === 'dollhouse'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Schuin perspectief van boven (Poppenhuis)"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Poppenhuis</span>
          </button>

          <button
            onClick={() => handleCameraPreset('interior')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              cameraPreset === 'interior'
                ? 'bg-amber-500 text-slate-950 shadow ring-2 ring-amber-400/50'
                : 'text-slate-400 hover:text-white'
            }`}
            title="FPS Loopmodus: loop rond met WASD en kijk rond met de muis"
          >
            <Compass className="w-3.5 h-3.5 text-amber-600" />
            <span>Binnenkijken (FPS)</span>
          </button>

          <button
            onClick={() => handleCameraPreset('top')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              cameraPreset === 'top'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Bovenaanzicht in 3D"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Boven</span>
          </button>
        </div>

        <div className="w-[1px] h-6 bg-slate-800 mx-1" />

        {/* Toggle All Doors Open / Closed */}
        <button
          onClick={toggleAllDoors}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border ${
            allDoorsOpen
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow'
              : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800'
          }`}
          title="Alle deuren tegelijk openen of sluiten"
        >
          {allDoorsOpen ? <DoorOpen className="w-3.5 h-3.5 text-amber-400" /> : <DoorClosed className="w-3.5 h-3.5" />}
          <span>{allDoorsOpen ? 'Deuren Open' : 'Deuren Dicht'}</span>
        </button>

        {/* Wall Height Toggle (Full vs Cutaway) */}
        <button
          onClick={() => setCutawayWalls((prev) => !prev)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border ${
            cutawayWalls
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow'
              : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800'
          }`}
          title="Wissel tussen volledige muren (2,6 m) of lage muren (1,2 m)"
        >
          {cutawayWalls ? <Minimize2 className="w-3.5 h-3.5 text-amber-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span>{cutawayWalls ? 'Lage Muren' : 'Hoge Muren'}</span>
        </button>

        <div className="w-[1px] h-6 bg-slate-800 mx-1" />

        {/* Lighting Atmosphere Presets */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setLighting('midday')}
            className={`p-2 rounded-lg transition ${
              lighting === 'midday' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-amber-300'
            }`}
            title="Middag: Heldere blauwe lucht en daglicht"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLighting('golden')}
            className={`p-2 rounded-lg transition ${
              lighting === 'golden' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-amber-300'
            }`}
            title="Gouden Uur: Warme namiddagzon"
          >
            <Sunset className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLighting('evening')}
            className={`p-2 rounded-lg transition ${
              lighting === 'evening' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-amber-300'
            }`}
            title="Avond: Schemering en sfeerverlichting"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-[1px] h-6 bg-slate-800 mx-1" />

        {/* Action Buttons: Reset & Screenshot */}
        <button
          onClick={resetCamera}
          className="p-2 bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
          title="Camera centreren"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleCaptureScreenshot}
          className="p-2 bg-slate-950/80 hover:bg-slate-800 text-amber-400 hover:text-amber-300 rounded-xl border border-slate-800 transition"
          title="3D Render downloaden als afbeelding (PNG)"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Atmospheric Info Tag (Top Left) */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 px-3.5 py-2.5 rounded-2xl text-xs text-slate-300 shadow-xl flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
        <div>
          <div className="font-bold text-slate-100 flex items-center gap-1.5">
            <span>3D Architectuur</span>
            <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-mono border border-sky-500/30">
              Helder Kozijn & Lucht
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {state.walls.length} muren • {state.openings.length} kozijnen • {(state.furniture || []).length} meubels
          </div>
        </div>
      </div>

      {/* FPS Walk Instruction Helper & Virtual D-Pad (Bottom Center & Left) */}
      {cameraPreset === 'interior' ? (
        <>
          {/* Main instruction bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-amber-500/50 px-4 py-2 rounded-2xl text-xs text-slate-200 shadow-2xl flex items-center gap-3 max-w-[95vw] overflow-x-auto">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 font-bold rounded text-[10px]">W A S D</span>
              <span className="text-slate-300 font-medium">Lopen</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <MousePointer className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-300 font-medium">Sleep muis = Rondkijken</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="px-1.5 py-0.5 bg-slate-800 text-amber-300 font-mono font-bold rounded text-[10px] border border-slate-700">E / Klik</span>
              <span className="text-slate-300 font-medium">Deur openen/sluiten</span>
            </div>
            <span className="text-slate-600">•</span>
            <button
              onClick={() => handleCameraPreset('dollhouse')}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold rounded-lg border border-rose-500/40 text-[11px] transition whitespace-nowrap"
              title="Terug naar overzicht"
            >
              <span className="px-1 bg-rose-500/40 rounded text-[9px]">ESC</span>
              <span>Sluiten</span>
            </button>
          </div>

          {/* Virtual On-Screen Navigation Controls (Bottom Left) */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-col items-center bg-slate-900/90 backdrop-blur-md border border-slate-800 p-2 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-1 mb-1">
              <button
                onClick={() => turnPlayer(0.25)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 rounded-lg text-xs font-bold transition"
                title="Draai naar links"
              >
                ↶
              </button>
              <button
                onClick={() => stepPlayer(0.6, 0)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 rounded-lg transition"
                title="Vooruit lopen (W)"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => turnPlayer(-0.25)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 rounded-lg text-xs font-bold transition"
                title="Draai naar rechts"
              >
                ↷
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => stepPlayer(0, -0.6)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 rounded-lg transition"
                title="Zijwaarts links (A)"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => stepPlayer(-0.6, 0)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 rounded-lg transition"
                title="Achteruit lopen (S)"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => stepPlayer(0, 0.6)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 rounded-lg transition"
                title="Zijwaarts rechts (D)"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <span className="text-[9px] text-slate-500 mt-1 font-mono">Loopbediening</span>
          </div>
        </>
      ) : (
        /* Orbit Controls Helper */
        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur-md border border-slate-800 px-3.5 py-2.5 rounded-xl text-[11px] text-slate-400 shadow-lg select-none flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Linkermuisknop:
          </span>
          <span>Draaien</span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 text-slate-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Rechtermuisknop:
          </span>
          <span>Verschuiven</span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 text-slate-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Scrollwiel:
          </span>
          <span>Zoomen</span>
          <span className="text-slate-600">•</span>
          <span className="text-amber-300 font-medium">Klik op een deur om hem te openen</span>
        </div>
      )}

      {/* Switch back to 2D quick button (Bottom Right) */}
      <button
        onClick={() => setState((prev) => ({ ...prev, activeTab: 'build' }))}
        className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xl transition"
      >
        <span>Terug naar 2D Plattegrond</span>
      </button>
    </div>
  );
};
