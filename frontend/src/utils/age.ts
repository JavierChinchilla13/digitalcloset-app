// Audit H12: the age rules the sign-up form shows, mirroring the server (AgePolicy.java), which is the one that decides. The age comes from a
// birth MONTH and YEAR only (never the day) and is worked out conservatively: you turn N at the END of your birth month. The two ages
// live here and on the server in one place each, because the Costa Rican data protection bill may change them.
export const MIN_AGE = 13;
export const ADULT_AGE = 18;

export type AgeBand = 'UNDER_MIN' | 'MINOR' | 'ADULT';


// The band for a birth month/year, or null when the date is not usable (month outside 1-12, before 1900, or in the future).
export function ageBandFor(birthYear: number, birthMonth: number, today: Date = new Date()): AgeBand | null {
  if (!Number.isInteger(birthYear) || !Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12 || birthYear < 1900) return null;
  // UTC, like the server, so both sides agree on the month.
  const monthsElapsed = today.getUTCFullYear() * 12 + (today.getUTCMonth() + 1) - (birthYear * 12 + birthMonth);
  if (monthsElapsed < 0) return null;
  const age = Math.floor((monthsElapsed - 1) / 12);
  if (age < MIN_AGE) return 'UNDER_MIN';
  if (age < ADULT_AGE) return 'MINOR';
  return 'ADULT';
}

// The years offered in the birth-year list: this year back 100 years (newest first), never before 1900.
export function birthYearOptions(today: Date = new Date()): number[] {
  const last = today.getUTCFullYear();
  const years: number[] = [];
  for (let year = last; year >= Math.max(1900, last - 100); year--) years.push(year);
  return years;
}
