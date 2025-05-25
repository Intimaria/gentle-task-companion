'use client'
import React from "react";

type CommCardProps = {
  phrase: string;
  onClick?: () => void;
};

export default function CommCard({ phrase, onClick }: CommCardProps) {
  return (
    <button
      className="w-full py-8 px-4 rounded-xl bg-fuchsia-100 text-fuchsia-900 text-xl font-semibold shadow hover:bg-fuchsia-200 transition-all focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
      onClick={onClick}
      aria-label={phrase}
    >
      {phrase}
    </button>
  );
}