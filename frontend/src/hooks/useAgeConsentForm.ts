import { useCallback, useMemo, useState } from 'react';
import { LEGAL_VERSION } from '../config/legal';
import { ageBandFor, type AgeBand } from '../utils/age';
import { isAgeBlocked, markAgeBlocked } from '../utils/ageGate';
import { translate } from '../i18n';

// Audit H12: the facts every sign-up gives: birth month and year, the guardian declaration (for 13-17), and the two separate acceptances.
// Shared by the sign-up form, the second step of a new Google sign-up and the "confirm your details" page.
export interface AgeConsentValues {
  birthMonth: string;
  birthYear: string;
  guardian: boolean;
  terms: boolean;
  data: boolean;
}

// What the server takes (the birth fields are left out when the account already has them recorded).
export interface AgeConsentPayload {
  birthMonth?: number;
  birthYear?: number;
  guardianAuthorized: boolean;
  termsAccepted: boolean;
  dataAuthorized: boolean;
  legalVersion: string;
}

interface Options {
  // An existing account that already has a birth month/year recorded: the form then only asks for the acceptances.
  birthKnown?: boolean;
  // The band of that recorded birth date ("MINOR" or "ADULT", as the server reports it).
  knownBand?: string | null;
}

const EMPTY: AgeConsentValues = { birthMonth: '', birthYear: '', guardian: false, terms: false, data: false };

export function useAgeConsentForm({ birthKnown = false, knownBand = null }: Options = {}) {
  const [values, setValues] = useState<AgeConsentValues>(EMPTY);
  // A refusal earlier in this tab (the flag holds no personal data).
  const [blocked, setBlocked] = useState(isAgeBlocked);

  const setField = useCallback(<K extends keyof AgeConsentValues>(field: K, value: AgeConsentValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  }, []);

  // The band the entered date gives (null until both are chosen). An existing account's recorded band is used as it is.
  const band: AgeBand | null = useMemo(() => {
    if (birthKnown) return knownBand === 'MINOR' || knownBand === 'ADULT' ? knownBand : null;
    if (!values.birthMonth || !values.birthYear) return null;
    return ageBandFor(Number(values.birthYear), Number(values.birthMonth));
  }, [birthKnown, knownBand, values.birthMonth, values.birthYear]);

  // The first thing wrong with the form, as a sentence for the person, or null when it can be sent. Under the minimum age there is
  // nothing to fix: the caller treats `band === 'UNDER_MIN'` separately (a uniform refusal, nothing sent).
  const validate = useCallback((): string | null => {
    if (!birthKnown) {
      if (!values.birthMonth || !values.birthYear) return translate('age.err.choose');
      if (band === null) return translate('age.err.check');
    }
    if (band === 'MINOR' && !values.guardian) return translate('age.err.guardian');
    if (!values.terms) return translate('age.err.terms');
    if (!values.data) return translate('age.err.data');
    return null;
  }, [birthKnown, band, values]);

  const payload = useCallback((): AgeConsentPayload => {
    const base: AgeConsentPayload = {
      guardianAuthorized: band === 'MINOR' ? values.guardian : false,
      termsAccepted: values.terms,
      dataAuthorized: values.data,
      legalVersion: LEGAL_VERSION,
    };
    return birthKnown ? base : { ...base, birthMonth: Number(values.birthMonth), birthYear: Number(values.birthYear) };
  }, [birthKnown, band, values]);

  // Records a refusal for this tab and locks the form (the same answer is shown every time).
  const block = useCallback(() => {
    markAgeBlocked();
    setBlocked(true);
  }, []);

  return { values, setField, band, validate, payload, blocked, block };
}

export type AgeConsentForm = ReturnType<typeof useAgeConsentForm>;
