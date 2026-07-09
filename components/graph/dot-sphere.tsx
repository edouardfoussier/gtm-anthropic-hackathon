"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface DotSphereNode {
  id: string;
  /** 0..1 — reveal progress; nodes below this in build order stay hidden. */
  revealed: boolean;
}

interface DotSphereProps {
  /** Total number of dots on the sphere shell. */
  nodeCount?: number;
  /** Which nodes (by build order) are currently revealed — drives the build-up animation. */
  nodes?: DotSphereNode[];
  radius?: number;
  className?: string;
}

const DEFAULT_NODE_COUNT = 900;
const SPHERE_RADIUS = 2.4;
const IDLE_ROTATION_SPEED = 0.0006;
const REVEAL_STAGGER_MS = 12;
const DOT_COLOR = 0xff6500;
const DOT_DIM_OPACITY = 0.12;
const DOT_LIT_OPACITY = 0.85;

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

export function DotSphere({
  nodeCount = DEFAULT_NODE_COUNT,
  nodes,
  radius = SPHERE_RADIUS,
  className,
}: DotSphereProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const revealedCountRef = useRef(0);

  const revealedCount = nodes
    ? nodes.filter((n) => n.revealed).length
    : nodeCount;

  useEffect(() => {
    revealedCountRef.current = revealedCount;
  }, [revealedCount]);

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
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

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
          if (length(coord) > 0.5) discard;
          gl_FragColor = vec4(color, vOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let animationFrame: number;
    let lastRevealStep = -1;

    const timer = new THREE.Timer();

    function animate(timestamp: number) {
      animationFrame = requestAnimationFrame(animate);
      timer.update(timestamp);
      const elapsedMs = timer.getElapsed() * 1000;

      const targetRevealed = revealedCountRef.current;
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

      points.rotation.y += IDLE_ROTATION_SPEED;
      points.rotation.x = Math.sin(timer.getElapsed() * 0.05) * 0.15;

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
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [nodeCount, radius]);

  return <div ref={mountRef} className={className} />;
}
