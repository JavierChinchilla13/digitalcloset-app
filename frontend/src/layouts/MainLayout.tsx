import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-background-main flex flex-col">
      <Navbar />
      <main className="flex-grow pt-24">
        <Outlet />
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-text-secondary text-sm">
        <p>© 2026 DIGITAL CLOSET. DESIGNED FOR THE FUTURE OF FASHION.</p>
      </footer>
    </div>
  );
};

export default MainLayout;
