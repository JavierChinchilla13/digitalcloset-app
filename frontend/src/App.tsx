import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { authService } from './api/authService';
import { useClothingStore } from './store/useClothingStore';
import { usePersonaSettingsStore } from './store/usePersonaSettingsStore';
import MainLayout from './layouts/MainLayout';

// Real Pages
import LandingPage from './pages/LandingPage';
import DemoPage from './pages/DemoPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminUsersPage from './pages/AdminUsersPage';
import FlatOutfitBuilderPage from './pages/FlatOutfitBuilderPage';
import SavedOutfitsPage from './pages/SavedOutfitsPage';
import ClosetPage from './pages/ClosetPage';
import PersonaPage from './pages/PersonaPage';
import CategoriesPage from './pages/CategoriesPage';
import CategoryDetailPage from './pages/CategoryDetailPage';
import OutfitShowcasePage from './pages/OutfitShowcasePage';
import SettingsPage from './pages/SettingsPage';

// Task 22: role-aware route guard. Signed-out visitors go to /login; with
// requireAdmin, signed-in non-admins are sent home instead (they have no
// business on an admin page, and the backend would refuse its requests
// anyway - @PreAuthorize is the real enforcement, this just avoids showing
// a page that can only fail). isAdmin comes from the role on the last login.
const ProtectedRoute = ({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) => {
  const { isAuthenticated, isAdmin } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
  return children as React.ReactElement;
};

function App() {
  const { isAuthenticated } = useAuthStore();
  const { fetchItems } = useClothingStore();
  const fetchDisplayNames = usePersonaSettingsStore((state) => state.fetchDisplayNames);

  // Task 97: refresh the account when the app opens. The user kept from sign-in can be out of date (the
  // plan was changed by an admin, or the session predates a field such as the plan / garment limit), and
  // the plan decides the garment limit and whether ads show. A failure is ignored: the kept copy is used.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    authService
      .getCurrentUser()
      .then((fresh) => {
        const token = useAuthStore.getState().token;
        if (!cancelled && token) useAuthStore.getState().login(token, fresh);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Load clothing items globally on mount to ensure persistent visibility across all components
  useEffect(() => {
    if (isAuthenticated) {
      fetchItems();
      // Task 77: the persona sign on every garment card uses the user's custom
      // persona names, so load them once here rather than page by page.
      fetchDisplayNames();
    }
  }, [isAuthenticated, fetchItems, fetchDisplayNames]);

  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Public Routes */}
          {/* "/" is the item-first Attire builder for signed-in users and the
              marketing page for visitors. (Where login lands is decided by
              LoginPage / SignupPage, not here.) */}
          <Route path="/" element={isAuthenticated ? <FlatOutfitBuilderPage /> : <LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/demo" element={<DemoPage />} />

          {/* Protected Routes */}
          <Route path="/closet" element={<ProtectedRoute><ClosetPage /></ProtectedRoute>} />
          <Route path="/outfits" element={<ProtectedRoute><SavedOutfitsPage /></ProtectedRoute>} />
          {/* Item-first builder (Task 36-39, Phase 8 pivot) - also served at "/"
              above; these keep it directly addressable (e.g. for editing from
              Saved Outfits). */}
          <Route path="/outfits/flat/new" element={<ProtectedRoute><FlatOutfitBuilderPage /></ProtectedRoute>} />
          <Route path="/outfits/flat/edit/:id" element={<ProtectedRoute><FlatOutfitBuilderPage /></ProtectedRoute>} />
          <Route path="/persona" element={<ProtectedRoute><PersonaPage /></ProtectedRoute>} />
          {/* Categories experience (Task 48-51, Phase 9) */}
          <Route path="/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
          <Route path="/categories/:id" element={<ProtectedRoute><CategoryDetailPage /></ProtectedRoute>} />
          {/* Task 75, Phase 9.7 / Task 90: where login and signup land (and the
              signed-in navbar logo goes) - "/" itself stays the Attire builder. */}
          <Route path="/showcase" element={<ProtectedRoute><OutfitShowcasePage /></ProtectedRoute>} />
          {/* Task 22: admin-only account management. */}
          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminUsersPage /></ProtectedRoute>} />
          {/* Task 79: name/email/password/deactivate, reached from UserMenu. */}
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          {/* Pages that were removed (the old dashboard and the persona-first
              outfit builder): old bookmarks land on their replacements. */}
          <Route path="/dashboard" element={<Navigate to="/showcase" replace />} />
          <Route path="/outfits/new" element={<Navigate to="/outfits/flat/new" replace />} />
          {/* Task 22: anything unmatched gets a real 404 page. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
