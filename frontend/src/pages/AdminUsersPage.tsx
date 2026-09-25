import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Search, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { adminService } from '../api/adminService';
import { useAuthStore } from '../store/useAuthStore';
import { useToast } from '../components/Toast';
import SectionWrapper from '../components/SectionWrapper';
import ErrorState from '../components/ErrorState';
import { Role, type User } from '../types';

// Admin-only account management (Task 22): list every user and deactivate or
// reactivate accounts, on the endpoints the backend already had. Reached only
// through the admin route guard (see ProtectedRoute's requireAdmin).
const AdminUsersPage = () => {
  const currentUserId = useAuthStore((state) => state.user?.userId);
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      setUsers(await adminService.getUsers());
    } catch (err) {
      console.error('Failed to load users:', err);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleActive = async (user: User) => {
    setBusyId(user.userId);
    try {
      const updated = user.active
        ? await adminService.deactivateUser(user.userId)
        : await adminService.reactivateUser(user.userId);
      setUsers((prev) => prev.map((u) => (u.userId === updated.userId ? updated : u)));
      showToast(`${user.email} ${updated.active ? 'reactivated' : 'deactivated'}`, 'success');
    } catch (err) {
      console.error('Failed to update user:', err);
      showToast(`Couldn't ${user.active ? 'deactivate' : 'reactivate'} ${user.email}`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.email, u.firstName, u.lastName].some((field) => field?.toLowerCase().includes(q))
    );
  }, [users, search]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background-main pt-24 pb-20">
      <SectionWrapper>
        <div className="space-y-4 mb-10">
          <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.3em] text-accent uppercase">
            <ShieldCheck size={14} /> Administration
          </p>
          <h1 className="text-6xl font-light tracking-tighter text-text-primary uppercase leading-none">
            USER <span className="text-accent">ACCOUNTS</span>
          </h1>
          <p className="text-text-secondary text-xs font-medium uppercase tracking-widest">
            {users.length} {users.length === 1 ? 'account' : 'accounts'}
          </p>
        </div>

        {isLoading ? (
          <div className="py-32 flex items-center justify-center">
            <Loader2 className="animate-spin text-accent" size={28} />
          </div>
        ) : loadFailed ? (
          <ErrorState
            title="We couldn't load the accounts"
            message="Check that the server is running and that you still have admin access, then try again."
            onRetry={loadUsers}
          />
        ) : (
          <>
            <div className="relative max-w-md mb-8">
              <Search
                className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary"
                size={16}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SEARCH BY NAME OR EMAIL"
                className="w-full bg-ink/5 border border-ink/10 rounded-2xl py-4 pl-12 pr-6 text-text-primary text-[10px] font-medium tracking-widest uppercase placeholder:text-ink/20 focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>

            {filtered.length === 0 ? (
              <p className="py-20 text-center text-text-secondary text-xs uppercase tracking-widest">
                No accounts match your search
              </p>
            ) : (
              <div className="space-y-3">
                {filtered.map((user) => {
                  const isSelf = user.userId === currentUserId;
                  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
                  return (
                    <motion.div
                      key={user.userId}
                      layout
                      className={`flex flex-col sm:flex-row sm:items-center gap-4 justify-between p-5 rounded-2xl border ${
                        user.active ? 'bg-background-secondary border-ink/5' : 'bg-ink/[0.02] border-ink/5 opacity-70'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-text-primary text-sm font-medium truncate">{user.email}</p>
                          {user.role === Role.ROLE_ADMIN && (
                            <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-medium tracking-widest uppercase">
                              Admin
                            </span>
                          )}
                          {!user.active && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[9px] font-medium tracking-widest uppercase">
                              Deactivated
                            </span>
                          )}
                          {isSelf && (
                            <span className="text-text-secondary text-[9px] tracking-widest uppercase">You</span>
                          )}
                        </div>
                        <p className="text-text-secondary text-[10px] tracking-widest uppercase">
                          {name ? `${name} // ` : ''}Joined {user.createdAt ? formatDate(user.createdAt) : 'unknown'}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleActive(user)}
                        disabled={isSelf || busyId === user.userId}
                        title={isSelf ? "You can't change your own account here" : undefined}
                        className={`shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[10px] font-medium tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          user.active
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-ink text-background-main hover:scale-[1.02]'
                        }`}
                      >
                        {busyId === user.userId ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : user.active ? (
                          <UserX size={14} />
                        ) : (
                          <UserCheck size={14} />
                        )}
                        {user.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </SectionWrapper>
    </div>
  );
};

export default AdminUsersPage;
