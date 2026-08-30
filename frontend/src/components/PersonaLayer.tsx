import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { type ClothingTransform, ClothingCategory, PersonaType } from '../types';
import { DEFAULT_TRANSFORMS, SHOE_PAIR_PRESETS } from './FittingTool/Presets';

export interface PersonaLayerProps {
  id: string;
  imageUrl?: string;
  zIndex: number;
  transform?: ClothingTransform;
  className?: string;
  alt?: string;
  category?: ClothingCategory;
  personaType?: PersonaType;
  side?: 'left' | 'right';
}

const PersonaLayer: React.FC<PersonaLayerProps> = ({ 
  imageUrl, 
  zIndex, 
  transform, 
  className = "", 
  alt = "",
  category,
  personaType = PersonaType.MALE,
  side
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.offsetHeight);
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height);
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  const VIRTUAL_HEIGHT = 1000;
  const VIRTUAL_WIDTH = 750;
  const viewScale = containerHeight / VIRTUAL_HEIGHT;

  // Determination of final transform
  let finalTransform = transform?.width ? transform : null;
  
  if (!finalTransform && category) {
    if (category === ClothingCategory.SHOES && side) {
      finalTransform = SHOE_PAIR_PRESETS[personaType][side];
    } else if (DEFAULT_TRANSFORMS[personaType][category]) {
      finalTransform = DEFAULT_TRANSFORMS[personaType][category];
    }
  }

  if (!imageUrl) return null;

  const getStyle = () => {
    if (!finalTransform) {
      return {
        position: 'absolute' as const,
        left: '50%',
        top: '50%',
        height: '100%',
        width: 'auto',
        transform: 'translate(-50%, -50%)',
        objectFit: 'contain' as const,
        visibility: 'visible' as const,
        opacity: 1
      };
    }

    // Dimension Reconstruction
    const width = (finalTransform.width || 450) * viewScale;
    const height = (finalTransform.height || 450) * viewScale;
    
    // Translation relative to center
    const offsetX = (finalTransform.x - VIRTUAL_WIDTH / 2) * viewScale;
    const offsetY = (finalTransform.y - VIRTUAL_HEIGHT / 2) * viewScale;

    // Mask Calculation
    let clipPath = 'none';
    if (finalTransform.maskWidth && finalTransform.maskHeight) {
      const gW = finalTransform.width || 450;
      const gH = finalTransform.height || 450;
      const gLeft = finalTransform.x - gW / 2;
      const gTop = finalTransform.y - gH / 2;

      const insetLeft = ((finalTransform.maskLeft! - gLeft) / gW) * 100;
      const insetTop = ((finalTransform.maskTop! - gTop) / gH) * 100;
      const insetRight = 100 - (((finalTransform.maskLeft! + finalTransform.maskWidth) - gLeft) / gW) * 100;
      const insetBottom = 100 - (((finalTransform.maskTop! + finalTransform.maskHeight) - gTop) / gH) * 100;

      clipPath = `inset(${Math.max(0, insetTop)}% ${Math.max(0, insetRight)}% ${Math.max(0, insetBottom)}% ${Math.max(0, insetLeft)}%)`;
    }

    // Center Opening Mask (for Jackets)
    let maskImage = 'none';
    if (category === ClothingCategory.JACKET && finalTransform.openness) {
       const openness = finalTransform.openness;
       const holeStart = (50 - (openness * 100) / 2);
       const holeEnd = (50 + (openness * 100) / 2);
       maskImage = `linear-gradient(to right, black 0%, black ${holeStart}%, transparent ${holeStart}%, transparent ${holeEnd}%, black ${holeEnd}%, black 100%)`;
    }

    return {
      position: 'absolute' as const,
      left: '50%',
      top: '50%',
      width: `${width}px`,
      height: `${height}px`,
      transform: `
        translate(-50%, -50%)
        translate(${offsetX}px, ${offsetY}px) 
        rotate(${finalTransform.rotation}deg) 
        scale(${finalTransform.flipX ? -1 : 1}, ${finalTransform.flipY ? -1 : 1})
      `,
      visibility: 'visible' as const,
      opacity: finalTransform.opacity ?? 1,
      clipPath,
      WebkitMaskImage: maskImage,
      maskImage,
      imageRendering: 'crisp-edges' as const,
      transformOrigin: 'center center'
    };
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible ${className}`}
      style={{ zIndex }}
    >
      <img 
        src={imageUrl} 
        alt={alt}
        className="pointer-events-none absolute"
        style={getStyle()}
      />
    </motion.div>
  );
};

export default PersonaLayer;
