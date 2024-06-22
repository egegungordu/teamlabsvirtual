"use client";

import { useState } from "react";
import Scene from "./scene";
import Music from "@/components/music";

export default function Home() {
  const [showPerf, setShowPerf] = useState(false);

  return (
    <main className="h-full bg-black relative text-neutral-100 w-full">
      <Scene showPerf={showPerf} />

      <div className="absolute top-8 left-8 text-sm font-medium">
        - spotlight tunnel
      </div>

      <button
        onClick={() => setShowPerf(!showPerf)}
        className="absolute bottom-0 right-0 p-2 text-xs text-neutral-500 rounded-full hover:underline"
      >
        {showPerf ? "Hide" : "Show"} Performance
      </button>

      <div className="absolute top-8 right-8">
        <Music src="/komorebi.mp3" name="komorebi" author="Kumi Tanioka" />
      </div>
    </main>
  );
}
