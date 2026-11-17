import { Link } from 'react-router-dom';
import type { AgeConsentForm } from '../hooks/useAgeConsentForm';
import { birthYearOptions, MONTH_NAMES } from '../utils/age';

// Audit H12: the age and consent part of every sign-up: birth month and year (never the day), the guardian declaration for 13-17 and
// the two separate, never pre-ticked acceptances. Used by the sign-up form, the second step of a new Google sign-up and the
// "confirm your details" page. Plain native controls: labelled, reachable by keyboard, 44 px high, readable at 375 px.
//
// The wording is deliberately neutral about the age: it never states a minimum, so the form does not teach anyone what to type. The
// guardian box is a DECLARATION; the text says VYSVI does not verify it.
const labelClass = 'text-[10px] font-medium tracking-[0.3em] text-accent uppercase';
const selectClass =
  'w-full min-h-[48px] bg-background-secondary border border-ink/5 rounded-2xl py-3 px-4 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50';
const checkRow = 'flex items-start gap-3 min-h-[44px] py-2 cursor-pointer';
const checkBox = 'mt-0.5 h-5 w-5 shrink-0 rounded accent-accent cursor-pointer focus-visible:ring-2 focus-visible:ring-accent/60';
const linkClass = 'underline underline-offset-2 text-text-primary hover:text-accent';

interface AgeAndConsentFieldsProps {
  form: AgeConsentForm;
  // Prefix for the element ids (several forms can exist on a page).
  idPrefix: string;
  disabled?: boolean;
  // An existing account that already has its birth month/year: only the acceptances (and the guardian box for 13-17) are asked.
  birthKnown?: boolean;
}

const AgeAndConsentFields = ({ form, idPrefix, disabled = false, birthKnown = false }: AgeAndConsentFieldsProps) => {
  const { values, setField, band } = form;
  const off = disabled || form.blocked;
  const years = birthYearOptions();
  const helpId = `${idPrefix}-dob-help`;

  return (
    <div className="space-y-6">
      {!birthKnown && (
        <fieldset className="space-y-2" disabled={off}>
          <legend className={`${labelClass} pl-4 mb-2`}>Date of birth</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor={`${idPrefix}-month`} className="block text-xs text-text-secondary pl-4">Month</label>
              <select
                id={`${idPrefix}-month`}
                name="birthMonth"
                required
                autoComplete="bday-month"
                aria-describedby={helpId}
                value={values.birthMonth}
                onChange={(e) => setField('birthMonth', e.target.value)}
                className={selectClass}
              >
                <option value="">Choose</option>
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${idPrefix}-year`} className="block text-xs text-text-secondary pl-4">Year</label>
              <select
                id={`${idPrefix}-year`}
                name="birthYear"
                required
                autoComplete="bday-year"
                aria-describedby={helpId}
                value={values.birthYear}
                onChange={(e) => setField('birthYear', e.target.value)}
                className={selectClass}
              >
                <option value="">Choose</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          <p id={helpId} className="text-xs text-text-secondary leading-relaxed pl-4">
            We ask for your birth month and year to set up your account. We never keep the day.
          </p>
        </fieldset>
      )}

      {/* The guardian declaration appears (and is announced) only for the 13-17 group. */}
      <div aria-live="polite">
        {band === 'MINOR' && (
          <div className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-4 space-y-1">
            <label className={checkRow}>
              <input
                type="checkbox"
                name="guardianAuthorized"
                checked={values.guardian}
                onChange={(e) => setField('guardian', e.target.checked)}
                disabled={off}
                className={checkBox}
              />
              <span className="text-sm text-text-primary leading-snug">
                My father, mother or legal guardian authorises the use of my account and my data.
              </span>
            </label>
            <p className="text-xs text-text-secondary leading-relaxed pl-8">
              This is a declaration: VYSVI does not verify it.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className={checkRow}>
          <input
            type="checkbox"
            name="termsAccepted"
            checked={values.terms}
            onChange={(e) => setField('terms', e.target.checked)}
            disabled={off}
            className={checkBox}
          />
          <span className="text-sm text-text-primary leading-snug">
            I accept the{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>
              Terms<span className="sr-only"> (opens in a new tab)</span>
            </Link>{' '}
            and the{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
              Privacy Policy<span className="sr-only"> (opens in a new tab)</span>
            </Link>
            .
          </span>
        </label>
        <label className={checkRow}>
          <input
            type="checkbox"
            name="dataAuthorized"
            checked={values.data}
            onChange={(e) => setField('data', e.target.checked)}
            disabled={off}
            className={checkBox}
          />
          <span className="text-sm text-text-primary leading-snug">
            I authorise the processing of my data and its transfer to the providers listed in the Privacy Policy, some of which are outside
            Costa Rica.
          </span>
        </label>
      </div>
    </div>
  );
};

export default AgeAndConsentFields;
