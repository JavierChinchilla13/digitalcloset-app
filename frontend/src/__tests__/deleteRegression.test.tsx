import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ClosetPage from '../pages/ClosetPage';
import { ToastProvider } from '../components/Toast';
import { useClothingStore } from '../store/useClothingStore';
import { clothingService } from '../api/clothingService';
import { makeItem } from '../test/fixtures';

// Only the network edge and the heavy Fabric/AI upload dialog are replaced; the
// page, card, modal, store and toast are all the real ones.
vi.mock('../api/clothingService', () => ({
  clothingService: {
    getClothingItems: vi.fn(),
    createClothingItem: vi.fn(),
    updateClothingItem: vi.fn(),
    deleteClothingItem: vi.fn(),
  },
}));
vi.mock('../components/FittingTool/UploadFlow', () => ({ default: () => null }));

const service = vi.mocked(clothingService);

function renderClosetPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ClosetPage />
      </ToastProvider>
    </MemoryRouter>
  );
}

// Blueprint Phase 5, area 4 ("Frontend Delete Regression"): Task 2 restored the
// delete confirmation after it was bypassed - clicking delete removed the item
// immediately with no confirmation.
describe('closet delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClothingStore.setState({ items: [], isLoading: false, error: null });
    service.getClothingItems.mockResolvedValue([
      makeItem({ itemId: 7, name: 'Linen Shirt' }),
      makeItem({ itemId: 8, name: 'Blue Jeans' }),
    ]);
    service.deleteClothingItem.mockResolvedValue(undefined);
  });

  it('clicking delete opens the confirmation and does NOT delete yet', async () => {
    const user = userEvent.setup();
    renderClosetPage();
    await screen.findByText('Linen Shirt');

    await user.click(screen.getAllByTitle('Delete')[0]);

    expect(await screen.findByText('Delete Garment?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Deletion' })).toBeInTheDocument();
    // The regression: nothing may be deleted before the user confirms.
    expect(service.deleteClothingItem).not.toHaveBeenCalled();
    expect(useClothingStore.getState().items).toHaveLength(2);
  });

  it('cancelling the confirmation keeps the item', async () => {
    const user = userEvent.setup();
    renderClosetPage();
    await screen.findByText('Linen Shirt');

    await user.click(screen.getAllByTitle('Delete')[0]);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Delete Garment?')).not.toBeInTheDocument());
    expect(service.deleteClothingItem).not.toHaveBeenCalled();
    expect(useClothingStore.getState().items).toHaveLength(2);
  });

  it('confirming deletes exactly the chosen item and removes it from the closet', async () => {
    const user = userEvent.setup();
    renderClosetPage();
    await screen.findByText('Linen Shirt');

    await user.click(screen.getAllByTitle('Delete')[0]);
    await user.click(await screen.findByRole('button', { name: 'Confirm Deletion' }));

    await waitFor(() => expect(service.deleteClothingItem).toHaveBeenCalledTimes(1));
    expect(service.deleteClothingItem).toHaveBeenCalledWith(7);
    await waitFor(() => expect(screen.queryByText('Linen Shirt')).not.toBeInTheDocument());
    expect(screen.getByText('Blue Jeans')).toBeInTheDocument();
    expect(useClothingStore.getState().items.map((i) => i.itemId)).toEqual([8]);
  });

  it('a failed delete keeps the item and the dialog open, and says so (Task 22)', async () => {
    service.deleteClothingItem.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderClosetPage();
    await screen.findByText('Linen Shirt');

    await user.click(screen.getAllByTitle('Delete')[0]);
    await user.click(await screen.findByRole('button', { name: 'Confirm Deletion' }));

    expect(await screen.findByText('Failed to delete garment')).toBeInTheDocument();
    expect(screen.getByText('Delete Garment?')).toBeInTheDocument();
    expect(useClothingStore.getState().items).toHaveLength(2);
  });
});
