import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ClosetPage from '../pages/ClosetPage';
import { ToastProvider } from '../components/Toast';
import { useClothingStore } from '../store/useClothingStore';
import { clothingService } from '../api/clothingService';
import { ClothingCategory, PersonaType } from '../types';
import { makeItem } from '../test/fixtures';

vi.mock('../api/clothingService', () => ({
  clothingService: {
    getClothingItems: vi.fn(),
    createClothingItem: vi.fn(),
    updateClothingItem: vi.fn(),
    deleteClothingItem: vi.fn(),
  },
}));
vi.mock('../components/FittingTool/UploadFlow', () => ({ default: () => null }));

// The Closet page's category chips (next to the search bar) used to be squeezed
// into a quarter-width strip with a hidden scrollbar, so several of them were
// cut off and unreachable. jsdom can't measure layout, so the overflow itself
// was verified in a real browser; this locks in that every category is
// rendered as a usable control and that each one filters the list.
// The persona filter row below also has an "ALL" button, so the category chip
// is always the first one in the document.
const categoryChip = (label: string) => screen.getAllByRole('button', { name: label })[0];

describe('closet category chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClothingStore.setState({ items: [], isLoading: false, error: null });
    vi.mocked(clothingService.getClothingItems).mockResolvedValue([
      makeItem({ itemId: 1, name: 'Linen Shirt', category: ClothingCategory.TOP }),
      makeItem({ itemId: 2, name: 'Blue Jeans', category: ClothingCategory.BOTTOM }),
      makeItem({ itemId: 3, name: 'White Sneakers', category: ClothingCategory.SHOES }),
    ]);
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <ToastProvider>
          <ClosetPage />
        </ToastProvider>
      </MemoryRouter>
    );
  }

  it('offers ALL plus every clothing category', async () => {
    renderPage();
    await screen.findByText('Linen Shirt');

    for (const label of ['ALL', ...Object.values(ClothingCategory)]) {
      expect(categoryChip(label), `${label} chip`).toBeInTheDocument();
    }
  });

  it('the chips are not inside a scroll/clip container that could hide them', async () => {
    renderPage();
    await screen.findByText('Linen Shirt');

    const chips = categoryChip('ALL').parentElement!;

    // The old markup was an overflow-x-auto strip with a hidden scrollbar.
    expect(chips.className).not.toMatch(/overflow-/);
    expect(chips.className).toMatch(/flex-wrap/);
  });

  it('each category chip filters the closet, and ALL shows everything again', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Linen Shirt');

    await user.click(categoryChip(ClothingCategory.SHOES));
    await waitFor(() => expect(screen.queryByText('Linen Shirt')).not.toBeInTheDocument());
    expect(screen.getByText('White Sneakers')).toBeInTheDocument();
    expect(screen.queryByText('Blue Jeans')).not.toBeInTheDocument();

    await user.click(categoryChip(ClothingCategory.TOP));
    await waitFor(() => expect(screen.getByText('Linen Shirt')).toBeInTheDocument());
    expect(screen.queryByText('White Sneakers')).not.toBeInTheDocument();

    await user.click(categoryChip('ALL'));
    await waitFor(() => expect(screen.getByText('White Sneakers')).toBeInTheDocument());
    expect(screen.getByText('Linen Shirt')).toBeInTheDocument();
    expect(screen.getByText('Blue Jeans')).toBeInTheDocument();
  });

  it('the persona filter is untouched by the category chips', async () => {
    renderPage();
    await screen.findByText('Linen Shirt');

    for (const label of Object.values(PersonaType)) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });
});
