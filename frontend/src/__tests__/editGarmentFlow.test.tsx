import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EditClothingModal from '../components/EditClothingModal';
import { ToastProvider } from '../components/Toast';
import { useClothingStore } from '../store/useClothingStore';
import { cloudinaryService } from '../api/cloudinaryService';
import { ClothingCategory, PersonaType } from '../types';
import type { ClothingItem } from '../types';

// Task 83: Edit Garment -> "Open Studio" now opens the Cleanup Studio first,
// and only its "Finalize & Next" opens Fabric Studio (same order as adding a
// garment). The two Fabric editors need a real canvas, so they are replaced
// by stubs that expose the props the modal hands them.
vi.mock('../api/cloudinaryService', () => ({ cloudinaryService: { uploadImage: vi.fn() } }));

vi.mock('../components/FittingTool/GarmentCleanup', () => ({
  default: (props: {
    imageUrl: string;
    exportMode?: string;
    skipLabel?: string;
    onComplete: (url: string) => void;
    onSkip: () => void;
    onBack: () => void;
  }) => (
    <div data-testid="cleanup" data-src={props.imageUrl} data-export={props.exportMode}>
      <button onClick={() => props.onComplete('data:image/png;base64,AAAA')}>finalize</button>
      <button onClick={props.onSkip}>{props.skipLabel}</button>
      <button onClick={props.onBack}>cleanup-back</button>
    </div>
  ),
}));

vi.mock('../components/FittingTool/FittingEditor', () => ({
  default: (props: {
    imageUrl: string;
    initialWarp: unknown;
    onBack: () => void;
    onSave: (d: { name: string; description: string; transform: unknown; imageUrl?: string; modularData?: string }) => void;
  }) => (
    <div data-testid="studio" data-src={props.imageUrl} data-warp={String(props.initialWarp)}>
      <button onClick={() => props.onSave({ name: 'Tee', description: '', transform: { x: 1 } })}>studio-save</button>
      <button
        onClick={() =>
          props.onSave({
            name: 'Tee',
            description: '',
            transform: { x: 1 },
            imageUrl: 'https://cdn/warped.png',
            modularData: '{"version":1}',
          })
        }
      >
        studio-save-warped
      </button>
      <button onClick={props.onBack}>studio-back</button>
    </div>
  ),
}));

// In-browser jacket segmentation (a real model): stubbed to three sections.
const segmentJacket = vi.fn();
vi.mock('../utils/segmentationService', () => ({
  segmentationService: { segmentJacket: (...args: unknown[]) => segmentJacket(...args) },
}));

vi.mock('../components/FittingTool/JacketFittingEditor', () => ({
  default: (props: {
    segments: Record<string, string>;
    onBack: () => void;
    onSave: (d: { name: string; description: string; modularData: string; previewUrl: string }) => void;
  }) => (
    <div data-testid="jacket-studio" data-parts={Object.keys(props.segments).join(',')}>
      <button
        onClick={() => props.onSave({ name: 'Tee', description: '', modularData: '{"segments":{}}', previewUrl: 'x' })}
      >
        jacket-save
      </button>
      <button onClick={props.onBack}>jacket-back</button>
    </div>
  ),
}));

const uploadImage = vi.mocked(cloudinaryService.uploadImage);
const updateItem = vi.fn();

const ORIGINAL = 'https://cdn/original.png';
const CLEANED = 'https://cdn/cleaned.png';

const makeItem = (over: Partial<ClothingItem> = {}): ClothingItem => ({
  itemId: 7,
  name: 'Tee',
  category: ClothingCategory.TOP,
  imageUrl: ORIGINAL,
  personaType: PersonaType.MALE,
  transform: { x: 375, y: 500, width: 400, height: 400, rotation: 0, scaleX: 1, scaleY: 1 } as ClothingItem['transform'],
  ...over,
});

function renderModal(item: ClothingItem) {
  return render(
    <ToastProvider>
      <EditClothingModal item={item} isOpen onClose={() => {}} />
    </ToastProvider>
  );
}

describe('edit garment: cleanup first, then Fabric Studio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateItem.mockResolvedValue(undefined);
    useClothingStore.setState({ updateItem } as never);
    uploadImage.mockResolvedValue(CLEANED);
    segmentJacket.mockResolvedValue(
      new Map([
        ['torso', new Blob(['t'])],
        ['leftSleeve', new Blob(['l'])],
        ['rightSleeve', new Blob(['r'])],
      ])
    );
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/png' }) })));
  });

  it('Open Studio opens the Cleanup Studio on the item image, not Fabric Studio', async () => {
    const user = userEvent.setup();
    renderModal(makeItem());

    await user.click(screen.getByRole('button', { name: /open studio/i }));

    const cleanup = screen.getByTestId('cleanup');
    expect(cleanup).toHaveAttribute('data-src', ORIGINAL);
    // The edit flow keeps the picture's framing (only the image rectangle).
    expect(cleanup).toHaveAttribute('data-export', 'image-bounds');
    expect(screen.queryByTestId('studio')).not.toBeInTheDocument();
    // An existing garment has no AI step to skip.
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('Finalize & Next uploads the cleaned image and opens Fabric Studio on it', async () => {
    const user = userEvent.setup();
    renderModal(makeItem());

    await user.click(screen.getByRole('button', { name: /open studio/i }));
    await user.click(screen.getByRole('button', { name: 'finalize' }));

    expect(await screen.findByTestId('studio')).toHaveAttribute('data-src', CLEANED);
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  it('saving from the studio stores the cleaned image and clears a stale warp record', async () => {
    const user = userEvent.setup();
    renderModal(makeItem({ modularData: '{"version":1,"originalImageUrl":"https://cdn/old.png"}' }));

    await user.click(screen.getByRole('button', { name: /open studio/i }));
    await user.click(screen.getByRole('button', { name: 'finalize' }));
    await screen.findByTestId('studio');
    // The old warp belonged to the pre-cleanup picture.
    expect(screen.getByTestId('studio')).toHaveAttribute('data-warp', 'null');
    await user.click(screen.getByRole('button', { name: 'studio-save' }));

    await waitFor(() => expect(updateItem).toHaveBeenCalled());
    expect(updateItem).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ imageUrl: CLEANED, modularData: '' })
    );
  });

  it('a warp made after cleanup wins over the cleaned image', async () => {
    const user = userEvent.setup();
    renderModal(makeItem());

    await user.click(screen.getByRole('button', { name: /open studio/i }));
    await user.click(screen.getByRole('button', { name: 'finalize' }));
    await screen.findByTestId('studio');
    await user.click(screen.getByRole('button', { name: 'studio-save-warped' }));

    await waitFor(() => expect(updateItem).toHaveBeenCalled());
    expect(updateItem).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ imageUrl: 'https://cdn/warped.png', modularData: '{"version":1}' })
    );
  });

  it('Skip goes to Fabric Studio unchanged and uploads nothing', async () => {
    const user = userEvent.setup();
    renderModal(makeItem());

    await user.click(screen.getByRole('button', { name: /open studio/i }));
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByTestId('studio')).toHaveAttribute('data-src', ORIGINAL);
    await user.click(screen.getByRole('button', { name: 'studio-save' }));

    await waitFor(() => expect(updateItem).toHaveBeenCalled());
    expect(uploadImage).not.toHaveBeenCalled();
    const payload = updateItem.mock.calls[0][1];
    expect(payload.imageUrl).toBe(ORIGINAL);
    expect(payload).not.toHaveProperty('modularData');
  });

  it('stays on the cleanup screen with an error when the upload fails', async () => {
    const user = userEvent.setup();
    uploadImage.mockRejectedValue(new Error('Cloudinary down'));
    renderModal(makeItem());

    await user.click(screen.getByRole('button', { name: /open studio/i }));
    await user.click(screen.getByRole('button', { name: 'finalize' }));

    expect(await screen.findByText('Cloudinary down')).toBeInTheDocument();
    expect(screen.getByTestId('cleanup')).toBeInTheDocument();
    expect(screen.queryByTestId('studio')).not.toBeInTheDocument();
  });

  it('shoes skip the Cleanup Studio and open Fabric Studio directly', async () => {
    const user = userEvent.setup();
    renderModal(makeItem({ category: ClothingCategory.SHOES }));

    await user.click(screen.getByRole('button', { name: /open studio/i }));

    expect(screen.getByTestId('studio')).toHaveAttribute('data-src', ORIGINAL);
    expect(screen.queryByTestId('cleanup')).not.toBeInTheDocument();
    expect(segmentJacket).not.toHaveBeenCalled();
  });

  it('a jacket opens the Cleanup Studio first, then is split into sections', async () => {
    const user = userEvent.setup();
    renderModal(makeItem({ category: ClothingCategory.JACKET, isModular: true, modularData: '{}' }));

    await user.click(screen.getByRole('button', { name: /open studio/i }));
    expect(screen.getByTestId('cleanup')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'finalize' }));

    // Segmentation ran on the cleaned image and each section was uploaded.
    const jacket = await screen.findByTestId('jacket-studio');
    expect(segmentJacket).toHaveBeenCalledTimes(1);
    expect(jacket).toHaveAttribute('data-parts', 'torso,leftSleeve,rightSleeve');
    expect(screen.queryByTestId('studio')).not.toBeInTheDocument();
  });

  it('skipping cleanup on a jacket still splits it into sections', async () => {
    const user = userEvent.setup();
    renderModal(makeItem({ category: ClothingCategory.JACKET }));

    await user.click(screen.getByRole('button', { name: /open studio/i }));
    await user.click(screen.getByRole('button', { name: 'Skip' }));

    expect(await screen.findByTestId('jacket-studio')).toBeInTheDocument();
    expect(segmentJacket).toHaveBeenCalledTimes(1);
  });

  it('saving from the jacket studio stores the sections and keeps the closet thumbnail', async () => {
    const user = userEvent.setup();
    renderModal(makeItem({ category: ClothingCategory.JACKET }));

    await user.click(screen.getByRole('button', { name: /open studio/i }));
    await user.click(screen.getByRole('button', { name: 'finalize' }));
    await screen.findByTestId('jacket-studio');
    await user.click(screen.getByRole('button', { name: 'jacket-save' }));

    await waitFor(() => expect(updateItem).toHaveBeenCalled());
    const payload = updateItem.mock.calls[0][1];
    expect(payload).toEqual(
      expect.objectContaining({ isModular: true, modularData: '{"segments":{}}', name: 'Tee' })
    );
    expect(payload).not.toHaveProperty('imageUrl');
  });

  it('a jacket the model cannot split falls back to Fabric Studio on the cleaned image', async () => {
    const user = userEvent.setup();
    segmentJacket.mockResolvedValueOnce(new Map());
    renderModal(makeItem({ category: ClothingCategory.JACKET }));

    await user.click(screen.getByRole('button', { name: /open studio/i }));
    await user.click(screen.getByRole('button', { name: 'finalize' }));

    expect(await screen.findByTestId('studio')).toHaveAttribute('data-src', CLEANED);
    expect(screen.queryByTestId('jacket-studio')).not.toBeInTheDocument();
  });

  it('Back from Fabric Studio returns to the form', async () => {
    const user = userEvent.setup();
    renderModal(makeItem());

    await user.click(screen.getByRole('button', { name: /open studio/i }));
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await user.click(screen.getByRole('button', { name: 'studio-back' }));

    expect(screen.getByText('Edit Garment')).toBeInTheDocument();
  });
});
