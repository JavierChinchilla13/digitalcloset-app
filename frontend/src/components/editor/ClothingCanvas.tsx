import React, { useEffect, useRef } from 'react';
import { Canvas, Rect } from 'fabric';
import { PersonaType, ClothingCategory, type ClothingTransform } from '../../types';
import {
  ASPECT_RATIO,
  toCanvasCoord,
  toVirtualCoord,
  toCanvasX,
  loadFabricImage,
  centerObject,
  getVirtualTransform
} from './CanvasUtils';
import { customizeFabricControls, lockObject } from './FabricControls';
import { useFabricCanvas } from '../../hooks/useFabricCanvas';

interface ClothingCanvasProps {
  imageUrl: string;
  category: ClothingCategory;
  personaType: PersonaType;
  transform: ClothingTransform;
  onTransformChange: (transform: ClothingTransform) => void;
  onCanvasReady?: (canvas: Canvas) => void;
  activeTool?: string;
}

const ClothingCanvas: React.FC<ClothingCanvasProps> = ({ 
  imageUrl, 
  personaType, 
  transform, 
  onTransformChange,
  onCanvasReady,
  activeTool = 'select'
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

    const handleModified = () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject && activeObject.name === 'garment' && !isUpdatingRef.current) {
        const virtualTransform = getVirtualTransform(activeObject, canvas.getWidth(), canvas.getHeight());
        onTransformChange({
          ...transform,
          ...virtualTransform,
        });
      }
    };

    canvas.on('object:modified', handleModified);
    canvas.on('object:scaling', handleModified);
    canvas.on('object:moving', handleModified);
    canvas.on('object:rotating', handleModified);

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Handle Tool Changes (Crop)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const garment = canvas.getObjects().find(obj => obj.name === 'garment');
    if (!garment) return;

    const existingCropBox = canvas.getObjects().find(obj => obj.name === 'cropBox');
    if (existingCropBox) canvas.remove(existingCropBox);

    if (activeTool === 'crop') {
      garment.set({ selectable: false });
      
      const canvasHeight = canvas.getHeight();
      
      // Initialize crop box at current mask position or fallback to 80% of garment
      const cropBox = new Rect({
        left: transform.maskWidth ? toCanvasCoord(transform.maskLeft!, canvasHeight) : garment.left,
        top: transform.maskHeight ? toCanvasCoord(transform.maskTop!, canvasHeight) : garment.top,
        width: transform.maskWidth ? toCanvasCoord(transform.maskWidth, canvasHeight) : garment.getScaledWidth() * 0.8,
        height: transform.maskHeight ? toCanvasCoord(transform.maskHeight, canvasHeight) : garment.getScaledHeight() * 0.8,
        fill: 'rgba(91, 140, 255, 0.3)',
        stroke: '#5B8CFF',
        strokeWidth: 2,
        name: 'cropBox',
        originX: 'center',
        originY: 'center',
        cornerStyle: 'circle',
        cornerColor: '#FFF',
        transparentCorners: false,
      });

      canvas.add(cropBox);
      canvas.setActiveObject(cropBox);
      
      const updateCrop = () => {
        const clipRect = new Rect({
          left: cropBox.left,
          top: cropBox.top,
          width: cropBox.getScaledWidth(),
          height: cropBox.getScaledHeight(),
          originX: 'center',
          originY: 'center',
          name: 'cropMask',
          absolutePositioned: true
        });
        garment.set({ clipPath: clipRect });
        
        onTransformChange({
          ...transform,
          maskLeft: toVirtualCoord(cropBox.left!, canvas.getHeight()),
          maskTop: toVirtualCoord(cropBox.top!, canvas.getHeight()),
          maskWidth: toVirtualCoord(cropBox.getScaledWidth(), canvas.getHeight()),
          maskHeight: toVirtualCoord(cropBox.getScaledHeight(), canvas.getHeight()),
        });
        canvas.requestRenderAll();
      };

      cropBox.on('modified', updateCrop);
      cropBox.on('moving', updateCrop);
      cropBox.on('scaling', updateCrop);

    } else {
      garment.set({ selectable: true });
      canvas.setActiveObject(garment);
    }
    
    canvas.requestRenderAll();
  }, [activeTool]);

  // Load Mannequin and Garment
  useEffect(() => {
    let cancelled = false;

    const initObjects = async () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || canvasSize.height === 0) return;

      try {
        const [mannequin, garment] = await Promise.all([
          loadFabricImage(mannequinUrl),
          loadFabricImage(imageUrl)
        ]);

        if (cancelled) return;

        canvas.clear();

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
        
        // Setup Garment
        garment.set({
          name: 'garment',
          originX: 'center',
          originY: 'center',
          left: toCanvasX(transform.x, canvasWidth, canvasHeight),
          top: toCanvasCoord(transform.y, canvasHeight),
          angle: transform.rotation,
          opacity: transform.opacity ?? 1,
          flipX: transform.flipX ?? false,
          flipY: transform.flipY ?? false,
          objectCaching: false,
          uniformScaling: false
        });

        // Apply scale based on absolute virtual width
        // If width is missing (new item), default to 450
        const virtualWidth = transform.width || 450;
        const targetWidth = toCanvasCoord(virtualWidth, canvasHeight);
        garment.scaleToWidth(targetWidth);

        // Apply mask if exists
        if (transform.maskWidth && transform.maskHeight) {
          garment.set({
            clipPath: new Rect({
              left: toCanvasX(transform.maskLeft!, canvasWidth, canvasHeight),
              top: toCanvasCoord(transform.maskTop!, canvasHeight),
              width: toCanvasCoord(transform.maskWidth, canvasHeight),
              height: toCanvasCoord(transform.maskHeight, canvasHeight),
              originX: 'center',
              originY: 'center',
              name: 'cropMask',
              absolutePositioned: true
            })
          });
        }

        canvas.add(garment);
        canvas.setActiveObject(garment);
        canvas.requestRenderAll();
      } catch (err) {
        console.error("Error loading images into Fabric canvas:", err);
      }
    };

    initObjects();
    return () => { cancelled = true; };
  }, [imageUrl, mannequinUrl, canvasSize]);

  // Sync Transform updates from props
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || isUpdatingRef.current) return;

    const garment = canvas.getObjects().find(obj => obj.name === 'garment');
    if (garment) {
      isUpdatingRef.current = true;
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      garment.set({
        left: toCanvasX(transform.x, canvasWidth, canvasHeight),
        top: toCanvasCoord(transform.y, canvasHeight),
        angle: transform.rotation,
        opacity: transform.opacity ?? 1,
        flipX: transform.flipX ?? false,
        flipY: transform.flipY ?? false,
      });

      if (transform.width && transform.height) {
        const targetWidth = toCanvasCoord(transform.width, canvasHeight);
        const targetHeight = toCanvasCoord(transform.height, canvasHeight);
        
        // Calculate required scales based on base image dimensions
        // fabric image scaleX = targetWidth / baseWidth
        const baseWidth = garment.getOriginalSize().width;
        const baseHeight = garment.getOriginalSize().height;
        
        garment.set({
          scaleX: targetWidth / baseWidth,
          scaleY: targetHeight / baseHeight
        });
      }

      garment.setCoords();
      canvas.requestRenderAll();
      isUpdatingRef.current = false;
    }
  }, [transform.x, transform.y, transform.width, transform.height, transform.rotation, transform.opacity, transform.flipX, transform.flipY]);

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
          <p className="text-[7px] font-black tracking-[0.4em] text-white uppercase">Fabric.js v7.4 Core</p>
          <p className="text-[7px] font-black tracking-[0.4em] text-accent uppercase">Absolute Virtual Engine</p>
        </div>
      </div>
    </div>
  );
};

export default ClothingCanvas;
