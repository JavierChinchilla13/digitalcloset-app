import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// A password <input> with a show/hide toggle, used everywhere the app asks
// for a password (login, signup, reset, Settings, admin create-user). Each
// instance owns its own visibility state, so e.g. Settings' "current" and
// "new" password fields toggle independently of each other.
//
// Callers keep full control of the input's own styling via `className` (this
// app's password fields aren't all styled identically - the auth pages use a
// taller field with a left-aligned Lock icon, Settings/admin use a plainer
// one) - just leave room on the right for the toggle (pr-12 rather than the
// pr-6/pr-5 a plain field would use). `icon` renders an optional left icon
// the same way the auth pages already did inline, now shared here instead of
// duplicated per page.
interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

const PasswordInput = ({ icon: Icon, className, ...rest }: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative group">
      {Icon && (
        <Icon
          size={18}
          className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors pointer-events-none"
        />
      )}
      <input type={visible ? 'text' : 'password'} className={className} {...rest} />
      <button
        type="button"
        // Not a real form action and shouldn't take focus away from typing -
        // same reasoning as the show/hide buttons in most password fields.
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

export default PasswordInput;
