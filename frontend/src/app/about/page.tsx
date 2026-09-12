'use client'
import React from "react";
import { useTranslation } from "../../hooks/useTranslation";
import Link from "next/link";

export default function AboutPage() {
  const { t } = useTranslation();
  return (
    <main className="flex flex-col min-h-screen items-center justify-center gap-10 p-4 bg-gradient-to-br from-pink-200 via-fuchsia-100 to-violet-200">
      <section className="w-full max-w-xl bg-white/90 rounded-3xl shadow-lg p-10 mt-12 mb-8 border border-fuchsia-100">
        <h1 className="text-4xl font-extrabold mb-6 text-fuchsia-700 text-center drop-shadow-sm tracking-tight">{t('aboutTitle')}</h1>
        <p className="mb-6 text-lg text-fuchsia-800 whitespace-pre-line leading-relaxed text-center">{t('aboutHonest')}</p>
        <h2 className="text-2xl font-extrabold mb-6 text-fuchsia-700 text-center">{t('aboutSupportTitle')}</h2>
        <p className="mb-2 text-fuchsia-800 text-center">{t('aboutContribute')}</p>
        <p className="mb-4 text-center">
          <a href={t('aboutGithub')} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-900 transition">{t('aboutGithub')}</a>
        </p>
        <p className="mb-2 text-fuchsia-800 text-center">{t('aboutDonate')}</p>
        <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-center items-center">
          <a
            href="https://link.mercadopago.com.ar/intu"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="MercadoPago"
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-100 via-blue-50 to-fuchsia-50 px-6 py-2 text-base font-medium text-blue-900 shadow hover:from-blue-200 hover:to-fuchsia-100 focus:outline-none focus:ring-2 focus:ring-blue-300 border border-blue-400 border-opacity-80 transition"
          >
            <span role="img" aria-label="MercadoPago">💙</span> {t('aboutMercadoPago')}
          </a>
          <a
            href="https://www.paypal.com/donate/?hosted_button_id=LJWDFCNPND8LG"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="PayPal"
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-100 via-yellow-50 to-fuchsia-50 px-6 py-2 text-base font-medium text-yellow-900 shadow hover:from-yellow-200 hover:to-fuchsia-100 focus:outline-none focus:ring-2 focus:ring-yellow-300 border border-yellow-400 border-opacity-80 transition"
          >
            <span role="img" aria-label="PayPal">💛</span> {t('aboutPaypal')}
          </a>
        </div>
        <p className="text-fuchsia-800 text-base mt-10 text-center">{t('aboutThanks')}</p>
        <div className="flex justify-center mt-10">
          <Link href="/" tabIndex={0}>
            <button
              className="mt-2 px-6 py-2 rounded bg-fuchsia-200 text-fuchsia-900 font-semibold shadow"
              style={{ boxShadow: '0 2px 8px 0 rgba(200, 100, 255, 0.06)' }}
            >
              <span aria-hidden="true">← </span>{t('back')}
            </button>
          </Link>
        </div>
      </section>
    </main>
  );
}
