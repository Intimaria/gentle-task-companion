import React from "react";

export default function Sparkle() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none animate-sparkle"
      viewBox="0 0 40 40"
      fill="none"
    >
      <g>
        <circle cx="20" cy="10" r="1.5" fill="#f472b6" />
        <circle cx="30" cy="20" r="1" fill="#a78bfa" />
        <circle cx="10" cy="25" r="1.2" fill="#fbbf24" />
        <circle cx="25" cy="30" r="0.8" fill="#f472b6" />
      </g>
    </svg>
  );
}