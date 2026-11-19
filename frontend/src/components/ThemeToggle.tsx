import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { useT } from '../i18n';

// Task 67 / Task 82: one icon button that flips between light and dark. The
// icon always matches the theme on screen (the device's setting when the app
// first opens, then whatever the user last picked) - there is no "system"
// state to decode.
const ThemeToggle = () => {
  const { resolved, togglePreference } = useThemeStore();
  const Icon = resolved === 'dark' ? Moon : Sun;
  const { t } = useT();
  const label = resolved === 'dark' ? t('theme.dark') : t('theme.light');

  return (
    <button
      type="button"
      onClick={togglePreference}
      className="p-2.5 sm:p-2 rounded-full hover:bg-ink/5 text-text-secondary hover:text-text-primary transition-all"
      title={t('theme.title', { theme: label })}
      aria-label={t('theme.label', { theme: label })}
    >
      <Icon size={16} />
    </button>
  );
};

export default ThemeToggle;
