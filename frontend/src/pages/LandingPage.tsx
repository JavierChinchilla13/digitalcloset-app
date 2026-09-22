import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shirt, LayoutPanelTop, UserCircle, Zap } from 'lucide-react';
import SectionWrapper from '../components/SectionWrapper';

const LandingPage = () => {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-20">
        
        <SectionWrapper className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-block px-4 py-1 rounded-full border border-accent/30 text-accent text-[10px] font-medium tracking-[0.4em] mb-8 bg-accent/5">
              THE FUTURE OF FASHION
            </span>
            {/* Task 72: VYSVI's own lockup - the wordmark plus its
                "Digital Wardrobe" subline, matching BrandMark.tsx's
                two-line layout at hero scale. */}
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-light tracking-tighter mb-4 leading-none">
              VYSVI
            </h1>
            <p className="text-accent text-sm md:text-base font-medium tracking-[0.5em] uppercase mb-8">
              Digital Wardrobe
            </p>
            <p className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light leading-relaxed">
              Curate your premium wardrobe, build futuristic outfits, and customize your digital persona in a high-end fashion ecosystem.
            </p>
            
            <div className="flex flex-wrap justify-center gap-6">
              <Link 
                to="/signup" 
                className="px-10 py-5 bg-ink text-background-main font-medium rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                GET STARTED
              </Link>
              <Link 
                to="/demo" 
                className="px-10 py-5 glass-panel text-text-primary font-medium rounded-full transition-all hover:bg-ink/10"
              >
                VIEW DEMO
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
          <div className="w-full h-full rounded-t-[3.8rem] overflow-hidden bg-background-secondary flex items-center justify-center">
             <div className="text-accent/20 font-medium text-9xl tracking-tighter select-none">PREMIUM</div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <SectionWrapper className="py-40">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {[
            { icon: Shirt, title: "VIRTUAL INVENTORY", desc: "Digitalize your physical closet with high-definition categorization." },
            { icon: LayoutPanelTop, title: "OUTFIT BUILDER", desc: "Experiment with layers and styles in our futuristic canvas." },
            { icon: UserCircle, title: "PERSONA TECH", desc: "Represent your style with a customizable digital twin." },
            { icon: Zap, title: "STYLE ANALYTICS", desc: "Gain insights into your most worn pieces and style patterns." },
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="premium-card p-10 group hover:border-accent/30"
            >
              <div className="w-14 h-14 rounded-2xl bg-ink/5 flex items-center justify-center mb-8 group-hover:bg-accent group-hover:text-on-accent transition-all">
                <feature.icon size={28} />
              </div>
              <h3 className="text-lg font-bold tracking-widest mb-4 uppercase">{feature.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      {/* Experience Section */}
      <SectionWrapper className="bg-background-secondary/30 border-y border-ink/5 py-40">
        <div className="flex flex-col lg:flex-row items-center gap-20">
          <div className="lg:w-1/2">
            <span className="text-accent text-[10px] font-medium tracking-[0.4em] mb-6 block uppercase">Seamless Integration</span>
            <h2 className="text-5xl md:text-6xl font-light tracking-tighter mb-8 leading-tight">
              A FASHION TECH <br />
              <span className="italic text-accent">EXPERIENCE</span>
            </h2>
            <p className="text-text-secondary text-lg mb-10 font-light leading-relaxed">
              Designed for the modern fashion enthusiast. Our interface bridges the gap between your physical wardrobe and the digital world.
            </p>
            <div className="space-y-6">
              {['DARK MODE ARCHITECTURE', 'MINIMALIST DESIGN LANGUAGE', 'FLUID MOTION SYSTEMS'].map((item) => (
                <div key={item} className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-xs font-medium tracking-widest uppercase">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:w-1/2 w-full aspect-square glass-panel rounded-2xl relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
             <div className="w-full h-full flex items-center justify-center p-20">
                <div className="w-full h-full border border-dashed border-ink/10 rounded-2xl flex items-center justify-center">
                  <span className="text-ink/10 font-medium text-6xl tracking-tighter">PREVIEW</span>
                </div>
             </div>
          </div>
        </div>
      </SectionWrapper>

      {/* CTA Section */}
      <SectionWrapper className="text-center py-60">
        <h2 className="text-6xl md:text-8xl font-light tracking-tighter mb-12">READY TO <span className="italic text-accent">UPGRADE?</span></h2>
        <Link 
          to="/signup" 
          className="inline-block px-16 py-8 bg-accent text-on-accent font-medium text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg"
        >
          CREATE YOUR CLOSET
        </Link>
      </SectionWrapper>
    </div>
  );
};

export default LandingPage;
