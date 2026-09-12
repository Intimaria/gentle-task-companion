import React from "react";
import { useTranslation } from "../hooks/useTranslation";

interface SoothingAudioMiniPlayerProps {
  current: number | null;
  isPlaying: boolean;
  play: (index: number) => void;
  pause: () => void;
  stop: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  sound: { name: string; icon: string } | null;
  volume: number;
  setVolume: (v: number) => void;
}
function SoothingAudioMiniPlayer({
  current,
  isPlaying,
  play,
  pause,
  stop,
  sound,
  volume,
  setVolume,
}: SoothingAudioMiniPlayerProps) {
  const { t } = useTranslation();
  if (!sound || current === null) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-white/95 rounded-full shadow-2xl flex items-center px-6 py-3 gap-4 border-2 border-fuchsia-300 backdrop-blur-lg min-w-[280px] max-w-[95vw] transition-all animate-fade-in">
      <span className="text-3xl" aria-label={t(sound.name)}>{sound.icon}</span>
      <span className="font-semibold text-fuchsia-900 text-base truncate max-w-[100px]">{t(sound.name)}</span>
      <button
        className="rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 bg-fuchsia-100 hover:bg-fuchsia-200 transition"
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={() => (isPlaying ? pause() : play(current))}
      >
        {isPlaying ? (
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="2" fill="#a21caf"/><rect x="14" y="5" width="4" height="14" rx="2" fill="#a21caf"/></svg>
        ) : (
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M7 5v14l11-7L7 5z" fill="#a21caf"/></svg>
        )}
      </button>
      <button
        className="rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 bg-fuchsia-100 hover:bg-fuchsia-200 transition"
        aria-label="Stop"
        onClick={stop}
      >
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="3" fill="#a21caf"/></svg>
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={e => setVolume(Number(e.target.value))}
        aria-label="Volume"
        className="accent-fuchsia-400 w-24 h-2"
      />
    </div>
  );
}

export default SoothingAudioMiniPlayer;
