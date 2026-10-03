import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ModalShell from '../components/ModalShell';

// Task 91: the shared pop-up frame - closes from the backdrop only, and its card is
// capped to the visible screen height (dvh) and scrolls instead of being cut off.
describe('ModalShell', () => {
  it('renders nothing while closed', () => {
    render(<ModalShell isOpen={false} onClose={() => {}}><p>inside</p></ModalShell>);
    expect(screen.queryByText('inside')).not.toBeInTheDocument();
  });

  it('shows its content in a card limited to the visible height, scrolling when taller', () => {
    render(<ModalShell isOpen onClose={() => {}} className="max-w-md"><p>inside</p></ModalShell>);
    const card = screen.getByText('inside').parentElement as HTMLElement;
    expect(card.className).toContain('max-h-[calc(100dvh-1.5rem)]');
    expect(card.className).toContain('overflow-y-auto');
    expect(card.className).toContain('max-w-md'); // the caller's own classes are kept
  });

  it('a tap on the backdrop closes it, a tap inside the card does not', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<ModalShell isOpen onClose={onClose}><button>inside</button></ModalShell>);

    await user.click(screen.getByText('inside'));
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = container.querySelector('.absolute.inset-0') as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
