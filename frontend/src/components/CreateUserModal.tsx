import { useState } from 'react';
import { Loader2, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { adminService } from '../api/adminService';
import PasswordInput from './PasswordInput';
import ModalShell from './ModalShell';
import { Role, type User } from '../types';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (user: User) => void;
}

// Task 79: the only place an account can be given ROLE_ADMIN - only reachable
// from the Admin page, which is itself admin-only. Modal chrome matches
// EditClothingModal/DeleteConfirmationModal's existing conventions.
const CreateUserModal = ({ isOpen, onClose, onCreated }: CreateUserModalProps) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(Role.ROLE_USER);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clears the form back to its defaults.
  const reset = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setRole(Role.ROLE_USER);
    setError(null);
  };

  // Closing is ignored while a save is in flight, so a half-sent request can't be abandoned.
  const handleClose = () => {
    if (isSaving) return;
    reset();
    onClose();
  };

  // Creates the account through the admin endpoint and hands it back to the page's user list.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const created = await adminService.createUser({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        role,
      });
      onCreated(created);
      reset();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create account');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={handleClose} className="max-w-md bg-background-secondary border border-ink/5 rounded-2xl shadow-lg" backdropClassName="bg-background-main/90 backdrop-blur-sm">
            <div className="p-8">
              <h2 className="text-2xl font-light tracking-tight text-text-primary mb-1">Create Account</h2>
              <p className="text-text-secondary text-[10px] font-medium tracking-widest uppercase opacity-50 mb-8">
                Only admins can create admins
              </p>

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-[10px] font-medium uppercase tracking-widest text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-ink/[0.02] border border-ink/5 rounded-xl text-text-primary placeholder:text-text-secondary/50 text-sm focus:outline-none focus:border-accent/50"
                  />
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-ink/[0.02] border border-ink/5 rounded-xl text-text-primary placeholder:text-text-secondary/50 text-sm focus:outline-none focus:border-accent/50"
                  />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  disabled={isSaving}
                  className="w-full px-4 py-3 bg-ink/[0.02] border border-ink/5 rounded-xl text-text-primary placeholder:text-text-secondary/50 text-sm focus:outline-none focus:border-accent/50"
                />
                <PasswordInput
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min. 8 characters)"
                  disabled={isSaving}
                  className="w-full pl-4 pr-12 py-3 bg-ink/[0.02] border border-ink/5 rounded-xl text-text-primary placeholder:text-text-secondary/50 text-sm focus:outline-none focus:border-accent/50"
                />

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {([Role.ROLE_USER, Role.ROLE_ADMIN] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      disabled={isSaving}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest ${
                        role === r ? 'bg-accent/10 border-accent text-text-primary' : 'bg-ink/[0.02] border-ink/5 text-text-secondary hover:border-ink/20'
                      }`}
                    >
                      {r === Role.ROLE_ADMIN ? <ShieldCheck size={14} /> : <UserIcon size={14} />}
                      {r === Role.ROLE_ADMIN ? 'Admin' : 'User'}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-4 bg-accent hover:bg-accent-hover text-on-accent text-xs font-medium uppercase tracking-[0.2em] rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Create Account'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSaving}
                    className="w-full py-4 bg-ink/5 hover:bg-ink/10 text-text-secondary hover:text-text-primary text-xs font-medium uppercase tracking-[0.2em] rounded-full transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>

            <button
              onClick={handleClose}
              disabled={isSaving}
              className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={20} />
            </button>
          </ModalShell>
  );
};

export default CreateUserModal;
