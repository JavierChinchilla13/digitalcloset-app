import { useEffect } from 'react';
import AvatarSection from '../sections/AvatarSection';
import ClosetSection from '../sections/ClosetSection';
import OutfitsSection from '../sections/OutfitsSection';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const DashboardPage = () => {
  const location = useLocation();

  useEffect(() => {
    // Handle INITIAL hash scrolling (e.g. landing on /#closet from another page)
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []); // Only run once on mount

  useEffect(() => {
    const sections = ['persona', 'closet', 'outfits'];
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px', // Trigger near top
      threshold: 0
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          // Update URL without triggering scroll event listeners or dispatching events
          // This keeps the URL in sync for the Navbar to read, without "dragging" the user
          window.history.replaceState(null, '', `/#${id}`);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-20 bg-background-main scroll-smooth"
    >
      <div id="persona">
        <AvatarSection />
      </div>
      
      <div id="closet">
        <ClosetSection />
      </div>
      
      <div id="outfits">
        <OutfitsSection />
      </div>
    </motion.div>
  );
};

export default DashboardPage;
