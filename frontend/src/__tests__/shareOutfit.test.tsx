import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ShareOutfitModal from '../components/ShareOutfitModal';
import SharedOutfitPage from '../pages/SharedOutfitPage';
import { ToastProvider } from '../components/Toast';
import { useOutfitStore } from '../store/useOutfitStore';
import { useClothingStore } from '../store/useClothingStore';
import { useAuthStore } from '../store/useAuthStore';
import { outfitService } from '../api/outfitService';
import { publicOutfitService } from '../api/publicOutfitService';
import { ClothingCategory, PersonaType } from '../types';
import type { Outfit } from '../types';
import { makeItem, makeUser } from '../test/fixtures';

// Task 102: sharing an outfit as a picture and a public link, and the page behind the link.
vi.mock('../api/outfitService', () => ({
  outfitService: { shareOutfit: vi.fn(), unshareOutfit: vi.fn(), getOutfits: vi.fn() },
}));
vi.mock('../api/publicOutfitService', () => ({ publicOutfitService: { getByToken: vi.fn() } }));
// The canvas drawing is covered by outfitImage.test.ts; here the modal only needs "a picture came back".
vi.mock('../utils/outfitImage', () => ({
  renderOutfitToBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));
// The persona itself is not what these tests are about.
vi.mock('../components/PersonaRenderer', () => ({
  default: ({ items }: { items?: unknown[] }) => <div data-testid="persona" data-items={items?.length ?? 0} />,
}));

import { renderOutfitToBlob } from '../utils/outfitImage';

const service = vi.mocked(outfitService);
const publicService = vi.mocked(publicOutfitService);

const OUTFIT: Outfit = {
  outfitId: 7,
  name: 'Sunday look',
  avatarType: PersonaType.MALE,
  createdAt: '2026-10-01T10:00:00',
  items: [{ outfitItemId: 1, itemId: 1, slot: 'top', itemOrder: 0 }],
};

const renderModal = () =>
  render(
    <ToastProvider>
      <ShareOutfitModal outfitId={7} isOpen onClose={() => {}} />
    </ToastProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().login('token', makeUser());
  useClothingStore.setState({ items: [makeItem({ itemId: 1, category: ClothingCategory.TOP, personaType: PersonaType.MALE })] });
  useOutfitStore.setState({ outfits: [{ ...OUTFIT }] });
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

describe('the share dialog', () => {
  it('draws the picture and offers to download it', async () => {
    renderModal();

    expect(await screen.findByAltText(/sunday look on the figure/i)).toBeInTheDocument();
    expect(renderOutfitToBlob).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /download image/i })).toBeEnabled();
  });

  it('creates a public link, shows it, and copies it', async () => {
    service.shareOutfit.mockResolvedValue({ ...OUTFIT, shareToken: 'abc123tokenXYZ' });
    const user = userEvent.setup();
    // user-event installs its own clipboard on setup(); watch that one.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderModal();

    await user.click(screen.getByRole('button', { name: /create public link/i }));

    const field = await screen.findByLabelText('Public link');
    expect(service.shareOutfit).toHaveBeenCalledWith(7);
    expect((field as HTMLInputElement).value).toBe(`${window.location.origin}/s/abc123tokenXYZ`);

    await user.click(screen.getByRole('button', { name: /^copy$/i }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/abc123tokenXYZ`);
    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument();
  });

  it('turns the link off', async () => {
    useOutfitStore.setState({ outfits: [{ ...OUTFIT, shareToken: 'abc123tokenXYZ' }] });
    service.unshareOutfit.mockResolvedValue({ ...OUTFIT, shareToken: null });
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByLabelText('Public link')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /turn off link/i }));

    await waitFor(() => expect(screen.queryByLabelText('Public link')).not.toBeInTheDocument());
    expect(service.unshareOutfit).toHaveBeenCalledWith(7);
    expect(screen.getByRole('button', { name: /create public link/i })).toBeInTheDocument();
  });

  it('says so when the link cannot be created', async () => {
    service.shareOutfit.mockRejectedValue({ response: { status: 500, data: { message: 'Server is down' } } });
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /create public link/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByLabelText('Public link')).not.toBeInTheDocument();
  });

  it('still offers the link when the picture cannot be made', async () => {
    vi.mocked(renderOutfitToBlob).mockRejectedValueOnce(new Error('tainted'));
    renderModal();

    expect(await screen.findByText(/picture couldn't be created/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download image/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /create public link/i })).toBeInTheDocument();
  });

  it('offers the phone share sheet only when the browser can share files', async () => {
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole('button', { name: /^share$/i }));

    expect(share).toHaveBeenCalledTimes(1);
    const arg = (share.mock.calls[0] as unknown[])[0] as { files: File[]; title: string };
    expect(arg.files[0].type).toBe('image/png');
    expect(arg.files[0].name).toBe('sunday-look.png');
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
});

describe('the shared outfit page', () => {
  const renderPage = (path = '/s/tok123') =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/s/:token" element={<SharedOutfitPage />} />
        </Routes>
      </MemoryRouter>
    );

  const GARMENT = {
    itemId: 1,
    name: 'Shirt',
    category: ClothingCategory.TOP,
    imageUrl: 'https://img/x.png',
    personaType: PersonaType.MALE,
    transform: { x: 375, y: 420, scaleX: 1, scaleY: 1, rotation: 0, width: 300, height: 300 },
  };

  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('shows the outfit to a signed-out visitor, from the link data alone', async () => {
    publicService.getByToken.mockResolvedValue({
      name: 'Sunday look',
      avatarType: PersonaType.MALE,
      items: [{ itemId: 1, slot: 'top', itemOrder: 0 }],
      garments: [GARMENT],
    });
    renderPage();

    expect(await screen.findByRole('heading', { name: /sunday look/i })).toBeInTheDocument();
    expect(publicService.getByToken).toHaveBeenCalledWith('tok123');
    // The persona is drawn from the shared garments, not the visitor's closet.
    expect(screen.getByTestId('persona')).toHaveAttribute('data-items', '1');
    expect(screen.getByRole('link', { name: /make your own outfits/i })).toHaveAttribute('href', '/signup');
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });

  it('sends a signed-in visitor to their own closet instead of the sign-up page', async () => {
    useAuthStore.getState().login('token', makeUser());
    publicService.getByToken.mockResolvedValue({ name: 'Look', avatarType: PersonaType.MALE, items: [], garments: [] });
    renderPage();

    expect(await screen.findByRole('link', { name: /open your closet/i })).toHaveAttribute('href', '/showcase');
  });

  it('a link that was turned off is a friendly note, not an error', async () => {
    publicService.getByToken.mockRejectedValue({ response: { status: 404 } });
    renderPage();

    expect(await screen.findByText(/no longer shared/i)).toBeInTheDocument();
  });

  it('a network failure offers a retry', async () => {
    publicService.getByToken.mockRejectedValueOnce(new Error('offline'));
    publicService.getByToken.mockResolvedValue({ name: 'Look', avatarType: PersonaType.MALE, items: [], garments: [] });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('heading', { name: /look/i })).toBeInTheDocument();
  });
});
