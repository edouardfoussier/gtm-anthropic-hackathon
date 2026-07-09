"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import type { RelationshipKind } from "@/lib/types";

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  kind: "contact";
  relationshipKind?: RelationshipKind;
}

export interface GraphLink {
  id: string;
  fromId: string;
  toId: string;
  relationshipKind?: RelationshipKind;
}

interface SignalGlobeProps {
  /** Total number of ambient dots on the sphere shell. */
  nodeCount?: number;
  /** 0..1 build-up progress for the ambient dot field. */
  buildProgress?: number;
  /** Rendered as a static label pinned to the exact center of the globe. */
  companyName?: string;
  /** Contact nodes rendered as overlay labels, projected from 3D positions and orbiting the center. */
  graphNodes?: GraphNode[];
  /** Links from the center to each contact; revealed one at a time in array order. */
  graphLinks?: GraphLink[];
  /** true = large, foregrounded, nodes visible. false = idle ambient globe. */
  expanded?: boolean;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
}

const EMPTY_GRAPH_NODES: GraphNode[] = [];
const EMPTY_GRAPH_LINKS: GraphLink[] = [];

const DEFAULT_NODE_COUNT = 900;
const SPHERE_RADIUS = 2.4;
const IDLE_ROTATION_SPEED = 0.0006;
const EXPANDED_ROTATION_SPEED = 0.0009;
const REVEAL_STAGGER_MS = 8;
const DOT_COLOR = 0xff6500;
const DOT_DIM_OPACITY = 0.1;
const DOT_LIT_OPACITY = 0.75;

const RELATIONSHIP_COLOR: Record<RelationshipKind, string> = {
  signal_source: "#9a9a95",
  champion: "#ff6500",
  decision_maker: "#111111",
};

function fibonacciSpherePoints(count: number, radius: number): Float32Array {
  const points = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;

    points[i * 3] = Math.cos(theta) * radiusAtY * radius;
    points[i * 3 + 1] = y * radius;
    points[i * 3 + 2] = Math.sin(theta) * radiusAtY * radius;
  }

  return points;
}

/** Deterministic placement for contact nodes: an orbit ring around the center. */
function layoutGraphNodes(
  nodes: GraphNode[],
  radius: number,
): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>();
  const ringRadius = radius * 0.85;

  nodes.forEach((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    const y = index % 2 === 0 ? 0.3 : -0.3;
    positions.set(
      node.id,
      new THREE.Vector3(
        Math.cos(angle) * ringRadius,
        y,
        Math.sin(angle) * ringRadius,
      ),
    );
  });

  return positions;
}

const LINK_REVEAL_INTERVAL_MS = 450;

export function SignalGlobe({
  nodeCount = DEFAULT_NODE_COUNT,
  buildProgress = 1,
  companyName,
  graphNodes = EMPTY_GRAPH_NODES,
  graphLinks = EMPTY_GRAPH_LINKS,
  expanded = false,
  className,
  onNodeClick,
}: SignalGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const buildProgressRef = useRef(buildProgress);
  const graphNodesRef = useRef(graphNodes);
  const [projected, setProjected] = useState<
    Map<string, { x: number; y: number; visible: boolean }>
  >(new Map());
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [revealedLinkCount, setRevealedLinkCount] = useState(0);
  const [lastSeenLinks, setLastSeenLinks] = useState(graphLinks);

  if (graphLinks !== lastSeenLinks) {
    setLastSeenLinks(graphLinks);
    setRevealedLinkCount(graphLinks.length > 0 ? 1 : 0);
  }

  useEffect(() => {
    buildProgressRef.current = buildProgress;
  }, [buildProgress]);

  useEffect(() => {
    graphNodesRef.current = graphNodes;
  }, [graphNodes]);

  useEffect(() => {
    if (graphLinks.length === 0) return;
    const interval = setInterval(() => {
      setRevealedLinkCount((count) => {
        const next = count + 1;
        if (next >= graphLinks.length) clearInterval(interval);
        return next;
      });
    }, LINK_REVEAL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [graphLinks]);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;
    const mount = mountEl;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.z = expanded ? 4.2 : 6;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    setContainerSize({ width: mount.clientWidth, height: mount.clientHeight });

    const positions = fibonacciSpherePoints(nodeCount, SPHERE_RADIUS);
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
          if (length(coord) > 0.5) discard;
          gl_FragColor = vec4(color, vOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    let animationFrame: number;
    let lastRevealStep = -1;
    const timer = new THREE.Timer();
    const rotationSpeed = expanded ? EXPANDED_ROTATION_SPEED : IDLE_ROTATION_SPEED;

    function animate(timestamp: number) {
      animationFrame = requestAnimationFrame(animate);
      timer.update(timestamp);
      const elapsedMs = timer.getElapsed() * 1000;

      const targetRevealed = Math.round(buildProgressRef.current * nodeCount);
      const revealStep = Math.min(
        targetRevealed,
        Math.floor(elapsedMs / REVEAL_STAGGER_MS),
      );

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

      points.rotation.y += rotationSpeed;
      points.rotation.x = Math.sin(timer.getElapsed() * 0.05) * 0.15;
      graphGroup.rotation.y = points.rotation.y;
      graphGroup.rotation.x = points.rotation.x;

      renderer.render(scene, camera);

      if (graphNodesRef.current.length > 0) {
        const layout = layoutGraphNodes(graphNodesRef.current, SPHERE_RADIUS);
        const next = new Map<
          string,
          { x: number; y: number; visible: boolean }
        >();
        for (const node of graphNodesRef.current) {
          const localPos = layout.get(node.id);
          if (!localPos) continue;
          const worldPos = localPos.clone().applyEuler(graphGroup.rotation);
          const screenPos = worldPos.clone().project(camera);
          next.set(node.id, {
            x: ((screenPos.x + 1) / 2) * mount.clientWidth,
            y: ((1 - screenPos.y) / 2) * mount.clientHeight,
            visible: screenPos.z < 1,
          });
        }
        setProjected(next);
      }
    }
    animate(performance.now());

    function syncSize() {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      setContainerSize({ width: mount.clientWidth, height: mount.clientHeight });
    }
    window.addEventListener("resize", syncSize);
    // The mount div animates size via a CSS transition (idle <-> expanded);
    // ResizeObserver keeps the renderer/camera/center anchor in sync every frame of that transition.
    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", syncSize);
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [nodeCount, expanded]);

  const revealedLinks = graphLinks.slice(0, revealedLinkCount);
  const center = { x: containerSize.width / 2, y: containerSize.height / 2 };

  return (
    <div ref={mountRef} className={cn("relative", className)}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {revealedLinks.map((link) => {
          const to = projected.get(link.toId);
          if (!to || !to.visible) return null;
          const color = link.relationshipKind
            ? RELATIONSHIP_COLOR[link.relationshipKind]
            : "var(--accent-orange)";

          return (
            <line
              key={link.id}
              x1={center.x}
              y1={center.y}
              x2={to.x}
              y2={to.y}
              stroke={color}
              strokeWidth={1.5}
              strokeOpacity={0.7}
              className="transition-all duration-500"
            />
          );
        })}
      </svg>
      {companyName ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-3xl uppercase tracking-tight md:text-5xl">
          {companyName}
        </span>
      ) : null}
      {graphNodes.map((node) => {
        const pos = projected.get(node.id);
        if (!pos || !pos.visible) return null;
        const color = node.relationshipKind
          ? RELATIONSHIP_COLOR[node.relationshipKind]
          : "var(--foreground)";

        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onNodeClick?.(node.id)}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur-sm transition-opacity",
              onNodeClick
                ? "cursor-pointer hover:bg-accent-orange hover:text-white"
                : "cursor-default",
            )}
            style={{
              left: pos.x,
              top: pos.y,
              borderColor: color,
              color,
            }}
            disabled={!onNodeClick}
          >
            {node.label}
            {node.sublabel ? (
              <span className="ml-1 text-muted-foreground">
                · {node.sublabel}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
