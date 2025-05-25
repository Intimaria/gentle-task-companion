import { useEffect, useState } from 'react';

interface Translations {
  [key: string]: string;
}

export function useTranslation() {
  const [locale, setLocale] = useState('en');
  const [translations, setTranslations] = useState<{ [locale: string]: Translations }>({});

  useEffect(() => {
    // Detect browser language
    const browserLang = navigator.language.split('-')[0];
    const supportedLang = ['en', 'es'].includes(browserLang) ? browserLang : 'en';
    setLocale(supportedLang);
  }, []);

  useEffect(() => {
    // Load translations for both languages
    const loadTranslations = async () => {
      try {
        const [enResponse, esResponse] = await Promise.all([
          fetch('/locales/en/common.json'),
          fetch('/locales/es/common.json')
        ]);
        
        const [enData, esData] = await Promise.all([
          enResponse.json(),
          esResponse.json()
        ]);

        setTranslations({
          en: enData,
          es: esData
        });
      } catch (error) {
        console.error('Failed to load translations:', error);
        // Fallback translations
        setTranslations({
          en: {
            safeMessage: "You are safe. This moment will pass.",
            crisisButton: "Crisis",
            chooseTasks: "Choose three tasks",
            todaysTasks: "Today's Tasks",
            addTask: "Add",
            mood: "Mood",
            gratitude: "Gratitude",
            addGratitude: "Add",
            completedTasks: "Completed Tasks",
            close: "Close",
            history: "History",
            nonVerbalCueCards: "Communication Cards",
            useCardToCommunicate: "Use one of these cards to help communicate your needs.",
            back: "Back",
            needBreak: "I need a break",
            hugMe: "Hug me",
            talkLater: "Can we talk later?",
            overwhelmed: "I'm overwhelmed",
            sitWithMe: "Please sit with me",
            noTalking: "No talking, just company",
            safeMessageAudio: "safe-message.mp3"
          },
          es: {
            safeMessage: "Estás a salvo. Este momento pasará.",
            crisisButton: "Crisis",
            chooseTasks: "Elige tres tareas",
            todaysTasks: "Tareas de hoy",
            addTask: "Agregar",
            mood: "Ánimo",
            gratitude: "Gratitud",
            addGratitude: "Agregar",
            completedTasks: "Tareas completadas",
            close: "Cerrar",
            history: "Historial",
            nonVerbalCueCards: "Tarjetas de comunicación no verbal",
            useCardToCommunicate: "Usa una de estas tarjetas para comunicar tus necesidades.",
            back: "Atrás",
            needBreak: "Necesito un descanso",
            hugMe: "Abrázame",
            talkLater: "¿Podemos hablar más tarde?",
            overwhelmed: "Me siento abrumado/a",
            sitWithMe: "Por favor siéntate conmigo",
            noTalking: "Sin hablar, solo compañía",
            safeMessageAudio: "safe-message-es.mp3"
          }
        });
      }
    };

    loadTranslations();
  }, []);

  const t = (key: string, vars?: Record<string, string>): string => {
    let str = translations[locale]?.[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`{${k}}`, 'g'), v);
      });
    }
    return str;
  };

  return { t, locale, setLocale };
}
