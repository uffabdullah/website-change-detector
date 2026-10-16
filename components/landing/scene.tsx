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
    let visible = true;
    let cleanup = () => {};

    (async () => {
      try {
        const THREE = await import("three");
        if (disposed) return;
        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: false,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(1);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
        camera.position.set(0, 0, 6.2);
        const core = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.35, 1),
          new THREE.MeshBasicMaterial({ color: 0xe2ff4d, wireframe: true })
        );
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(2.15, 0.012, 6, 48),
          new THREE.MeshBasicMaterial({ color: 0xc6a27a })
        );
        ring.rotation.x = 1.15;
        scene.add(core, ring);

        const resize = () => {
          const rect = canvas.getBoundingClientRect();
          const width = Math.max(rect.width, 320);
          const height = Math.max(rect.height, 320);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        const seen = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
        });
        seen.observe(canvas);

        let last = 0;
        const tick = (time: number) => {
          frame = requestAnimationFrame(tick);
          if (!visible || document.hidden || time - last < 40) return;
          last = time;
          if (!reduced) {
            core.rotation.y = time * 0.00025;
            core.rotation.x = time * 0.00012;
            ring.rotation.z = time * 0.0002;
          }
          renderer.render(scene, camera);
        };
        renderer.render(scene, camera);
        if (!reduced) frame = requestAnimationFrame(tick);

        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          seen.disconnect();
          core.geometry.dispose();
          ring.geometry.dispose();
          (core.material as { dispose: () => void }).dispose();
          (ring.material as { dispose: () => void }).dispose();
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

  return (
    <div className="stage-visual">
      <div className="orb" />
      {failed ? null : <canvas ref={ref} className="webgl" aria-hidden="true" />}
    </div>
  );
}
