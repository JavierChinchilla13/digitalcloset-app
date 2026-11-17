import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PrivacyPage from '../pages/PrivacyPage';
import { LEGAL_VERSION } from '../config/legal';

// The admin "Download backup" adds one sentence to the Privacy Policy's retention list. It adds no new use of data and no provider, so
// the legal version does not change (a decision recorded here so a change of the version is a conscious one).
describe('the Privacy Policy and the admin backup download', () => {
  it('says that backups downloaded from the administration area are encrypted, never stored on the server and deleted within 90 days', () => {
    const { container } = render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toMatch(/Backups downloaded from the administration area are encrypted with a password chosen at the time, are never stored on the server, and are deleted within 90 days/);
  });

  it('leaves the legal version as it was', () => {
    expect(LEGAL_VERSION).toBe('2026-11-draft-1');
  });
});
