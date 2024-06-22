"use client";

import { useRef, useState } from "react";
import { LuPlay, LuPause } from "react-icons/lu";

export default function Music({
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
      className="flex flex-col hover:opacity-80 transition-all"
    >
      <audio ref={audioRef} src={src} autoPlay loop></audio>

      <div className="flex gap-2 items-center">
        {isPlaying ? <LuPause /> : <LuPlay />}
        {name} <span className="text-neutral-400 text-sm">- {author}</span>
      </div>
    </button>
  );
}

