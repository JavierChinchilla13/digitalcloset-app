import { afterEach, describe, expect, it } from 'vitest';
import axios from 'axios';
import { networkViolations } from '../test/setup';

// RULE: no test may reach a real external host. The guard lives in src/test/setup.ts; these tests show it works for fetch and for
// axios (which uses XMLHttpRequest in jsdom), and that the machine itself stays reachable (stubbed local servers).
describe('the external-network guard', () => {
  // These tests provoke violations on purpose: clear them so the shared afterEach check does not fail them.
  afterEach(() => {
    networkViolations.splice(0);
  });

  it('refuses a fetch to a real host and records it', async () => {
    expect(() => fetch('https://api.stripe.com/v1/customers')).toThrow(/BLOCKED IN TESTS/);
    expect(networkViolations).toHaveLength(1);
  });

  it('refuses an axios call to a real host (XMLHttpRequest) and records it', async () => {
    await expect(axios.get('https://res.cloudinary.com/demo/image/upload/a.png')).rejects.toBeDefined();
    expect(networkViolations.some((v) => v.includes('res.cloudinary.com'))).toBe(true);
  });

  it('refuses the Google script host as well', () => {
    expect(() => fetch('https://accounts.google.com/gsi/client')).toThrow(/BLOCKED IN TESTS/);
  });

  it('does not refuse this machine', async () => {
    // Nothing listens there, so the call fails - but not because of the guard.
    await expect(fetch('http://localhost:9/none')).rejects.not.toThrow(/BLOCKED IN TESTS/);
    expect(networkViolations).toHaveLength(0);
  });
});
