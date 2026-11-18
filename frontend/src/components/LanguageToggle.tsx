import { useEffect, useRef, useState } from 'react';
import { Languages } from 'lucide-react';
import { useLanguageStore, useT } from '../i18n';

type Variant = 'menu' | 'row' | 'footer';

// The language button: shows the OTHER language ("Español" while the site is in English, "English" while it is in Spanish) and switches to it.
// A real <button> (Tab to it, Enter or Space), with a visible focus ring; its name says what pressing it does, in the language on screen, and
// the label itself is marked with the language it is written in (lang="es"/"en") so a screen reader pronounces it correctly. The change is
// announced once for the whole page by LanguageAnnouncer.
const styles: Record<Variant, string> = {
  // A row of the account dropdown (same look as its other rows).
  menu: 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-widest text-text-secondary hover:bg-ink/5 hover:text-text-primary transition-colors',
  // A row of the phone menu (48px tall).
  row: 'w-full flex items-center gap-4 min-h-12 px-4 rounded-2xl text-xs font-medium uppercase tracking-[0.2em] text-text-primary hover:bg-ink/5 active:bg-ink/10 transition-colors text-left',
  // The small toggle of the footer.
  footer:
    'inline-flex items-center gap-2 min-h-[44px] px-3 rounded-full text-[10px] uppercase tracking-widest hover:text-text-primary transition-colors',
};

const LanguageToggle = ({ variant = 'footer', onToggle }: { variant?: Variant; onToggle?: () => void }) => {
  const { t, language } = useT();
  const toggle = useLanguageStore((state) => state.toggleLanguage);
  const otherLanguage = language === 'en' ? 'es' : 'en';
  const otherName = t('lang.otherName');

  return (
    <button
      type="button"
      onClick={() => {
        toggle();
        onToggle?.();
      }}
      aria-label={t('lang.switchLabel', { language: otherName })}
      data-testid={`language-toggle-${variant}`}
      className={`${styles[variant]} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
    >
      <Languages size={variant === 'row' ? 18 : 14} aria-hidden />
      <span lang={otherLanguage}>{otherName}</span>
    </button>
  );
};

// One polite announcement per change ("Language changed to English" / "Idioma cambiado a español"), not on the first render.
export const LanguageAnnouncer = () => {
  const { t, language } = useT();
  const first = useRef(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setMessage(t('lang.changed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  return (
    <div role="status" aria-live="polite" className="sr-only" data-testid="language-announcer">
      {message}
    </div>
  );
};

export default LanguageToggle;
