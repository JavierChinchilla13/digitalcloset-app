import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';

// Task 67 / Task 82: one icon button that flips between light and dark. The
// icon always matches the theme on screen (the device's setting when the app
// first opens, then whatever the user last picked) - there is no "system"
// state to decode.
const ThemeToggle = () => {
  const { resolved, togglePreference } = useThemeStore();
  const Icon = resolved === 'dark' ? Moon : Sun;
  const label = resolved === 'dark' ? 'Dark' : 'Light';

  return (
    <button
      type="button"
      onClick={togglePreference}
      className="p-2 rounded-full hover:bg-ink/5 text-text-secondary hover:text-text-primary transition-all"
      title={`Theme: ${label} (click to change)`}
      aria-label={`Theme: ${label}. Click to change.`}
    >
      <Icon size={16} />
    </button>
  );
};

export default ThemeToggle;
