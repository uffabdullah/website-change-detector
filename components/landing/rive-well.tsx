"use client";

import { useEffect, useRef, useState } from "react";
import { useRive } from "@rive-app/react-canvas";

function RiveCanvas() {
  const { RiveComponent } = useRive({
    src: "https://cdn.rive.app/animations/vehicles.riv",
    stateMachine: "bumpy",
    autoplay: true,
  });
  return <RiveComponent />;
}

export default function RiveWell() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setReady(true);
      },
      { rootMargin: "160px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="rive-well" ref={ref} aria-hidden="true">
      {ready ? <RiveCanvas /> : null}
    </div>
  );
}
