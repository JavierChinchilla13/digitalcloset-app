import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorState from '../components/ErrorState';

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-main flex flex-col">
      <Navbar />
      <main className="flex-grow pt-24">
        {/* Task 22: a page that crashes while rendering shows a recoverable
            error instead of a blank screen, and the navbar keeps working. It
            resets when the route changes, so leaving a crashed page never
            leaves the error stuck on the next one. */}
        <ErrorBoundary
          resetKeys={[location.pathname]}
          fallback={({ reset }) => (
            <ErrorState
              title="This page ran into a problem"
              message="Something went wrong while showing this page. You can try again, or head back home."
              onRetry={reset}
              secondaryLabel="Go home"
              onSecondary={() => navigate('/')}
            />
          )}
        >
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="py-12 border-t border-ink/5 text-center text-text-secondary text-sm">
        <p>© 2026 VYSVI. DESIGNED FOR THE FUTURE OF FASHION.</p>
      </footer>
    </div>
  );
};

export default MainLayout;
