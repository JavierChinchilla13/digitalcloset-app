import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import MountOnFirstOpen from '../components/MountOnFirstOpen';

// Task 100: lazy modals are only mounted (and so only downloaded) once they have been opened.
describe('MountOnFirstOpen', () => {
  it('renders nothing while it has never been open', () => {
    render(
      <MountOnFirstOpen open={false}>
        <p>HEAVY MODAL</p>
      </MountOnFirstOpen>
    );
    expect(screen.queryByText('HEAVY MODAL')).not.toBeInTheDocument();
  });

  it('mounts on the first open and stays mounted after it closes', () => {
    const { rerender } = render(
      <MountOnFirstOpen open={false}>
        <p>HEAVY MODAL</p>
      </MountOnFirstOpen>
    );

    rerender(
      <MountOnFirstOpen open>
        <p>HEAVY MODAL</p>
      </MountOnFirstOpen>
    );
    expect(screen.getByText('HEAVY MODAL')).toBeInTheDocument();

    rerender(
      <MountOnFirstOpen open={false}>
        <p>HEAVY MODAL</p>
      </MountOnFirstOpen>
    );
    expect(screen.getByText('HEAVY MODAL')).toBeInTheDocument();
  });
});
