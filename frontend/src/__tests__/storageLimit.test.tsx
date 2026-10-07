import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ClosetPage from '../pages/ClosetPage';
import UploadFlow from '../components/FittingTool/UploadFlow';
import { ToastProvider } from '../components/Toast';
import { useClothingStore } from '../store/useClothingStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { useAuthStore } from '../store/useAuthStore';
import { clothingService } from '../api/clothingService';
import { collectionService } from '../api/collectionService';
import { cloudinaryService } from '../api/cloudinaryService';
import { bgRemovalService } from '../lib/background-removers';
import { computeStorage } from '../utils/storage';
import { Plan, Role } from '../types';
import type { ClothingItem } from '../types';
import { makeItems, makeUser } from '../test/fixtures';

// Task 96: garment limits - 15 free, 300 paying, none for admins. The server enforces them;
// the client says so up front, before any photo is uploaded.
vi.mock('../api/clothingService', () => ({
  clothingService: { getClothingItems: vi.fn(), createClothingItem: vi.fn(), updateClothingItem: vi.fn(), deleteClothingItem: vi.fn() },
}));
vi.mock('../api/collectionService', () => ({ collectionService: { getCollections: vi.fn(), addItemToCollection: vi.fn() } }));
vi.mock('../api/cloudinaryService', () => ({ cloudinaryService: { uploadImage: vi.fn() } }));
vi.mock('../lib/background-removers', () => ({
  bgRemovalService: { removeBackground: vi.fn() },
  optimizeImage: vi.fn(async (file: File) => file),
}));
vi.mock('../utils/segmentationService', () => ({ segmentationService: {} }));
vi.mock('../components/FittingTool/FittingEditor', () => ({ default: () => null }));
vi.mock('../components/FittingTool/JacketSegmentationTool', () => ({ default: () => null }));
vi.mock('../components/FittingTool/JacketFittingEditor', () => ({ default: () => null }));
vi.mock('../components/FittingTool/GarmentCleanup', () => ({ default: () => null }));
// The shoe steps are replaced by buttons that take the path a user would, and hand over what the
// real editor would: here a pair with both feet kept.
vi.mock('../components/FittingTool/ShoeSymmetryCheck', () => ({
  default: ({ onSelect }: { onSelect: (different: boolean) => void }) => <button onClick={() => onSelect(false)}>mirror this shoe</button>,
}));
vi.mock('../components/FittingTool/ShoeFittingEditor', () => ({
  default: ({ onSave }: { onSave: (data: unknown) => void }) => (
    <button
      onClick={() =>
        onSave({
          name: 'Runner',
          description: '',
          leftTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          rightTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          skipLeft: false,
          skipRight: false,
        })
      }
    >
      save pair
    </button>
  ),
}));

const clothing = vi.mocked(clothingService);
const cloudinary = vi.mocked(cloudinaryService);
const collections = vi.mocked(collectionService);
const bgRemoval = vi.mocked(bgRemovalService);

const FREE = makeUser();
const PREMIUM = makeUser({ plan: Plan.PREMIUM, garmentLimit: 300 });
const ADMIN = makeUser({ role: Role.ROLE_ADMIN, garmentLimit: null });

function setSession(user = FREE, count = 0) {
  useAuthStore.getState().login('token', user);
  useClothingStore.setState({ items: makeItems(count), isLoading: false, error: null });
  clothing.getClothingItems.mockResolvedValue(makeItems(count));
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().logout();
  useCollectionStore.setState({ collections: [], isLoading: false, error: null });
  collections.getCollections.mockResolvedValue([]);
  cloudinary.uploadImage.mockResolvedValue('https://res.cloudinary.com/test/image/upload/x.png');
  clothing.createClothingItem.mockImplementation(async (data) => ({ ...data, itemId: Math.floor(Math.random() * 1e6) }) as ClothingItem);
  URL.createObjectURL = vi.fn(() => 'blob:http://localhost/original');
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['cutout'], { type: 'image/png' }) })));
});

describe('computeStorage', () => {
  it('free: 15 slots, full at 15', () => {
    expect(computeStorage(FREE, 14)).toMatchObject({ limit: 15, remaining: 1, atLimit: false, unlimited: false });
    expect(computeStorage(FREE, 15)).toMatchObject({ remaining: 0, atLimit: true });
    expect(computeStorage(FREE, 15).canAdd(1)).toBe(false);
  });

  it('a pair needs two slots', () => {
    const storage = computeStorage(FREE, 14);
    expect(storage.canAdd(1)).toBe(true);
    expect(storage.canAdd(2)).toBe(false);
  });

  it('premium has 300; an admin and an unknown account are never blocked', () => {
    expect(computeStorage(PREMIUM, 100)).toMatchObject({ limit: 300, atLimit: false, isPaid: true });
    expect(computeStorage(ADMIN, 5000)).toMatchObject({ limit: null, unlimited: true, atLimit: false, isPaid: true });
    expect(computeStorage(null, 5000)).toMatchObject({ unlimited: true, atLimit: false, isPaid: false });
    expect(computeStorage({ role: Role.ROLE_USER }, 5000).atLimit).toBe(false);
  });

  it('an account already over its limit has no negative slots', () => {
    expect(computeStorage(FREE, 18)).toMatchObject({ remaining: 0, atLimit: true });
  });
});

describe('Closet page', () => {
  function renderCloset() {
    return render(
      <MemoryRouter>
        <ToastProvider>
          <ClosetPage />
        </ToastProvider>
      </MemoryRouter>
    );
  }

  it('shows how full the closet is', async () => {
    setSession(FREE, 7);
    renderCloset();

    expect(await screen.findByText('7 / 15 garments')).toBeInTheDocument();
  });

  it('a full closet explains itself instead of opening the upload wizard', async () => {
    setSession(FREE, 15);
    const user = userEvent.setup();
    renderCloset();

    await user.click(await screen.findByRole('button', { name: /add new garment/i }));

    const dialog = await screen.findByRole('dialog', { name: /closet is full/i });
    expect(within(dialog).getByText(/used 15 of 15 garments/i)).toBeInTheDocument();
    expect(screen.queryByText('Step 1 — Initial Intake')).not.toBeInTheDocument();
  });

  it('with room left, the wizard opens', async () => {
    setSession(FREE, 14);
    const user = userEvent.setup();
    renderCloset();

    await user.click(await screen.findByRole('button', { name: /add new garment/i }));

    expect(await screen.findByText('Step 1 — Initial Intake')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /closet is full/i })).not.toBeInTheDocument();
  });

  it('paying users and admins are not blocked, and an admin sees no meter', async () => {
    setSession(ADMIN, 40);
    const user = userEvent.setup();
    renderCloset();

    expect(screen.queryByTestId('storage-meter')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /add new garment/i }));
    expect(await screen.findByText('Step 1 — Initial Intake')).toBeInTheDocument();
  });
});

describe('Upload wizard', () => {
  const pngFile = () => new File([new Uint8Array([137, 80, 78, 71])], 'shirt.png', { type: 'image/png' });

  it('a full closet gets the explanation instead of the drop zone, and nothing is uploaded', () => {
    setSession(FREE, 15);
    const { container } = render(<UploadFlow isOpen onClose={() => {}} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/closet is full/i);
    expect(container.querySelector('#file-input')).toBeNull();
    expect(cloudinary.uploadImage).not.toHaveBeenCalled();
  });

  it('with one slot left, choosing shoes says a pair uses two', async () => {
    setSession(FREE, 14);
    const user = userEvent.setup();
    const { container } = render(<UploadFlow isOpen onClose={() => {}} />);

    await user.upload(container.querySelector('#file-input') as HTMLInputElement, pngFile());
    await screen.findByText('Next Step');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /shoes/i }));
    expect(screen.getByRole('note')).toHaveTextContent(/2 slots and you have 1 left/i);
  });

  async function reachShoeSave(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
    bgRemoval.removeBackground.mockResolvedValue({ url: 'blob:http://localhost/cutout' } as never);
    await user.upload(container.querySelector('#file-input') as HTMLInputElement, pngFile());
    await screen.findByText('Next Step');
    await user.click(screen.getByRole('button', { name: /shoes/i }));
    await user.click(screen.getByRole('button', { name: /next step/i }));
    await user.click(await screen.findByRole('button', { name: /mirror this shoe/i }));
    return screen.findByRole('button', { name: /save pair/i });
  }

  it('a shoe pair that does not fit is refused before either shoe is saved', async () => {
    setSession(FREE, 14);
    const user = userEvent.setup();
    const { container } = render(<UploadFlow isOpen onClose={() => {}} />);

    await user.click(await reachShoeSave(user, container));

    expect(await screen.findByRole('alert')).toHaveTextContent(/pair uses 2 slots and you have 1 left/i);
    expect(clothing.createClothingItem).not.toHaveBeenCalled();
  });

  it('a pair that fits saves both shoes', async () => {
    setSession(FREE, 13);
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<UploadFlow isOpen onClose={onClose} />);

    await user.click(await reachShoeSave(user, container));

    await waitFor(() => expect(clothing.createClothingItem).toHaveBeenCalledTimes(2));
    expect(onClose).toHaveBeenCalled();
  });

  it("the server's own refusal (GARMENT_LIMIT) is shown as it was sent", async () => {
    setSession(FREE, 5);
    clothing.createClothingItem.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Your free plan holds up to 15 garments. Delete a garment to add another.', code: 'GARMENT_LIMIT' } },
    });
    const user = userEvent.setup();
    const { container } = render(<UploadFlow isOpen onClose={() => {}} />);

    await user.upload(container.querySelector('#file-input') as HTMLInputElement, pngFile());
    await user.click(await screen.findByRole('button', { name: /Skip Background Removal/ }));
    await user.click(await screen.findByRole('button', { name: /Save to Closet/ }));

    expect(await screen.findByText(/Your free plan holds up to 15 garments/)).toBeInTheDocument();
  });
});
