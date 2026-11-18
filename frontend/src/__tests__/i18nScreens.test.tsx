import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ClosetPage from '../pages/ClosetPage';
import SettingsPage from '../pages/SettingsPage';
import ConfirmDetailsPage from '../pages/ConfirmDetailsPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import PremiumInterestNote from '../components/PremiumInterestNote';
import { ToastProvider } from '../components/Toast';
import { useLanguageStore } from '../i18n';
import { useAuthStore } from '../store/useAuthStore';
import { useBillingStore } from '../store/useBillingStore';
import { useClothingStore } from '../store/useClothingStore';
import { clothingService } from '../api/clothingService';
import { ClothingCategory, PersonaType, Plan } from '../types';
import { makeItem, makeUser } from '../test/fixtures';

// The screens of step 1 in Spanish: what is on them is Spanish (not a mix), and the same screens in English are unchanged (the rest of the
// test suite covers those).
vi.mock('../api/clothingService', () => ({
  clothingService: { getClothingItems: vi.fn(), createClothingItem: vi.fn(), updateClothingItem: vi.fn(), deleteClothingItem: vi.fn() },
}));
vi.mock('../api/billingService', () => ({
  billingService: {
    getStatus: vi.fn(async () => ({ enabled: false, plan: Plan.FREE, subscriptionStatus: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, canManage: false, priceLabel: null })),
    startCheckout: vi.fn(),
    openPortal: vi.fn(),
  },
}));
vi.mock('../api/premiumInterestService', () => ({
  premiumInterestService: { getState: vi.fn(async () => ({ requested: false, requestedAt: null })), request: vi.fn(), getAdminSummary: vi.fn() },
}));
vi.mock('../api/userService', () => ({
  userService: { updateProfile: vi.fn(), requestPasswordChange: vi.fn(), confirmPasswordChange: vi.fn(), requestEmailChange: vi.fn(), confirmEmailChange: vi.fn(), deleteAccount: vi.fn(), exportMyData: vi.fn(), confirmLegal: vi.fn() },
}));
vi.mock('../api/authService', () => ({ authService: { getCurrentUser: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() } }));
vi.mock('../components/FittingTool/UploadFlow', () => ({ default: () => null }));

const wrap = (node: React.ReactNode, entry = '/') => (
  <MemoryRouter initialEntries={[entry]}>
    <ToastProvider>{node}</ToastProvider>
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  useBillingStore.getState().reset();
  useAuthStore.getState().login('t', makeUser({ email: 'ada@example.com' }));
  useLanguageStore.getState().setLanguage('es');
});

describe('Spanish screens', () => {
  it('Settings: titles, fields, account rows, the Premium note and the delete/export block', async () => {
    render(wrap(<SettingsPage />, '/settings'));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AJUSTES');
    for (const heading of ['Perfil', 'Correo', 'Contraseña', 'Cuenta']) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Guardar perfil' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Enviar código' })).toHaveLength(2);
    expect(screen.getByText('Miembro desde')).toBeInTheDocument();
    expect(screen.getByText('Gratis')).toBeInTheDocument();
    expect(await screen.findByText('Premium llega pronto. ¿Lo quieres? Avísanos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /solicitar premium/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar mis datos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar mi cuenta y mis datos' })).toBeInTheDocument();
    // Nothing of the English screen is left behind.
    expect(document.body.textContent).not.toMatch(/Save Profile|Send Code|Download my data|Member since|Request Premium/);
  });

  it('the Premium request button in its three states, in Spanish', async () => {
    const { premiumInterestService } = await import('../api/premiumInterestService');
    vi.mocked(premiumInterestService.request).mockResolvedValue({ requested: true, requestedAt: '2026-11-18T10:00:00' });
    render(wrap(<PremiumInterestNote />));
    const button = await screen.findByRole('button', { name: 'Solicitar Premium' });
    button.click();
    expect(await screen.findByRole('button', { name: 'Solicitado' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Gracias, te avisaremos.');
  });

  it('Closet: title, search, filters and the category chips', async () => {
    useClothingStore.setState({ items: [], isLoading: false, error: null });
    vi.mocked(clothingService.getClothingItems).mockResolvedValue([
      makeItem({ itemId: 1, name: 'Linen Shirt', category: ClothingCategory.TOP, personaType: PersonaType.MALE }),
    ]);
    render(wrap(<ClosetPage />, '/closet'));
    await screen.findByText('Linen Shirt');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/MI\s*GUARDARROPA/);
    expect(screen.getByPlaceholderText('BUSCA EN TU COLECCIÓN...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solo favoritas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar prenda nueva' })).toBeInTheDocument();
    for (const chip of ['PARTE SUPERIOR', 'PARTE INFERIOR', 'CALZADO', 'ACCESORIOS', 'CHAQUETAS', 'VESTIDOS']) {
      expect(screen.getByRole('button', { name: chip }), chip).toBeInTheDocument();
    }
    expect(screen.getByText('Filtro de persona')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'HOMBRE' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Detalles de Linen Shirt' })).toBeInTheDocument();
    expect(screen.getByText('Usar')).toBeInTheDocument();
    // The garment's own name is the person's, never translated.
    expect(screen.getByText('Linen Shirt')).toBeInTheDocument();
  });

  it('Confirm details, forgot and reset password pages', async () => {
    useAuthStore.getState().login('t', makeUser({ ageBand: null, needsLegalConfirmation: true }));
    const confirm = render(wrap(<ConfirmDetailsPage />, '/confirm-details'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Confirma tus datos');
    expect(screen.getByRole('button', { name: /confirmar y continuar/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elimina mi cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mes')).toBeInTheDocument();
    confirm.unmount();

    const forgot = render(wrap(<ForgotPasswordPage />, '/forgot-password'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Restablecer contraseña');
    expect(screen.getByRole('button', { name: /enviar enlace/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a iniciar sesión/i })).toBeInTheDocument();
    forgot.unmount();

    render(wrap(<ResetPasswordPage />, '/reset-password?token=abc'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nueva contraseña');
    expect(screen.getByPlaceholderText('Al menos 8 caracteres')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actualizar contraseña/i })).toBeInTheDocument();
  });
});
