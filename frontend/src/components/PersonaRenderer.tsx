import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { PersonaType, type PersonaState, type ModularJacketData } from '../types';
import PersonaLayer, { type PersonaLayerProps } from './PersonaLayer';
import { useClothingStore } from '../store/useClothingStore';
import { usePersonaStore } from '../store/usePersonaStore';
import ErrorBoundary from './ErrorBoundary';
import ErrorState from './ErrorState';
import { useOcclusionMasks, pickLayerAt } from '../hooks/useOcclusionMasks';
import { resolveStack } from '../utils/layerOrder';

interface PersonaRendererProps {
  persona?: PersonaState;
  className?: string;
  // Task 86: makes the garments clickable - called with the closet item under
  // the click (nothing when the click lands on the bare persona).
  onLayerPick?: (itemId: number) => void;
  // The item to glow (the one selected for reordering).
  highlightItemId?: number | null;
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
  highlightItemId
}) => {
  const { items, fetchItems } = useClothingStore();
  const { persona: storePersona } = usePersonaStore();

  const persona = customPersona || storePersona;

  const isMale = persona?.type === PersonaType.MALE;
  const baseImage = isMale ? '/personas/male-base.png' : '/personas/female-base.png';

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (!persona) {
    return (
      <div className={`flex items-center justify-center w-full ${className}`}>
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  const getItem = (itemId: number | null | undefined) => {
    if (!itemId) return undefined;
    const item = items.find(i => String(i.itemId) === String(itemId));
    if (item && item.personaType !== persona.type) return undefined;
    return item;
  };

  const getItems = (itemIds: number[] | undefined | null) => {
    if (!itemIds || !Array.isArray(itemIds)) return [];
    return itemIds
      .map(id => getItem(id))
      .filter((item): item is NonNullable<typeof item> => !!item);
  };

  const bottoms = getItems(persona.bottomIds);
  const leftShoe = getItem(persona.leftShoeId);
  const rightShoe = getItem(persona.rightShoeId);
  const tops = getItems(persona.topIds);
  const dresses = getItems(persona.dressIds);
  const jackets = getItems(persona.jacketIds);
  const accessories = getItems(persona.accessoryIds);

  const layers: PersonaLayerProps[] = [
    { id: 'base', imageUrl: baseImage, zIndex: 0, alt: 'Mannequin' },
  ];

  // Add Bottoms (Z: 100+)
  bottoms.forEach((item, index) => {
    layers.push({
      id: `bottom-${item.itemId}`,
      itemId: item.itemId,
      imageUrl: item.imageUrl,
      zIndex: 100 + index,
      transform: item.transform,
      category: item.category,
      personaType: persona.type
    });
  });

  // Add Shoes (Z: 200+)
  if (leftShoe && rightShoe && leftShoe.itemId === rightShoe.itemId) {
    // Legacy behavior: Single image contains both shoes
    layers.push({
      id: `shoes-pair-${leftShoe.itemId}`,
      itemId: leftShoe.itemId,
      imageUrl: leftShoe.imageUrl,
      zIndex: 200,
      transform: leftShoe.transform,
      category: leftShoe.category,
      personaType: persona.type
    });
  } else {
    if (leftShoe) {
      layers.push({
        id: `left-shoe-${leftShoe.itemId}`,
      itemId: leftShoe.itemId,
        imageUrl: leftShoe.imageUrl,
        zIndex: 200,
        transform: leftShoe.transform,
        category: leftShoe.category,
        personaType: persona.type,
        side: 'left'
      });
    }
    if (rightShoe) {
      layers.push({
        id: `right-shoe-${rightShoe.itemId}`,
      itemId: rightShoe.itemId,
        imageUrl: rightShoe.imageUrl,
        zIndex: 201,
        transform: rightShoe.transform,
        category: rightShoe.category,
        personaType: persona.type,
        side: 'right'
      });
    }
  }

  // Add Dresses (Z: 250+)
  dresses.forEach((item, index) => {
    layers.push({
      id: `dress-${item.itemId}`,
      itemId: item.itemId,
      imageUrl: item.imageUrl,
      zIndex: 250 + index,
      transform: item.transform,
      category: item.category,
      personaType: persona.type
    });
  });

  // Add Tops (Z: 300+)
  tops.forEach((item, index) => {
    layers.push({
      id: `top-${item.itemId}`,
      itemId: item.itemId,
      imageUrl: item.imageUrl,
      zIndex: 300 + index,
      transform: item.transform,
      category: item.category,
      personaType: persona.type
    });
  });

  // Add Jackets (Z: 400+)
  jackets.forEach((item, index) => {
    if (item.isModular && item.modularData) {
      try {
        const modularData: ModularJacketData = JSON.parse(item.modularData);
        const order = modularData.renderOrder || ['torso', 'leftSleeve', 'rightSleeve', 'collar'];
        order.forEach((partName, partIndex) => {
          const segment = modularData.segments[partName as keyof ModularJacketData['segments']];
          if (segment) {
            layers.push({
              id: `jacket-${item.itemId}-${partName}`,
      itemId: item.itemId,
              group: `jacket-${item.itemId}`,
              imageUrl: segment.imageUrl,
              zIndex: 400 + (index * 10) + partIndex,
              transform: { 
                ...segment.transform, 
                openness: partName === 'torso' ? modularData.openness : 0 
              },
              category: item.category,
              personaType: persona.type
            });
          }
        });
      } catch (e) {
        layers.push({
          id: `jacket-${item.itemId}`,
      itemId: item.itemId,
          imageUrl: item.imageUrl,
          zIndex: 400 + (index * 10),
          transform: item.transform,
          category: item.category,
          personaType: persona.type
        });
      }
    } else {
      layers.push({
        id: `jacket-${item.itemId}`,
      itemId: item.itemId,
        imageUrl: item.imageUrl,
        zIndex: 400 + (index * 10),
        transform: item.transform,
        category: item.category,
        personaType: persona.type
      });
    }
  });

  // Add Accessories (Z: 500+)
  accessories.forEach((item, index) => {
    layers.push({
      id: `accessory-${item.itemId}`,
      itemId: item.itemId,
      imageUrl: item.imageUrl,
      zIndex: 500 + index,
      transform: item.transform,
      category: item.category,
      personaType: persona.type
    });
  });

  // Task 86: a custom stacking order replaces the category ranges. Every piece
  // gets a slot of ten in the stack (its pictures keep their relative order
  // inside it - a modular jacket's parts, a left/right shoe), so the pieces
  // the order doesn't mention still land where their category would put them.
  if (persona.layerOrder && persona.layerOrder.length > 0) {
    const renderedIds = Array.from(new Set(layers.map((l) => l.itemId).filter((id): id is number => id != null)));
    const stack = resolveStack(renderedIds, items, persona.layerOrder);
    const sub = new Map<number, number>();
    [...layers]
      .filter((l) => l.itemId != null)
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((layer) => {
        const n = sub.get(layer.itemId!) ?? 0;
        sub.set(layer.itemId!, n + 1);
        const position = stack.indexOf(layer.itemId!);
        if (position >= 0) layer.zIndex = 100 + position * 10 + Math.min(n, 9);
      });
  }

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
