import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import FirstRunPanel from '../components/FirstRunPanel';
import { useClothingStore } from '../store/useClothingStore';
import { useAuthStore } from '../store/useAuthStore';
import { makeItems, makeUser } from '../test/fixtures';

// Task 101: the first-run guide.

const renderPanel = (props: { outfitCount?: number } = {}) =>
  render(
    <MemoryRouter>
      <FirstRunPanel {...props} />
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  useAuthStore.getState().login('token', makeUser());
  useClothingStore.setState({ items: [], isLoading: false, error: null });
});

describe('the first-run panel', () => {
  it('shows for an empty closet with the three steps', () => {
    renderPanel();

    expect(screen.getByTestId('first-run-panel')).toBeInTheDocument();
    expect(screen.getByText('Add a few pieces')).toBeInTheDocument();
    expect(screen.getByText('Build an outfit')).toBeInTheDocument();
    expect(screen.getByText('See it in your Showcase')).toBeInTheDocument();
    expect(screen.queryByText(/sample/i)).not.toBeInTheDocument();
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
