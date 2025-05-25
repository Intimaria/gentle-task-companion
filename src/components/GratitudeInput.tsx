'use client'
import React from "react";
import { useEffect, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function GratitudeInput({ value, onChange }: Props) {
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (value) {
      setJustSaved(true);
      const timeout = setTimeout(() => setJustSaved(false), 400);
      return () => clearTimeout(timeout);
    }
  }, [value]);

  return (
    <div>
      <input
        type="text"
        className={`w-full rounded px-3 py-2 border border-gray-300 focus:outline-none focus:ring focus:ring-violet-200 transition-colors duration-300 ${
          justSaved ? "animate-shimmer bg-violet-100" : ""
        }`}
        placeholder="What are you grateful for today?"
        value={value}
        maxLength={100}
        onChange={e => onChange(e.target.value)}
        aria-label="Daily gratitude input"
      />
      <div className="text-xs text-gray-500 mt-1">
        {value.length > 0 ? "1 gratitude set" : "Enter your gratitude"}
      </div>
    </div>
  );
}