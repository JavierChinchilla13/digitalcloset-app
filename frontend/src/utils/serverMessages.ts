import { translate, useLanguageStore, type MessageKey } from '../i18n';

// The API answers every refusal with an English sentence in `message` (and, for two of them, a stable `code`). In Spanish the sentences it is
// known to send are shown in Spanish; anything else is shown as sent (an error is never hidden or invented), and English never changes.
// The backend is not touched: the sentences below are the ones it sends today (GlobalExceptionHandler and the services), matched whole,
// ignoring case, spaces, a final full stop and a trailing ": <id>" (some "not found" messages end with the id).

// Every known sentence -> the dictionary key holding its Spanish text. (Generated from the backend inventory; keep in step with it.)
const KNOWN: ReadonlyArray<readonly [string, MessageKey]> = [
    ['Invalid email or password', 'srv.invalidLogin'],
    ['Current password is incorrect', 'srv.wrongPassword'],
    ['An account with this email already exists', 'srv.emailTaken'],
    ['To create an account you need to accept the Terms and the Privacy Policy and authorise the processing of your data.', 'srv.acceptTerms'],
    ['The Terms have been updated. Please reload the page and try again.', 'srv.termsUpdated'],
    ['A parent or legal guardian must authorise the use of your account and data.', 'srv.guardian'],
    ['Please enter a valid birth month and year.', 'srv.birth'],
    ['This password reset link is invalid or has expired.', 'srv.resetLink'],
    ['This code is invalid or has expired.', 'srv.badCode'],
    ['Please wait a moment before requesting another code', 'srv.waitCode'],
    ['Type DELETE to confirm.', 'srv.typeDelete'],
    ['Google sign-in is not set up on this server.', 'srv.googleOff'],
    ['Google sign-in failed. Please try again.', 'srv.googleFailed'],
    ['Google did not share an email address.', 'srv.googleNoEmail'],
    ['Your Google email address is not verified.', 'srv.googleUnverified'],
    ['This account has been deactivated.', 'srv.deactivated'],
    ['Google sign-in is too old to confirm this. Please sign in with Google again.', 'srv.googleOld'],
    ['Google sign-in was already used. Please sign in with Google again.', 'srv.googleUsed'],
    ['Google could not confirm it is you. Please try again.', 'srv.googleNotYou'],
    ['Your account signs in with Google and has no password yet. Use "Forgot password" on the sign-in page to set one.', 'srv.noPassword'],
    ['Please confirm your details first.', 'srv.confirmFirst'],
    ['Please confirm your details before subscribing.', 'srv.confirmBeforeSub'],
    ['Premium is available to people who are 18 or older.', 'srv.adultsOnly'],
    ['You already have a Premium subscription. Manage it from the billing page.', 'srv.alreadySub'],
    ['Your account already has Premium.', 'srv.alreadyPremium'],
    ['There is no subscription to manage yet.', 'srv.noSub'],
    ['Payments are not set up yet.', 'srv.noPayments'],
    ['Your account already has everything Premium offers.', 'srv.hasEverything'],
    ['Premium can be bought now: use the Upgrade button.', 'srv.canBuy'],
    ['Too many attempts - please wait a minute and try again', 'srv.tooMany'],
    ['Too many attempts. Please wait a minute and try again.', 'srv.tooMany'],
    ['Too many requests. Please try again in a minute.', 'srv.tooMany'],
    ['Too many attempts. Please try again later.', 'srv.tooManyLater'],
    ['Too many incorrect attempts. Please try again in a few minutes.', 'srv.tooManyWrong'],
    ['Your session has expired. Please sign in again.', 'srv.session'],
    ['You do not have permission to do this', 'srv.noPermission'],
    ['User not found', 'srv.noUser'],
    ['Authenticated user not found', 'srv.noUser'],
    ['Item not found', 'srv.noItem'],
    ['Clothing item not found', 'srv.noItem'],
    ['Outfit not found', 'srv.noOutfit'],
    ['Collection not found', 'srv.noCollection'],
    ['This outfit is not shared', 'srv.notShared'],
    ['Not found', 'srv.notFound'],
    ['The picture must be uploaded through the app.', 'srv.upload'],
    ['An outfit can have only one shoe per foot.', 'srv.oneShoe'],
    ['An outfit must have at least one item', 'srv.oneItem'],
    ['You already have a category with this name.', 'srv.dupCategory'],
    ['That value is already in use.', 'srv.inUse'],
    ['Validation failed', 'srv.validation'],
    ['Email must be a valid email address', 'srv.badEmail'],
    ['Password must be at least 8 characters', 'srv.min8'],
    ['New password must be at least 8 characters', 'srv.min8'],
    ['Password is too long', 'srv.tooLong'],
    ['Credential is too long', 'srv.tooLong'],
    ['Malformed request', 'srv.malformed'],
    ['Method not allowed', 'srv.method'],
    ['Unsupported content type', 'srv.contentType'],
    ['File is too large', 'srv.fileLarge'],
];

// Field names the validation messages ("Name is required", "Description must be at most 255 characters") can carry.
const FIELD_KEYS: Readonly<Record<string, MessageKey>> = {
    'email': 'srvField.email',
    'password': 'srvField.password',
    'newpassword': 'srvField.newpassword',
    'currentpassword': 'srvField.currentpassword',
    'name': 'srvField.name',
    'description': 'srvField.description',
    'category': 'srvField.category',
    'imageurl': 'srvField.imageurl',
    'personatype': 'srvField.personatype',
    'itemid': 'srvField.itemid',
    'avatartype': 'srvField.avatartype',
    'displayname': 'srvField.displayname',
    'code': 'srvField.code',
    'credential': 'srvField.credential',
    'resettoken': 'srvField.resettoken',
    'confirmation': 'srvField.confirmation',
    'outfitid': 'srvField.outfitid',
    'firstname': 'srvField.firstname',
    'lastname': 'srvField.lastname',
};

export const normalise = (message: string): string =>
  message.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.+$/, '').replace(/: \d+$/, '');

const TABLE = new Map<string, MessageKey>(KNOWN.map(([english, key]) => [normalise(english), key]));

// (exported for the test) every sentence the table knows
export const KNOWN_MESSAGES: ReadonlyArray<readonly [string, MessageKey]> = KNOWN;

const fieldName = (field: string): string | null => {
  const key = FIELD_KEYS[field.replace(/\s+/g, '').toLowerCase()];
  return key ? translate(key) : null;
};

interface Extra {
  code?: unknown;
  limit?: unknown;
  plan?: unknown;
}

/**
 * The text to show for a message the API sent. English (and any message it does not know) is returned as it came.
 * A stable `code` wins over the wording: GARMENT_LIMIT carries the limit and the plan, so the sentence is built from those.
 */
export function translateServerMessage(message: string, extra: Extra = {}): string {
  if (useLanguageStore.getState().language !== 'es') return message;

  if (extra.code === 'GARMENT_LIMIT' && typeof extra.limit === 'number') {
    return translate(extra.plan === 'PREMIUM' ? 'srv.garmentPremium' : 'srv.garmentFree', { limit: extra.limit });
  }

  const text = normalise(message);
  const key = TABLE.get(text);
  if (key) return translate(key);

  // "Your free plan holds up to 15 garments..." (the same sentence, when the code is missing)
  const limit = /^your (free )?plan holds up to (\d+) garments\. delete a garment to add another$/.exec(text);
  if (limit) return translate(limit[1] ? 'srv.garmentFree' : 'srv.garmentPremium', { limit: Number(limit[2]) });

  // "Unauthorized to update this item", "Unauthorized to use clothing item: 12"...: all say the same thing
  if (text.startsWith('unauthorized to ')) return translate('srv.noPermission');

  const required = /^(.+) is required$/.exec(text);
  if (required) {
    const field = fieldName(required[1]);
    if (field) return translate('srv.required', { field });
  }
  const max = /^(.+) must be at most (\d+) characters$/.exec(text);
  if (max) {
    const field = fieldName(max[1]);
    if (field) return translate('srv.maxChars', { field, max: max[2] });
  }
  return message;
}
