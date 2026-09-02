import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { useClothingStore } from './store/useClothingStore';
import MainLayout from './layouts/MainLayout';

// Real Pages
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import DemoPage from './pages/DemoPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OutfitBuilderPage from './pages/OutfitBuilderPage';
import FlatOutfitBuilderPage from './pages/FlatOutfitBuilderPage';
import SavedOutfitsPage from './pages/SavedOutfitsPage';
import ClosetPage from './pages/ClosetPage';
import PersonaPage from './pages/PersonaPage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? (children as React.ReactElement) : <Navigate to="/login" />;
};

function App() {
  const { isAuthenticated } = useAuthStore();
  const { fetchItems } = useClothingStore();

  // Load clothing items globally on mount to ensure persistent visibility across all components
  useEffect(() => {
    if (isAuthenticated) {
      fetchItems();
    }
  }, [isAuthenticated, fetchItems]);

  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Public Routes */}
          {/* Task 39, Phase 8 pivot: post-login landing is now the
              item-first flat builder rather than the persona-first
              DashboardPage, confirmed with the user 2026-09-01 (open
              question #8). DashboardPage isn't deleted - it stays
              reachable at /dashboard below. */}
          <Route path="/" element={isAuthenticated ? <FlatOutfitBuilderPage /> : <LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/demo" element={<DemoPage />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/closet" element={<ProtectedRoute><ClosetPage /></ProtectedRoute>} />
          <Route path="/outfits" element={<ProtectedRoute><SavedOutfitsPage /></ProtectedRoute>} />
          <Route path="/outfits/new" element={<ProtectedRoute><OutfitBuilderPage /></ProtectedRoute>} />
          <Route path="/outfits/edit/:id" element={<ProtectedRoute><OutfitBuilderPage /></ProtectedRoute>} />
          {/* Item-first builder (Task 36-39, Phase 8 pivot) - now the
              post-login landing at / above; these keep it directly
              addressable too (e.g. for editing from Saved Outfits). */}
          <Route path="/outfits/flat/new" element={<ProtectedRoute><FlatOutfitBuilderPage /></ProtectedRoute>} />
          <Route path="/outfits/flat/edit/:id" element={<ProtectedRoute><FlatOutfitBuilderPage /></ProtectedRoute>} />
          <Route path="/persona" element={<ProtectedRoute><PersonaPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
