// The archive password of an admin backup: a generator that uses the browser's cryptographic random numbers, and a simple strength
// check. No library: the generator picks characters with crypto.getRandomValues (rejection sampling, so none is more likely than
// another) and the check is a rough estimate with a few plain rules. It exists to stop an obviously weak password protecting a file that
// holds every user's email and password hash; it is not a promise of strength.

// 31 characters with no look-alikes (no 0/o, 1/l/i): easy to read out or type from a password manager.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const GROUPS = 6;
const GROUP_LENGTH = 4;

// Six groups of four, e.g. "k7m2-q9xa-4tnd-hw3c-p8ze-r5bv": 24 characters, about 119 bits.
export function generatePassphrase(random: Crypto = crypto): string {
  const needed = GROUPS * GROUP_LENGTH;
  const limit = 256 - (256 % ALPHABET.length);   // bytes at or above this would favour the first characters: skipped
  const picked: string[] = [];
  while (picked.length < needed) {
    const bytes = new Uint8Array(needed * 2);
    random.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < limit && picked.length < needed) picked.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i++) groups.push(picked.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH).join(''));
  return groups.join('-');
}

export const MIN_ARCHIVE_PASSWORD_LENGTH = 12;

export type StrengthLabel = 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';

export interface Strength {
  // 0 = too short, 1 = weak, 2 = fair, 3 = good, 4 = strong. 2 and up may be used.
  score: 0 | 1 | 2 | 3 | 4;
  label: StrengthLabel;
  // What to change, in plain words (empty when there is nothing to say).
  hints: string[];
}

const COMMON = ['password', 'passw0rd', 'qwerty', 'letmein', 'welcome', 'admin', 'vysvi', 'iloveyou', 'abc123', '123456', 'changeme', 'backup'];

const LABELS: StrengthLabel[] = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

// A rough estimate: bits = length x log2(size of the character pool used), then cut down for obvious patterns. `forbidden` are
// strings that must not be part of it (the admin's own account password).
export function estimateStrength(password: string, forbidden: string[] = []): Strength {
  const hints: string[] = [];
  if (password.length < MIN_ARCHIVE_PASSWORD_LENGTH) {
    return { score: 0, label: 'Too short', hints: [`Use at least ${MIN_ARCHIVE_PASSWORD_LENGTH} characters.`] };
  }

  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 32;
  let bits = password.length * Math.log2(Math.max(pool, 2));

  const unique = new Set(password).size;
  if (unique < 6) {
    bits = Math.min(bits, 25);
    hints.push('Too many repeated characters.');
  }
  if (/(.)\1{2,}/.test(password)) {
    bits -= 12;
    hints.push('Avoid repeating the same character.');
  }
  if (/(.{3,})\1/.test(password)) {
    bits -= 20;
    hints.push('Avoid repeating a pattern.');
  }
  if (/(?:012|123|234|345|456|567|678|789|abc|bcd|cde|def|qwe|wer|ert|asd|sdf|zxc)/i.test(password)) {
    bits -= 12;
    hints.push('Avoid runs like 123 or abc.');
  }
  const lower = password.toLowerCase();
  if (COMMON.some((word) => lower.includes(word))) {
    bits = Math.min(bits, 30);
    hints.push('Avoid common words such as "password".');
  }
  if (forbidden.some((f) => f.length >= 4 && lower.includes(f.toLowerCase()))) {
    bits = Math.min(bits, 20);
    hints.push('It must not contain your account password.');
  }

  const score = bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  if (score <= 2 && hints.length === 0) hints.push('Longer, or mixed with other kinds of characters, is stronger. Or press "Generate passphrase".');
  return { score: score as Strength['score'], label: LABELS[score], hints };
}

// A password that may be used for an archive: long enough and at least "Fair".
export function isAcceptableArchivePassword(password: string, forbidden: string[] = []): boolean {
  return estimateStrength(password, forbidden).score >= 2;
}
