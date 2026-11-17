import { describe, expect, it } from 'vitest';
import { estimateStrength, generatePassphrase, isAcceptableArchivePassword } from '../utils/passphrase';

describe('generatePassphrase', () => {
  it('gives six groups of four characters from the readable alphabet (no look-alikes)', () => {
    const value = generatePassphrase();
    expect(value).toMatch(/^[a-hj-km-np-z2-9]{4}(-[a-hj-km-np-z2-9]{4}){5}$/);
    expect(value).not.toMatch(/[01ilo]/);
    expect(value).toHaveLength(29);
  });

  it('uses crypto.getRandomValues: a fixed source gives a fixed answer, and different sources differ', () => {
    const fixed = (byte: number) =>
      ({ getRandomValues: (a: Uint8Array) => { a.fill(byte); return a; } }) as unknown as Crypto;
    expect(generatePassphrase(fixed(0))).toBe('aaaa-aaaa-aaaa-aaaa-aaaa-aaaa');
    expect(generatePassphrase(fixed(1))).toBe('bbbb-bbbb-bbbb-bbbb-bbbb-bbbb');
    // 255 is above the rejection limit (248 = 8 * 31): those bytes are skipped, not wrapped, so a source of only 255s never finishes
    // on its own; mix them with good bytes and the result still uses only the good ones.
    let calls = 0;
    const mixed = { getRandomValues: (a: Uint8Array) => { a.fill(calls++ === 0 ? 255 : 2); return a; } } as unknown as Crypto;
    expect(generatePassphrase(mixed)).toBe('cccc-cccc-cccc-cccc-cccc-cccc');
  });

  it('is different every time with the real random source', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generatePassphrase()));
    expect(seen.size).toBe(50);
  });

  it('every generated passphrase is judged strong', () => {
    for (let i = 0; i < 20; i++) expect(estimateStrength(generatePassphrase()).score).toBe(4);
  });

  it('is evenly spread: over many draws every character appears, none is wildly favoured', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 400; i++) for (const c of generatePassphrase().replaceAll('-', '')) counts.set(c, (counts.get(c) ?? 0) + 1);
    expect(counts.size).toBe(31);
    const values = [...counts.values()];
    // 9,600 draws over 31 characters: about 310 each; a biased modulo would show clearly.
    expect(Math.min(...values)).toBeGreaterThan(220);
    expect(Math.max(...values)).toBeLessThan(410);
  });
});

describe('estimateStrength', () => {
  it('under 12 characters is too short', () => {
    expect(estimateStrength('Short1!')).toMatchObject({ score: 0, label: 'Too short' });
    expect(isAcceptableArchivePassword('Short1!')).toBe(false);
  });

  it('common or patterned passwords are weak even when long enough', () => {
    for (const weak of ['password1234', 'qwertyuiop12', '111111111111', 'abcdefabcdef', 'MyBackup123456']) {
      expect(estimateStrength(weak).score, weak).toBeLessThanOrEqual(1);
      expect(isAcceptableArchivePassword(weak), weak).toBe(false);
    }
  });

  it('a long mixed password or a passphrase is accepted', () => {
    expect(isAcceptableArchivePassword('Tr0ub4dor&3-horse-9')).toBe(true);
    expect(isAcceptableArchivePassword('correct horse battery staple')).toBe(true);
    expect(estimateStrength('correct horse battery staple').score).toBeGreaterThanOrEqual(3);
  });

  it('refuses one that contains the account password', () => {
    const result = estimateStrength('xx-Sup3r-secret-pw-xx', ['Sup3r-secret-pw']);
    expect(result.score).toBe(1);
    expect(result.hints.join(' ')).toMatch(/account password/i);
  });

  it('explains what to change', () => {
    expect(estimateStrength('Short1!').hints[0]).toMatch(/at least 12/i);
    expect(estimateStrength('password1234').hints.join(' ')).toMatch(/common/i);
    expect(estimateStrength('aaaaaaaaaaaaaa').hints.length).toBeGreaterThan(0);
  });
});
