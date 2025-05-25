import { useRef } from "react";

export function useAudio(url: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function play() {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  }

  return play;
}