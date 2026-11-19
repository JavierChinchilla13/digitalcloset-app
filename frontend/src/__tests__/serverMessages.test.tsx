import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import LoginPage from '../pages/LoginPage';
import { getApiErrorMessage } from '../utils/apiError';
import { KNOWN_MESSAGES, translateServerMessage } from '../utils/serverMessages';
import { dictionaries, useLanguageStore } from '../i18n';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../api/authService';

// The sentences the API sends are shown in Spanish when the site is in Spanish; English and unknown messages are shown as sent.
vi.mock('../api/authService', () => ({ authService: { login: vi.fn(), register: vi.fn(), getCurrentUser: vi.fn() } }));
const auth = vi.mocked(authService);

const FALLBACK = "Couldn't do that. Please try again.";
const http = (status: number, data: unknown) => ({ response: { status, data } });

// Messages that carry a field name or a number, with what they must become in Spanish.
const PATTERNS: Array<[english: string, spanish: string]> = [
  ['Name is required', 'El campo «Nombre» es obligatorio.'],
  ['Name is required.', 'El campo «Nombre» es obligatorio.'],
  ['Email is required', 'El campo «Correo electrónico» es obligatorio.'],
  ['Image URL is required', 'El campo «URL de la imagen» es obligatorio.'],
  ['Name must be at most 100 characters', '«Nombre» admite como máximo 100 caracteres.'],
  ['Description must be at most 255 characters.', '«Descripción» admite como máximo 255 caracteres.'],
  ['Display name must be at most 30 characters', '«Nombre para mostrar» admite como máximo 30 caracteres.'],
  ['Clothing item not found: 12', 'No encontramos esa prenda.'],
  ['Outfit not found: 7', 'No encontramos ese atuendo.'],
  ['Unauthorized to update this item', 'No tienes permiso para hacer esto.'],
  ['Unauthorized to use clothing item: 12', 'No tienes permiso para hacer esto.'],
  ['Unauthorized to share this outfit', 'No tienes permiso para hacer esto.'],
  ['Your free plan holds up to 15 garments. Delete a garment to add another.', 'Tu plan gratuito admite hasta 15 prendas. Elimina una prenda para agregar otra.'],
  ['Your plan holds up to 300 garments. Delete a garment to add another.', 'Tu plan admite hasta 300 prendas. Elimina una prenda para agregar otra.'],
];

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().logout();
  useLanguageStore.getState().setLanguage('es');
});

describe('server messages in Spanish', () => {
  it.each(KNOWN_MESSAGES.map(([english, key]) => [english, key] as const))('"%s" is shown in Spanish', (english, key) => {
    const spanish = dictionaries.es[key];
    expect(spanish).toBeTruthy();
    expect(spanish).not.toBe(english);
    // straight from the helper, and through a real failed request (a 400/401/403/409 with that message)
    expect(translateServerMessage(english)).toBe(spanish);
    expect(getApiErrorMessage(http(403, { message: english }), FALLBACK)).toBe(spanish);
    // ...and it is the Spanish text only, never the server's sentence next to it
    expect(getApiErrorMessage(http(403, { message: english }), FALLBACK)).not.toContain(english);
  });

  it.each(PATTERNS)('"%s" is shown in Spanish', (english, spanish) => {
    expect(getApiErrorMessage(http(400, { message: english }), FALLBACK)).toBe(spanish);
  });

  it('matching ignores case, spaces and a final full stop', () => {
    expect(translateServerMessage('  invalid EMAIL or   password. ')).toBe('Correo o contraseña incorrectos.');
  });

  it('a validation failure shows its first field reason in Spanish', () => {
    const err = http(400, { message: 'Validation failed', errors: { password: 'Password must be at least 8 characters' } });
    expect(getApiErrorMessage(err, FALLBACK)).toBe('La contraseña debe tener al menos 8 caracteres.');
  });

  it('a stable code wins over the wording: the garment limit is built from its limit and plan', () => {
    const free = http(403, { code: 'GARMENT_LIMIT', message: 'whatever the wording is', limit: 15, plan: 'FREE' });
    expect(getApiErrorMessage(free, FALLBACK)).toBe('Tu plan gratuito admite hasta 15 prendas. Elimina una prenda para agregar otra.');
    const premium = http(403, { code: 'GARMENT_LIMIT', message: 'x', limit: 300, plan: 'PREMIUM' });
    expect(getApiErrorMessage(premium, FALLBACK)).toBe('Tu plan admite hasta 300 prendas. Elimina una prenda para agregar otra.');
  });

  it('AGE_NOT_ALLOWED still has its own sentence', () => {
    const refusal = http(403, { code: 'AGE_NOT_ALLOWED', message: "We can't create an account with this information." });
    expect(getApiErrorMessage(refusal, FALLBACK)).toBe('No podemos crear una cuenta con esta información.');
  });

  it('a message it does not know is shown exactly as the server sent it', () => {
    expect(getApiErrorMessage(http(400, { message: 'Something brand new went wrong' }), FALLBACK)).toBe('Something brand new went wrong');
    expect(getApiErrorMessage(http(400, { message: 'Name is required for the moon' }), FALLBACK)).toBe('Name is required for the moon');
    // an unknown field name is not guessed at
    expect(getApiErrorMessage(http(400, { message: 'Shoe size is required' }), FALLBACK)).toBe('Shoe size is required');
  });

  it('the auth messages stay as generic as the English ones (no account enumeration)', () => {
    const text = translateServerMessage('Invalid email or password');
    expect(text).toBe('Correo o contraseña incorrectos.');
    expect(text.toLowerCase()).not.toMatch(/no existe|no encontr|solo (el|la)/);
  });

  it('the Spanish is informal (tú), never formal', () => {
    for (const [, key] of KNOWN_MESSAGES) expect(dictionaries.es[key]).not.toMatch(/\b(usted|ustedes)\b/i);
  });
});

describe('server messages in English', () => {
  beforeEach(() => useLanguageStore.getState().setLanguage('en'));

  it.each(KNOWN_MESSAGES.map(([english]) => [english] as const))('"%s" is shown exactly as sent', (english) => {
    expect(getApiErrorMessage(http(403, { message: english }), FALLBACK)).toBe(english);
  });

  it.each(PATTERNS)('"%s" is shown exactly as sent', (english) => {
    expect(getApiErrorMessage(http(400, { message: english }), FALLBACK)).toBe(english);
  });

  it('the garment limit keeps the server wording', () => {
    const err = http(403, { code: 'GARMENT_LIMIT', message: 'Your free plan holds up to 15 garments. Delete a garment to add another.', limit: 15, plan: 'FREE' });
    expect(getApiErrorMessage(err, FALLBACK)).toBe('Your free plan holds up to 15 garments. Delete a garment to add another.');
  });
});

describe('the login page', () => {
  function renderLogin() {
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('a wrong email or password is shown in Spanish in Spanish mode, and in English otherwise', async () => {
    auth.login.mockRejectedValue(http(401, { message: 'Invalid email or password' }));
    const user = userEvent.setup();
    const view = renderLogin();

    await user.type(screen.getByPlaceholderText('fashion@example.com'), 'nobody@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /iniciar sesión|entrar/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    view.unmount();

    useLanguageStore.getState().setLanguage('en');
    renderLogin();
    await user.type(screen.getByPlaceholderText('fashion@example.com'), 'nobody@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
