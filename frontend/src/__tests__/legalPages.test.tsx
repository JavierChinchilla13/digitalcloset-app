import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PrivacyPage from '../pages/PrivacyPage';
import TermsPage from '../pages/TermsPage';
import { Marker } from '../components/LegalLayout';
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

  it('the texts are final: no marker remains, and the draft notice is gone', () => {
    expect(LEGAL_IS_DRAFT).toBe(false);
    for (const page of [privacy(), terms()]) {
      expect(page).not.toMatch(/\[(PLACEHOLDER|PROPOSAL)/);
      expect(page).not.toMatch(/Draft for review/i);
      expect(page).not.toMatch(/has not been reviewed by a lawyer/i);
    }
    const { container } = render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );
    expect(container.querySelector('[role="note"]')).toBeNull();
  });

  it('shows the neutral "Last updated" line', () => {
    expect(privacy()).toContain('Last updated: November 17, 2026');
    expect(terms()).toContain('Last updated: November 17, 2026');
  });

  it('claims neither compliance nor a legal review', () => {
    for (const page of [privacy(), terms()]) {
      expect(page).not.toMatch(/\bcompl(y|ies|iant|iance)\b/i);
      expect(page).not.toMatch(/(has been|was|is) (legally )?(reviewed|approved|certified) by/i);
      expect(page).not.toMatch(/lawyer|legal review/i);
    }
  });

  it('the Marker used for gaps (while a page is a draft) is spelled out in words, readable without colour', () => {
    const { container } = render(
      <>
        <Marker kind="PLACEHOLDER">a fact</Marker>
        <Marker kind="PROPOSAL">a suggestion</Marker>
      </>
    );
    expect(container.textContent).toBe('[PLACEHOLDER: a fact][PROPOSAL: a suggestion]');
  });
});

describe('the owner facts are in the texts', () => {
  it('an individual runs the service, with the published address, the contact email and who answers', () => {
    const page = privacy();
    expect(page).toContain('Javier Chinchilla Lugo, an individual');
    expect(page).toContain('Address: San José, Costa Rica');
    expect(page).toContain(LEGAL.contactEmail);
    expect(page).toContain('Javier Chinchilla Lugo answers these requests personally');
    expect(terms()).toContain('Javier Chinchilla Lugo, an individual');
  });

  it('every provider is placed in the United States without naming a region', () => {
    const page = privacy();
    expect((page.match(/Located in the United States/g) ?? []).length).toBe(6);
    expect(page).not.toMatch(/us-east|us-west|eu-|Virginia|Oregon|Ohio/i);
  });

  it('says Stripe and Google AdSense are planned and not active yet', () => {
    const page = privacy();
    expect(page).toMatch(/Stripe[\s\S]{0,80}Planned, not active yet/);
    expect(page).toMatch(/Google AdSense[\s\S]{0,120}Planned, not active yet/);
  });

  it('describes the manual backups (no schedule, the latest 14) and the 30-day rules', () => {
    const page = privacy();
    expect(page).toMatch(/by hand, with no fixed schedule, and keep the latest 14/);
    expect(page).toMatch(/at most that window of 14 backups/);
    expect(page).toMatch(/within 30 days of the deletion/);
    expect(page).toMatch(/erased after 30 days/);
    expect(page).toMatch(/keep no backups made by the database provider/);
  });

  it('keeps the text for existing accounts asked once for birth month and year', () => {
    expect(privacy()).toMatch(/Accounts created before we asked for the birth month and year are asked for them once, at their next sign-in/);
  });

  it('states the effective date, the governing law and the courts of San José', () => {
    expect(privacy()).toContain('takes effect on November 17, 2026');
    expect(terms()).toContain('takes effect on November 17, 2026');
    expect(terms()).toMatch(/governed by the law of Costa Rica;\s*the courts of San José, Costa Rica apply/);
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
