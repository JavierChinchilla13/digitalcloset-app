import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { type PersonaState, type ClothingItem } from '../types';
import PersonaLayer, { type PersonaLayerProps } from './PersonaLayer';
import { useClothingStore } from '../store/useClothingStore';
import { usePersonaStore } from '../store/usePersonaStore';
import ErrorBoundary from './ErrorBoundary';
import ErrorState from './ErrorState';
import { useOcclusionMasks, pickLayerAt } from '../hooks/useOcclusionMasks';
import { buildPersonaLayers } from '../utils/personaLayers';

interface PersonaRendererProps {
  persona?: PersonaState;
  className?: string;
  // Task 86: makes the garments clickable - called with the closet item under
  // the click (nothing when the click lands on the bare persona).
  onLayerPick?: (itemId: number) => void;
  // The item to glow (the one selected for reordering).
  highlightItemId?: number | null;
  // Task 102: draw these garments instead of the signed-in user's closet (the public shared-outfit
  // page has no closet). When given, the closet store is neither read nor fetched.
  items?: ClothingItem[];
}

// The persona's layers, each with the mask (Task 85) that stops a garment
// from showing where another one above it would really cover it. A component
// of its own because hooks can't sit after the renderer's early return.
const PersonaLayerStack: React.FC<{ layers: PersonaLayerProps[]; highlightItemId?: number | null }> = ({
  layers,
  highlightItemId,
}) => {
  const masks = useOcclusionMasks(layers);
  return (
    <>
      {layers.map((layer) => (
        <PersonaLayer
          key={`${layer.id}-${layer.imageUrl || 'none'}`}
          {...layer}
          occlusionMask={masks[layer.id]}
          highlight={highlightItemId != null && layer.itemId === highlightItemId}
        />
      ))}
    </>
  );
};

const PersonaRendererContent: React.FC<PersonaRendererProps> = ({ 
  persona: customPersona,
  className = "h-[600px] md:h-[800px]",
  onLayerPick,
  highlightItemId,
  items: itemsProp,
}) => {
  const { items: storeItems, fetchItems } = useClothingStore();
  const items = itemsProp ?? storeItems;
  const { persona: storePersona } = usePersonaStore();

  const persona = customPersona || storePersona;

  useEffect(() => {
    if (!itemsProp) fetchItems();
  }, [fetchItems, itemsProp]);

  if (!persona) {
    return (
      <div className={`flex items-center justify-center w-full ${className}`}>
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  const layers = buildPersonaLayers(persona, items);

  const handlePick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onLayerPick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const itemId = await pickLayerAt(layers, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    if (itemId != null) onLayerPick(itemId);
  };

  return (
    <div className={`relative w-full flex items-center justify-center overflow-visible ${className}`}>
      {/* Clean Minimal shadow for depth */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 h-4 bg-black/40 blur-2xl rounded-full scale-x-150 z-0" />

      {/* Main Persona Container */}
      <div className="relative w-full h-full flex items-center justify-center z-10 overflow-visible">
        <AnimatePresence mode="wait">
          <motion.div
            key={persona.type}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className={`relative h-full aspect-[3/4] flex items-center justify-center overflow-visible ${onLayerPick ? 'cursor-pointer' : ''}`}
            onClick={onLayerPick ? handlePick : undefined}
          >
            <PersonaLayerStack layers={layers} highlightItemId={highlightItemId} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// Task 22: a render error in any layer (a malformed transform, a corrupt
// modularData blob, ...) used to unmount the whole page. Wrapping at the
// source covers every place the persona is shown; it retries by itself when
// the persona being shown changes, and offers Try Again otherwise.
const PersonaRenderer: React.FC<PersonaRendererProps> = (props) => (
  <ErrorBoundary
    resetKeys={[props.persona]}
    fallback={({ reset }) => (
      <div className={`flex items-center justify-center ${props.className ?? "h-[600px] md:h-[800px]"}`}>
        <ErrorState
          compact
          title="Couldn't show this preview"
          message="Something went wrong drawing the persona. Your items are safe."
          onRetry={reset}
        />
      </div>
    )}
  >
    <PersonaRendererContent {...props} />
  </ErrorBoundary>
);

export default PersonaRenderer;
