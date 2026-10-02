import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import DemoPage from '../pages/DemoPage';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitDraftStore } from '../store/useOutfitDraftStore';
import { clothingService } from '../api/clothingService';

// Task 81: the Demo page must work end-to-end for a signed-out visitor
// without ever touching the real backend - these tests assert that
// directly (the mocked API is never called) rather than just checking
// what renders, since a silent 401-triggered logout/redirect (the bug this
// page replaces) would otherwise look fine in a shallow render test.
vi.mock('../api/clothingService', () => ({
  clothingService: {
    getClothingItems: vi.fn(),
    createClothingItem: vi.fn(),
    updateClothingItem: vi.fn(),
    deleteClothingItem: vi.fn(),
  },
}));

function renderDemo() {
  return render(
    <MemoryRouter>
      <DemoPage />
    </MemoryRouter>
  );
}

const cardFor = (name: string) => screen.getByText(name).closest('div')!.parentElement!;

describe('DemoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClothingStore.setState({ items: [], isLoading: false, error: null, fetchItems: vi.fn() });
    useOutfitDraftStore.setState({ selectedItemIds: [] });
  });

  it('shows the preset closet and lets a visitor select an item for free', async () => {
    const user = userEvent.setup();
    renderDemo();

    expect(screen.getByText('0 Items Selected')).toBeInTheDocument();
    await user.click(cardFor('Black Tee'));

    expect(await screen.findByText('1 Item Selected')).toBeInTheDocument();
    expect(clothingService.getClothingItems).not.toHaveBeenCalled();
    expect(clothingService.createClothingItem).not.toHaveBeenCalled();
    expect(useClothingStore.getState().fetchItems).not.toHaveBeenCalled();
  });

  it('has no live persona: no preview toggle, no switcher, no badges', async () => {
    const user = userEvent.setup();
    renderDemo();
    await user.click(cardFor('Black Tee'));

    expect(screen.queryByRole('button', { name: /preview on persona/i })).not.toBeInTheDocument();
    expect(screen.queryByAltText('Mannequin')).not.toBeInTheDocument();
    expect(screen.queryByText(/m persona/i)).not.toBeInTheDocument();
  });

  it('View on Persona is off until something is selected, then shows the persona clip with a sign-up button', async () => {
    const user = userEvent.setup();
    renderDemo();

    const button = screen.getByRole('button', { name: /view on persona/i });
    expect(button).toBeDisabled();

    await user.click(cardFor('Black Tee'));
    expect(button).toBeEnabled();
    await user.click(button);

    expect(await screen.findByText(/create a free account to see your outfit on your own persona/i)).toBeInTheDocument();
    expect(screen.getByAltText(/put on the vysvi persona/i)).toHaveAttribute('src', '/marketing/persona-demo.gif');
    expect(screen.getByRole('link', { name: /create free account/i })).toHaveAttribute('href', '/signup');
    // A recorded clip, not the real thing: no mannequin, no API calls.
    expect(screen.queryByAltText('Mannequin')).not.toBeInTheDocument();
    expect(clothingService.getClothingItems).not.toHaveBeenCalled();
  });

  it('the other gates keep the outfit-builder clip', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(screen.getByRole('button', { name: /save outfit/i }));

    expect(await screen.findByAltText(/previewing it on a digital persona/i)).toHaveAttribute(
      'src',
      '/marketing/outfit-builder-demo.gif'
    );
  });

  it('a shoe is one selectable item', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(cardFor('University Blue Sneaker'));
    expect(await screen.findByText('1 Item Selected')).toBeInTheDocument();
  });

  it('one shoe per foot: picking another shoe swaps it and says so', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(cardFor('University Blue Sneaker'));
    expect(await screen.findByText('1 Item Selected')).toBeInTheDocument();

    await user.click(cardFor('Black Chukka Boot'));
    expect(await screen.findByText('1 Item Selected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Replaced University Blue Sneaker with Black Chukka Boot');
  });

  it('Save Outfit opens the sign-up gate instead of saving anything', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(screen.getByRole('button', { name: /save outfit/i }));

    expect(await screen.findByText(/create a free account to save this outfit/i)).toBeInTheDocument();
    expect(clothingService.createClothingItem).not.toHaveBeenCalled();
  });

  it('Add Garment opens the sign-up gate', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(screen.getByRole('button', { name: /add garment/i }));

    expect(await screen.findByText(/create a free account to add your own clothes/i)).toBeInTheDocument();
  });

  it('editing a preset item opens the sign-up gate, not a real edit', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(within(cardFor('Black Tee')).getByTitle('Edit'));

    expect(await screen.findByText(/create a free account to edit this item/i)).toBeInTheDocument();
    expect(clothingService.updateClothingItem).not.toHaveBeenCalled();
  });

  it('deleting a preset item opens the sign-up gate, not a real delete', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(within(cardFor('Black Tee')).getByTitle('Delete'));

    expect(await screen.findByText(/create a free account to delete this item/i)).toBeInTheDocument();
    expect(clothingService.deleteClothingItem).not.toHaveBeenCalled();
  });

  it("the sign-up gate's call to action links to /signup", async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(screen.getByRole('button', { name: /save outfit/i }));

    const cta = await screen.findByRole('link', { name: /create free account/i });
    expect(cta).toHaveAttribute('href', '/signup');
  });

  it('deselecting an item from the selection panel stays free (not gated)', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(cardFor('Black Tee'));
    expect(await screen.findByText('1 Item Selected')).toBeInTheDocument();

    await user.click(screen.getByTitle('Remove from outfit'));

    expect(await screen.findByText('0 Items Selected')).toBeInTheDocument();
    expect(screen.queryByText(/create a free account/i)).not.toBeInTheDocument();
  });

  it('the Closet tab lists the same preset items and its Add / Edit stay gated', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(screen.getByRole('button', { name: /closet/i }));
    expect(await screen.findByRole('heading', { name: /demo wardrobe/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add new garment/i }));
    expect(await screen.findByText(/create a free account to add your own clothes/i)).toBeInTheDocument();
  });
});
