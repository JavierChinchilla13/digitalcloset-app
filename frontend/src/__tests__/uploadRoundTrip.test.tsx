import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import UploadFlow from '../components/FittingTool/UploadFlow';
import PersonaRenderer from '../components/PersonaRenderer';
import { useClothingStore } from '../store/useClothingStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { cloudinaryService } from '../api/cloudinaryService';
import { clothingService } from '../api/clothingService';
import { collectionService } from '../api/collectionService';
import { bgRemovalService } from '../lib/background-removers';
import { ClothingCategory, PersonaStatus, PersonaType } from '../types';
import type { ClothingItem, PersonaState } from '../types';

// Blueprint Phase 5, area 5 ("Upload Round Trip"):
//   Upload -> Background removal -> Cloudinary -> Backend -> Clothing Store -> PersonaLayer
// The real UploadFlow, clothing store and PersonaRenderer run; only the outside
// world is replaced (AI background removal, Cloudinary, the backend API) and
// the Fabric.js editors, which need a real canvas and sit on the fitting paths
// that this test deliberately does not take.
vi.mock('../api/cloudinaryService', () => ({ cloudinaryService: { uploadImage: vi.fn() } }));
vi.mock('../api/clothingService', () => ({
  clothingService: {
    getClothingItems: vi.fn(),
    createClothingItem: vi.fn(),
    updateClothingItem: vi.fn(),
    deleteClothingItem: vi.fn(),
  },
}));
vi.mock('../api/collectionService', () => ({
  collectionService: { getCollections: vi.fn(), addItemToCollection: vi.fn() },
}));
vi.mock('../lib/background-removers', () => ({
  bgRemovalService: { removeBackground: vi.fn() },
  optimizeImage: vi.fn(async (file: File) => file),
}));
vi.mock('../utils/segmentationService', () => ({ segmentationService: {} }));
vi.mock('../components/FittingTool/FittingEditor', () => ({ default: () => null }));
vi.mock('../components/FittingTool/ShoeFittingEditor', () => ({ default: () => null }));
vi.mock('../components/FittingTool/ShoeSymmetryCheck', () => ({ default: () => null }));
vi.mock('../components/FittingTool/JacketSegmentationTool', () => ({ default: () => null }));
vi.mock('../components/FittingTool/JacketFittingEditor', () => ({ default: () => null }));
vi.mock('../components/FittingTool/GarmentCleanup', () => ({ default: () => null }));

const cloudinary = vi.mocked(cloudinaryService);
const clothing = vi.mocked(clothingService);
const collections = vi.mocked(collectionService);
const bgRemoval = vi.mocked(bgRemovalService);

const CLOUD_URL = 'https://res.cloudinary.com/test/image/upload/v1/digital-closet/shirt.png';

function pngFile(name = 'shirt.png') {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });
}

// The clothing "backend": whatever the UI posts comes back with an id.
function fakeBackend() {
  clothing.createClothingItem.mockImplementation(async (data) => ({ ...data, itemId: 501 }) as ClothingItem);
}

async function pickFileAndReachConfig(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  const input = container.querySelector('#file-input') as HTMLInputElement;
  await user.upload(input, pngFile());
  await screen.findByText('Next Step');
}

describe('upload round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClothingStore.setState({ items: [], isLoading: false, error: null });
    useCollectionStore.setState({ collections: [], isLoading: false, error: null });
    collections.getCollections.mockResolvedValue([]);
    cloudinary.uploadImage.mockResolvedValue(CLOUD_URL);
    fakeBackend();
    // jsdom has no object URLs and no blob fetching.
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/original');
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob(['cutout'], { type: 'image/png' }) }))
    );
  });

  it('keep-original path: file -> Cloudinary -> backend -> store, saved as not persona-eligible', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<UploadFlow isOpen onClose={onClose} />);

    await pickFileAndReachConfig(user, container);
    await user.click(await screen.findByRole('button', { name: /Skip Background Removal/ }));
    await user.type(await screen.findByPlaceholderText('Garment name'), 'Linen Shirt');
    await user.click(await screen.findByRole('button', { name: /Save to Closet/ }));

    // The image was uploaded to Cloudinary...
    await waitFor(() => expect(cloudinary.uploadImage).toHaveBeenCalledTimes(1));
    // ...and the backend was sent the hosted URL, never a blob: URL.
    await waitFor(() => expect(clothing.createClothingItem).toHaveBeenCalledTimes(1));
    const sent = clothing.createClothingItem.mock.calls[0][0];
    expect(sent.imageUrl).toBe(CLOUD_URL);
    expect(sent.imageUrl.startsWith('blob:')).toBe(false);
    expect(sent.name).toBe('Linen Shirt');
    expect(sent.category).toBe(ClothingCategory.TOP);
    expect(sent.personaStatus).toBe(PersonaStatus.INELIGIBLE_NO_CUTOUT);

    // The item is in the closet store and the dialog closed itself.
    expect(useClothingStore.getState().items.map((i) => i.itemId)).toEqual([501]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('AI path: background removal result is what gets uploaded and saved', async () => {
    bgRemoval.removeBackground.mockResolvedValue({ url: 'blob:http://localhost/cutout', method: 'browser' });
    const user = userEvent.setup();
    const { container } = render(<UploadFlow isOpen onClose={vi.fn()} />);

    await pickFileAndReachConfig(user, container);
    await user.click(await screen.findByRole('button', { name: /Next Step/ }));

    // Removal ran on the chosen file, and its output is shown for review.
    await screen.findByText('Step 3 — Analysis Preview');
    expect(bgRemoval.removeBackground).toHaveBeenCalledTimes(1);
    expect((bgRemoval.removeBackground.mock.calls[0][0] as File).name).toBe('shirt.png');
    expect(screen.getByAltText('Processed')).toHaveAttribute('src', 'blob:http://localhost/cutout');

    await user.click(await screen.findByRole('button', { name: /Skip Persona Fitting/ }));
    await user.type(await screen.findByPlaceholderText('Garment name'), 'Cutout Shirt');
    await user.click(await screen.findByRole('button', { name: /Save to Closet/ }));

    // The cutout blob (not the original file) went to Cloudinary...
    await waitFor(() => expect(cloudinary.uploadImage).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('blob:http://localhost/cutout');
    expect(cloudinary.uploadImage.mock.calls[0][0]).toBeInstanceOf(Blob);
    // ...and the saved item points at the hosted URL, flagged as not fitted.
    await waitFor(() => expect(clothing.createClothingItem).toHaveBeenCalledTimes(1));
    const sent = clothing.createClothingItem.mock.calls[0][0];
    expect(sent.imageUrl).toBe(CLOUD_URL);
    expect(sent.personaStatus).toBe(PersonaStatus.NOT_FITTED);
    expect(useClothingStore.getState().items).toHaveLength(1);
  });

  it('a Cloudinary failure saves nothing and tells the user', async () => {
    cloudinary.uploadImage.mockRejectedValue(new Error('upload down'));
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<UploadFlow isOpen onClose={onClose} />);

    await pickFileAndReachConfig(user, container);
    await user.click(await screen.findByRole('button', { name: /Skip Background Removal/ }));
    await user.click(await screen.findByRole('button', { name: /Save to Closet/ }));

    expect(await screen.findByText('Failed to save garment.')).toBeInTheDocument();
    expect(clothing.createClothingItem).not.toHaveBeenCalled();
    expect(useClothingStore.getState().items).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a backend failure keeps the dialog open with a message and leaves the store untouched', async () => {
    clothing.createClothingItem.mockRejectedValue(new Error('500'));
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<UploadFlow isOpen onClose={onClose} />);

    await pickFileAndReachConfig(user, container);
    await user.click(await screen.findByRole('button', { name: /Skip Background Removal/ }));
    await user.click(await screen.findByRole('button', { name: /Save to Closet/ }));

    expect(await screen.findByText('Failed to save garment.')).toBeInTheDocument();
    expect(useClothingStore.getState().items).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the last leg: an item in the store is drawn on the persona from its hosted URL', async () => {
    // What the store holds after the flow above (and after a reload, via fetchItems).
    const saved: ClothingItem = {
      itemId: 501,
      name: 'Linen Shirt',
      category: ClothingCategory.TOP,
      personaType: PersonaType.FEMALE,
      personaStatus: PersonaStatus.FITTED,
      imageUrl: CLOUD_URL,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, width: 300, height: 300 },
    };
    clothing.getClothingItems.mockResolvedValue([saved]);
    useClothingStore.setState({ items: [saved] });
    const persona: PersonaState = {
      type: PersonaType.FEMALE,
      topIds: [501],
      bottomIds: [],
      leftShoeId: null,
      rightShoeId: null,
      accessoryIds: [],
      jacketIds: [],
      dressIds: [],
    };

    const { container } = render(<PersonaRenderer persona={persona} />);

    await waitFor(() => {
      const srcs = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
      expect(srcs).toContain(CLOUD_URL);
    });
  });

  it('a garment of the other persona type is not drawn', async () => {
    const other: ClothingItem = {
      itemId: 502,
      name: "Men's Shirt",
      category: ClothingCategory.TOP,
      personaType: PersonaType.MALE,
      personaStatus: PersonaStatus.FITTED,
      imageUrl: 'https://res.cloudinary.com/test/mens.png',
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    };
    clothing.getClothingItems.mockResolvedValue([other]);
    useClothingStore.setState({ items: [other] });
    const persona: PersonaState = {
      type: PersonaType.FEMALE,
      topIds: [502],
      bottomIds: [],
      leftShoeId: null,
      rightShoeId: null,
      accessoryIds: [],
      jacketIds: [],
      dressIds: [],
    };

    const { container } = render(<PersonaRenderer persona={persona} />);

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    const srcs = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
    expect(srcs).not.toContain(other.imageUrl);
  });
});
