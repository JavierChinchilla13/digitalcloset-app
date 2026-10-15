import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import SectionWrapper from './SectionWrapper';
import { LEGAL, LEGAL_IS_DRAFT } from '../config/legal';

// Task 99: the shared frame of the Privacy Policy and the Terms - a readable column with a title,
// the date it was last changed, and a link to the sibling document.
const LegalLayout = ({
  title,
  other,
  children,
}: {
  title: string;
  other: { to: string; label: string };
  children: ReactNode;
}) => (
  <div className="min-h-dvh bg-background-main pt-8 pb-20">
    <SectionWrapper>
      <article className="mx-auto max-w-3xl">
        <p className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase mb-4">{LEGAL.siteName}</p>
        <h1 className="text-4xl sm:text-5xl font-light tracking-tighter text-text-primary uppercase leading-none">{title}</h1>
        <p className="mt-4 text-text-secondary text-xs uppercase tracking-widest">Last updated {LEGAL.lastUpdated}</p>

        {LEGAL_IS_DRAFT && (
          <p
            role="note"
            className="mt-8 rounded-2xl border border-ink/10 bg-ink/[0.03] p-4 text-text-secondary text-xs leading-relaxed"
          >
            Draft for review: this page is written in plain language and has not been reviewed by a lawyer. The marked
            gaps (like {LEGAL.country}) are still to be filled in.
          </p>
        )}

        <div className="mt-10 space-y-10 text-text-secondary text-sm leading-relaxed">{children}</div>

        <p className="mt-16 text-xs uppercase tracking-widest text-text-secondary">
          <Link to={other.to} className="text-text-primary underline underline-offset-2">
            {other.label}
          </Link>
        </p>
      </article>
    </SectionWrapper>
  </div>
);

// One numbered-looking section of a legal page.
export const LegalSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-text-primary text-sm font-medium uppercase tracking-widest">{title}</h2>
    {children}
  </section>
);

export default LegalLayout;
