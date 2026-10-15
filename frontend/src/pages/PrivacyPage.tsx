import LegalLayout, { LegalSection } from '../components/LegalLayout';
import { useConsentStore } from '../store/useConsentStore';
import { LEGAL } from '../config/legal';

// Task 99: the Privacy Policy. Public (no sign-in). It describes what the app really does - the
// storage keys, the services that receive data, and what the cookie banner switches on and off.
// A DRAFT for the owner to review (see config/legal.ts).
const PrivacyPage = () => {
  const reopen = useConsentStore((state) => state.reopen);

  return (
    <LegalLayout title="Privacy Policy" other={{ to: '/terms', label: 'Read the Terms of Service' }}>
      <p>
        This explains what {LEGAL.siteName} (the "service") collects about you, why, who else handles it, and what
        you can do about it. {LEGAL.siteName} is a digital wardrobe: you upload photos of your clothes, build outfits and
        see them on a figure.
      </p>

      <LegalSection title="1. Who runs the service">
        <p>
          The service is run by {LEGAL.operator} ("we"). You can reach us at{' '}
          <a className="text-text-primary underline underline-offset-2" href={`mailto:${LEGAL.contactEmail}`}>
            {LEGAL.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-text-primary">Your account:</strong> your email address, your name if you give one, and
            your password (we only keep a scrambled "hash" of it, never the password itself). If you sign in with Google we
            keep Google's identifier for your account and the email and name Google shares.
          </li>
          <li>
            <strong className="text-text-primary">What you add:</strong> the photos of garments you upload, their names,
            descriptions and categories, your outfits, categories you create, and your choices such as which figure you use.
          </li>
          <li>
            <strong className="text-text-primary">Your plan and billing:</strong> whether you are on the Free or Premium plan.
            Payments (when available) are handled by Stripe: we keep identifiers and the subscription status, never your card
            number.
          </li>
          <li>
            <strong className="text-text-primary">Technical data:</strong> like any website, our hosting providers see your
            IP address and basic request details in their logs. If you allow optional services (below), error reports may
            include your browser type and the page where a problem happened.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Why we use it">
        <p>
          To run the service you asked for: to sign you in, to store and show your wardrobe and outfits, to apply the limits
          of your plan, to send you the emails you request (such as a password reset), to keep the service secure, and to
          fix errors. We do not sell your personal data.
        </p>
      </LegalSection>

      <LegalSection title="4. Who else handles your data">
        <p>We use these providers to run the service. They only receive what is needed for their job:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Render - hosts the website and the server.</li>
          <li>Neon - stores the database (accounts, garments' details, outfits).</li>
          <li>Cloudinary - stores and delivers the garment photos you upload.</li>
          <li>Google - if you choose "Continue with Google", and for sending some account emails from our Gmail account.</li>
          <li>Stripe - payments for Premium, when available.</li>
          <li>Sentry - error reports, only if you allow optional services.</li>
          <li>An advertising network - ads shown to Free accounts, only if you allow optional services.</li>
        </ul>
        <p>
          Removing the background from a photo happens inside your browser: your photo is not sent to a server for that. The
          first time you use it, your browser downloads the model files it needs from public content networks (for example
          imgly and Hugging Face), which can see your IP address when it does.
        </p>
      </LegalSection>

      <LegalSection title="5. Cookies and browser storage">
        <p>
          We do not set cookies ourselves. We use your browser's local storage for things the service needs to work, and
          these do not need your permission:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <code>auth-storage</code> - keeps you signed in (your session token and basic account details).
          </li>
          <li>
            <code>clothing-closet-storage</code>, <code>closet-favorites</code>, <code>persona-storage</code> - a copy of your
            closet and your figure settings so pages open quickly.
          </li>
          <li>
            <code>vysvi-theme</code> - light or dark appearance. <code>vysvi-consent</code> - the choice you make on the banner.
          </li>
          <li>
            <code>session-expired</code> (session storage) - a one-time note that your session ended.
          </li>
        </ul>
        <p>
          <strong className="text-text-primary">Optional services</strong> are off until you choose "Accept all" on the banner:
          advertising for Free accounts (the ad network may use its own cookies and identifiers) and error monitoring. If you
          choose "Only essentials", none of them runs. You can change your choice any time:{' '}
          <button
            type="button"
            onClick={reopen}
            className="text-text-primary underline underline-offset-2"
          >
            open cookie settings
          </button>
          .
        </p>
      </LegalSection>

      <LegalSection title="6. How long we keep it">
        <p>
          We keep your data while your account exists. Deactivating your account stops you and others from using it; to have
          your data deleted, email us and we will delete your account, garments and outfits. Backups and logs can keep a copy
          for a short time afterwards. Photos you delete may remain stored at our image provider until it is cleaned up.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>
          You can ask us for a copy of your data, to correct it, or to delete it, and you can object to or limit how we use
          it. Depending on where you live, you may also be able to complain to your data protection authority. Email us and we
          will answer within a reasonable time.
        </p>
      </LegalSection>

      <LegalSection title="8. Children">
        <p>
          The service is not meant for children under 13, and we do not knowingly collect their data. If you think a child has
          given us information, email us and we will remove it.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          Passwords are stored hashed, connections use HTTPS, and access to your data requires your signed-in session. No
          system is perfectly secure, so please use a strong password and tell us if you notice anything wrong.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes and contact">
        <p>
          If we change this policy we will update the date at the top and, for important changes, tell you in the app. Questions
          or requests: {LEGAL.contactEmail}. Governing law: {LEGAL.country}.
        </p>
      </LegalSection>
    </LegalLayout>
  );
};

export default PrivacyPage;
