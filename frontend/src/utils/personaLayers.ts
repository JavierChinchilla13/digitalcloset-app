import { PersonaType, type ClothingItem, type ModularJacketData, type PersonaState } from '../types';
import type { PersonaLayerProps } from '../components/PersonaLayer';
import { resolveStack } from './layerOrder';

// Task 102: the list of picture layers a persona is drawn with (the base figure plus each garment, with
// its stacking order). It used to live inside PersonaRenderer; it is shared now so the same layers can
// be drawn by the CSS renderer on screen and by the canvas exporter that makes the shareable image.
// `items` is the closet the persona's ids refer to.
export function buildPersonaLayers(persona: PersonaState, items: ClothingItem[]): PersonaLayerProps[] {
  const isMale = persona.type === PersonaType.MALE;
  const baseImage = isMale ? '/personas/male-base.png' : '/personas/female-base.png';

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

  return layers;
}
