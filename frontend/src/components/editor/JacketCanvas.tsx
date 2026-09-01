import React, { useEffect, useRef } from 'react';
import { Canvas, Rect, Group, Object as FabricObject } from 'fabric';
import { PersonaType, type ModularJacketData } from '../../types';
import {
  ASPECT_RATIO,
  toCanvasCoord,
  toCanvasX,
  loadFabricImage,
  centerObject,
  getVirtualTransform
} from './CanvasUtils';
import { customizeFabricControls, lockObject } from './FabricControls';
import { useFabricCanvas } from '../../hooks/useFabricCanvas';

interface JacketCanvasProps {
  segments: Record<string, string>;
  personaType: PersonaType;
  modularData: ModularJacketData;
  onDataChange: (data: ModularJacketData) => void;
  onCanvasReady?: (canvas: Canvas) => void;
  onSelectPart?: (part: string | null) => void;
  activePart?: string;
  isGroupMode?: boolean;
}

const JacketCanvas: React.FC<JacketCanvasProps> = ({
  segments,
  personaType,
  modularData,
  onDataChange,
  onCanvasReady,
  onSelectPart,
  activePart = 'torso',
  isGroupMode = false
}) => {
  const { canvasRef, fabricCanvasRef, containerRef, canvasSize } = useFabricCanvas({
    aspectRatio: ASPECT_RATIO,
    resizeThreshold: 5,
  });

  const isUpdatingRef = useRef(false);
  const isInteractingRef = useRef(false);
  const modularDataRef = useRef(modularData);
  const isGroupModeRef = useRef(isGroupMode);
  const activePartRef = useRef(activePart);
  // Per-object drag/scale/rotate delta tracking for group-mode sync (was
  // previously stashed directly on each FabricObject as _lastLeft/_lastTop/
  // _lastScaleX/_lastScaleY/_lastAngle - a WeakMap keyed by object achieves
  // the same per-object tracking without custom properties on Fabric's own
  // types, and objects are naturally released when the canvas is disposed.
  const lastTransformRef = useRef(
    new WeakMap<FabricObject, { left: number; top: number; scaleX: number; scaleY: number; angle: number }>()
  );

  // Keep refs up to date for event handlers
  useEffect(() => {
    modularDataRef.current = modularData;
    isGroupModeRef.current = isGroupMode;
    activePartRef.current = activePart;
  }, [modularData, isGroupMode, activePart]);

  // Unified Initialization and Loading
  useEffect(() => {
    if (!canvasRef.current || canvasSize.height === 0) return;
    let cancelled = false;

    customizeFabricControls();

    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: true,
      width: canvasSize.width,
      height: canvasSize.height
    });

    fabricCanvasRef.current = canvas;
    if (onCanvasReady) onCanvasReady(canvas);

    const handleModified = (e?: any) => {
      if (isUpdatingRef.current || cancelled) return;
      
      const canvasHeight = canvas.getHeight();
      const canvasWidth = canvas.getWidth();
      const target = e?.target;

      // --- Visual Virtual Grouping (Real-time movement, scaling, rotation) ---
      if (isGroupModeRef.current && target && target.name !== 'mannequin') {
        // action can be from transform or direct action property
        const action = e.transform?.action || e.action;
        
        const lastTransform = lastTransformRef.current.get(target);

        if (action === 'drag' || action === 'drag-all') {
          const dx = target.left - (lastTransform?.left ?? target.left);
          const dy = target.top - (lastTransform?.top ?? target.top);

          canvas.getObjects().forEach(obj => {
            if (obj.name && obj.name !== 'mannequin' && obj !== target) {
              obj.set({
                left: (obj.left || 0) + dx,
                top: (obj.top || 0) + dy
              });
              obj.setCoords();
            }
          });
        } else if (action && (action.includes('scale') || action.includes('resize'))) {
          // Calculate scale ratio relative to last known state
          const dsX = target.scaleX / (lastTransform?.scaleX || target.scaleX);
          const dsY = target.scaleY / (lastTransform?.scaleY || target.scaleY);

          if (Math.abs(dsX - 1) > 0.0001 || Math.abs(dsY - 1) > 0.0001) {
            canvas.getObjects().forEach(obj => {
              if (obj.name && obj.name !== 'mannequin' && obj !== target) {
                // Synchronize scale
                obj.set({
                  scaleX: (obj.scaleX || 1) * dsX,
                  scaleY: (obj.scaleY || 1) * dsY,
                  // Synchronize position relative to the target's center (originX/Y is center)
                  left: target.left + (obj.left - target.left) * dsX,
                  top: target.top + (obj.top - target.top) * dsY
                });
                obj.setCoords();
              }
            });
          }
        } else if (action === 'rotate') {
          const da = target.angle - (lastTransform?.angle ?? target.angle);

          if (Math.abs(da) > 0.0001) {
            canvas.getObjects().forEach(obj => {
              if (obj.name && obj.name !== 'mannequin' && obj !== target) {
                const radians = (da * Math.PI) / 180;
                const sin = Math.sin(radians);
                const cos = Math.cos(radians);
                
                const rx = obj.left - target.left;
                const ry = obj.top - target.top;
                
                obj.set({
                  angle: (obj.angle || 0) + da,
                  left: target.left + (rx * cos - ry * sin),
                  top: target.top + (rx * sin + ry * cos)
                });
                obj.setCoords();
              }
            });
          }
        }
        
        // Update tracking state for next frame
        lastTransformRef.current.set(target, {
          left: target.left,
          top: target.top,
          scaleX: target.scaleX,
          scaleY: target.scaleY,
          angle: target.angle,
        });

        canvas.requestRenderAll();
        return;
      }

      // --- Final State Sync ---
      if (e.type === 'object:modified' || !isInteractingRef.current) {
        const currentData: ModularJacketData = {
          ...modularDataRef.current,
          renderOrder: canvas.getObjects()
            .filter(obj => obj.name && obj.name !== 'mannequin')
            .map(obj => obj.name!)
        };

        canvas.getObjects().forEach(obj => {
          if (obj.name && obj.name !== 'mannequin') {
            currentData.segments[obj.name as keyof ModularJacketData['segments']] = {
              imageUrl: segments[obj.name] || '',
              transform: getVirtualTransform(obj, canvasWidth, canvasHeight)
            };
          }
        });

        onDataChange(currentData);
      }
    };

    // Track interaction
    canvas.on('mouse:down', (e) => {
      isInteractingRef.current = true;
      const target = e.target;
      if (target) {
        lastTransformRef.current.set(target, {
          left: target.left,
          top: target.top,
          scaleX: target.scaleX,
          scaleY: target.scaleY,
          angle: target.angle,
        });
      }
    });

    canvas.on('mouse:up', () => { 
      isInteractingRef.current = false;
      handleModified({ type: 'object:modified' });
    });
    
    canvas.on('object:moving', (e) => handleModified({ ...e, action: 'drag', type: 'object:moving' }));
    canvas.on('object:scaling', (e) => handleModified({ ...e, action: 'scale', type: 'object:scaling' }));
    canvas.on('object:rotating', (e) => handleModified({ ...e, action: 'rotate', type: 'object:rotating' }));
    canvas.on('object:modified', handleModified);

    const initObjects = async () => {
      try {
        isUpdatingRef.current = true;
        
        // 1. Mannequin
        const mannequinUrl = personaType === PersonaType.MALE 
          ? '/personas/male-base.png' 
          : '/personas/female-base.png';
        const mannequin = await loadFabricImage(mannequinUrl);
        if (cancelled) return;

        mannequin.set({
          name: 'mannequin',
          originX: 'center',
          originY: 'center',
        });
        mannequin.scale(canvas.getHeight() / mannequin.height!);
        centerObject(canvas, mannequin);
        lockObject(mannequin);
        canvas.add(mannequin);
        canvas.sendObjectToBack(mannequin);

        // 2. Jacket Segments
        const canvasHeight = canvas.getHeight();
        const canvasWidth = canvas.getWidth();
        for (const [name, url] of Object.entries(segments)) {
          const segmentImg = await loadFabricImage(url);
          if (cancelled) return;

          const savedTransform = modularDataRef.current.segments[name as keyof ModularJacketData['segments']]?.transform;

          segmentImg.set({
            name,
            originX: 'center',
            originY: 'center',
            left: savedTransform 
              ? toCanvasX(savedTransform.x, canvasWidth, canvasHeight) 
              : canvas.getCenterPoint().x,
            top: savedTransform 
              ? toCanvasCoord(savedTransform.y, canvasHeight) 
              : canvas.getCenterPoint().y,
            angle: savedTransform?.rotation || 0,
            opacity: savedTransform?.opacity ?? 1,
            flipX: savedTransform?.flipX ?? false,
            flipY: savedTransform?.flipY ?? false,
            objectCaching: false,
            selectable: true,
            perPixelTargetFind: true,
            targetFindTolerance: 10,
            padding: 4,
            // Accurate scaling controls
            centeredScaling: true,
            centeredRotation: true
          });

          // Accurate Scale Initialization
          const virtualWidth = savedTransform?.width || 350;
          const virtualHeight = savedTransform?.height;
          
          segmentImg.scaleToWidth(toCanvasCoord(virtualWidth, canvasHeight));
          if (virtualHeight) {
            segmentImg.set({ scaleY: toCanvasCoord(virtualHeight, canvasHeight) / segmentImg.height! });
          }

          canvas.add(segmentImg);
        }

        // 3. Selection State
        const activeObj = canvas.getObjects().find(obj => obj.name === activePartRef.current);
        if (activeObj) canvas.setActiveObject(activeObj);

        canvas.requestRenderAll();
        handleModified({ type: 'object:modified' });
        isUpdatingRef.current = false;
      } catch (err) {
        console.error("Error initializing Jacket Canvas:", err);
        isUpdatingRef.current = false;
      }
    };

    initObjects();

    return () => {
      cancelled = true;
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [segments, personaType, canvasSize]); // Re-init on hard changes

  // Effect 1: Transform Synchronization (State -> Canvas)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    // CRITICAL: Skip sync during active interaction to prevent feedback loops
    if (!canvas || isUpdatingRef.current || isInteractingRef.current) return;

    const activeObj = canvas.getActiveObject();

    // Sync Transforms from State -> Canvas
    canvas.getObjects().forEach(obj => {
      if (obj.name && obj.name !== 'mannequin') {
        // Skip sync for the object currently being manipulated
        if (isInteractingRef.current && obj === activeObj) return;

        const segmentData = modularData.segments[obj.name as keyof ModularJacketData['segments']];
        if (segmentData) {
          const trans = segmentData.transform;
          const canvasHeight = canvas.getHeight();
          const canvasWidth = canvas.getWidth();
          
          obj.set({
            left: toCanvasX(trans.x, canvasWidth, canvasHeight),
            top: toCanvasCoord(trans.y, canvasHeight),
            angle: trans.rotation,
            opacity: trans.opacity ?? 1,
            flipX: trans.flipX ?? false,
            flipY: trans.flipY ?? false,
            scaleX: toCanvasCoord(trans.width || 350, canvasHeight) / obj.width!,
            scaleY: toCanvasCoord(trans.height || 350, canvasHeight) / obj.height!
          });
          
          obj.setCoords();
        }
      }
    });

    // Center Opening Mask
    const torso = canvas.getObjects().find(obj => obj.name === 'torso');
    if (torso) {
      if (modularData.openness && modularData.openness > 0) {
        const w = torso.width!;
        const h = torso.height!;
        const holeWidth = w * modularData.openness;
        const leftRect = new Rect({ left: -w/2, top: -h/2, width: (w-holeWidth)/2, height: h, fill: 'white' });
        const rightRect = new Rect({ left: holeWidth/2, top: -h/2, width: (w-holeWidth)/2, height: h, fill: 'white' });
        torso.set({ clipPath: new Group([leftRect, rightRect], { originX: 'center', originY: 'center' }) });
      } else {
        torso.set({ clipPath: undefined });
      }
    }

    canvas.requestRenderAll();
  }, [modularData]);

  // Effect 2: Interaction Logic (Controls, Selection, Highlights)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || isUpdatingRef.current) return;

    // A. Apply Highlights & Controls
    canvas.getObjects().forEach(obj => {
      if (obj.name && obj.name !== 'mannequin') {
        const isSelected = obj.name === activePart;
        
        obj.set({ 
          hasControls: isSelected,
          selectable: true,
          evented: true,
          stroke: isSelected ? '#5B8CFF' : undefined,
          strokeWidth: isSelected ? 2 : 0,
          hoverCursor: 'move',
          lockMovementX: false,
          lockMovementY: false,
          lockRotation: false,
          lockScalingX: false,
          lockScalingY: false
        });
        obj.setCoords();
      }
    });

    // B. Handle Active Object Focus
    if (!isGroupMode && activePart) {
      const activeObj = canvas.getObjects().find(obj => obj.name === activePart);
      if (activeObj && canvas.getActiveObject() !== activeObj) {
        canvas.setActiveObject(activeObj);
      }
    } else if (!activePart && !isGroupMode) {
      canvas.discardActiveObject();
    }

    canvas.requestRenderAll();

    // C. Selection Events
    const handleSelection = (e: any) => {
      const selected = e.selected?.[0] || e.target;
      if (selected && selected.name && selected.name !== 'mannequin' && selected.name !== activePart) {
        onSelectPart?.(selected.name);
      }
    };

    const handleSelectionCleared = () => {
      if (!isUpdatingRef.current && !isInteractingRef.current) {
        onSelectPart?.(null);
      }
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelectionCleared);

    return () => {
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared', handleSelectionCleared);
    };
  }, [activePart, isGroupMode, onSelectPart]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[500px] flex items-center justify-center bg-black/40 rounded-[2.5rem] overflow-hidden border border-white/5 shadow-inner">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#5B8CFF 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <canvas ref={canvasRef} />
      <div className="absolute bottom-6 left-6 flex items-center gap-4 opacity-40 pointer-events-none">
        <div className="flex flex-col gap-1">
          <p className="text-[7px] font-black tracking-[0.4em] text-white uppercase">Modular Jacket Engine</p>
          <p className="text-[7px] font-black tracking-[0.4em] text-accent uppercase">Synchronized Layer Orchestration</p>
        </div>
      </div>
    </div>
  );
};

export default JacketCanvas;
