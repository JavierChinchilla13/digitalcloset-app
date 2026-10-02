import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Shown for any URL that doesn't match a route (Task 22). Before this there was
// no catch-all route, so an unknown URL rendered the navbar over an empty page.
const NotFoundPage = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 max-w-md"
      >
        <p className="text-[10px] font-medium tracking-[0.4em] text-accent uppercase">Error 404</p>
        <h1 className="text-5xl font-light tracking-tighter uppercase text-text-primary">Page not found</h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 py-3 px-6 bg-ink text-background-main font-medium rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="text-xs tracking-widest uppercase">Back to home</span>
          <ArrowRight size={16} />
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
