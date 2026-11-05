import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import FirstRunPanel from '../components/FirstRunPanel';
import { useClothingStore } from '../store/useClothingStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { clothingService } from '../api/clothingService';
import { ClothingCategory, PersonaType, PersonaStatus } from '../types';
import { makeItems, makeUser } from '../test/fixtures';
import { SAMPLE_GARMENTS, STARTER_OUTFIT_SLUGS, sampleToNewItems } from '../utils/sampleGarments';

// Task 101: the first-run guide and the sample garments.
vi.mock('../api/clothingService', () => ({
  clothingService: { getClothingItems: vi.fn(), createClothingItem: vi.fn() },
}));

const clothing = vi.mocked(clothingService);

const renderPanel = (props: { outfitCount?: number } = {}) =>
  render(
    <MemoryRouter>
      <FirstRunPanel {...props} />
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useAuthStore.getState().login('token', makeUser());
  useClothingStore.setState({ items: [], isLoading: false, error: null });
  usePersonaStore.setState({ persona: { ...usePersonaStore.getState().persona, type: PersonaType.MALE } });
  let nextId = 100;
  clothing.createClothingItem.mockImplementation(async (data) => ({ ...data, itemId: nextId++ }));
});

describe('the sample garments', () => {
  it('have stable file names under /samples, sane sizes and no duplicates', () => {
    const slugs = SAMPLE_GARMENTS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const sample of SAMPLE_GARMENTS) {
      expect(sample.imageUrl).toBe(`/samples/${sample.slug}.png`);
      for (const persona of [PersonaType.MALE, PersonaType.FEMALE]) {
        for (const item of sampleToNewItems(sample, persona)) {
          expect(item.transform.width).toBeGreaterThan(0);
          expect(item.transform.height).toBeGreaterThan(0);
          // Not stretched: the placed box keeps the picture's own proportions.
          expect(item.transform.width! / item.transform.height!).toBeCloseTo(sample.aspect, 1);
          expect(item.personaType).toBe(persona);
          expect(item.personaStatus).toBe(PersonaStatus.FITTED);
          // The visible garment sits on the figure's canvas (750 x 1000), not off its edge.
          const { x, y, width, height } = item.transform;
          expect(x - width! / 2).toBeGreaterThan(-100);
          expect(x + width! / 2).toBeLessThan(850);
          expect(y - height! / 2).toBeGreaterThan(-100);
          expect(y + height! / 2).toBeLessThan(1150);
        }
      }
    }
  });

  it('the starter outfit is a top, a bottom and shoes', () => {
    const categories = STARTER_OUTFIT_SLUGS.map((slug) => SAMPLE_GARMENTS.find((s) => s.slug === slug)!.category);
    expect(categories).toEqual([ClothingCategory.TOP, ClothingCategory.BOTTOM, ClothingCategory.SHOES]);
  });

  it('shoes are a left and a right piece, the right one mirrored', () => {
    const boots = SAMPLE_GARMENTS.find((s) => s.slug === 'black-boot')!;
    const [left, right] = sampleToNewItems(boots, PersonaType.MALE);
    expect(left.side).toBe('left');
    expect(right.side).toBe('right');
    expect(right.transform.flipX).toBe(true);
    expect(left.transform.x).toBeLessThan(right.transform.x);
  });
});

describe('the first-run panel', () => {
  it('shows for an empty closet with the three steps and the samples', () => {
    renderPanel();

    expect(screen.getByTestId('first-run-panel')).toBeInTheDocument();
    expect(screen.getByText('Add a few pieces')).toBeInTheDocument();
    expect(screen.getByText('Build an outfit')).toBeInTheDocument();
    expect(screen.getByText('See it in your Showcase')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Black Tee' })).toBeInTheDocument();
  });

  it('does not show once the closet has garments (and no outfit count is given)', () => {
    useClothingStore.setState({ items: makeItems(2) });
    renderPanel();
    expect(screen.queryByTestId('first-run-panel')).not.toBeInTheDocument();
  });

  it('shows on the Showcase while there are garments but no outfit, with step 1 ticked', () => {
    useClothingStore.setState({ items: makeItems(2) });
    renderPanel({ outfitCount: 0 });
    expect(screen.getByTestId('first-run-panel')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Done').length).toBeGreaterThan(0);
  });

  it('adding a sample creates the garment for the active persona', async () => {
    usePersonaStore.setState({ persona: { ...usePersonaStore.getState().persona, type: PersonaType.FEMALE } });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Add Pants' }));

    expect(clothing.createClothingItem).toHaveBeenCalledTimes(1);
    expect(clothing.createClothingItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Pants',
        category: ClothingCategory.BOTTOM,
        imageUrl: '/samples/pants.png',
        personaType: PersonaType.FEMALE,
        personaStatus: PersonaStatus.FITTED,
      })
    );
    expect(useClothingStore.getState().items).toHaveLength(1);
  });

  it('"Add a starter outfit" adds a top, a bottom and shoes', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /add a starter outfit/i }));

    const created = clothing.createClothingItem.mock.calls.map(([data]) => data.category);
    expect(created).toEqual([ClothingCategory.TOP, ClothingCategory.BOTTOM, ClothingCategory.SHOES, ClothingCategory.SHOES]);
  });

  it('explains instead of adding when the closet has no room left', async () => {
    // A free account holds 15; the starter outfit needs four slots (the shoes are a pair).
    useClothingStore.setState({ items: makeItems(13).map((it, i) => ({ ...it, imageUrl: `https://x/${i}.png` })) });
    const user = userEvent.setup();
    renderPanel({ outfitCount: 0 });

    await user.click(screen.getByRole('button', { name: /add a starter outfit/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/room for 2 more garments/i);
    expect(clothing.createClothingItem).not.toHaveBeenCalled();
  });

  it('shows the server message when adding fails', async () => {
    clothing.createClothingItem.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Boom' } } });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Add Black Tee' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(useClothingStore.getState().items).toHaveLength(0);
  });

  it('hiding the guide is remembered for this account only', async () => {
    const user = userEvent.setup();
    const first = renderPanel();

    await user.click(screen.getByRole('button', { name: /hide this guide/i }));
    expect(screen.queryByTestId('first-run-panel')).not.toBeInTheDocument();
    first.unmount();

    // Same account, later: still hidden.
    renderPanel();
    expect(screen.queryByTestId('first-run-panel')).not.toBeInTheDocument();

    // A different account in the same browser still sees it.
    useAuthStore.getState().login('token2', makeUser({ userId: 999 }));
    renderPanel();
    expect(screen.getByTestId('first-run-panel')).toBeInTheDocument();
  });
});
