"use client";

import { useRef, useState } from "react";
import SpotlightScene from "./spotlight-scene";
import { LuMusic, LuPause, LuPlay } from "react-icons/lu";

function Music({
  src,
  name,
  author,
}: {
  src: string;
  name: string;
  author: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function handlePlayPause() {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play();
      setIsPlaying(true);
    }
  }

  return (
    <button 
        onClick={handlePlayPause}
    className="flex flex-col hover:opacity-80 transition-all">
      <audio ref={audioRef} src={src} autoPlay loop></audio>

      <div className="flex gap-2 items-center">
        {isPlaying ? <LuPause /> : <LuPlay />}
        {name} <span className="text-neutral-400 text-sm">- {author}</span>
      </div>

    </button>
  );
}

export default function Home() {
  const [showPerf, setShowPerf] = useState(false);

  return (
    <main className="h-full bg-black relative text-neutral-100 w-full">
      <SpotlightScene showPerf={showPerf} />

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
