import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeStore, type ThemePreference } from '../store/useThemeStore';

// Task 67, Phase 9.6: one icon button that cycles System -> Light -> Dark.
// The icon shows the *preference* (a monitor means "following the device"),
// not the resolved theme, so the user can tell "System" apart from a manual
// choice that happens to match it.
const OPTIONS: Record<ThemePreference, { label: string; Icon: typeof Sun }> = {
  system: { label: 'System', Icon: Monitor },
  light: { label: 'Light', Icon: Sun },
  dark: { label: 'Dark', Icon: Moon },
};

const ThemeToggle = () => {
  const { preference, cyclePreference } = useThemeStore();
  const { label, Icon } = OPTIONS[preference];

  return (
    <button
      type="button"
      onClick={cyclePreference}
      className="p-2 rounded-full hover:bg-ink/5 text-text-secondary hover:text-text-primary transition-all"
      title={`Theme: ${label} (click to change)`}
      aria-label={`Theme: ${label}. Click to change.`}
    >
      <Icon size={16} />
    </button>
  );
};

export default ThemeToggle;
