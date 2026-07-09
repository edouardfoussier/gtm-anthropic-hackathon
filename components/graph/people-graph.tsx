"use client";

// The contact-graph centerpiece: a people-only org constellation. Every
// person is a particle mini-sphere (seniority-sized) linked to their manager;
// Claude's pick lights its reporting line orange with flowing data dots.
// All effects are opaque ink-on-paper — no bloom/additive (dies on #F7F7F5,
// see docs/research-SYNTHESIS-effects-plan.md).
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import type { PeopleGraphProps, PersonNode, PersonStatus, Seniority } from "./types";

export type { PersonNode } from "./types";

const IDLE_ROTATION_SPEED = 0.0006;
const CONVERGE_SECONDS = 0.9;
const CAMERA_IDLE_Z = 6;
const CAMERA_MAX_Z = 18;
const FLOW_DOTS = 5;
const LEVEL_1_DIST = 3.0;
const LEVEL_2_DIST = 2.1;
const LEVEL_1_Y_SPREAD = 1.1;
const DUST_COUNT = 150;

const INK = new THREE.Color("#111111");
const ORANGE = new THREE.Color("#ff6500");

const TIER: Record<
  Seniority,
  { radius: number; dots: number; size: number; labelPad: number }
> = {
  1: { radius: 0.44, dots: 130, size: 5.0, labelPad: 30 },
  2: { radius: 0.34, dots: 105, size: 4.7, labelPad: 25 },
  3: { radius: 0.26, dots: 82, size: 4.4, labelPad: 21 },
  4: { radius: 0.2, dots: 62, size: 4.0, labelPad: 19 },
};

// Base color stays ink even when picked — the orange arrives via the uAccent
// ignition sweep (particles turn orange one by one, in stagger order).
const STATUS_STYLE: Record<
  PersonStatus,
  { color: THREE.Color; opacity: number; pulse: boolean; accent: boolean }
> = {
  pending: { color: INK, opacity: 0.3, pulse: false, accent: false },
  active: { color: INK, opacity: 0.85, pulse: false, accent: false },
  picked: { color: INK, opacity: 1, pulse: true, accent: true },
  enriched: { color: INK, opacity: 1, pulse: true, accent: true },
  dim: { color: INK, opacity: 0.22, pulse: false, accent: false },
};

const LINK_STYLE: Record<
  PersonStatus,
  { color: THREE.Color; opacity: number; flow: boolean }
> = {
  pending: { color: INK, opacity: 0.14, flow: false },
  active: { color: INK, opacity: 0.28, flow: false },
  picked: { color: ORANGE, opacity: 0.85, flow: true },
  enriched: { color: ORANGE, opacity: 0.85, flow: true },
  dim: { color: INK, opacity: 0.08, flow: false },
};

const CLUSTER_VERTEX = /* glsl */ `
  uniform float uProgress;
  uniform float uPulse;
  uniform float uSize;
  attribute vec3 aStart;
  attribute float aStagger;
  varying float vAlpha;
  varying float vStagger;
  float easeOutBack(float t) {
    float c1 = 1.70158;
    float c3 = c1 + 1.0;
    float u = t - 1.0;
    return 1.0 + c3 * u * u * u + c1 * u * u;
  }
  void main() {
    float p = clamp((uProgress - aStagger * 0.3) / 0.7, 0.0, 1.0);
    float e = easeOutBack(p);
    vec3 pos = mix(aStart, position, e);
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uSize * (6.0 / -mvPosition.z) * (0.6 + 0.4 * p) * (1.0 + uPulse * 0.25);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = smoothstep(0.0, 0.2, p);
    vStagger = aStagger;
  }
`;

const CLUSTER_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccentColor;
  uniform float uAccent;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vStagger;
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float edge = 1.0 - smoothstep(0.44, 0.5, length(coord));
    if (edge < 0.01) discard;
    // Ignition sweep: particles flip to the accent color in stagger order.
    float ignite = smoothstep(vStagger, vStagger + 0.25, uAccent);
    vec3 col = mix(uColor, uAccentColor, ignite);
    gl_FragColor = vec4(col, uOpacity * vAlpha * edge);
  }
`;

const DOT_VERTEX = /* glsl */ `
  uniform float uSize;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (6.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const DOT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float edge = 1.0 - smoothstep(0.4, 0.5, length(coord));
    if (edge < 0.01) discard;
    gl_FragColor = vec4(uColor, uOpacity * edge);
  }
`;

function fibonacciSpherePoints(count: number, radius: number): Float32Array {
  const points = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(1 - y * y, 0));
    const theta = goldenAngle * i;

    points[i * 3] = Math.cos(theta) * radiusAtY * radius;
    points[i * 3 + 1] = y * radius;
    points[i * 3 + 2] = Math.sin(theta) * radiusAtY * radius;
  }

  return points;
}

/** Deterministic per-cluster randomness (replays identically). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PersonVisual {
  node: PersonNode;
  anchor: THREE.Vector3; // group-local center of the cluster
  linkFrom: THREE.Vector3; // parent cluster edge (group-local)
  linkTo: THREE.Vector3; // own cluster edge (group-local)
  hasLink: boolean;
  tier: (typeof TIER)[Seniority];
  points: THREE.Points;
  clusterGeometry: THREE.BufferGeometry;
  clusterMaterial: THREE.ShaderMaterial;
  link: THREE.Line;
  linkGeometry: THREE.BufferGeometry;
  linkMaterial: THREE.LineBasicMaterial;
  flow: THREE.Points;
  flowGeometry: THREE.BufferGeometry;
  flowMaterial: THREE.ShaderMaterial;
  labelEl: HTMLDivElement;
  nameEl: HTMLDivElement;
  titleEl: HTMLDivElement;
  subEl: HTMLDivElement;
  progress: number; // 0..1 converge animation
  accent: number; // 0..1.25 orange ignition sweep
  color: THREE.Color; // smoothed current values
  opacity: number;
  pulse: number;
  linkColor: THREE.Color;
  linkOpacity: number;
  flowOpacity: number;
}

export function PeopleGraph({
  people,
  className,
  onPersonClick,
}: PeopleGraphProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const peopleRef = useRef<PersonNode[]>(people ?? []);
  const peopleVersionRef = useRef(0);
  useEffect(() => {
    peopleRef.current = people ?? [];
    peopleVersionRef.current += 1;
  }, [people]);

  const onPersonClickRef = useRef(onPersonClick);
  useEffect(() => {
    onPersonClickRef.current = onPersonClick;
  }, [onPersonClick]);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount: HTMLDivElement = mountRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.z = CAMERA_IDLE_Z;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    mount.appendChild(renderer.domElement);

    const labelLayer = document.createElement("div");
    labelLayer.className = "pointer-events-none absolute inset-0";
    mount.appendChild(labelLayer);

    // Hover card: personal data for the person under the cursor. Positioned
    // manually near the label; only one shows at a time.
    const tooltip = document.createElement("div");
    tooltip.className =
      "pointer-events-none absolute z-20 hidden min-w-52 -translate-x-1/2 border border-border bg-background/95 p-3 text-left shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)] backdrop-blur-sm";
    labelLayer.appendChild(tooltip);

    function showTooltip(node: PersonNode, x: number, y: number) {
      const rows: string[] = [];
      if (node.title) rows.push(node.title);
      if (node.email) rows.push(node.email);
      if (node.phone) rows.push(node.phone);
      if (node.linkedin) rows.push(node.linkedin);
      tooltip.innerHTML =
        `<div class="font-display text-sm uppercase tracking-tight">${node.name}</div>` +
        rows
          .map(
            (r) =>
              `<div class="mt-0.5 text-[11px] text-muted-foreground">${r}</div>`,
          )
          .join("");
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y + 18}px`;
      tooltip.classList.remove("hidden");
    }
    function hideTooltip() {
      tooltip.classList.add("hidden");
    }

    // One world group: every cluster + link rotates together.
    const world = new THREE.Group();
    scene.add(world);

    // Idle dust field — visible while the map is empty, fades on first person.
    const dustRand = mulberry32(7);
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      const r = 0.8 + Math.pow(dustRand(), 0.6) * 2.2;
      const theta = dustRand() * Math.PI * 2;
      const y = (dustRand() - 0.5) * 2.6;
      dustPositions[i * 3] = Math.cos(theta) * r;
      dustPositions[i * 3 + 1] = y;
      dustPositions[i * 3 + 2] = Math.sin(theta) * r;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(dustPositions, 3),
    );
    const dustMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: 2.4 },
        uColor: { value: ORANGE.clone() },
        uOpacity: { value: 0 },
      },
      vertexShader: DOT_VERTEX,
      fragmentShader: DOT_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    world.add(dust);
    let dustOpacity = 0;

    const visuals = new Map<string, PersonVisual>();
    const childCounts = new Map<string, number>();
    let rootCount = 0;
    let spawnCounter = 0;
    let syncedVersion = -1;

    function makeLabel(personId: string): {
      labelEl: HTMLDivElement;
      nameEl: HTMLDivElement;
      titleEl: HTMLDivElement;
      subEl: HTMLDivElement;
    } {
      const labelEl = document.createElement("div");
      labelEl.className =
        "absolute -translate-x-1/2 whitespace-nowrap text-center pointer-events-auto cursor-pointer";
      labelEl.dataset.personLabel = personId;
      labelEl.addEventListener("click", () => {
        onPersonClickRef.current?.(personId);
      });
      labelEl.addEventListener("mouseenter", () => {
        const v = visuals.get(personId);
        if (!v) return;
        const left = parseFloat(v.labelEl.style.left) || 0;
        const top = parseFloat(v.labelEl.style.top) || 0;
        showTooltip(v.node, left, top);
      });
      labelEl.addEventListener("mouseleave", hideTooltip);
      const nameEl = document.createElement("div");
      nameEl.className = "text-[11px] font-medium tracking-tight";
      nameEl.style.transition = "color 700ms";
      const titleEl = document.createElement("div");
      titleEl.className =
        "text-[10px] uppercase tracking-[0.15em] text-muted-foreground";
      const subEl = document.createElement("div");
      subEl.className = "text-[10px] font-medium text-accent-orange";
      labelEl.appendChild(nameEl);
      labelEl.appendChild(titleEl);
      labelEl.appendChild(subEl);
      labelLayer.appendChild(labelEl);
      return { labelEl, nameEl, titleEl, subEl };
    }

    function applyLabelText(v: PersonVisual) {
      v.nameEl.textContent = v.node.name;
      v.titleEl.textContent = v.node.title;
      v.subEl.textContent = v.node.sublabel ?? "";
      const accent = v.node.status === "picked" || v.node.status === "enriched";
      v.nameEl.style.color = accent ? "#FF6500" : "#111111";
    }

    /** Deterministic hierarchical-radial placement from the reportsTo tree. */
    function placeNode(node: PersonNode): {
      anchor: THREE.Vector3;
      parent: PersonVisual | null;
    } {
      const parent = node.reportsTo ? (visuals.get(node.reportsTo) ?? null) : null;

      if (!parent) {
        // Root(s): first at the center, extra roots on the level-1 ring.
        if (rootCount === 0) {
          rootCount++;
          return { anchor: new THREE.Vector3(0, 0, 0), parent: null };
        }
        rootCount++;
      }

      if (parent && parent.anchor.lengthSq() > 0.01) {
        // Level 2+: push outward near the parent's direction, fanned per sibling.
        const index = childCounts.get(parent.node.id) ?? 0;
        childCounts.set(parent.node.id, index + 1);
        const dir = parent.anchor.clone().normalize();
        const up = Math.abs(dir.y) > 0.9
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 1, 0);
        const u = new THREE.Vector3().crossVectors(dir, up).normalize();
        const v = new THREE.Vector3().crossVectors(dir, u).normalize();
        const around = index * 2.1 + 1.3;
        const cone = 0.8;
        const offset = dir
          .clone()
          .multiplyScalar(Math.cos(cone))
          .addScaledVector(u, Math.sin(cone) * Math.cos(around))
          .addScaledVector(v, Math.sin(cone) * Math.sin(around))
          .normalize();
        return {
          anchor: parent.anchor.clone().addScaledVector(offset, LEVEL_2_DIST),
          parent,
        };
      }

      // Level 1 (child of the center root, or extra roots): golden-angle ring.
      const ringKey = parent ? parent.node.id : "__roots__";
      const index = childCounts.get(ringKey) ?? 0;
      childCounts.set(ringKey, index + 1);
      const angle = index * 2.39996 + 0.5;
      const y = Math.sin(index * 2.1 + 0.7) * LEVEL_1_Y_SPREAD;
      const horizontal = Math.sqrt(
        Math.max(LEVEL_1_DIST * LEVEL_1_DIST - y * y, 0.25),
      );
      return {
        anchor: new THREE.Vector3(
          Math.cos(angle) * horizontal,
          y,
          Math.sin(angle) * horizontal,
        ),
        parent,
      };
    }

    function addPerson(node: PersonNode) {
      const seed = spawnCounter++;
      const tier = TIER[node.seniority];
      const { anchor, parent } = placeNode(node);
      const rand = mulberry32(seed * 9973 + 1);

      // Link endpoints: parent cluster edge → own cluster edge.
      const hasLink = parent !== null;
      let linkFrom = new THREE.Vector3();
      let linkTo = new THREE.Vector3();
      if (parent) {
        const dir = anchor.clone().sub(parent.anchor).normalize();
        linkFrom = parent.anchor
          .clone()
          .addScaledVector(dir, parent.tier.radius * 1.35);
        linkTo = anchor.clone().addScaledVector(dir, -tier.radius * 1.35);
      }

      // Cluster targets: mini fibonacci sphere (local to the anchor).
      const targets = fibonacciSpherePoints(tier.dots, tier.radius);
      // Starts: stream from the parent (roots: loose shell around themselves),
      // so the org visibly grows outward.
      const starts = new Float32Array(tier.dots * 3);
      const staggers = new Float32Array(tier.dots);
      const origin = parent
        ? parent.anchor.clone().sub(anchor)
        : new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < tier.dots; i++) {
        const along = parent ? 0.15 + rand() * 0.85 : 1;
        const jitter = parent ? 0.45 : 0.9;
        starts[i * 3] = origin.x * along + (rand() - 0.5) * jitter;
        starts[i * 3 + 1] = origin.y * along + (rand() - 0.5) * jitter;
        starts[i * 3 + 2] = origin.z * along + (rand() - 0.5) * jitter;
        staggers[i] = rand();
      }

      const clusterGeometry = new THREE.BufferGeometry();
      clusterGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(targets, 3),
      );
      clusterGeometry.setAttribute(
        "aStart",
        new THREE.BufferAttribute(starts, 3),
      );
      clusterGeometry.setAttribute(
        "aStagger",
        new THREE.BufferAttribute(staggers, 1),
      );

      const clusterMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uProgress: { value: 0 },
          uPulse: { value: 0 },
          uSize: { value: tier.size },
          uColor: { value: INK.clone() },
          uAccentColor: { value: ORANGE.clone() },
          uAccent: { value: 0 },
          uOpacity: { value: 0 },
        },
        vertexShader: CLUSTER_VERTEX,
        fragmentShader: CLUSTER_FRAGMENT,
        transparent: true,
        depthWrite: false,
      });

      const clusterPoints = new THREE.Points(clusterGeometry, clusterMaterial);
      clusterPoints.position.copy(anchor);
      world.add(clusterPoints);

      // Reporting-line link, draw-in animated in the tick.
      const linkGeometry = new THREE.BufferGeometry();
      linkGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(6), 3),
      );
      const linkMaterial = new THREE.LineBasicMaterial({
        color: INK.clone(),
        transparent: true,
        opacity: 0,
      });
      const link = new THREE.Line(linkGeometry, linkMaterial);
      link.visible = hasLink;
      world.add(link);

      // Flow dots: data traveling along the picked reporting line.
      const flowGeometry = new THREE.BufferGeometry();
      flowGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(FLOW_DOTS * 3), 3),
      );
      const flowMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: 2.6 },
          uColor: { value: ORANGE.clone() },
          uOpacity: { value: 0 },
        },
        vertexShader: DOT_VERTEX,
        fragmentShader: DOT_FRAGMENT,
        transparent: true,
        depthWrite: false,
      });
      const flow = new THREE.Points(flowGeometry, flowMaterial);
      world.add(flow);

      const label = makeLabel(node.id);

      const visual: PersonVisual = {
        node,
        anchor,
        linkFrom,
        linkTo,
        hasLink,
        tier,
        points: clusterPoints,
        clusterGeometry,
        clusterMaterial,
        link,
        linkGeometry,
        linkMaterial,
        flow,
        flowGeometry,
        flowMaterial,
        ...label,
        progress: 0,
        accent: 0,
        color: INK.clone(),
        opacity: 0,
        pulse: 0,
        linkColor: INK.clone(),
        linkOpacity: 0,
        flowOpacity: 0,
      };
      visuals.set(node.id, visual);
      applyLabelText(visual);
    }

    function removePerson(id: string, v: PersonVisual) {
      world.remove(v.points);
      world.remove(v.link);
      world.remove(v.flow);
      v.clusterGeometry.dispose();
      v.clusterMaterial.dispose();
      v.linkGeometry.dispose();
      v.linkMaterial.dispose();
      v.flowGeometry.dispose();
      v.flowMaterial.dispose();
      v.labelEl.remove();
      visuals.delete(id);
    }

    function syncPeople() {
      const next = peopleRef.current;
      const seen = new Set<string>();
      for (const node of next) {
        seen.add(node.id);
        const existing = visuals.get(node.id);
        if (existing) {
          existing.node = node;
          applyLabelText(existing);
        } else {
          addPerson(node);
        }
      }
      for (const [id, v] of visuals) {
        if (!seen.has(id)) removePerson(id, v);
      }
      if (visuals.size === 0) {
        childCounts.clear();
        rootCount = 0;
      }
    }

    let animationFrame: number;
    const timer = new THREE.Timer();
    const worldPos = new THREE.Vector3();
    const ndc = new THREE.Vector3();

    // Drag-to-rotate: user drag overrides the idle spin; a short grace period
    // after release keeps the manual angle, then the gentle auto-spin resumes.
    const DRAG_SPEED = 0.008;
    const RESUME_DELAY_MS = 2500;
    let dragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let manualYaw = 0;
    let manualPitch = 0;
    let userControlled = false;
    let lastInteraction = 0;

    // Drag starts pending: we only capture the pointer (which would swallow the
    // label's click) once the cursor actually moves past a small threshold, so a
    // plain click on a person still fires and queues them.
    const DRAG_THRESHOLD_PX = 4;
    let pendingPointerId: number | null = null;

    function onPointerDown(e: PointerEvent) {
      // Let clicks on a person label through — don't arm the drag on them.
      if ((e.target as HTMLElement).closest("[data-person-label]")) return;
      pendingPointerId = e.pointerId;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    }
    function onPointerMove(e: PointerEvent) {
      if (pendingPointerId === e.pointerId && !dragging) {
        if (
          Math.abs(e.clientX - lastPointerX) + Math.abs(e.clientY - lastPointerY) <
          DRAG_THRESHOLD_PX
        )
          return;
        dragging = true;
        userControlled = true;
        mount.setPointerCapture(e.pointerId);
        mount.style.cursor = "grabbing";
      }
      if (!dragging) return;
      manualYaw += (e.clientX - lastPointerX) * DRAG_SPEED;
      manualPitch += (e.clientY - lastPointerY) * DRAG_SPEED;
      manualPitch = Math.max(-1.2, Math.min(1.2, manualPitch));
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    }
    function onPointerUp(e: PointerEvent) {
      pendingPointerId = null;
      if (!dragging) return;
      dragging = false;
      lastInteraction = performance.now();
      if (mount.hasPointerCapture(e.pointerId))
        mount.releasePointerCapture(e.pointerId);
      mount.style.cursor = "grab";
    }
    mount.style.cursor = "grab";
    mount.addEventListener("pointerdown", onPointerDown);
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerup", onPointerUp);

    function animate(timestamp: number) {
      animationFrame = requestAnimationFrame(animate);
      timer.update(timestamp);
      const dt = Math.min(timer.getDelta(), 0.1);
      const elapsed = timer.getElapsed();
      const w = mount ? mount.clientWidth : 1;
      const h = mount ? mount.clientHeight : 1;

      if (syncedVersion !== peopleVersionRef.current) {
        syncedVersion = peopleVersionRef.current;
        syncPeople();
      }

      const smoothing = 1 - Math.exp(-dt * 6);

      // Idle dust fades out as soon as the map has people.
      const dustTarget = visuals.size === 0 ? 0.28 : 0;
      dustOpacity += (dustTarget - dustOpacity) * smoothing;
      dustMaterial.uniforms.uOpacity.value = dustOpacity;

      // World rotation: drag-to-rotate takes over; auto-spin resumes after a
      // grace period since the last interaction.
      const sinceInteraction = performance.now() - lastInteraction;
      if (!dragging && userControlled && sinceInteraction > RESUME_DELAY_MS) {
        userControlled = false;
      }
      if (userControlled) {
        world.rotation.y = manualYaw;
        world.rotation.x = manualPitch;
      } else {
        const rotationScale = visuals.size > 0 ? 0.45 : 1;
        manualYaw += IDLE_ROTATION_SPEED * rotationScale * (dt * 60);
        manualPitch = Math.sin(elapsed * 0.05) * 0.15;
        world.rotation.y = manualYaw;
        world.rotation.x = manualPitch;
      }
      world.updateMatrixWorld();

      // Camera dolly: fit height and width separately (wide screens can keep
      // the camera much closer, so clusters render bigger).
      const halfTan = Math.tan((camera.fov * Math.PI) / 360);
      // Margins include room for the DOM labels hanging off each cluster —
      // clusters must never touch the canvas edge (the queue sidebar shrinks
      // the container at runtime).
      let maxY = 0.8;
      let maxH = 1.2;
      for (const v of visuals.values()) {
        maxY = Math.max(maxY, Math.abs(v.anchor.y) + v.tier.radius + 0.8);
        maxH = Math.max(
          maxH,
          Math.hypot(v.anchor.x, v.anchor.z) + v.tier.radius + 1.0,
        );
      }
      const needZ =
        Math.max(maxY / halfTan, maxH / (halfTan * camera.aspect)) * 1.15 + 1.0;
      const cameraTarget =
        visuals.size > 0
          ? Math.min(Math.max(needZ, CAMERA_IDLE_Z), CAMERA_MAX_Z)
          : CAMERA_IDLE_Z;
      camera.position.z +=
        (cameraTarget - camera.position.z) * (1 - Math.exp(-dt * 2.2));

      const smoothingSlow = 1 - Math.exp(-dt * 2.5);

      for (const v of visuals.values()) {
        v.progress = Math.min(v.progress + dt / CONVERGE_SECONDS, 1);
        const style = STATUS_STYLE[v.node.status];
        const linkStyle = LINK_STYLE[v.node.status];

        v.color.lerp(style.color, smoothing);
        v.opacity += (style.opacity - v.opacity) * smoothing;
        const pulseTarget = style.pulse
          ? 0.5 + 0.5 * Math.sin(elapsed * 3.4)
          : 0;
        v.pulse += (pulseTarget - v.pulse) * smoothing;

        // Orange ignition sweep: ramp toward 1.25 (covers every stagger) so
        // the cluster lights up particle by particle; faster ramp back down.
        const accentTarget = style.accent ? 1.25 : 0;
        const accentRate = style.accent ? dt / 1.1 : dt / 0.45;
        const accentDiff = accentTarget - v.accent;
        v.accent +=
          Math.sign(accentDiff) * Math.min(Math.abs(accentDiff), accentRate * 1.25);

        const uniforms = v.clusterMaterial.uniforms;
        uniforms.uProgress.value = v.progress;
        uniforms.uPulse.value = v.pulse;
        uniforms.uOpacity.value = v.opacity;
        uniforms.uAccent.value = v.accent;
        (uniforms.uColor.value as THREE.Color).copy(v.color);

        if (v.hasLink) {
          // Link draw-in follows the converge animation.
          const draw = Math.min(Math.max((v.progress - 0.1) / 0.55, 0), 1);
          const drawEased = 1 - Math.pow(1 - draw, 3);
          const linkAttr = v.linkGeometry.getAttribute(
            "position",
          ) as THREE.BufferAttribute;
          linkAttr.setXYZ(0, v.linkFrom.x, v.linkFrom.y, v.linkFrom.z);
          linkAttr.setXYZ(
            1,
            v.linkFrom.x + (v.linkTo.x - v.linkFrom.x) * drawEased,
            v.linkFrom.y + (v.linkTo.y - v.linkFrom.y) * drawEased,
            v.linkFrom.z + (v.linkTo.z - v.linkFrom.z) * drawEased,
          );
          linkAttr.needsUpdate = true;

          // Links shift color on the slow curve so the orange spreads visibly.
          v.linkColor.lerp(linkStyle.color, smoothingSlow);
          v.linkOpacity +=
            (linkStyle.opacity * drawEased - v.linkOpacity) * smoothingSlow;
          v.linkMaterial.color.copy(v.linkColor);
          v.linkMaterial.opacity = v.linkOpacity;

          // Flow dots follow once the ignition sweep is underway.
          const flowTarget =
            linkStyle.flow && v.progress > 0.85 && v.accent > 0.5 ? 0.95 : 0;
          v.flowOpacity += (flowTarget - v.flowOpacity) * smoothingSlow;
          v.flowMaterial.uniforms.uOpacity.value = v.flowOpacity;
          if (v.flowOpacity > 0.02) {
            const flowAttr = v.flowGeometry.getAttribute(
              "position",
            ) as THREE.BufferAttribute;
            for (let i = 0; i < FLOW_DOTS; i++) {
              const t = (elapsed * 0.28 + i / FLOW_DOTS) % 1;
              flowAttr.setXYZ(
                i,
                v.linkFrom.x + (v.linkTo.x - v.linkFrom.x) * t,
                v.linkFrom.y + (v.linkTo.y - v.linkFrom.y) * t,
                v.linkFrom.z + (v.linkTo.z - v.linkFrom.z) * t,
              );
            }
            flowAttr.needsUpdate = true;
          }
        }

        // Label: project the anchor to screen space; fade on the far side.
        worldPos.copy(v.anchor).applyMatrix4(world.matrixWorld);
        const depthFade =
          0.45 + 0.55 * Math.min(Math.max((worldPos.z + 0.8) / 1.6, 0), 1);
        ndc.copy(worldPos).project(camera);
        if (ndc.z > 1) {
          v.labelEl.style.display = "none";
        } else {
          v.labelEl.style.display = "";
          v.labelEl.style.left = `${((ndc.x + 1) / 2) * w}px`;
          v.labelEl.style.top = `${((1 - ndc.y) / 2) * h + v.tier.labelPad}px`;
          const dimFactor = v.node.status === "dim" ? 0.5 : 1;
          v.labelEl.style.opacity = `${
            Math.min(v.progress * 1.6, 1) * depthFade * dimFactor
          }`;
        }
      }

      renderer.render(scene, camera);
    }
    animate(performance.now());

    function handleResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    // Observe the mount itself, not the window — the container shrinks when
    // the queue sidebar mounts, and the canvas must reflow with it.
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerup", onPointerUp);
      for (const [id, v] of visuals) removePerson(id, v);
      dustGeometry.dispose();
      dustMaterial.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      labelLayer.remove();
    };
  }, []);

  return <div ref={mountRef} className={cn("relative", className)} />;
}
