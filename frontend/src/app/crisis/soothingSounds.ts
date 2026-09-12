import { SoothingSound } from "../../hooks/useSoothingAudio";

// Audio servido localmente desde public/audio/ (antes en Supabase Storage).
// En producción migra a S3 (AWS) / MinIO (self-host) — misma idea de media compartida.
export const SOOTHING_SOUNDS: SoothingSound[] = [
  { name: "soundGentleRain", url: "/audio/rain.mp3", icon: "🌧️" },
  { name: "soundHealing", url: "/audio/healing.mp3", icon: "🧠" },
  { name: "soundForestAmbience", url: "/audio/forest.mp3", icon: "🌲" },
  { name: "soundSoftPiano", url: "/audio/piano.mp3", icon: "🎹" },
];
