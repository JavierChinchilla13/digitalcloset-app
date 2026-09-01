import { motion } from 'framer-motion';
import { ChevronLeft, User, Sparkles, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePersonaStore } from '../store/usePersonaStore';
import { PersonaType } from '../types';
import SectionWrapper from '../components/SectionWrapper';

const PersonaPage = () => {
  const navigate = useNavigate();
  const { persona, setPersonaType } = usePersonaStore();

  const types = [
    { 
      id: PersonaType.MALE, 
      label: 'Masculine', 
      description: 'Defined silhouette with classic tailoring metrics.',
      icon: '/personas/male-base.png' 
    },
    { 
      id: PersonaType.FEMALE, 
      label: 'Feminine', 
      description: 'Elegant silhouette optimized for fluid layering.',
      icon: '/personas/female-base.png' 
    }
  ];

  return (
    <div className="min-h-screen bg-background-main pt-24 pb-20">
      <SectionWrapper>
        {/* Header */}
        <div className="mb-16 space-y-4">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <ChevronLeft size={14} />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-accent" />
            <h1 className="text-5xl font-light tracking-tighter text-white uppercase leading-none">
              PERSONA <span className="text-accent">STUDIO</span>
            </h1>
          </div>
          <p className="text-text-secondary text-xs font-medium max-w-md uppercase tracking-widest opacity-40">
            Configure your digital twin // Core Silhouette & Biometrics
          </p>
        </div>

        {/* Gender Selection */}
        <div className="max-w-4xl">
          <div className="flex items-center gap-4 mb-10">
            <User size={16} className="text-accent" />
            <span className="text-[10px] font-black tracking-[0.3em] text-accent uppercase">Select Silhouette Core</span>
            <div className="h-[1px] flex-grow bg-white/5" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {types.map((type) => {
              const isActive = persona.type === type.id;
              return (
                <motion.div
                  key={type.id}
                  whileHover={{ y: -8 }}
                  onClick={() => setPersonaType(type.id)}
                  className={`
                    relative group cursor-pointer rounded-[3rem] p-1 border-2 transition-all duration-500
                    ${isActive ? 'border-accent bg-accent/5' : 'border-white/5 bg-white/[0.02] hover:border-white/20'}
                  `}
                >
                  <div className="relative aspect-[4/5] rounded-[2.8rem] overflow-hidden bg-background-secondary/40 mb-8">
                    <img 
                      src={type.icon} 
                      alt={type.label}
                      className={`
                        w-full h-full object-contain transition-all duration-700 p-8
                        ${isActive ? 'scale-110' : 'opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-60'}
                      `}
                    />
                    
                    {isActive && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute top-8 right-8 w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center shadow-xl shadow-accent/40"
                      >
                        <Check size={24} strokeWidth={3} />
                      </motion.div>
                    )}
                  </div>

                  <div className="px-10 pb-10 space-y-3">
                    <h3 className={`text-2xl font-light tracking-widest uppercase transition-colors ${isActive ? 'text-white' : 'text-text-secondary group-hover:text-white'}`}>
                      {type.label}
                    </h3>
                    <p className="text-[10px] text-text-secondary font-medium uppercase tracking-widest leading-relaxed opacity-40">
                      {type.description}
                    </p>
                  </div>

                  {/* Aesthetic HUD Line */}
                  {isActive && (
                    <motion.div 
                      layoutId="hud-line"
                      className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-1 bg-accent blur-sm rounded-full"
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-24 p-12 rounded-[3rem] border border-white/5 bg-white/[0.01] max-w-4xl text-center">
          <p className="text-[10px] font-black tracking-[0.5em] text-text-secondary uppercase opacity-20">
            Advanced biometric customization (Height, Hair, Skin Tone) coming in next cycle.
          </p>
        </div>
      </SectionWrapper>

      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent/5 blur-[160px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/5 blur-[140px] rounded-full" />
      </div>
    </div>
  );
};

export default PersonaPage;
