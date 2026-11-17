import LegalLayout, { LegalSection, Marker } from '../components/LegalLayout';
import { useConsentStore } from '../store/useConsentStore';
import { LEGAL } from '../config/legal';

const strong = 'text-text-primary';
const list = 'list-disc pl-5 space-y-2';

// The Privacy Policy. Public (no sign-in). It describes what the app really does, checked against the code on the date at the top:
// the data it asks for, who handles it and where, every outside host the browser contacts, the browser storage keys, deletion and the
// rights. A DRAFT for the owner to review (see config/legal.ts): anything not yet supplied is a visible [PLACEHOLDER] / [PROPOSAL].
// Not legal advice, and it claims neither compliance with any law nor a legal review.
const PrivacyPage = () => {
  const reopen = useConsentStore((state) => state.reopen);

  return (
    <LegalLayout title="Privacy Policy" other={{ to: '/terms', label: 'Read the Terms of Service' }}>
      <p>
        This explains what {LEGAL.siteName} (the "service") collects about you, why, who else handles it, where it goes, and what
        you can do about it. {LEGAL.siteName} is a digital wardrobe: you upload photos of your clothes, build outfits and see them
        on a figure.
      </p>

      <LegalSection title="1. Who runs the service">
        <p>
          The service is run by {LEGAL.operator} ("we"), who decides how your data is used. <Marker kind="PLACEHOLDER">confirm
          the legal name and whether this is an individual or a company</Marker>. <Marker kind="PLACEHOLDER">the address, postal
          box or other way to reach us that the owner chooses to publish</Marker>.
        </p>
        <p>
          Contact for privacy requests:{' '}
          <a className="text-text-primary underline underline-offset-2" href={`mailto:${LEGAL.contactEmail}`}>
            {LEGAL.contactEmail}
          </a>
          . <Marker kind="PLACEHOLDER">who answers these requests</Marker>
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <ul className={list}>
          <li>
            <strong className={strong}>Your account:</strong> your email address, your name if you give one, and your password (we
            only keep a scrambled "hash" of it, never the password itself). If you sign in with Google we keep Google's identifier
            for your account and the email and name Google shares.
          </li>
          <li>
            <strong className={strong}>Your age:</strong> your birth <em>month and year</em> (never the day). From them we work
            out whether you are 13 to 17 or 18 or older. If you are 13 to 17 we also record that you declared that a parent or
            legal guardian authorises the use of your account and data, and when. Nothing is verified: it is what you tell us.
          </li>
          <li>
            <strong className={strong}>What you agreed to:</strong> that you accepted the Terms and this policy, that you
            authorised the processing and transfer of your data, which version of the texts, and when.
          </li>
          <li>
            <strong className={strong}>What you add:</strong> the photos of garments you upload, their names, descriptions and
            categories, your outfits, categories you create, and your choices such as which figure you use.
          </li>
          <li>
            <strong className={strong}>Your plan and billing:</strong> whether you are on the Free or Premium plan. Premium is only
            for people who declared they are 18 or older. Payments (when available) are handled by Stripe: we keep identifiers and
            the subscription status, never your card number.
          </li>
          <li>
            <strong className={strong}>Technical data:</strong> like any website, our hosting providers see your IP address and
            basic request details in their logs. If you allow optional services (section 7), error reports may include your browser
            type and the page where a problem happened.
          </li>
        </ul>
        <p>If someone says they are under 13, nothing about them is saved (see section 11).</p>
      </LegalSection>

      <LegalSection title="3. Why we use it">
        <p>
          To run the service you asked for: to sign you in, to store and show your wardrobe and outfits, to apply the limits of
          your plan, to send you the emails you request (such as a password reset), to keep the service secure, and to fix errors.
          You give your agreement by accepting the Terms and by authorising the processing of your data when you sign up. We do not
          sell your personal data.
        </p>
      </LegalSection>

      <LegalSection title="4. Who else handles your data, and where">
        <p>
          We use these providers to run the service. They only receive what is needed for their job. All of them are outside Costa
          Rica or may store data outside it.
        </p>
        <ul className={list}>
          <li>
            <strong className={strong}>Render</strong> - hosts the website and the server (your requests, your account data while
            it is processed). <Marker kind="PLACEHOLDER">Render region</Marker>
          </li>
          <li>
            <strong className={strong}>Supabase</strong> - stores the database: accounts, garment details, outfits, the records of
            what you agreed to. <Marker kind="PLACEHOLDER">confirm the Supabase region (believed to be us-east-1)</Marker>
          </li>
          <li>
            <strong className={strong}>Cloudinary</strong> - stores and delivers the garment photos you upload.{' '}
            <Marker kind="PLACEHOLDER">Cloudinary region</Marker>
          </li>
          <li>
            <strong className={strong}>Google</strong> - if you choose "Continue with Google" (your Google identity, email and
            name), and for sending some account emails from our Gmail account (your email address and the message).
          </li>
          <li>
            <strong className={strong}>Stripe</strong> - payments for Premium, when available (adults only). Stripe keeps the
            payment records it is required to keep. <Marker kind="PLACEHOLDER">Stripe data location</Marker>
          </li>
          <li>
            <strong className={strong}>Sentry</strong> - error reports, only if you allow optional services.{' '}
            <Marker kind="PLACEHOLDER">Sentry data region (US or EU)</Marker>
          </li>
          <li>
            <strong className={strong}>An advertising network</strong> - ads shown to Free accounts of adults, only if you allow
            optional services and when ads are switched on. <Marker kind="PLACEHOLDER">name of the ad network</Marker>
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Transfer of your data abroad">
        <p>
          Because of the providers above, your data is processed and stored outside Costa Rica. When you sign up you tick a
          separate box to authorise that processing and transfer. If you do not, we cannot create your account. You can withdraw
          that authorisation at any time by deleting your account (section 8).
        </p>
      </LegalSection>

      <LegalSection title="6. Outside websites your browser contacts">
        <p>
          Some features make your browser connect directly to other companies' servers. Those servers can see your IP address, your
          browser details and the request itself. This is the list as found in our code on the date above:
        </p>
        <ul className={list}>
          <li>
            <code>accounts.google.com</code> and Google's own content addresses - only after you click "Continue with Google" (and
            again to confirm a deletion of a Google-only account). Opening the sign-in or sign-up page loads nothing from Google.
          </li>
          <li>
            <code>api.cloudinary.com</code> - when you upload a photo (the photo goes to our image provider). <code>res.cloudinary.com</code>{' '}
            - every time your garment photos are shown to you or to someone you shared an outfit with.
          </li>
          <li>
            <code>cdn.jsdelivr.net</code> - a public content network that serves a small helper file used to shrink photos in your
            browser when you upload, and the runtime files of the jacket-cutting tool.
          </li>
          <li>
            <code>staticimgly.com</code> - the model files used to remove a photo's background, downloaded the first time you use
            it. The removal itself runs in your browser: your photo is not sent there.
          </li>
          <li>
            <code>huggingface.co</code> and its file-delivery addresses - the model files of the jacket-cutting tool, downloaded
            the first time you use it. The cutting runs in your browser.
          </li>
          <li>
            <code>checkout.stripe.com</code> and Stripe's billing portal - only when you go to pay or manage your subscription:
            you are sent to Stripe's own page.
          </li>
          <li>
            <strong className={strong}>Sentry</strong> and <strong className={strong}>the ad network</strong> - only if you choose
            "Accept all" (section 7). <Marker kind="PLACEHOLDER">the exact Sentry and ad network host names</Marker>
          </li>
        </ul>
        <p>
          Fonts are served from our own site. <Marker kind="PROPOSAL">re-check this list against the code at every release that
          adds a feature</Marker>
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies and browser storage">
        <p>
          We do not set cookies ourselves. We use your browser's storage for things the service needs to work, and these do not
          need your permission:
        </p>
        <ul className={list}>
          <li>
            <code>auth-storage</code> - keeps you signed in (your session token and basic account details, including your age
            group but never your birth date).
          </li>
          <li>
            <code>clothing-closet-storage</code>, <code>closet-favorites</code>, <code>persona-storage</code> - a copy of your
            closet and your figure settings so pages open quickly.
          </li>
          <li>
            <code>vysvi-theme</code> - light or dark appearance. <code>vysvi-consent</code> - the choice you make on the banner.{' '}
            <code>vysvi-onboarding:&lt;account number&gt;</code> - that you closed the getting-started guide.
          </li>
          <li>
            In this tab only (wiped when you close it): <code>session-expired</code> and <code>vysvi-login-notice</code> - one-time
            notes shown on the sign-in page, and <code>vysvi-age-blocked</code> - a flag, with no date or other detail, that a
            sign-up was refused in this tab.
          </li>
        </ul>
        <p>
          <strong className={strong}>Optional services</strong> are off until you choose "Accept all" on the banner: advertising
          for Free accounts of adults (the ad network may use its own cookies and identifiers) and error monitoring. If you choose
          "Only essentials", none of them runs. You can change your choice any time:{' '}
          <button type="button" onClick={reopen} className="text-text-primary underline underline-offset-2">
            open cookie settings
          </button>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Deleting your data and how long we keep it">
        <p>
          We keep your data while your account exists. In Settings, "Delete my account and data" permanently erases your account,
          garments (including ones you had already removed), outfits, share links, categories and the records of what you agreed
          to, and cancels any subscription. It cannot be undone. Before that, "Download my data" gives you a copy as a file.
        </p>
        <ul className={list}>
          <li>
            <strong className={strong}>Photos:</strong> their addresses are queued and removed from our image provider by a cleanup
            we run by hand, <Marker kind="PROPOSAL">within 30 days of the deletion</Marker>. The queue is not linked to you.
          </li>
          <li>
            <strong className={strong}>Payments:</strong> Stripe may keep the payment records it is required to keep.
          </li>
          <li>
            <strong className={strong}>Backups:</strong> we keep our own backups of the database, and a deleted account can remain
            in them until they are replaced. <Marker kind="PROPOSAL">we keep the latest 14 backups, so deleted data can remain in
            them for at most that window; confirm how often they are taken</Marker>.{' '}
            <Marker kind="PLACEHOLDER">what Supabase itself keeps in its own backups on our plan</Marker>
          </li>
          <li>
            <strong className={strong}>Accounts we deactivate</strong> (for example for breaking the Terms) are erased after{' '}
            <Marker kind="PROPOSAL">30 days</Marker>.
          </li>
          <li>
            <strong className={strong}>Logs</strong> at our hosting providers are kept by them for their own periods.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Your rights">
        <p>
          You can see, correct and delete your data and you can object to or limit how we use it. You can do much of this yourself:
          change your name, email and password and download or delete everything in Settings. For anything else, or if you cannot
          use the app, email us. We will answer within 5 business days.
        </p>
        <p>
          If you think your data was handled wrongly, you can complain to the data protection authority of Costa Rica, PRODHAB
          (Agencia de Protección de Datos de los Habitantes), or to the authority where you live.
        </p>
      </LegalSection>

      <LegalSection title="10. Security">
        <p>
          Passwords are stored hashed, connections use HTTPS, and access to your data requires your signed-in session. No system is
          perfectly secure, so please use a strong password and tell us if you notice anything wrong.
        </p>
      </LegalSection>

      <LegalSection title="11. Age and children">
        <p>
          You must be at least 13 to have an account. We ask for your birth month and year when you sign up. If it shows you are
          under 13, we do not create an account and we do not store or log what you entered. People aged 13 to 17 declare that a
          parent or legal guardian authorises the use of their account and data; we do not verify this, and a parent or guardian can
          email us to ask for the account to be deleted. People aged 13 to 17 do not see advertising and cannot buy Premium. If we
          learn that an account belongs to someone under 13, we erase it.
        </p>
        <p>
          <Marker kind="PROPOSAL">accounts created before the age question are asked for their birth month and year once, at
          their next sign-in; if the answer shows they are under 13, the account is erased on the spot</Marker>
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          If we change this policy in a way that matters (a new use of your data, a new provider, the age rules or how long we keep
          things) we change its version and ask you to confirm it again the next time you sign in. For small corrections we only
          update the date at the top. <Marker kind="PLACEHOLDER">effective date of this version</Marker>
        </p>
        <p>
          Questions or requests: {LEGAL.contactEmail}. Governing law: {LEGAL.country}.
        </p>
      </LegalSection>
    </LegalLayout>
  );
};

export default PrivacyPage;
