import { SoothingSound } from "../../hooks/useSoothingAudio";

// You can replace these with your own audio files in public/audio/
export const SOOTHING_SOUNDS: SoothingSound[] = [
  {
    name: "soundGentleRain",
    url: "https://rlerrouujqsdmbugoolb.supabase.co/storage/v1/object/public/audio//rain.wav",
    icon: "🌧️",
  },
  {
    name: "soundHealing",
    url: "https://rlerrouujqsdmbugoolb.supabase.co/storage/v1/object/public/audio//healing.mp3",
    icon: "🧠",
  },
  {
    name: "soundForestAmbience",
    url: "https://rlerrouujqsdmbugoolb.supabase.co/storage/v1/object/public/audio//forest.mp3",
    icon: "🌲",
  },
  {
    name: "soundSoftPiano",
    url: "https://rlerrouujqsdmbugoolb.supabase.co/storage/v1/object/public/audio//piano.mp3",
    icon: "🎹",
  },
];
