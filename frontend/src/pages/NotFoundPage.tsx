import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useT } from '../i18n';

// Shown for any URL that doesn't match a route (Task 22). Before this there was
// no catch-all route, so an unknown URL rendered the navbar over an empty page.
const NotFoundPage = () => {
  const { t } = useT();
  // Home is the Showcase for a signed-in user and the landing page for a visitor.
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return (
    <div className="min-h-[60dvh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 max-w-md"
      >
        <p className="text-[10px] font-medium tracking-[0.4em] text-accent uppercase">{t('notfound.code')}</p>
        <h1 className="text-5xl font-light tracking-tighter uppercase text-text-primary">{t('notfound.title')}</h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          {t('notfound.body')}
        </p>
        <Link
          to={isAuthenticated ? '/showcase' : '/'}
          className="inline-flex items-center gap-2 py-3 px-6 bg-ink text-background-main font-medium rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="text-xs tracking-widest uppercase">{t('notfound.home')}</span>
          <ArrowRight size={16} />
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
