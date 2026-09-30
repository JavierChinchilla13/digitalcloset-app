import { useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  // Path (under /public) of a short clip showing this feature. Hovering or
  // tapping the card reveals it. Optional on purpose: a card whose file is
  // missing or fails to load simply has no preview, so a clip can be dropped
  // into public/marketing later with no code change.
  media?: string;
  delay?: number;
}

// Landing page feature tile. Hover (desktop) or tap (touch) swaps the tile's
// text for a looping capture of the actual feature.
const FeatureCard = ({ icon: Icon, title, desc, media, delay = 0 }: FeatureCardProps) => {
  const [isActive, setIsActive] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const hasPreview = !!media && !mediaFailed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      // A tap fires mouseenter first, then click - so click only ever opens
      // (a toggle would immediately close what the hover just opened).
      onClick={() => setIsActive(true)}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      tabIndex={hasPreview ? 0 : undefined}
      data-testid="feature-card"
      className={`premium-card relative overflow-hidden p-10 group hover:border-accent/30 min-h-[20rem] ${hasPreview ? 'cursor-pointer' : ''}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-ink/5 flex items-center justify-center mb-8 group-hover:bg-accent group-hover:text-on-accent transition-all">
        <Icon size={28} />
      </div>
      <h3 className="text-lg font-bold tracking-widest mb-4 uppercase">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
      {hasPreview && (
        <p className="absolute bottom-5 left-10 text-[9px] font-medium tracking-[0.3em] uppercase text-accent/70">
          Hover to preview
        </p>
      )}

      {media && !mediaFailed && (
        <div
          aria-hidden={!isActive}
          className={`absolute inset-0 bg-background-main transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <img
            src={media}
            alt={`${title.toLowerCase()} in action`}
            onError={() => setMediaFailed(true)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/85 to-transparent">
            <p className="text-xs font-bold tracking-widest uppercase text-white">{title}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FeatureCard;
