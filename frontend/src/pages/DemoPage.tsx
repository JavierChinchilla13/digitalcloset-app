import AvatarSection from '../sections/AvatarSection';
import ClosetSection from '../sections/ClosetSection';
import OutfitsSection from '../sections/OutfitsSection';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';

const DemoPage = () => {
  return (
    <div className="relative pb-20">
      {/* Demo Banner */}
      <div className="bg-accent py-3 text-center">
        <p className="text-[10px] font-black tracking-[0.4em] text-white">INTERACTIVE DEMO MODE — FEATURES ARE LIMITED</p>
      </div>

      <AvatarSection />
      
      {/* Floating CTA for Demo */}
      <div className="sticky top-28 z-40 flex justify-center pointer-events-none">
        <Link 
          to="/login"
          className="pointer-events-auto px-8 py-4 bg-white text-background-main font-black rounded-full shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all"
        >
          <LogIn size={18} />
          <span>ADD YOUR OWN CLOTHES</span>
        </Link>
      </div>

      <ClosetSection />
      <OutfitsSection />
    </div>
  );
};

export default DemoPage;
