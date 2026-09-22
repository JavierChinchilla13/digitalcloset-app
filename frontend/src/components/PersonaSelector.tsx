import React from 'react';
import { motion } from 'framer-motion';
import { PersonaType } from '../types';
import { User, UserRound } from 'lucide-react';

interface PersonaSelectorProps {
  currentType: PersonaType;
  onTypeChange: (type: PersonaType) => void;
}

const PersonaSelector: React.FC<PersonaSelectorProps> = ({ currentType, onTypeChange }) => {
  const options = [
    { type: PersonaType.MALE, label: 'MALE', icon: UserRound },
    { type: PersonaType.FEMALE, label: 'FEMALE', icon: User },
  ];

  return (
    <div className="relative inline-flex bg-background-secondary p-1.5 rounded-full border border-ink/5 backdrop-blur-md shadow-2xl">
      {/* Background Sliding Indicator */}
      <motion.div
        className="absolute h-[calc(100%-12px)] bg-accent rounded-full shadow-lg"
        initial={false}
        animate={{
          x: currentType === PersonaType.MALE ? 0 : 120,
          width: currentType === PersonaType.MALE ? 110 : 130, // Slight adjust for label length
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />

      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = currentType === opt.type;
        return (
          <button
            key={opt.type}
            onClick={() => onTypeChange(opt.type)}
            className={`
              relative z-10 flex items-center gap-2.5 px-6 py-2.5 rounded-full transition-colors duration-300
              ${isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}
            `}
            style={{ width: opt.type === PersonaType.MALE ? 120 : 140 }}
          >
            <Icon size={16} className={isActive ? 'opacity-100' : 'opacity-50'} />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default PersonaSelector;
