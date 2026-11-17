import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

// Audit H12: fills the age and consent part of a sign-up form in a test: birth month/year chosen from the real selects, then the
// two acceptances (and the guardian box when asked). `yearsAgo` is counted from the current UTC year, in January, which is
// always a full year or more back.
export async function fillAgeAndConsent(
  user: ReturnType<typeof userEvent.setup>,
  opts: { yearsAgo?: number; guardian?: boolean; terms?: boolean; data?: boolean } = {}
) {
  const { yearsAgo = 30, guardian = false, terms = true, data = true } = opts;
  await user.selectOptions(screen.getByLabelText(/^month$/i), 'January');
  await user.selectOptions(screen.getByLabelText(/^year$/i), String(new Date().getUTCFullYear() - yearsAgo));
  if (guardian) await user.click(screen.getByLabelText(/legal guardian authorises/i));
  if (terms) await user.click(screen.getByLabelText(/i accept the/i));
  if (data) await user.click(screen.getByLabelText(/i authorise the processing/i));
}
