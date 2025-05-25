import React from "react";
import { SOOTHING_SOUNDS } from "../app/crisis/soothingSounds";
import { useEffect, useRef } from "react";
import { useTranslation } from "../hooks/useTranslation";

interface SoothingAudioModalProps {
  open: boolean;
  onClose: () => void;
  current: number | null;
  isPlaying: boolean;
  play: (index: number) => void;
  pause: () => void;
}

export default function SoothingAudioModal({
  open,
  onClose,
  current,
  isPlaying,
  play,
  pause,
}: SoothingAudioModalProps) {
  const { t } = useTranslation();
  // Trap focus for accessibility
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && modalRef.current) {
      modalRef.current.focus();
    }
  }, [open]);

  if (!open) {
    // Stop audio if modal closes
    if (isPlaying) pause();
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
      ref={modalRef}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-md flex flex-col items-center">
        <h2 className="text-xl font-bold mb-2 text-fuchsia-900 flex items-center gap-2">
          <span>{t('soothingSoundsTitle')}</span>
        </h2>
        <p className="text-sm text-gray-600 mb-4 text-center">{t('soothingSoundsDesc')}</p>
        <div className="grid grid-cols-2 gap-4 mb-6 w-full">
          {SOOTHING_SOUNDS.map((s, i) => (
            <button
              key={s.name}
              className={`flex flex-col items-center justify-center rounded-lg p-4 border-2 transition focus:outline-none focus:ring-2 focus:ring-fuchsia-400 ${
                current === i
                  ? "border-fuchsia-500 bg-fuchsia-50"
                  : "border-gray-200 bg-gray-50"
              }`}
              aria-pressed={current === i && isPlaying}
              aria-label={`Play ${s.name}`}
              onClick={() => (current === i && isPlaying ? pause() : play(i))}
            >
              <span
                className="text-3xl mb-2"
                aria-hidden
              >
                {s.icon}
              </span>
              <span className="font-medium text-fuchsia-900">{t(s.name)}</span>
              <span className="mt-2 text-xs text-gray-500">
                {current === i && isPlaying ? (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <svg className="w-3 h-3 animate-pulse" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4" />
                    </svg>
                    {t('playing')}
                  </span>
                ) : (
                  t('play')
                )}
              </span>
            </button>
          ))}
        </div>
        <button
          className="mt-2 px-6 py-2 rounded bg-fuchsia-200 text-fuchsia-900 font-semibold shadow"
          onClick={onClose}
        >
          {t('close')}
        </button>
        {/* <p className="mt-4 text-xs text-gray-500 text-center">
          Audio will continue in the background if you close this window. You can
          pause or stop it anytime using the floating player.
        </p> */}
      </div>
    </div>
  );
}
