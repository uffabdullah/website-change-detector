"use client";

import { useEffect, useRef, useState } from "react";

export function Scene() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const THREE = await import("three");
        if (disposed) return;
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 40);
        camera.position.set(0, 0.1, 7.2);
        const knot = new THREE.Mesh(
          new THREE.TorusKnotGeometry(1.15, 0.28, 180, 18),
          new THREE.MeshBasicMaterial({ color: 0xe2ff4d, wireframe: true })
        );
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(2.05, 0.012, 12, 120),
          new THREE.MeshBasicMaterial({ color: 0xc6a27a })
        );
        ring.rotation.x = Math.PI / 2.4;
        const dots = new THREE.BufferGeometry();
        const positions = new Float32Array(420 * 3);
        for (let i = 0; i < positions.length; i += 3) {
          const radius = 2.2 + Math.random() * 1.6;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          positions[i] = radius * Math.sin(phi) * Math.cos(theta);
          positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.72;
          positions[i + 2] = radius * Math.cos(phi);
        }
        dots.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const dust = new THREE.Points(dots, new THREE.PointsMaterial({ color: 0xf3ecdf, size: 0.02, transparent: true, opacity: 0.7 }));
        scene.add(knot, ring, dust);
        const pointer = { x: 0, y: 0 };
        const onMove = (event: PointerEvent) => {
          pointer.x = event.clientX / window.innerWidth - 0.5;
          pointer.y = event.clientY / window.innerHeight - 0.5;
        };
        window.addEventListener("pointermove", onMove);
        const resize = () => {
          const rect = canvas.getBoundingClientRect();
          renderer.setSize(rect.width, rect.height, false);
          camera.aspect = rect.width / Math.max(rect.height, 1);
          camera.updateProjectionMatrix();
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        const tick = (time: number) => {
          if (!reduced) {
            knot.rotation.y = time * 0.00018;
            knot.rotation.x = time * 0.00008;
            ring.rotation.z = time * 0.00022;
            dust.rotation.y = time * 0.00005;
          }
          camera.position.x += (pointer.x * 0.7 - camera.position.x) * 0.04;
          camera.position.y += (-pointer.y * 0.4 - camera.position.y) * 0.04;
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
          if (!reduced) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        if (reduced) renderer.render(scene, camera);
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          window.removeEventListener("pointermove", onMove);
          knot.geometry.dispose();
          ring.geometry.dispose();
          dots.dispose();
          (knot.material as { dispose: () => void }).dispose();
          (ring.material as { dispose: () => void }).dispose();
          (dust.material as { dispose: () => void }).dispose();
          renderer.dispose();
        };
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return failed ? <div className="orb" /> : <canvas ref={ref} className="webgl" aria-hidden="true" />;
}
