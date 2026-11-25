import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import DemoPage from '../pages/DemoPage';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitDraftStore } from '../store/useOutfitDraftStore';
import { clothingService } from '../api/clothingService';
import { useLanguageStore } from '../i18n';

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
    await user.click(cardFor('White Shirt'));

    expect(await screen.findByText('1 Item Selected')).toBeInTheDocument();
    expect(clothingService.getClothingItems).not.toHaveBeenCalled();
    expect(clothingService.createClothingItem).not.toHaveBeenCalled();
    expect(useClothingStore.getState().fetchItems).not.toHaveBeenCalled();
  });

  it('has no live persona: no preview toggle, no switcher, no badges', async () => {
    const user = userEvent.setup();
    renderDemo();
    await user.click(cardFor('White Shirt'));

    expect(screen.queryByRole('button', { name: /preview on persona/i })).not.toBeInTheDocument();
    expect(screen.queryByAltText('Mannequin')).not.toBeInTheDocument();
    expect(screen.queryByText(/m persona/i)).not.toBeInTheDocument();
  });

  it('View on Persona is off until something is selected, then shows the persona clip with a sign-up button', async () => {
    const user = userEvent.setup();
    renderDemo();

    const button = screen.getByRole('button', { name: /view on persona/i });
    expect(button).toBeDisabled();

    await user.click(cardFor('White Shirt'));
    expect(button).toBeEnabled();
    await user.click(button);

    expect(await screen.findByText(/create a free account to see your outfit on your own persona/i)).toBeInTheDocument();
    expect(screen.getByAltText(/swapping the jacket of a saved outfit/i)).toHaveAttribute('src', '/marketing/persona-demo.gif');
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

  it('a shoe is one selectable item (one shoe, not a pair)', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(cardFor('White Sneaker (Left)'));
    expect(await screen.findByText('1 Item Selected')).toBeInTheDocument();
  });

  it('a mismatched pair is allowed: the left shoe of one pair and the right shoe of the other', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(cardFor('White Sneaker (Left)'));
    await user.click(cardFor('Black & White Sneaker (Right)'));

    expect(await screen.findByText('2 Items Selected')).toBeInTheDocument();
    // nothing was replaced, so there is no note
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // both are in "Your selection" (one card in the closet list, one in the selection)
    expect(screen.getAllByText('White Sneaker (Left)')).toHaveLength(2);
    expect(screen.getAllByText('Black & White Sneaker (Right)')).toHaveLength(2);
  });

  it('the picked shoes show as the left/right pair row, left first', async () => {
    const user = userEvent.setup();
    renderDemo();

    // picked right first, then left: the row still puts the left shoe first
    await user.click(cardFor('Black & White Sneaker (Right)'));
    await user.click(cardFor('White Sneaker (Left)'));
    await screen.findByText('2 Items Selected');

    // (the selection panel is the <main>; its pictures are labelled with the garment name)
    const labels = [...document.querySelectorAll('main [role="img"]')].map((el) => el.getAttribute('aria-label'));
    expect(labels).toEqual(['White Sneaker (Left)', 'Black & White Sneaker (Right)']);
  });

  it('one shoe per foot: a second LEFT shoe replaces the first left, and says which', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(cardFor('White Sneaker (Left)'));
    await user.click(cardFor('White Sneaker (Right)'));
    expect(await screen.findByText('2 Items Selected')).toBeInTheDocument();

    await user.click(cardFor('Black & White Sneaker (Left)'));
    expect(await screen.findByText('2 Items Selected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Replaced White Sneaker (Left) with Black & White Sneaker (Left)');
    // the right shoe stayed
    expect(screen.getAllByText('White Sneaker (Right)')).toHaveLength(2);
  });

  it('a second RIGHT shoe replaces the first right and keeps the left', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(cardFor('White Sneaker (Left)'));
    await user.click(cardFor('White Sneaker (Right)'));
    await user.click(cardFor('Black & White Sneaker (Right)'));

    expect(await screen.findByRole('status')).toHaveTextContent('Replaced White Sneaker (Right) with Black & White Sneaker (Right)');
    expect(screen.getByText('2 Items Selected')).toBeInTheDocument();
    expect(screen.getAllByText('White Sneaker (Left)')).toHaveLength(2);
  });

  it('the closet tab says which foot a shoe is for, in both languages', async () => {
    const user = userEvent.setup();
    renderDemo();
    await user.click(screen.getByRole('button', { name: /^closet$/i }));
    expect(screen.getAllByText(/^SHOES · left$/).length).toBe(2);
    expect(screen.getAllByText(/^SHOES · right$/).length).toBe(2);
  });

  it('the closet tab in Spanish: category and foot are translated', async () => {
    useLanguageStore.getState().setLanguage('es');
    const user = userEvent.setup();
    renderDemo();
    await user.click(screen.getByRole('button', { name: /^clóset$/i }));
    expect(screen.getAllByText(/^CALZADO · izquierdo$/).length).toBe(2);
    expect(screen.getAllByText(/^CALZADO · derecho$/).length).toBe(2);
    expect(screen.getAllByText('PARTE SUPERIOR').length).toBeGreaterThan(0);
    // the filter chips too
    expect(screen.getByRole('button', { name: 'CALZADO' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TODO' })).toBeInTheDocument();
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

    await user.click(within(cardFor('White Shirt')).getByTitle('Edit'));

    expect(await screen.findByText(/create a free account to edit this item/i)).toBeInTheDocument();
    expect(clothingService.updateClothingItem).not.toHaveBeenCalled();
  });

  it('deleting a preset item opens the sign-up gate, not a real delete', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(within(cardFor('White Shirt')).getByTitle('Delete'));

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

    await user.click(cardFor('White Shirt'));
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
