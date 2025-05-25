'use client'
import React from "react";
import { useState } from "react";
import CommCard from "./CommCard";
import { useTranslation } from "../hooks/useTranslation";

const phrases = [
  "needBreak",
  "hugMe", 
  "talkLater",
  "overwhelmed",
  "sitWithMe",
  "noTalking",
];

export default function CommCardsGrid({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-lg flex flex-col items-center min-h-[350px]">
        <h2 className="text-xl font-bold mb-2 text-fuchsia-900 flex items-center gap-2">
          <span>{t('cardsTitle')}</span>
          <span className="text-fuchsia-500 text-2xl">💬</span>
        </h2>
        <p className="text-sm text-gray-600 mb-4 text-center">
          {t('useCardToCommunicate')}
        </p>
        {!focused ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {phrases.map(phraseKey => (
              <CommCard
                key={phraseKey}
                phrase={t(phraseKey)}
                onClick={() => setFocused(t(phraseKey))}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-64 animate-flip">
            <div className="bg-fuchsia-100 rounded-xl shadow p-8 flex items-center justify-center w-full h-full transition-all duration-500 scale-105">
              <span className="text-2xl text-fuchsia-900 text-center">{focused}</span>
            </div>
            <button
              className="mt-8 px-6 py-2 rounded bg-gray-200 text-gray-800 font-medium shadow"
              onClick={() => setFocused(null)}
            >
              {t('back')}
            </button>
          </div>
        )}
        {!focused && (
          <button
            className="mt-2 px-6 py-2 rounded bg-fuchsia-200 text-fuchsia-900 font-semibold shadow"
            onClick={onClose}
          >
            {t('close')}
          </button>
        )}
      </div>
      <style >{`
        .animate-flip {
          animation: flipIn 0.5s;
        }
        @keyframes flipIn {
          from {
            transform: rotateY(90deg) scale(0.8);
            opacity: 0;
          }
          to {
            transform: rotateY(0deg) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}