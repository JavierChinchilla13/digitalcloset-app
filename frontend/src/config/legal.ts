// Task 99: the facts the Privacy Policy and Terms are written around, in one place so they are
// easy to review and change. These pages are DRAFTS written in plain language for the owner to
// check (ideally with a lawyer before charging money): while LEGAL_IS_DRAFT is true they say so.
export const LEGAL = {
  operator: 'Javier Chinchilla Lugo',
  contactEmail: 'javidilugo@gmail.com',
  siteName: 'VYSVI',
  siteUrl: 'https://vysvi-web.onrender.com',
  lastUpdated: 'November 17, 2026',
  // The date this version of the texts takes effect.
  effectiveDate: 'November 17, 2026',
  // What is published as the way to reach the person who runs the service (with the contact email). Whether this is enough for the
  // controller-address rule of Costa Rica's data protection law is an open question for the lawyer (see the lawyer brief).
  address: 'San José, Costa Rica',
  // The courts that apply.
  courts: 'the courts of San José, Costa Rica',
  // The country whose law governs these terms.
  country: 'Costa Rica',
} as const;

// The version of the Terms and Privacy Policy a person accepts when signing up; stored with the acceptance. It must equal
// LegalVersion.CURRENT in the backend (a backend test compares the two). While the texts are a draft it reads YYYY-MM-draft-N.
export const LEGAL_VERSION = '2026-11-draft-1';

// Flip to false once the owner has reviewed both pages and EVERY [PLACEHOLDER: ...] / [PROPOSAL: ...] marker is gone from them: it removes
// the "draft" notice. A test (legalPages.test.tsx) fails the build if this is false while a marker remains. The notice claims neither a
// legal review nor compliance, and its replacement ("Last updated <date>") must not either.
export const LEGAL_IS_DRAFT = false;
