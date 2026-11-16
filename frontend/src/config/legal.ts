// Task 99: the facts the Privacy Policy and Terms are written around, in one place so they are
// easy to review and change. These pages are DRAFTS written in plain language for the owner to
// check (ideally with a lawyer before charging money): while LEGAL_IS_DRAFT is true they say so.
export const LEGAL = {
  operator: 'Javier Chinchilla Lugo',
  contactEmail: 'javidilugo@gmail.com',
  siteName: 'VYSVI',
  siteUrl: 'https://vysvi-web.onrender.com',
  lastUpdated: 'November 5, 2026',
  // The country whose law governs these terms.
  country: 'Costa Rica',
} as const;

// The version of the Terms and Privacy Policy a person accepts when signing up; stored with the acceptance. It must equal
// LegalVersion.CURRENT in the backend (a backend test compares the two). While the texts are a draft it reads YYYY-MM-draft-N.
export const LEGAL_VERSION = '2026-11-draft-1';

// Flip to false once the owner has reviewed both pages: removes the "draft" notice from them.
export const LEGAL_IS_DRAFT = true;
