import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shirt, LayoutPanelTop, UserCircle, Star } from 'lucide-react';
import SectionWrapper from '../components/SectionWrapper';
import FeatureCard from '../components/FeatureCard';
import { useT } from '../i18n';

// Real, in-app captures used as marketing material (Task 80) - not stock
// footage or mockups. See the project history for how these were recorded.
const OUTFIT_BUILDER_GIF = '/marketing/outfit-builder-demo.gif';
const CLOSET_BROWSING_GIF = '/marketing/closet-browsing-demo.gif';
const PERSONA_GIF = '/marketing/persona-demo.gif';
// Not recorded yet - the feature card skips the preview until this exists.
const MAIN_OUTFIT_GIF = '/marketing/main-outfit-demo.gif';

const LandingPage = () => {
  const { t } = useT();
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-dvh flex flex-col items-center justify-center pt-20">
        
        <SectionWrapper className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-block px-4 py-1 rounded-full border border-accent/30 text-accent text-[10px] font-medium tracking-[0.4em] mb-8 bg-accent/5">
              {t('landing.tag')}
            </span>
            {/* Task 74: the real logo (verified already-transparent, see
                the project history) replaces Task 72's text
                lockup here - confirmed with the user. An <h1> is kept,
                visually hidden, so the page still has a real text
                heading for accessibility/SEO. */}
            <h1 className="sr-only">{t('landing.logoAlt')}</h1>
            <img
              src="/logo.png"
              alt={t('landing.logoAlt')}
              className="w-48 md:w-64 lg:w-72 mx-auto mb-8"
            />
            <p className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light leading-relaxed">
              {t('landing.lead')}
            </p>
            
            <div className="flex flex-wrap justify-center gap-6">
              <Link 
                to="/signup" 
                className="px-10 py-5 bg-ink text-background-main font-medium rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                {t('landing.getStarted')}
              </Link>
              <Link 
                to="/demo" 
                className="px-10 py-5 glass-panel text-text-primary font-medium rounded-full transition-all hover:bg-ink/10"
              >
                {t('landing.viewDemo')}
              </Link>
            </div>
          </motion.div>
        </SectionWrapper>

        {/* Hero Image/Abstract Visual */}
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 2 }}
          className="relative w-full max-w-5xl mx-auto mt-20 aspect-[21/9] rounded-t-[4rem] overflow-hidden border-x border-t border-ink/10 bg-gradient-to-b from-ink/5 to-transparent p-1"
        >
          <div className="w-full h-full rounded-t-[3.8rem] overflow-hidden bg-background-secondary">
             <img
               src={OUTFIT_BUILDER_GIF}
               alt={t('landing.heroAlt')}
               className="w-full h-full object-cover"
               loading="lazy"
               decoding="async"
             />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <SectionWrapper className="py-20 sm:py-40">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Hover/tap a card to see that feature in action. The persona and
              main-outfit clips don't exist yet - drop files with these names
              into public/marketing and they light up with no code change. */}
          {[
            { icon: Shirt, title: t('landing.f1.title'), desc: t('landing.f1.desc'), media: CLOSET_BROWSING_GIF },
            { icon: LayoutPanelTop, title: t('landing.f2.title'), desc: t('landing.f2.desc'), media: OUTFIT_BUILDER_GIF },
            { icon: UserCircle, title: t('landing.f3.title'), desc: t('landing.f3.desc'), media: PERSONA_GIF },
            { icon: Star, title: t('landing.f4.title'), desc: t('landing.f4.desc'), media: MAIN_OUTFIT_GIF },
          ].map((feature, idx) => (
            <FeatureCard key={feature.title} {...feature} delay={idx * 0.1} />
          ))}
        </div>
      </SectionWrapper>

      {/* How It Works - Digital Closet */}
      <SectionWrapper className="py-32">
        <div className="flex flex-col lg:flex-row items-center gap-20">
          <div className="lg:w-1/2">
            <span className="text-accent text-[10px] font-medium tracking-[0.4em] mb-6 block uppercase">{t('landing.step1.label')}</span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter mb-8 leading-tight">
              {t('landing.step1.title')} <br />
              <span className="italic text-accent">{t('landing.step1.emph')}</span>
            </h2>
            <p className="text-text-secondary text-lg font-light leading-relaxed">
              {t('landing.step1.body')}
            </p>
          </div>
          <div className="lg:w-1/2 w-full aspect-video glass-panel rounded-2xl overflow-hidden border border-ink/10">
            <img
              src={CLOSET_BROWSING_GIF}
              alt={t('landing.step1.alt')}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </SectionWrapper>

      {/* How It Works - Outfit Builder & Persona */}
      <SectionWrapper className="py-32">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-20">
          <div className="lg:w-1/2">
            <span className="text-accent text-[10px] font-medium tracking-[0.4em] mb-6 block uppercase">{t('landing.step2.label')}</span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter mb-8 leading-tight">
              {t('landing.step2.title')} <br />
              <span className="italic text-accent">{t('landing.step2.emph')}</span>
            </h2>
            <p className="text-text-secondary text-lg font-light leading-relaxed">
              {t('landing.step2.body')}
            </p>
          </div>
          <div className="lg:w-1/2 w-full aspect-video glass-panel rounded-2xl overflow-hidden border border-ink/10">
            <img
              src={OUTFIT_BUILDER_GIF}
              alt={t('landing.step2.alt')}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </SectionWrapper>

      {/* Experience Section */}
      <SectionWrapper className="bg-background-secondary/30 border-y border-ink/5 py-20 sm:py-40">
        <div className="flex flex-col lg:flex-row items-center gap-20">
          <div className="lg:w-1/2">
            <span className="text-accent text-[10px] font-medium tracking-[0.4em] mb-6 block uppercase">{t('landing.exp.label')}</span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter mb-8 leading-tight">
              {t('landing.exp.title')} <br />
              <span className="italic text-accent">{t('landing.exp.emph')}</span>
            </h2>
            <p className="text-text-secondary text-lg mb-10 font-light leading-relaxed">
              {t('landing.exp.body')}
            </p>
            <div className="space-y-6">
              {[t('landing.exp.i1'), t('landing.exp.i2'), t('landing.exp.i3')].map((item) => (
                <div key={item} className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-xs font-medium tracking-widest uppercase">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:w-1/2 w-full aspect-video glass-panel rounded-2xl relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none z-10" />
             <img
               src={PERSONA_GIF}
               alt={t('landing.exp.alt')}
               className="w-full h-full object-cover"
               loading="lazy"
               decoding="async"
             />
          </div>
        </div>
      </SectionWrapper>

      {/* CTA Section */}
      <SectionWrapper className="text-center py-32 sm:py-60">
        <h2 className="text-4xl sm:text-6xl md:text-8xl font-light tracking-tighter mb-8 sm:mb-12">{t('landing.cta.title')} <span className="italic text-accent">{t('landing.cta.emph')}</span></h2>
        <Link 
          to="/signup" 
          className="inline-block px-8 sm:px-16 py-5 sm:py-8 bg-accent text-on-accent font-medium text-base sm:text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg"
        >
          {t('landing.cta.button')}
        </Link>
      </SectionWrapper>
    </div>
  );
};

export default LandingPage;
