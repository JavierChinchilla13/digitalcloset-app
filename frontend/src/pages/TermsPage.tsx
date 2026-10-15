import LegalLayout, { LegalSection } from '../components/LegalLayout';
import { LEGAL } from '../config/legal';

// Task 99: the Terms of Service. Public (no sign-in). Includes the subscription, cancellation and
// refund wording a payment provider asks a site to publish. A DRAFT for the owner to review (see
// config/legal.ts); the governing-law country is a marked gap.
const TermsPage = () => (
  <LegalLayout title="Terms of Service" other={{ to: '/privacy', label: 'Read the Privacy Policy' }}>
    <p>
      These terms are the agreement between you and {LEGAL.operator} ("we") for using {LEGAL.siteName} (the "service"). By
      creating an account or using the service you agree to them. If you do not agree, please do not use the service.
    </p>

    <LegalSection title="1. Your account">
      <p>
        You need an account to save a wardrobe. Give accurate information, keep your password safe, and tell us if you think
        someone else is using your account. You are responsible for what happens under your account. You must be at least 13
        years old.
      </p>
    </LegalSection>

    <LegalSection title="2. Your content">
      <p>
        You keep ownership of the photos and other content you upload. You give us permission to store, process and display
        it as needed to run the service for you (for example, to show it on your figure or in an outfit you choose to share).
        Only upload things you have the right to use, and nothing unlawful, hateful or that shows other people without their
        permission.
      </p>
      <p>
        If you create a public link to an outfit, anyone with the link can see that outfit. You can turn the link off at any
        time.
      </p>
    </LegalSection>

    <LegalSection title="3. Acceptable use">
      <p>
        Do not attack, overload or try to get around the limits of the service, do not access other people's accounts or data,
        and do not use it to break the law or to harm others. We may suspend or remove accounts that do.
      </p>
    </LegalSection>

    <LegalSection title="4. Plans and limits">
      <p>
        The Free plan lets you keep up to 15 garments and shows advertising. The Premium plan, when available, raises the limit
        to 300 garments and removes advertising. Limits and features can change; if a change reduces what you have, we will
        not delete what you already saved without telling you first.
      </p>
    </LegalSection>

    <LegalSection title="5. Subscriptions, cancellation and refunds">
      <p>
        Premium is a monthly subscription charged through Stripe. It renews automatically each month until you cancel. You can
        cancel at any time from your account's billing page; you keep Premium until the end of the period you already paid for
        and are not charged again.
      </p>
      <p>
        Payments are not refundable for the period already started, except where the law says otherwise. If you were charged
        by mistake or have a problem with a charge, email {LEGAL.contactEmail} within 14 days and we will put it right.
      </p>
    </LegalSection>

    <LegalSection title="6. Advertising">
      <p>
        Free accounts may see advertising from a third-party network, only if you allow optional services on the cookie
        banner. We are not responsible for the ads or the advertisers' sites.
      </p>
    </LegalSection>

    <LegalSection title="7. The service as it is">
      <p>
        The service is provided "as is". It runs on free and low-cost infrastructure, so it may be slow to start, change or be
        unavailable at times, and we cannot promise it will always work or that nothing will ever be lost. Keep your own copy
        of photos you care about.
      </p>
    </LegalSection>

    <LegalSection title="8. Ending your use">
      <p>
        You can stop using the service and deactivate your account at any time. We may suspend or end accounts that break these
        terms. Sections that by their nature should survive (such as responsibility for your content and the limits on our
        liability) continue after that.
      </p>
    </LegalSection>

    <LegalSection title="9. Limits on our responsibility">
      <p>
        To the extent the law allows, we are not responsible for indirect or consequential losses, or for loss of data or
        profits, arising from your use of the service. Nothing in these terms limits liability that cannot be limited by law.
      </p>
    </LegalSection>

    <LegalSection title="10. Changes, law and contact">
      <p>
        We may update these terms; the date at the top shows the latest version, and continuing to use the service after a
        change means you accept it. These terms are governed by the law of {LEGAL.country}. Questions: {LEGAL.contactEmail}.
      </p>
    </LegalSection>
  </LegalLayout>
);

export default TermsPage;
