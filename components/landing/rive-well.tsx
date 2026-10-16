"use client";

import { useRive } from "@rive-app/react-canvas";

export default function RiveWell() {
  const { RiveComponent } = useRive({
    src: "https://cdn.rive.app/animations/vehicles.riv",
    stateMachine: "bumpy",
    autoplay: true,
  });
  return (
    <div className="rive-well" aria-hidden="true">
      <RiveComponent />
    </div>
  );
}
