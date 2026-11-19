import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import NotFoundPage from '../pages/NotFoundPage';
import PersonaPage from '../pages/PersonaPage';
import DemoPage from '../pages/DemoPage';
import SavedOutfitsPage from '../pages/SavedOutfitsPage';
import CategoriesPage from '../pages/CategoriesPage';
import OutfitShowcasePage from '../pages/OutfitShowcasePage';
import FlatOutfitBuilderPage from '../pages/FlatOutfitBuilderPage';
import ErrorState from '../components/ErrorState';
import FirstRunPanel from '../components/FirstRunPanel';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import StorageLimitModal from '../components/StorageLimitModal';
import UploadFlow from '../components/FittingTool/UploadFlow';
import { ToastProvider } from '../components/Toast';
import { useLanguageStore } from '../i18n';
import { useAuthStore } from '../store/useAuthStore';
import { useOutfitStore } from '../store/useOutfitStore';
import { useClothingStore } from '../store/useClothingStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { useOutfitDraftStore } from '../store/useOutfitDraftStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { outfitService } from '../api/outfitService';
import { clothingService } from '../api/clothingService';
import { userService } from '../api/userService';
import { ClothingCategory, PersonaType } from '../types';
import { makeItem, makeUser } from '../test/fixtures';

// Step 2: the rest of the app in Spanish. What is on each screen is Spanish (not a mix), and the English screens are unchanged (the
// rest of the test suite covers those).
vi.mock('../api/userService', () => ({
  userService: { getMe: vi.fn(), setMainOutfit: vi.fn(), clearMainOutfit: vi.fn() },
}));
vi.mock('../api/outfitService', () => ({
  outfitService: { getOutfits: vi.fn(), createOutfit: vi.fn(), updateOutfit: vi.fn(), deleteOutfit: vi.fn() },
}));
vi.mock('../api/clothingService', () => ({
  clothingService: { getClothingItems: vi.fn(), createClothingItem: vi.fn(), updateClothingItem: vi.fn(), deleteClothingItem: vi.fn() },
}));
vi.mock('../api/collectionService', () => ({ collectionService: { getCollections: vi.fn(async () => []) } }));
vi.mock('../api/personaDisplayNameService', () => ({
  personaDisplayNameService: { getAll: vi.fn(async () => []), upsert: vi.fn(), reset: vi.fn() },
}));
vi.mock('../api/billingService', () => ({
  billingService: { getStatus: vi.fn(async () => ({ enabled: false, plan: 'FREE', subscriptionStatus: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, canManage: false, priceLabel: null })), startCheckout: vi.fn(), openPortal: vi.fn() },
}));
vi.mock('../api/premiumInterestService', () => ({
  premiumInterestService: { getState: vi.fn(async () => ({ requested: false, requestedAt: null })), request: vi.fn(), getAdminSummary: vi.fn() },
}));

const realMatchMedia = window.matchMedia;
function setViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 1024px') ? wide : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

const wrap = (node: React.ReactNode, entry = '/') => (
  <MemoryRouter initialEntries={[entry]}>
    <ToastProvider>{node}</ToastProvider>
  </MemoryRouter>
);

beforeEach(() => {
  setViewport(false);
  vi.clearAllMocks();
  useAuthStore.getState().login('t', makeUser({ email: 'ada@example.com' }));
  useOutfitStore.setState({ outfits: [], mainOutfitId: null, isLoading: false, error: null });
  useClothingStore.setState({ items: [], isLoading: false, error: null });
  useCollectionStore.setState({ collections: [], isLoading: false, error: null });
  useOutfitDraftStore.getState().clearDraft();
  usePersonaStore.getState().setPersonaType(PersonaType.FEMALE);
  vi.mocked(outfitService.getOutfits).mockResolvedValue([]);
  vi.mocked(clothingService.getClothingItems).mockResolvedValue([
    makeItem({ itemId: 1, name: 'Linen Shirt', category: ClothingCategory.TOP, personaType: PersonaType.FEMALE }),
  ]);
  vi.mocked(userService.getMe).mockResolvedValue({ mainOutfitId: null } as never);
  useLanguageStore.getState().setLanguage('es');
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe('Spanish: the rest of the app', () => {
  it('the 404 page and the generic error state', () => {
    const notFound = render(wrap(<NotFoundPage />));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Página no encontrada');
    expect(screen.getByRole('link', { name: /volver al inicio/i })).toBeInTheDocument();
    notFound.unmount();

    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByText('No pudimos completar esta acción')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /intentar de nuevo/i })).toBeInTheDocument();
  });

  it('the Persona page', () => {
    render(wrap(<PersonaPage />));
    expect(screen.getByText('Elige la silueta base')).toBeInTheDocument();
    expect(screen.getByText('Volver a Atuendo')).toBeInTheDocument();
    expect(screen.getAllByTitle('Renombrar').length).toBeGreaterThan(0);
  });

  it('the first-run guide, the delete dialog and the "closet is full" dialog', () => {
    useClothingStore.setState({ items: [], isLoading: false, error: null });
    const guide = render(wrap(<FirstRunPanel />));
    // (the guide only shows for a brand-new account; with none of its conditions it renders nothing - what matters is that it does not throw)
    guide.unmount();

    render(wrap(<DeleteConfirmationModal itemId={1} itemName="Linen Shirt" isOpen onClose={() => {}} />));
    expect(screen.getByText('¿Eliminar prenda?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar eliminación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('the storage limit dialog', async () => {
    useAuthStore.getState().login('t', makeUser({ garmentLimit: 15 }));
    useClothingStore.setState({ items: Array.from({ length: 15 }, (_, i) => makeItem({ itemId: i + 1 })), isLoading: false, error: null });
    render(wrap(<StorageLimitModal isOpen onClose={() => {}} />));
    expect(await screen.findByText('Tu clóset está lleno')).toBeInTheDocument();
    expect(screen.getByText('Has usado 15 de 15 prendas. Elimina una prenda para agregar otra.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entendido' })).toBeInTheDocument();
  });

  it('Saved outfits (empty) and Categories (empty)', async () => {
    const saved = render(wrap(<SavedOutfitsPage />));
    expect(await screen.findByText('Tu colección está vacía')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir el creador/i })).toBeInTheDocument();
    saved.unmount();

    render(wrap(<CategoriesPage />));
    expect(await screen.findByText('Aún no hay categorías')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('BUSCAR CATEGORÍAS...')).toBeInTheDocument();
    expect(screen.getByText(/0 categorías/)).toBeInTheDocument();
  });

  it('the Showcase with no outfits', async () => {
    render(wrap(<OutfitShowcasePage />));
    expect(await screen.findByText('Guarda tu primer atuendo y será la estrella aquí.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comencemos/i })).toBeInTheDocument();
    // The first-run guide shows under it, in Spanish too.
    expect(screen.getByRole('region', { name: 'Primeros pasos' })).toBeInTheDocument();
    expect(screen.getByText('Agrega algunas prendas')).toBeInTheDocument();
  });

  it('the builder: panels, buttons, default name and tabs', async () => {
    render(
      wrap(
        <Routes>
          <Route path="/outfits/flat/new" element={<FlatOutfitBuilderPage />} />
        </Routes>,
        '/outfits/flat/new'
      )
    );
    await screen.findByText('Linen Shirt');

    expect(screen.getByRole('tab', { name: 'Clóset' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Atuendo (0)' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ESCRIBE EL NOMBRE DEL ESTILO')).toHaveValue('Nuevo estilo');
    expect(screen.getByRole('button', { name: 'Crear atuendo aleatorio' })).toBeInTheDocument();
    expect(screen.getByText('Parte superior')).toBeInTheDocument();
  });

  it('the demo: tabs, badge and the sign-up gate', async () => {
    const user = userEvent.setup();
    render(wrap(<DemoPage />));
    expect(screen.getByText('0 prendas seleccionadas')).toBeInTheDocument();
    expect(screen.getByText('Demo · no se guarda nada')).toBeInTheDocument();

    await user.click(screen.getAllByLabelText('Agregar prenda')[0]);
    expect(await screen.findByText('Crea una cuenta gratis para agregar tu propia ropa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /crear cuenta gratis/i })).toBeInTheDocument();
  });

  it('the upload flow opens in Spanish', () => {
    render(wrap(<UploadFlow isOpen onClose={() => {}} />));
    expect(screen.getByText('Paso 1 — Recepción inicial')).toBeInTheDocument();
    expect(screen.getByText('Seleccionar imagen')).toBeInTheDocument();
  });

  it('the same screens in English are unchanged', () => {
    useLanguageStore.getState().setLanguage('en');
    render(wrap(<NotFoundPage />));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
  });
});
