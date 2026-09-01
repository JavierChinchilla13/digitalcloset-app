import React, { useEffect, useRef } from 'react';
import { Canvas, Rect } from 'fabric';
import { PersonaType, type ClothingTransform } from '../../types';
import {
  ASPECT_RATIO,
  toCanvasX,
  toCanvasCoord,
  loadFabricImage,
  centerObject,
  getVirtualTransform
} from '../editor/CanvasUtils';
import { customizeFabricControls, lockObject } from '../editor/FabricControls';
import { useFabricCanvas } from '../../hooks/useFabricCanvas';

interface ShoeCanvasProps {
  leftImageUrl: string;
  rightImageUrl: string;
  personaType: PersonaType;
  leftTransform: ClothingTransform;
  rightTransform: ClothingTransform;
  onTransformChange: (side: 'left' | 'right', transform: ClothingTransform) => void;
  onCanvasReady?: (canvas: Canvas) => void;
  activeSide?: 'left' | 'right' | null;
  onSideSelect?: (side: 'left' | 'right') => void;
}

const ShoeCanvas: React.FC<ShoeCanvasProps> = ({ 
  leftImageUrl, 
  rightImageUrl,
  personaType, 
  leftTransform,
  rightTransform,
  onTransformChange,
  onCanvasReady,
  activeSide,
  onSideSelect
}) => {
  const { canvasRef, fabricCanvasRef, containerRef, canvasSize } = useFabricCanvas({
    aspectRatio: ASPECT_RATIO,
    onResize: (size, canvas) => {
      canvas?.setDimensions(size);
      canvas?.requestRenderAll();
    },
  });
  const isUpdatingRef = useRef(false);

  const mannequinUrl = personaType === PersonaType.MALE 
    ? '/personas/male-base.png' 
    : '/personas/female-base.png';

  // Initialize Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    customizeFabricControls();

    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: false,
    });

    fabricCanvasRef.current = canvas;
    if (onCanvasReady) onCanvasReady(canvas);

    const handleModified = (e: any) => {
      const activeObject = e.target;
      if (activeObject && (activeObject.name === 'leftShoe' || activeObject.name === 'rightShoe') && !isUpdatingRef.current) {
        const side = activeObject.name === 'leftShoe' ? 'left' : 'right';
        const currentBaseTransform = side === 'left' ? leftTransform : rightTransform;
        const virtualTransform = getVirtualTransform(activeObject, canvas.getWidth(), canvas.getHeight());
        
        onTransformChange(side, {
          ...currentBaseTransform,
          ...virtualTransform,
        });

        if (onSideSelect) onSideSelect(side);
      }
    };

    canvas.on('object:modified', handleModified);
    canvas.on('object:scaling', handleModified);
    canvas.on('object:moving', handleModified);
    canvas.on('object:rotating', handleModified);
    
    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0];
      if (obj && (obj.name === 'leftShoe' || obj.name === 'rightShoe')) {
        if (onSideSelect) onSideSelect(obj.name === 'leftShoe' ? 'left' : 'right');
      }
    });

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Load Mannequin and Shoes
  useEffect(() => {
    let cancelled = false;

    const initObjects = async () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || canvasSize.height === 0) return;

      try {
        const [mannequin, leftShoe, rightShoe] = await Promise.all([
          loadFabricImage(mannequinUrl),
          loadFabricImage(leftImageUrl),
          loadFabricImage(rightImageUrl)
        ]);

        if (cancelled) return;

        canvas.clear();

        // 1. Setup Mannequin
        mannequin.set({
          name: 'mannequin',
          originX: 'center',
          originY: 'center',
        });
        const mannequinScale = canvas.getHeight() / mannequin.height!;
        mannequin.scale(mannequinScale);
        centerObject(canvas, mannequin);
        lockObject(mannequin);
        canvas.add(mannequin);
        canvas.sendObjectToBack(mannequin);

        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();

        // 2. Setup Foot Indicators
        const indicatorColor = 'rgba(91, 140, 255, 0.4)';
        const createFootIndicator = (x: number, y: number, _label: string) => {
          const group = new Rect({
            left: toCanvasX(x, canvasWidth, canvasHeight),
            top: toCanvasCoord(y, canvasHeight),
            width: toCanvasCoord(150, canvasHeight),
            height: toCanvasCoord(60, canvasHeight),
            fill: indicatorColor,
            rx: 30,
            ry: 30,
            originX: 'center',
            originY: 'center',
            stroke: '#5B8CFF',
            strokeDashArray: [5, 5],
            strokeWidth: 1,
            selectable: false,
            evented: false,
            name: 'indicator'
          });
          canvas.add(group);
        };

        createFootIndicator(300, 940, 'L');
        createFootIndicator(450, 940, 'R');

        // 3. Setup Left Shoe
        leftShoe.set({
          name: 'leftShoe',
          originX: 'center',
          originY: 'center',
          left: toCanvasX(leftTransform.x, canvasWidth, canvasHeight),
          top: toCanvasCoord(leftTransform.y, canvasHeight),
          angle: leftTransform.rotation,
          opacity: leftTransform.opacity ?? 1,
          flipX: leftTransform.flipX ?? false,
          flipY: leftTransform.flipY ?? false,
          objectCaching: false,
          uniformScaling: false
        });
        leftShoe.scaleToWidth(toCanvasCoord(leftTransform.width || 260, canvasHeight));
        if (leftTransform.height) {
           const baseHeight = leftShoe.getOriginalSize().height;
           leftShoe.set({ scaleY: toCanvasCoord(leftTransform.height, canvasHeight) / baseHeight });
        }
        canvas.add(leftShoe);

        // 4. Setup Right Shoe
        rightShoe.set({
          name: 'rightShoe',
          originX: 'center',
          originY: 'center',
          left: toCanvasX(rightTransform.x, canvasWidth, canvasHeight),
          top: toCanvasCoord(rightTransform.y, canvasHeight),
          angle: rightTransform.rotation,
          opacity: rightTransform.opacity ?? 1,
          flipX: rightTransform.flipX ?? false,
          flipY: rightTransform.flipY ?? false,
          objectCaching: false,
          uniformScaling: false
        });
        rightShoe.scaleToWidth(toCanvasCoord(rightTransform.width || 260, canvasHeight));
        if (rightTransform.height) {
           const baseHeight = rightShoe.getOriginalSize().height;
           rightShoe.set({ scaleY: toCanvasCoord(rightTransform.height, canvasHeight) / baseHeight });
        }
        canvas.add(rightShoe);

        if (activeSide === 'left') canvas.setActiveObject(leftShoe);
        else if (activeSide === 'right') canvas.setActiveObject(rightShoe);

        canvas.requestRenderAll();
      } catch (err) {
        console.error("Error loading images into Shoe canvas:", err);
      }
    };

    initObjects();
    return () => { cancelled = true; };
  }, [leftImageUrl, rightImageUrl, mannequinUrl, canvasSize]);

  // Sync Transform updates from props
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || isUpdatingRef.current) return;

    const leftObj = canvas.getObjects().find(obj => obj.name === 'leftShoe');
    const rightObj = canvas.getObjects().find(obj => obj.name === 'rightShoe');
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    isUpdatingRef.current = true;
    
    if (leftObj) {
      leftObj.set({
        left: toCanvasX(leftTransform.x, canvasWidth, canvasHeight),
        top: toCanvasCoord(leftTransform.y, canvasHeight),
        angle: leftTransform.rotation,
        opacity: leftTransform.opacity ?? 1,
        flipX: leftTransform.flipX ?? false,
        flipY: leftTransform.flipY ?? false,
      });
      if (leftTransform.width && leftTransform.height) {
        const baseSize = leftObj.getOriginalSize();
        leftObj.set({
          scaleX: toCanvasCoord(leftTransform.width, canvasHeight) / baseSize.width,
          scaleY: toCanvasCoord(leftTransform.height, canvasHeight) / baseSize.height
        });
      }
      leftObj.setCoords();
    }

    if (rightObj) {
      rightObj.set({
        left: toCanvasX(rightTransform.x, canvasWidth, canvasHeight),
        top: toCanvasCoord(rightTransform.y, canvasHeight),
        angle: rightTransform.rotation,
        opacity: rightTransform.opacity ?? 1,
        flipX: rightTransform.flipX ?? false,
        flipY: rightTransform.flipY ?? false,
      });
      if (rightTransform.width && rightTransform.height) {
        const baseSize = rightObj.getOriginalSize();
        rightObj.set({
          scaleX: toCanvasCoord(rightTransform.width, canvasHeight) / baseSize.width,
          scaleY: toCanvasCoord(rightTransform.height, canvasHeight) / baseSize.height
        });
      }
      rightObj.setCoords();
    }

    canvas.requestRenderAll();
    isUpdatingRef.current = false;
  }, [leftTransform, rightTransform]);

  // Handle side selection from props
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (activeSide === 'left') {
      const leftObj = canvas.getObjects().find(obj => obj.name === 'leftShoe');
      if (leftObj) canvas.setActiveObject(leftObj);
    } else if (activeSide === 'right') {
      const rightObj = canvas.getObjects().find(obj => obj.name === 'rightShoe');
      if (rightObj) canvas.setActiveObject(rightObj);
    }
    canvas.requestRenderAll();
  }, [activeSide]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] flex items-center justify-center bg-black/40 rounded-[2.5rem] overflow-hidden border border-white/5 shadow-inner"
    >
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(#5B8CFF 1px, transparent 1px)', 
          backgroundSize: '30px 30px' 
        }} 
      />
      <canvas ref={canvasRef} />
      <div className="absolute bottom-6 left-6 flex items-center gap-4 opacity-40 pointer-events-none">
        <div className="flex flex-col gap-1">
          <p className="text-[7px] font-black tracking-[0.4em] text-white uppercase">SHOE STUDIO ENGINE</p>
          <p className="text-[7px] font-black tracking-[0.4em] text-accent uppercase">DUAL ASSET PIPELINE</p>
        </div>
      </div>
    </div>
  );
};

export default ShoeCanvas;
