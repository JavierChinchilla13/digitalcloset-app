import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { type ClothingTransform, ClothingCategory, PersonaType } from '../types';
import {
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
  cropInsets,
  jacketOpening,
  resolveFinalTransform,
} from '../utils/layerGeometry';

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
  // Task 85: the pictures of one garment (a modular jacket's torso, sleeves,
  // ...) share a group; a single-picture garment is its own group.
  group?: string;
  // A mask (image URL) hiding the parts of this layer a garment above it would
  // really cover, e.g. a shirt's sides and hem beyond the jacket over it.
  occlusionMask?: string;
}

const PersonaLayer: React.FC<PersonaLayerProps> = ({ 
  imageUrl, 
  zIndex, 
  transform, 
  className = "", 
  alt = "",
  category,
  personaType = PersonaType.MALE,
  side,
  occlusionMask
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

  const viewScale = containerHeight / VIRTUAL_HEIGHT;

  // Determination of final transform
  const finalTransform = resolveFinalTransform(transform, category, personaType, side);

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

    // Crop (see cropInsets for how the numbers are read).
    const insets = cropInsets(finalTransform);
    const clipPath = insets
      ? `inset(${insets.top}% ${insets.right}% ${insets.bottom}% ${insets.left}%)`
      : 'none';

    // Center Opening Mask (for Jackets)
    const opening = jacketOpening(finalTransform, category);
    const maskImage = opening
      ? `linear-gradient(to right, black 0%, black ${opening.start}%, transparent ${opening.start}%, transparent ${opening.end}%, black ${opening.end}%, black 100%)`
      : 'none';

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
      // Task 85: the occlusion mask goes on this wrapper, which is exactly the
      // persona's 3:4 box, so it needs no placing - the picture's own crop and
      // jacket-opening masks stay on the <img> underneath.
      style={{
        zIndex,
        ...(occlusionMask && {
          maskImage: `url("${occlusionMask}")`,
          WebkitMaskImage: `url("${occlusionMask}")`,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }),
      }}
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
