'use client'
import React from "react";
import BreathingTimer from "../../components/BreathingTimer"; 
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import SoothingAudioModal from "../../components/SoothingAudioModal";
import SoothingAudioMiniPlayer from "../../components/SoothingAudioMiniPlayer";
import { useSoothingAudio } from "../../hooks/useSoothingAudio";
import { SOOTHING_SOUNDS } from "./soothingSounds";
import { saveContact, fetchContact } from "../../lib/dailyEntryApi";
import { supabase } from "@/lib/supabaseClient";
import { useTranslation } from "../../hooks/useTranslation";


export default function CrisisPage() {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [contact, setContact] = useState<{ name: string; phone: string } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
 const [isSafeMessagePlaying, setIsSafeMessagePlaying] = useState(false);
 const [isSafeMessagePaused, setIsSafeMessagePaused] = useState(false);
  const safeMessageRef = useRef<HTMLAudioElement | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) setUserId(data.user.id);
    };
    getUser();
  }, []);

    useEffect(() => {
    if (!userId) return;
    async function loadContact() {
      try {
        if (userId) {
          const data = await fetchContact(userId);
          setContact(data);
          setName(data.name);
          setPhone(data.phone);
        }
      } catch {
        setContact(null);
      }
    }
    loadContact();
  }, [userId]);

function stopSafeMessage() {
  if (safeMessageRef.current) {
    safeMessageRef.current.pause();
    safeMessageRef.current.currentTime = 0;
  }
  setIsSafeMessagePlaying(false);
  setIsSafeMessagePaused(false);
}
  
  async function handleSaveContact(name: string, phone: string) {
    if (!userId) return;
    await saveContact(userId, name, phone);
    setContact({ name, phone });
    setShowModal(false);
  }


  const [showBreathing, setShowBreathing] = useState(false);
  const [showSoothing, setShowSoothing] = useState(false);
  const [volume, setVolume] = useState(1);

  const soothingAudio = useSoothingAudio(SOOTHING_SOUNDS, stopSafeMessage);

function playSafeMessage() {
  soothingAudio.stop();
  if (!safeMessageRef.current) {
    // Dynamically select localized audio file
    const audioFile = t('safeMessageAudio');
    safeMessageRef.current = new Audio(`https://rlerrouujqsdmbugoolb.supabase.co/storage/v1/object/public/audio/${audioFile}`);
    safeMessageRef.current.onended = () => {
      setIsSafeMessagePlaying(false);
      setIsSafeMessagePaused(false);
    };
  }
  safeMessageRef.current.volume = volume;
  safeMessageRef.current.currentTime = 0;
  safeMessageRef.current.play();
  setIsSafeMessagePlaying(true);
  setIsSafeMessagePaused(false);
}
 
function pauseSafeMessage() {
  safeMessageRef.current?.pause();
  setIsSafeMessagePaused(true);
}
function resumeSafeMessage() {
  safeMessageRef.current?.play();
  setIsSafeMessagePaused(false);
}



  // Stop audio when navigating away from the crisis page
  useEffect(() => {
    if (soothingAudio.audioRef.current) soothingAudio.audioRef.current.volume = volume;
    if (safeMessageRef.current) safeMessageRef.current.volume = volume;
  }, [volume, soothingAudio.audioRef]);

 useEffect(() => {
  return () => {
    stopSafeMessage();
    soothingAudio.stop();
  };
}, []);


  return (
    <main className="flex flex-col min-h-screen items-center justify-center gap-8 p-4 bg-gradient-to-br from-pink-200 via-fuchsia-100 to-violet-200">

      <h1 className="text-3xl font-bold text-red-600 mb-2 text-center drop-shadow">{t('crisisSupport')}</h1>
      <p className="text-center text-fuchsia-900 text-lg max-w-xl mb-4">{t('crisisDescription')}</p>
            {contact && (
        <div className="flex flex-col gap-2 mt-4">
          <a
            href={`https://wa.me/${contact.phone}?text=I%20need%20support%20right%20now`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded bg-green-200 text-green-900 font-semibold shadow inline-block text-center"
          >
            {t('messageWhatsApp').replace('{name}', contact.name)}
          </a>
          <a
            href={`sms:${contact.phone}?body=I%20need%20support%20right%20now`}
            className="px-6 py-3 rounded bg-blue-200 text-blue-900 font-semibold shadow inline-block text-center"
          >
            {t('messageSMS').replace('{name}', contact.name)}
          </a>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl justify-center items-stretch">
        <button
          className="flex-1 px-6 py-4 rounded-xl bg-fuchsia-100 text-fuchsia-900 font-semibold shadow border border-fuchsia-200 flex flex-col items-center gap-2 hover:bg-fuchsia-200 transition"
          onClick={() => setShowSoothing(true)}
          aria-label="Open soothing sounds modal"
        >
          <span className="text-3xl">🎵</span>
          <span>{t('soothingSounds')}</span>
        </button>
        <button
          className="flex-1 px-6 py-4 rounded-xl bg-blue-100 text-blue-900 font-semibold shadow border border-blue-200 flex flex-col items-center gap-2 hover:bg-blue-200 transition"
          onClick={() => setShowBreathing(true)}
        >
          <span className="text-3xl">🫧</span>
          <span>{t('breathingTimer')}</span>
        </button>
        <button
          className="flex-1 px-6 py-4 rounded-xl bg-yellow-100 text-yellow-900 font-semibold shadow border border-yellow-200 flex flex-col items-center gap-2 hover:bg-yellow-200 transition"
          onClick={() => setShowModal(true)}
        >
          <span className="text-3xl">🤝</span>
          <span>{t('contactSafePerson')}</span>
        </button>
        <button
          className="flex-1 px-6 py-4 rounded-xl bg-green-100 text-green-900 font-semibold shadow border border-green-200 flex flex-col items-center gap-2 hover:bg-green-200 transition"
          onClick={playSafeMessage}
          disabled={isSafeMessagePlaying}
        >
          <span className="text-3xl">🫂</span>
          <span>{t('playSafeMeditation')}</span>
        </button>
      </div>
      <SoothingAudioMiniPlayer
        {...soothingAudio}
        volume={volume}
        setVolume={setVolume}
        sound={
          soothingAudio.sound
            ? {
                ...soothingAudio.sound,
                icon: soothingAudio.sound.icon ?? "",
              }
            : null
        }
      />
      {(isSafeMessagePlaying || isSafeMessagePaused) && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-white/95 rounded-full shadow-2xl flex items-center px-6 py-3 gap-4 border-2 border-green-300 backdrop-blur-lg min-w-[280px] max-w-[95vw] transition-all">
          <span className="text-3xl" aria-label="Safe Message">🫂</span>
          <span className="font-semibold text-green-900 text-base">{t('safeMessageTitle')}</span>
          {isSafeMessagePaused ? (
            <button
              className="rounded-full p-2 bg-green-100 hover:bg-green-200"
              aria-label="Play"
              onClick={resumeSafeMessage}
            >
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M7 5v14l11-7L7 5z" fill="#15803d"/></svg>
            </button>
          ) : (
            <button
              className="rounded-full p-2 bg-green-100 hover:bg-green-200"
              aria-label="Pause"
              onClick={pauseSafeMessage}
            >
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="2" fill="#15803d"/><rect x="14" y="5" width="4" height="14" rx="2" fill="#15803d"/></svg>
            </button>
          )}
          <button
            className="rounded-full p-2 bg-green-100 hover:bg-green-200"
            aria-label="Stop"
            onClick={stopSafeMessage}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="3" fill="#15803d"/></svg>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={e => {
              setVolume(Number(e.target.value));
              if (safeMessageRef.current) safeMessageRef.current.volume = Number(e.target.value);
            }}
            aria-label="Volume"
            className="accent-green-400 w-24 h-2"
          />
        </div>
      )}
       <div className="mt-8">
        <Link href="/">
          <button className="mt-2 px-6 py-2 rounded bg-fuchsia-200 text-fuchsia-900 font-semibold shadow">{t('imOkTakeMeBack')}</button>
        </Link>
      </div>
      {showBreathing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-10 shadow-2xl w-full max-w-md flex flex-col items-center">
            <BreathingTimer cycles={3} onDone={() => setShowBreathing(false)} />
            <button
            className="mt-2 px-6 py-2 rounded bg-fuchsia-200 text-fuchsia-900 font-semibold shadow"
            onClick={() => setShowBreathing(false)}
            >
            {t('close')}
            
            </button>
        </div>
        </div>
        )}
{showModal && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 shadow-lg w-80">
      <h2 className="text-lg font-bold mb-2">
        {contact ? t('updateSafeContact') : t('addSafeContact')}
      </h2>
 {/*
      {contact && (
        <div className="flex items-center justify-between bg-yellow-50 rounded p-3 shadow mb-4">
           <div>
            <div className="font-semibold text-fuchsia-900">Safe Contact:</div>
            <div className="text-fuchsia-700">{contact.name} — {contact.phone}</div>
          </div>
          <button
            className="ml-4 px-3 py-1 rounded bg-fuchsia-200 text-fuchsia-900 font-semibold shadow hover:bg-fuchsia-300"
            onClick={() => {
              setName(contact.name);
              setPhone(contact.phone);
              // Modal is already open, so just update fields
            }}
          >
            Update
          </button> 
        </div> 
      )} */}
      <input
        className="w-full mb-2 px-2 py-1 border rounded"
        placeholder={t('namePlaceholder')}
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        className="w-full mb-2 px-2 py-1 border rounded"
        placeholder={t('phonePlaceholder')}
        value={phone}
        onChange={e => setPhone(e.target.value)}
      />
      <button
        className="w-full bg-green-500 text-white rounded py-2 mt-2"
        onClick={() => handleSaveContact(name, phone)}
        disabled={!name || !phone}
      >
        {t('saveContact')}
      </button>
      <button
        className="w-full mt-2 text-gray-500"
        onClick={() => setShowModal(false)}
      >
        {t('cancel')}
      </button>
    </div>
  </div>
)}
      {showSoothing && (
        <SoothingAudioModal
          open={showSoothing}
          onClose={() => {
            soothingAudio.stop();
            setShowSoothing(false);
          }}
          {...soothingAudio}
        />
      )}

    </main>
    
  );
}