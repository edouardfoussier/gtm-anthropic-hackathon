"use client";

// The contact-graph centerpiece. The big dot-sphere is the COMPANY; each
// person found there condenses as a satellite particle mini-sphere linked to
// the shell. All effects are opaque ink-on-paper (no bloom/additive — it dies
// on #F7F7F5, see docs/research-SYNTHESIS-effects-plan.md).
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import type { DotSphereProps, PersonNode, PersonStatus } from "./types";

export type { DotSphereNode, PersonNode } from "./types";

const DEFAULT_NODE_COUNT = 900;
const SPHERE_RADIUS = 2.4;
const IDLE_ROTATION_SPEED = 0.0006;
const DOT_COLOR = 0xff6500;
const DOT_DIM_OPACITY = 0.12;
const DOT_LIT_OPACITY = 0.85;

const CLUSTER_DOTS = 70;
const CLUSTER_RADIUS_FACTOR = 0.075;
const ANCHOR_DIST_FACTOR = 1.55;
const CONVERGE_SECONDS = 0.9;
const CAMERA_IDLE_Z = 6;
const CAMERA_PEOPLE_Z = 10;
const FLOW_DOTS = 5;

const INK = new THREE.Color("#111111");
const ORANGE = new THREE.Color("#ff6500");

const STATUS_STYLE: Record<
  PersonStatus,
  { color: THREE.Color; opacity: number; pulse: boolean }
> = {
  pending: { color: INK, opacity: 0.3, pulse: false },
  active: { color: INK, opacity: 0.85, pulse: false },
  picked: { color: ORANGE, opacity: 1, pulse: true },
  enriched: { color: ORANGE, opacity: 1, pulse: true },
  dim: { color: INK, opacity: 0.22, pulse: false },
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
  }
`;

const CLUSTER_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float edge = 1.0 - smoothstep(0.44, 0.5, length(coord));
    if (edge < 0.01) discard;
    gl_FragColor = vec4(uColor, uOpacity * vAlpha * edge);
  }
`;

const FLOW_VERTEX = /* glsl */ `
  uniform float uSize;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (6.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FLOW_FRAGMENT = /* glsl */ `
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

/** Satellite anchor positions: golden-angle ring around the sphere, equator-biased. */
function anchorForIndex(index: number, radius: number): THREE.Vector3 {
  const angle = index * 2.39996 + 0.6;
  const y = Math.sin(index * 2.1 + 0.8) * radius * 0.45;
  const ring = radius * ANCHOR_DIST_FACTOR;
  const horizontal = Math.sqrt(Math.max(ring * ring - y * y, 0.25));
  return new THREE.Vector3(
    Math.cos(angle) * horizontal,
    y,
    Math.sin(angle) * horizontal,
  );
}

interface PersonVisual {
  node: PersonNode;
  index: number;
  anchor: THREE.Vector3; // group-local
  shellPoint: THREE.Vector3; // group-local, on the company shell
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
  color: THREE.Color; // smoothed current values
  opacity: number;
  pulse: number;
  linkColor: THREE.Color;
  linkOpacity: number;
  flowOpacity: number;
}

export function DotSphere({
  nodeCount = DEFAULT_NODE_COUNT,
  nodes,
  revealCount,
  people,
  companyLabel,
  radius = SPHERE_RADIUS,
  className,
}: DotSphereProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const revealTarget =
    revealCount ?? (nodes ? nodes.filter((n) => n.revealed).length : nodeCount);
  const revealTargetRef = useRef(revealTarget);
  useEffect(() => {
    revealTargetRef.current = revealTarget;
  }, [revealTarget]);

  const peopleRef = useRef<PersonNode[]>(people ?? []);
  const peopleVersionRef = useRef(0);
  useEffect(() => {
    peopleRef.current = people ?? [];
    peopleVersionRef.current += 1;
  }, [people]);

  const companyLabelRef = useRef(companyLabel ?? "");
  useEffect(() => {
    companyLabelRef.current = companyLabel ?? "";
  }, [companyLabel]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

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
    labelLayer.className =
      "pointer-events-none absolute inset-0 overflow-hidden";
    mount.appendChild(labelLayer);

    // One world group: company sphere + person clusters + links rotate together.
    const world = new THREE.Group();
    scene.add(world);

    const positions = fibonacciSpherePoints(nodeCount, radius);
    const opacities = new Float32Array(nodeCount).fill(DOT_DIM_OPACITY);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("opacity", new THREE.BufferAttribute(opacities, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(DOT_COLOR) },
      },
      vertexShader: `
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 3.5 * (6.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vOpacity;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float edge = 1.0 - smoothstep(0.44, 0.5, length(coord));
          if (edge < 0.01) discard;
          gl_FragColor = vec4(color, vOpacity * edge);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    world.add(points);

    // Company label under the sphere.
    const companyEl = document.createElement("div");
    companyEl.className =
      "absolute -translate-x-1/2 whitespace-nowrap text-xs font-medium uppercase tracking-[0.2em] text-foreground";
    companyEl.style.display = "none";
    labelLayer.appendChild(companyEl);

    const clusterRadius = radius * CLUSTER_RADIUS_FACTOR;
    const visuals = new Map<string, PersonVisual>();
    let spawnCounter = 0;
    let syncedVersion = -1;

    function makeLabel(): {
      labelEl: HTMLDivElement;
      nameEl: HTMLDivElement;
      titleEl: HTMLDivElement;
      subEl: HTMLDivElement;
    } {
      const labelEl = document.createElement("div");
      labelEl.className =
        "absolute -translate-x-1/2 whitespace-nowrap text-center";
      const nameEl = document.createElement("div");
      nameEl.className = "text-[11px] font-medium tracking-tight";
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

    function addPerson(node: PersonNode) {
      const index = spawnCounter++;
      const anchor = anchorForIndex(index, radius);
      const shellPoint = anchor.clone().normalize().multiplyScalar(radius);
      const rand = mulberry32(index * 9973 + 1);

      // Cluster targets: mini fibonacci sphere (local to the anchor).
      const targets = fibonacciSpherePoints(CLUSTER_DOTS, clusterRadius);
      // Starts: along the company→anchor path, so particles stream out of the
      // company shell and condense into the person.
      const starts = new Float32Array(CLUSTER_DOTS * 3);
      const staggers = new Float32Array(CLUSTER_DOTS);
      const toShell = shellPoint.clone().sub(anchor);
      for (let i = 0; i < CLUSTER_DOTS; i++) {
        const along = 0.15 + rand() * 0.85;
        starts[i * 3] = toShell.x * along + (rand() - 0.5) * 0.5;
        starts[i * 3 + 1] = toShell.y * along + (rand() - 0.5) * 0.5;
        starts[i * 3 + 2] = toShell.z * along + (rand() - 0.5) * 0.5;
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
          uSize: { value: 3.0 },
          uColor: { value: INK.clone() },
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

      // Link: company shell → cluster edge, draw-in animated in the tick.
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
      world.add(link);

      // Flow dots: data traveling along the picked link.
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
        vertexShader: FLOW_VERTEX,
        fragmentShader: FLOW_FRAGMENT,
        transparent: true,
        depthWrite: false,
      });
      const flow = new THREE.Points(flowGeometry, flowMaterial);
      world.add(flow);

      const label = makeLabel();

      const visual: PersonVisual = {
        node,
        index,
        anchor,
        shellPoint,
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
    }

    let animationFrame: number;
    let revealShown = 0;
    let lastRevealStep = -1;

    const timer = new THREE.Timer();
    const worldPos = new THREE.Vector3();
    const ndc = new THREE.Vector3();

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

      // Ambient reveal: rate-limited toward the target (snaps down on replay).
      const target = Math.min(revealTargetRef.current, nodeCount);
      const diff = target - revealShown;
      if (diff > 0) {
        revealShown = Math.min(
          target,
          revealShown + Math.min(Math.max(diff * 1.6, 70), 150) * dt,
        );
      } else if (diff < 0) {
        revealShown = target;
      }
      const revealStep = Math.floor(revealShown);
      if (revealStep !== lastRevealStep) {
        const opacityAttr = geometry.getAttribute(
          "opacity",
        ) as THREE.BufferAttribute;
        for (let i = 0; i < nodeCount; i++) {
          opacityAttr.setX(
            i,
            i < revealStep ? DOT_LIT_OPACITY : DOT_DIM_OPACITY,
          );
        }
        opacityAttr.needsUpdate = true;
        lastRevealStep = revealStep;
      }

      // World rotation (slower while people are on screen so labels stay readable).
      const rotationScale = visuals.size > 0 ? 0.45 : 1;
      world.rotation.y += IDLE_ROTATION_SPEED * rotationScale * (dt * 60);
      world.rotation.x = Math.sin(elapsed * 0.05) * 0.15;
      world.updateMatrixWorld();

      // Camera dolly: pull back when satellites exist so the full graph fits.
      const cameraTarget = visuals.size > 0 ? CAMERA_PEOPLE_Z : CAMERA_IDLE_Z;
      camera.position.z +=
        (cameraTarget - camera.position.z) * (1 - Math.exp(-dt * 2.2));

      const smoothing = 1 - Math.exp(-dt * 6);

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

        const uniforms = v.clusterMaterial.uniforms;
        uniforms.uProgress.value = v.progress;
        uniforms.uPulse.value = v.pulse;
        uniforms.uOpacity.value = v.opacity;
        (uniforms.uColor.value as THREE.Color).copy(v.color);

        // Link draw-in follows the converge animation.
        const draw = Math.min(Math.max((v.progress - 0.1) / 0.55, 0), 1);
        const drawEased = 1 - Math.pow(1 - draw, 3);
        const linkAttr = v.linkGeometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        const endX =
          v.shellPoint.x + (v.anchor.x * 0.94 - v.shellPoint.x) * drawEased;
        const endY =
          v.shellPoint.y + (v.anchor.y * 0.94 - v.shellPoint.y) * drawEased;
        const endZ =
          v.shellPoint.z + (v.anchor.z * 0.94 - v.shellPoint.z) * drawEased;
        linkAttr.setXYZ(0, v.shellPoint.x, v.shellPoint.y, v.shellPoint.z);
        linkAttr.setXYZ(1, endX, endY, endZ);
        linkAttr.needsUpdate = true;

        v.linkColor.lerp(linkStyle.color, smoothing);
        v.linkOpacity +=
          (linkStyle.opacity * drawEased - v.linkOpacity) * smoothing;
        v.linkMaterial.color.copy(v.linkColor);
        v.linkMaterial.opacity = v.linkOpacity;

        // Flow dots along the picked link.
        const flowTarget = linkStyle.flow && v.progress > 0.85 ? 0.95 : 0;
        v.flowOpacity += (flowTarget - v.flowOpacity) * smoothing;
        v.flowMaterial.uniforms.uOpacity.value = v.flowOpacity;
        if (v.flowOpacity > 0.02) {
          const flowAttr = v.flowGeometry.getAttribute(
            "position",
          ) as THREE.BufferAttribute;
          for (let i = 0; i < FLOW_DOTS; i++) {
            const t = (elapsed * 0.28 + i / FLOW_DOTS) % 1;
            flowAttr.setXYZ(
              i,
              v.shellPoint.x + (v.anchor.x * 0.94 - v.shellPoint.x) * t,
              v.shellPoint.y + (v.anchor.y * 0.94 - v.shellPoint.y) * t,
              v.shellPoint.z + (v.anchor.z * 0.94 - v.shellPoint.z) * t,
            );
          }
          flowAttr.needsUpdate = true;
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
          v.labelEl.style.top = `${((1 - ndc.y) / 2) * h + 16}px`;
          const dimFactor = v.node.status === "dim" ? 0.5 : 1;
          v.labelEl.style.opacity = `${
            Math.min(v.progress * 1.6, 1) * depthFade * dimFactor
          }`;
        }
      }

      // Company label under the sphere.
      const label = companyLabelRef.current;
      if (label) {
        if (companyEl.textContent !== label) companyEl.textContent = label;
        companyEl.style.display = "";
        worldPos.set(0, -radius - 0.45, 0).applyMatrix4(world.matrixWorld);
        ndc.copy(worldPos).project(camera);
        companyEl.style.left = `${((ndc.x + 1) / 2) * w}px`;
        companyEl.style.top = `${((1 - ndc.y) / 2) * h}px`;
      } else {
        companyEl.style.display = "none";
      }

      renderer.render(scene, camera);
    }
    animate(performance.now());

    function handleResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
      for (const [id, v] of visuals) removePerson(id, v);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      labelLayer.remove();
    };
  }, [nodeCount, radius]);

  return <div ref={mountRef} className={cn("relative", className)} />;
}
