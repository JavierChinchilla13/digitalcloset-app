import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PrivacyPage from '../pages/PrivacyPage';
import TermsPage from '../pages/TermsPage';
import { LEGAL, LEGAL_IS_DRAFT } from '../config/legal';

// The Terms and the Privacy Policy: what they must say to match the app, and the rule that the "draft" notice cannot be switched off
// while a visible [PLACEHOLDER: ...] / [PROPOSAL: ...] is still in the text.
const text = (page: React.ReactElement) => {
  const { container, unmount } = render(<MemoryRouter>{page}</MemoryRouter>);
  const content = container.textContent ?? '';
  unmount();
  return content.replace(/\s+/g, ' ');
};
const privacy = () => text(<PrivacyPage />);
const terms = () => text(<TermsPage />);

describe('the draft rule', () => {
  it('LEGAL_IS_DRAFT cannot be false while a [PLACEHOLDER] or [PROPOSAL] marker is still on a page', () => {
    if (LEGAL_IS_DRAFT) return; // still a draft: markers are allowed (and expected)
    for (const page of [privacy(), terms()]) {
      expect(page).not.toMatch(/\[(PLACEHOLDER|PROPOSAL)/);
    }
  });

  it('while it is a draft, the notice is shown and does not name Costa Rica as a gap', () => {
    const { container } = render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );
    const note = container.querySelector('[role="note"]');
    expect(LEGAL_IS_DRAFT).toBe(true);
    expect(note?.textContent).toMatch(/has not been reviewed by a lawyer/i);
    expect(note?.textContent).toMatch(/\[PLACEHOLDER\]/);
    expect(note?.textContent).toMatch(/\[PROPOSAL\]/);
    expect(note?.textContent).not.toMatch(/costa rica/i);
  });

  it('the markers are spelled out in words (readable without colour)', () => {
    expect(privacy()).toMatch(/\[PLACEHOLDER: [^\]]+\]/);
    expect(privacy()).toMatch(/\[PROPOSAL: [^\]]+\]/);
  });

  it('claims neither compliance nor a legal review', () => {
    for (const page of [privacy(), terms()]) {
      expect(page).not.toMatch(/\bcompl(y|ies|iant|iance)\b/i);
      expect(page).not.toMatch(/(has been|was|is) (legally )?(reviewed|approved|certified) by/i);
    }
  });
});

describe('the Privacy Policy matches what the app does', () => {
  it('names the real database provider (Supabase, not Neon) and the other providers', () => {
    const page = privacy();
    expect(page).toMatch(/Supabase/);
    expect(page).not.toMatch(/Neon/);
    for (const name of ['Render', 'Cloudinary', 'Google', 'Stripe', 'Sentry']) expect(page).toContain(name);
  });

  it('lists every outside host the browser contacts, and says they can see the visitor\'s IP address', () => {
    const page = privacy();
    for (const host of [
      'accounts.google.com',
      'api.cloudinary.com',
      'res.cloudinary.com',
      'cdn.jsdelivr.net',
      'staticimgly.com',
      'huggingface.co',
      'checkout.stripe.com',
    ]) {
      expect(page, host).toContain(host);
    }
    expect(page).toMatch(/can see your IP address/i);
  });

  it('says Google loads only on click', () => {
    expect(privacy()).toMatch(/only after you click "Continue with Google"/i);
  });

  it('describes the age rules, the declaration, and what is stored', () => {
    const page = privacy();
    expect(page).toMatch(/birth month and year \(never the day\)/i);
    expect(page).toMatch(/at least 13/i);
    expect(page).toMatch(/we do not verify this/i);
    expect(page).toMatch(/do not store or log/i);
  });

  it('covers transfers abroad, deletion, export, backups, the image queue, the 5-business-day answer and PRODHAB', () => {
    const page = privacy();
    expect(page).toMatch(/outside Costa Rica/i);
    expect(page).toMatch(/Delete my account and data/);
    expect(page).toMatch(/Download my data/);
    expect(page).toMatch(/backups/i);
    expect(page).toMatch(/addresses are queued/i);
    expect(page).toMatch(/within 5 business days/i);
    expect(page).toMatch(/PRODHAB/);
  });

  it('lists the browser storage keys the app really uses', () => {
    const page = privacy();
    for (const key of [
      'auth-storage',
      'clothing-closet-storage',
      'closet-favorites',
      'persona-storage',
      'vysvi-theme',
      'vysvi-consent',
      'vysvi-onboarding',
      'session-expired',
      'vysvi-login-notice',
      'vysvi-age-blocked',
    ]) {
      expect(page, key).toContain(key);
    }
  });

  it('keeps the contact email as configured', () => {
    expect(privacy()).toContain(LEGAL.contactEmail);
    expect(terms()).toContain(LEGAL.contactEmail);
  });
});

describe('the Terms match what the app does', () => {
  it('states the minimum age, the guardian declaration as a declaration, and Premium for adults only', () => {
    const page = terms();
    expect(page).toMatch(/at least 13 years old/i);
    expect(page).toMatch(/This is a declaration: we do not verify it/i);
    expect(page).toMatch(/18 or older/i);
    expect(page).toMatch(/13 to 17 do not see advertising/i);
  });

  it('describes acceptance, deletion and export, and no longer offers deactivation', () => {
    const page = terms();
    expect(page).toMatch(/we record which version you accepted and when/i);
    expect(page).toMatch(/Delete my account and data/);
    expect(page).toMatch(/Download my data/);
    expect(page).not.toMatch(/deactivate your account/i);
  });
});
