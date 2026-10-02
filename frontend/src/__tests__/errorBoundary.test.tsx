import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ErrorBoundary from '../components/ErrorBoundary';
import PersonaRenderer from '../components/PersonaRenderer';
import { useClothingStore } from '../store/useClothingStore';
import { PersonaType } from '../types';
import type { ClothingItem, PersonaState } from '../types';

// Task 22: a render crash must show recoverable UI, never a blank screen.
let shouldCrash = true;
function Bomb() {
  if (shouldCrash) throw new Error('kaboom');
  return <p>all good</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldCrash = true;
    // React and the boundary both log the caught error; keep the output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the recoverable fallback instead of a blank screen', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText("We couldn't complete this action")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('Try Again re-renders the children once the cause is gone', async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    shouldCrash = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onReset when the user retries', async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorBoundary onReset={onReset}>
        <Bomb />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('a custom fallback receives the error', () => {
    render(
      <ErrorBoundary fallback={({ error }) => <p>custom: {error.message}</p>}>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('custom: kaboom')).toBeInTheDocument();
  });

  it('resets on its own when a resetKey changes (e.g. navigating to another page)', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['/a']}>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldCrash = false;
    rerender(
      <ErrorBoundary resetKeys={['/b']}>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('a crash inside PersonaRenderer is contained, not propagated', () => {
    // Corrupt store data makes the renderer throw while rendering (items.find
    // on a non-array); the boundary around it must catch that and leave the
    // rest of the page alone.
    useClothingStore.setState({ items: null as unknown as ClothingItem[] });
    const persona: PersonaState = {
      type: PersonaType.FEMALE,
      topIds: [1],
      bottomIds: [],
      leftShoeId: null,
      rightShoeId: null,
      accessoryIds: [],
      jacketIds: [],
      dressIds: [],
    };

    render(
      <div>
        <p>rest of the page</p>
        <PersonaRenderer persona={persona} />
      </div>
    );

    expect(screen.getByText('rest of the page')).toBeInTheDocument();
    expect(screen.getByText("Couldn't show this preview")).toBeInTheDocument();
  });
});
