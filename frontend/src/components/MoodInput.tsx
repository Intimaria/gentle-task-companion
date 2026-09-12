'use client'
import React from "react";
import Sparkle from "./Sparkle";
import { useEffect, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";

interface Props {
  value: string | null;
  onChange: (value: string) => void;
}

const MOODS = [
  { label: "😊", value: "happy", nameKey: "moodHappy" },
  { label: "😐", value: "neutral", nameKey: "moodNeutral" },
  { label: "😔", value: "sad", nameKey: "moodSad" },
  { label: "😴", value: "tired", nameKey: "moodTired" },
  { label: "😤", value: "angry", nameKey: "moodAngry" },
  { label: "🤯", value: "overwhelmed", nameKey: "moodOverwhelmed" },
];

export default function MoodInput({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (value) {
      setJustSaved(true);
      const timeout = setTimeout(() => setJustSaved(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [value]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-xs mx-auto" role="radiogroup" aria-label="Mood selector">
      {MOODS.map(({ label, value: moodValue, nameKey }) => (
        <div key={moodValue} className="flex flex-col items-center relative">
          <button
            className={`text-3xl p-3 rounded-full border-2 transition-colors duration-300 focus:outline-none  ${
              value === moodValue
                ? "border-pink-400 bg-pink-100 shadow"
                : "border-gray-200 bg-white hover:bg-pink-50"
            }`}
            onClick={() => onChange(moodValue)}
            aria-label={t(nameKey)}
            aria-pressed={value === moodValue}
            tabIndex={0}
            type="button"
            role="radio"
          >
            {label}
            {justSaved && value === moodValue && <Sparkle />}
          </button>
          <span className="text-xs mt-1 text-gray-700 select-none" aria-hidden="true">{t(nameKey)}</span>
        </div>
      ))}
    </div>
  );
}