import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PersonaRenderer from '../components/PersonaRenderer';
import LayerPanel from '../components/LayerPanel';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitDraftStore, outfitItemsFromDraft } from '../store/useOutfitDraftStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { computePersonaEligibility, buildOutfitPersona } from '../utils/personaEligibility';
import { ClothingCategory as C, PersonaType } from '../types';
import type { Outfit, PersonaState } from '../types';
import { makeItem } from '../test/fixtures';

// Task 86: the stacking order is part of the draft (until saved), is sent with
// the outfit, and is what the persona draws; and an outfit holds one shoe per foot.
const MALE = PersonaType.MALE;
const tee = makeItem({ itemId: 1, name: 'Tee', category: C.TOP, personaType: MALE, imageUrl: 'https://img.test/tee.png' });
const pants = makeItem({ itemId: 2, name: 'Pants', category: C.BOTTOM, personaType: MALE, imageUrl: 'https://img.test/pants.png' });
const jacket = makeItem({ itemId: 3, name: 'Jacket', category: C.JACKET, personaType: MALE, imageUrl: 'https://img.test/jacket.png' });
const leftA = makeItem({ itemId: 10, name: 'Runner', category: C.SHOES, side: 'left', personaType: MALE, imageUrl: 'https://img.test/la.png' });
const leftB = makeItem({ itemId: 11, name: 'Boot', category: C.SHOES, side: 'left', personaType: MALE, imageUrl: 'https://img.test/lb.png' });
const rightA = makeItem({ itemId: 12, name: 'Runner', category: C.SHOES, side: 'right', personaType: MALE, imageUrl: 'https://img.test/ra.png' });
const items = [tee, pants, jacket, leftA, leftB, rightA];

const basePersona = (over: Partial<PersonaState> = {}): PersonaState => ({
  type: MALE,
  topIds: [],
  bottomIds: [],
  leftShoeId: null,
  rightShoeId: null,
  accessoryIds: [],
  jacketIds: [],
  dressIds: [],
  ...over,
});

// z-index of the layer showing `src`.
const zOf = (container: HTMLElement, name: string) => {
  const img = container.querySelector(`img[src="https://img.test/${name}.png"]`)!;
  return Number((img.parentElement as HTMLElement).style.zIndex);
};

beforeEach(() => {
  useClothingStore.setState({ items, fetchItems: vi.fn() } as never);
});

describe('the draft remembers the stacking order until it is saved', () => {
  beforeEach(() => useOutfitDraftStore.getState().clearDraft());

  it('starts without one (the default stacking) and clears with the draft', () => {
    const store = useOutfitDraftStore.getState();
    expect(store.layerOrder).toBeNull();
    store.setDraft([1, 2], [2, 1]);
    expect(useOutfitDraftStore.getState().layerOrder).toEqual([2, 1]);
    useOutfitDraftStore.getState().clearDraft();
    expect(useOutfitDraftStore.getState().layerOrder).toBeNull();
  });

  it('forgets a piece that leaves the outfit', () => {
    useOutfitDraftStore.getState().setDraft([1, 2, 3], [3, 2, 1]);
    useOutfitDraftStore.getState().removeItem(2);
    expect(useOutfitDraftStore.getState().layerOrder).toEqual([3, 1]);
    useOutfitDraftStore.getState().toggleItem(3);
    expect(useOutfitDraftStore.getState().layerOrder).toEqual([1]);
  });
});

describe('saving', () => {
  it('sends each piece with its position when the user set an order', () => {
    const out = outfitItemsFromDraft([1, 2], items, [2, 1]); // pants UNDER... bottom-first: pants 0, tee 1
    expect(out.find((o) => o.itemId === 2)?.layerOrder).toBe(0);
    expect(out.find((o) => o.itemId === 1)?.layerOrder).toBe(1);
  });

  it('sends no layer order by default, so the outfit keeps stacking by category', () => {
    const out = outfitItemsFromDraft([1, 2], items, null);
    expect(out.every((o) => !('layerOrder' in o))).toBe(true);
  });

  it('never saves two shoes for one foot - the later one wins', () => {
    const out = outfitItemsFromDraft([10, 11, 12], items);
    expect(out.map((o) => o.itemId)).toEqual([11, 12]);
    expect(out.map((o) => o.slot)).toEqual(['leftShoe', 'rightShoe']);
  });
});

describe('the persona', () => {
  it('stacks by category by default: the jacket in front of the tee in front of the pants', () => {
    const persona = basePersona({ topIds: [1], bottomIds: [2], jacketIds: [3] });
    const { container } = render(<PersonaRenderer persona={persona} />);
    expect(zOf(container, 'pants')).toBeLessThan(zOf(container, 'tee'));
    expect(zOf(container, 'tee')).toBeLessThan(zOf(container, 'jacket'));
  });

  it('follows a custom order: pants in front of the tee and the jacket', () => {
    const persona = basePersona({ topIds: [1], bottomIds: [2], jacketIds: [3], layerOrder: [1, 3, 2] });
    const { container } = render(<PersonaRenderer persona={persona} />);
    expect(zOf(container, 'tee')).toBeLessThan(zOf(container, 'jacket'));
    expect(zOf(container, 'jacket')).toBeLessThan(zOf(container, 'pants'));
  });

  it('can put the pants over the shoes (the default has the shoes in front)', () => {
    const persona = basePersona({ bottomIds: [2], leftShoeId: 10, rightShoeId: 12 });
    const byDefault = render(<PersonaRenderer persona={persona} />);
    expect(zOf(byDefault.container, 'pants')).toBeLessThan(zOf(byDefault.container, 'la'));
    byDefault.unmount();

    const custom = render(<PersonaRenderer persona={{ ...persona, layerOrder: [10, 12, 2] }} />);
    expect(zOf(custom.container, 'pants')).toBeGreaterThan(zOf(custom.container, 'la'));
    expect(zOf(custom.container, 'pants')).toBeGreaterThan(zOf(custom.container, 'ra'));
  });

  it('a piece the order does not mention still lands where its category puts it', () => {
    // The order only names pants + tee (pants in front); the jacket was added later.
    const persona = basePersona({ topIds: [1], bottomIds: [2], jacketIds: [3], layerOrder: [1, 2] });
    const { container } = render(<PersonaRenderer persona={persona} />);
    expect(zOf(container, 'jacket')).toBeGreaterThan(zOf(container, 'pants'));
  });

  it('carries the order from the draft into the preview, only for pieces that can be shown', () => {
    const wrong = makeItem({ itemId: 9, category: C.TOP, personaType: PersonaType.FEMALE });
    const result = computePersonaEligibility([tee, pants, wrong], [...items, wrong], MALE, [2, 9, 1]);
    expect(result.previewPersona.layerOrder).toEqual([2, 1]);
  });

  it('a saved outfit brings its order back', () => {
    const outfit: Outfit = {
      outfitId: 1,
      name: 'Look',
      avatarType: MALE,
      createdAt: '2026-09-30T00:00:00',
      items: [
        { outfitItemId: 1, itemId: 1, slot: 'top', layerOrder: 1 },
        { outfitItemId: 2, itemId: 2, slot: 'bottom', layerOrder: 0 },
      ],
    };
    expect(buildOutfitPersona(outfit, items).layerOrder).toEqual([2, 1]);
  });

  it('an outfit saved without an order has none', () => {
    const outfit: Outfit = {
      outfitId: 1,
      name: 'Old look',
      avatarType: MALE,
      createdAt: '2026-09-30T00:00:00',
      items: [{ outfitItemId: 1, itemId: 1, slot: 'top' }],
    };
    expect(buildOutfitPersona(outfit, items).layerOrder).toBeUndefined();
  });
});

describe('the layers panel', () => {
  const setup = (over: Partial<React.ComponentProps<typeof LayerPanel>> = {}) => {
    const props = {
      stack: [2, 1, 3], // pants, tee, jacket (bottom first)
      items,
      selectedId: null,
      onSelect: vi.fn(),
      onMove: vi.fn(),
      onReorder: vi.fn(),
      isCustom: false,
      onReset: vi.fn(),
      ...over,
    };
    render(<LayerPanel {...props} />);
    return props;
  };

  it('lists the front-most piece first', () => {
    setup();
    const rows = screen.getAllByTestId(/layer-row-/).map((el) => el.getAttribute('data-testid'));
    expect(rows).toEqual(['layer-row-3', 'layer-row-1', 'layer-row-2']);
  });

  it('selects a piece and moves it forward or back', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByTestId('layer-row-1'));
    expect(props.onSelect).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole('button', { name: 'Bring Tee forward' }));
    expect(props.onMove).toHaveBeenCalledWith(1, 'up');
    await user.click(screen.getByRole('button', { name: 'Send Tee back' }));
    expect(props.onMove).toHaveBeenCalledWith(1, 'down');
  });

  it('the front piece cannot go further forward, the back piece not further back', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Bring Jacket forward' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send Pants back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bring Pants forward' })).toBeEnabled();
  });

  it('drag and drop: dropping a piece on a row puts it in the place of that row', () => {
    const props = setup(); // rows front to back: Jacket(3), Tee(1), Pants(2); stack [2, 1, 3]
    const data: Record<string, string> = {};
    const dataTransfer = { setData: (k: string, v: string) => (data[k] = v), getData: (k: string) => data[k], effectAllowed: '', dropEffect: '' };

    fireEvent.dragStart(screen.getByTestId('layer-row-2'), { dataTransfer }); // pick up the pants
    fireEvent.dragOver(screen.getByTestId('layer-row-3'), { dataTransfer }); // over the front-most row
    expect(screen.getByTestId('layer-row-3')).toHaveAttribute('data-drop-target', 'true');
    fireEvent.drop(screen.getByTestId('layer-row-3'), { dataTransfer });

    // The jacket's row is the front: stack index 2.
    expect(props.onReorder).toHaveBeenCalledWith(2, 2);
    expect(screen.getByTestId('layer-row-3')).toHaveAttribute('data-drop-target', 'false');
  });

  it('dropping with nothing being dragged does nothing', () => {
    const props = setup();
    fireEvent.drop(screen.getByTestId('layer-row-1'));
    expect(props.onReorder).not.toHaveBeenCalled();
  });

  it('offers a reset only once the order is custom', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LayerPanel stack={[2, 1]} items={items} selectedId={null} onSelect={vi.fn()} onMove={vi.fn()} onReorder={vi.fn()} isCustom={false} onReset={vi.fn()} />
    );
    expect(screen.queryByText(/reset order/i)).not.toBeInTheDocument();

    const onReset = vi.fn();
    rerender(
      <LayerPanel stack={[2, 1]} items={items} selectedId={null} onSelect={vi.fn()} onMove={vi.fn()} onReorder={vi.fn()} isCustom onReset={onReset} />
    );
    await user.click(screen.getByText(/reset order/i));
    expect(onReset).toHaveBeenCalled();
  });
});

describe('equipping shoes on the persona store: one per foot', () => {
  const equip = (item: ReturnType<typeof makeItem>) => usePersonaStore.getState().setEquippedItem(item);
  const feet = () => {
    const { leftShoeId, rightShoeId } = usePersonaStore.getState().persona;
    return [leftShoeId, rightShoeId];
  };

  beforeEach(() => usePersonaStore.getState().clearEquipped());

  it('a sided shoe takes its own foot, swapping what was there', () => {
    equip(leftA);
    equip(rightA);
    expect(feet()).toEqual([10, 12]);
    equip(leftB);
    expect(feet()).toEqual([11, 12]);
  });

  it('the same sided shoe again takes it off', () => {
    equip(leftA);
    equip(leftA);
    expect(feet()).toEqual([null, null]);
  });

  it('a shoe with no side is the pair: it takes both feet and replaces what was there', () => {
    const pair = makeItem({ itemId: 20, category: C.SHOES, personaType: MALE });
    equip(leftA);
    equip(pair);
    expect(feet()).toEqual([20, 20]);
    equip(pair);
    expect(feet()).toEqual([null, null]);
  });

  it('a sided shoe taking a foot from a pair leaves the other foot empty', () => {
    const pair = makeItem({ itemId: 20, category: C.SHOES, personaType: MALE });
    equip(pair);
    equip(leftB);
    expect(feet()).toEqual([11, null]);
  });
});
