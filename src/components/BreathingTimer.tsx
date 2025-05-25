'use client'
import React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";

const PHASES = [
  { labelKey: "breatheIn", fallback: "Breathe in…", duration: 4000, scale: 1.25 },
  { labelKey: "hold", fallback: "Hold…", duration: 7000, scale: 1.25 },
  { labelKey: "breatheOut", fallback: "Breathe out…", duration: 8000, scale: 1 },
];

export default function BreathingTimer({ cycles = 3, onDone }: { cycles?: number; onDone?: () => void }) {
  const { t } = useTranslation();
  const [intro, setIntro] = useState(true);
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(0);

  // Show "Ready? Let's start..." for 3 seconds before starting breathing
  useEffect(() => {
    const introTimeout = setTimeout(() => setIntro(false), 3000);
    return () => clearTimeout(introTimeout);
  }, []);

  useEffect(() => {
    if (intro) return;
    if (cycle >= cycles) {
      onDone?.();
      return;
    }
    const timeout = setTimeout(() => {
      if (phase === PHASES.length - 1) {
        setPhase(0);
        setCycle(c => c + 1);
      } else {
        setPhase(p => p + 1);
      }
    }, PHASES[phase].duration);
    return () => clearTimeout(timeout);
  }, [intro, phase, cycle, cycles, onDone]);

  // During intro, keep scale at 1 and show intro text
  const scale = intro ? 1 : PHASES[phase].scale;
  const transitionDuration = intro ? "0ms" : `${PHASES[phase].duration}ms`;
  const [timeLeft, setTimeLeft] = useState(PHASES[phase].duration / 1000);

  useEffect(() => {
    if (intro) return;
    setTimeLeft(PHASES[phase].duration / 1000);
    if (cycle >= cycles) return;
    const interval = setInterval(() => {
      setTimeLeft(t => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [intro, phase, cycle, cycles]);

  return (
    <div className="flex flex-col items-center justify-center gap-8 pt-8 pb-2">
      <div className="mb-4 text-center max-w-md">
        <h2 className="text-xl font-bold text-pink-600 mb-2">{t('breathingTitle') || '4-7-8 Breathing'}</h2>
        <p className="text-blue-900 text-base leading-relaxed">
          {t('breathingDesc1')} {" "}
          <span className="font-semibold">{t('breathingDescBold')}</span>. {" "}
          {t('breathingDesc2')}
        </p>
      </div>
      <div
        className="w-60 h-60 rounded-full bg-gradient-to-br from-pink-300 via-yellow-50 to-green-200 shadow-xl flex flex-col items-center justify-center transition-transform"
        style={{
          transform: `scale(${scale})`,
          transition: `transform ${transitionDuration} cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        <span className="text-2xl text-fuchsia-700 font-light text-center px-2 mb-2 transition-colors duration-300 tracking-wide drop-shadow-sm">
          {intro
            ? t('breathingIntro') || "Ready? Let's start…"
            : t(PHASES[phase].labelKey) || PHASES[phase].fallback}
        </span>
        {!intro && (
          <span className="text-lg text-blue-500 font-mono mt-2" aria-live="polite">
            {timeLeft}s
          </span>
        )}
      </div>
      {!intro && (
        <div className="text-base text-blue-700 mt-2 font-medium tracking-wide animate-fade-in">
          {t('cycle') ? `${t('cycle')} ${cycle + 1} of ${cycles}` : `Cycle ${cycle + 1} of ${cycles}`}
        </div>
      )}
      <div className="mt-4 text-center text-blue-500 text-sm max-w-xs">
        {t('breathingTip') || 'Try to keep your shoulders relaxed and let your exhale be gentle. If you feel lightheaded, return to normal breathing.'}
      </div>
    </div>
  );
}