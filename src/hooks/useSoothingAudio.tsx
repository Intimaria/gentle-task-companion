import { useRef, useState } from "react";

export type SoothingSound = {
  name: string;
  url: string;
  icon?: string; 
};

export function useSoothingAudio(
  sounds: SoothingSound[],
  stopSafeMessage?: () => void
) {
  const [current, setCurrent] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function play(index: number) {
    stopSafeMessage?.();
    if (current !== index) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      audioRef.current = new Audio(sounds[index].url);
      audioRef.current.loop = true;
      audioRef.current.onended = () => setIsPlaying(false);
      setCurrent(index);
    }
    audioRef.current?.play();
    setIsPlaying(true);
  }

  function pause() {
    audioRef.current?.pause();
    setIsPlaying(false);
  }

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrent(null);
    }
  }

  // For persistent playback, expose the audioRef
  return {
    current,
    isPlaying,
    play,
    pause,
    stop,
    audioRef,
    sound: current !== null ? sounds[current] : null,
  };
}
