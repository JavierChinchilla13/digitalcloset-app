import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ClosetPage from '../pages/ClosetPage';
import FlatOutfitBuilderPage from '../pages/FlatOutfitBuilderPage';
import PersonaBadge, { ItemPersonaBadge } from '../components/PersonaBadge';
import { ToastProvider } from '../components/Toast';
import { personaSign } from '../utils/personaSign';
import { useClothingStore } from '../store/useClothingStore';
import { useOutfitStore } from '../store/useOutfitStore';
import { useOutfitDraftStore } from '../store/useOutfitDraftStore';
import { useCollectionStore } from '../store/useCollectionStore';
import { usePersonaSettingsStore } from '../store/usePersonaSettingsStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { clothingService } from '../api/clothingService';
import { outfitService } from '../api/outfitService';
import { collectionService } from '../api/collectionService';
import { personaDisplayNameService } from '../api/personaDisplayNameService';
import { ClothingCategory, PersonaStatus, PersonaType } from '../types';
import { makeItem } from '../test/fixtures';

vi.mock('../api/clothingService', () => ({
  clothingService: { getClothingItems: vi.fn(), updateClothingItem: vi.fn(), deleteClothingItem: vi.fn() },
}));
vi.mock('../api/outfitService', () => ({ outfitService: { getOutfits: vi.fn(async () => []) } }));
vi.mock('../api/collectionService', () => ({ collectionService: { getCollections: vi.fn(async () => []) } }));
vi.mock('../api/personaDisplayNameService', () => ({
  personaDisplayNameService: { getAll: vi.fn(async () => []), upsert: vi.fn(), reset: vi.fn() },
}));
vi.mock('../components/FittingTool/UploadFlow', () => ({ default: () => null }));

const nameOf = (type: PersonaType) => (type === PersonaType.MALE ? 'M Persona' : 'F Persona');

// Task 77: every garment card carries a sign saying which persona it is for,
// or that it is "Not fitted" / "Unassigned".
describe('personaSign (the wording rules)', () => {
  it('a fitted garment shows its persona name', () => {
    const sign = personaSign({ personaType: PersonaType.MALE, personaStatus: PersonaStatus.FITTED }, nameOf);

    expect(sign).toMatchObject({ label: 'M Persona', tone: 'persona' });
  });

  it('a legacy garment with no status is treated as fitted', () => {
    const sign = personaSign({ personaType: PersonaType.FEMALE, personaStatus: undefined }, nameOf);

    expect(sign).toMatchObject({ label: 'F Persona', tone: 'persona' });
  });

  it('uses the custom persona name the user chose', () => {
    const sign = personaSign({ personaType: PersonaType.MALE }, () => 'Dad');

    expect(sign.label).toBe('Dad');
  });

  it('a garment saved without fitting is "Not fitted" and still names its persona in the tooltip', () => {
    const sign = personaSign({ personaType: PersonaType.FEMALE, personaStatus: PersonaStatus.NOT_FITTED }, nameOf);

    expect(sign).toMatchObject({ label: 'Not fitted', tone: 'not-fitted' });
    expect(sign.title).toContain('F Persona');
  });

  it('a garment saved with no persona at all is "Unassigned"', () => {
    const sign = personaSign(
      { personaType: PersonaType.MALE, personaStatus: PersonaStatus.INELIGIBLE_NO_CUTOUT },
      nameOf
    );

    expect(sign).toMatchObject({ label: 'Unassigned', tone: 'unassigned' });
  });
});

describe('PersonaBadge', () => {
  beforeEach(() => {
    usePersonaSettingsStore.setState({ displayNames: {} });
    useClothingStore.setState({ items: [] });
  });

  it('renders the sign with an accessible description', () => {
    render(<PersonaBadge item={{ personaType: PersonaType.MALE, personaStatus: PersonaStatus.FITTED }} />);

    expect(screen.getByText('M Persona')).toBeInTheDocument();
    expect(screen.getByLabelText('Fitted to M Persona')).toHaveAttribute('data-persona-sign', 'persona');
  });

  it('follows a renamed persona', () => {
    usePersonaSettingsStore.setState({ displayNames: { [PersonaType.MALE]: 'Dad' } });

    render(<PersonaBadge item={{ personaType: PersonaType.MALE }} />);

    expect(screen.getByText('Dad')).toBeInTheDocument();
  });

  it('ItemPersonaBadge looks the garment up by id, and renders nothing for an unknown id', () => {
    useClothingStore.setState({
      items: [makeItem({ itemId: 9, personaStatus: PersonaStatus.INELIGIBLE_NO_CUTOUT })],
    });

    const { container, rerender } = render(<ItemPersonaBadge itemId={9} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();

    rerender(<ItemPersonaBadge itemId={12345} />);
    expect(container).toBeEmptyDOMElement();
  });
});

const FITTED = makeItem({ itemId: 1, name: 'Fitted Shirt', personaStatus: PersonaStatus.FITTED });
const NOT_FITTED = makeItem({ itemId: 2, name: 'Loose Jeans', category: ClothingCategory.BOTTOM, personaStatus: PersonaStatus.NOT_FITTED });
const NO_PERSONA = makeItem({ itemId: 3, name: 'Plain Scarf', category: ClothingCategory.ACCESSORY, personaStatus: PersonaStatus.INELIGIBLE_NO_CUTOUT });

// The sign has to be on the cards people actually browse, not just exist as a
// component. Each of the three states must show up on each screen.
describe('persona sign on the garment screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePersonaSettingsStore.setState({ displayNames: {} });
    // The fixtures are female garments; Attire only lists the active persona's.
    usePersonaStore.getState().setPersonaType(PersonaType.FEMALE);
    useClothingStore.setState({ items: [], isLoading: false, error: null });
    useOutfitStore.setState({ outfits: [], isLoading: false, error: null });
    useCollectionStore.setState({ collections: [], isLoading: false, error: null });
    useOutfitDraftStore.getState().clearDraft();
    vi.mocked(clothingService.getClothingItems).mockResolvedValue([FITTED, NOT_FITTED, NO_PERSONA]);
    vi.mocked(outfitService.getOutfits).mockResolvedValue([]);
    vi.mocked(collectionService.getCollections).mockResolvedValue([]);
    vi.mocked(personaDisplayNameService.getAll).mockResolvedValue([]);
  });

  it('Closet cards', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <ClosetPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await screen.findByText('Fitted Shirt');

    expect(screen.getAllByText('F Persona').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not fitted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
  });

  it('Attire browse cards, and the selection panel once a garment is picked', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/outfits/flat/new']}>
        <ToastProvider>
          <Routes>
            <Route path="/outfits/flat/new" element={<FlatOutfitBuilderPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await screen.findByText('Fitted Shirt');
    // The browse grid shows a sign for all three, whatever the persona filter.
    const signs = () =>
      Array.from(container.querySelectorAll('[data-persona-sign]')).map((el) => el.getAttribute('data-persona-sign'));
    expect(signs()).toEqual(expect.arrayContaining(['persona', 'not-fitted', 'unassigned']));

    // Pick a garment: it appears in the selection panel with its own sign too.
    const before = signs().length;
    await userEvent.setup().click(screen.getByText('Loose Jeans'));
    await waitFor(() => expect(signs().length).toBeGreaterThan(before));
    expect(useOutfitDraftStore.getState().selectedItemIds).toEqual([2]);
  });
});
