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
          <Route path="/" element={isAuthenticated ? <DashboardPage /> : <LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/demo" element={<DemoPage />} />

          {/* Protected Routes */}
          <Route path="/closet" element={<ProtectedRoute><ClosetPage /></ProtectedRoute>} />
          <Route path="/outfits" element={<ProtectedRoute><SavedOutfitsPage /></ProtectedRoute>} />
          <Route path="/outfits/new" element={<ProtectedRoute><OutfitBuilderPage /></ProtectedRoute>} />
          <Route path="/outfits/edit/:id" element={<ProtectedRoute><OutfitBuilderPage /></ProtectedRoute>} />
          {/* Item-first builder (Task 36, Phase 8 pivot) - additive, doesn't
              replace the persona-based /outfits/new above yet. Re-routing
              the post-login landing here is Task 39, not this task. */}
          <Route path="/outfits/flat/new" element={<ProtectedRoute><FlatOutfitBuilderPage /></ProtectedRoute>} />
          <Route path="/persona" element={<ProtectedRoute><PersonaPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
