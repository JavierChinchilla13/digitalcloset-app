import React, { useEffect, useRef, useState } from 'react';
import {
  Eraser,
  Undo2,
  Redo2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Brush,
  Save,
  Hand,
  Sparkles,
  Info,
  Loader2
} from 'lucide-react';
import { Canvas, Image as FabricImage, PencilBrush, Point } from 'fabric';
import { useFabricCanvas, measureContainerWithRetry } from '../../hooks/useFabricCanvas';

interface GarmentCleanupProps {
  imageUrl: string;
  onComplete: (cleanedImageUrl: string) => void;
  onSkip: () => void;
  onBack: () => void;
}

type ToolMode = 'erase' | 'restore' | 'pan';

const GarmentCleanup: React.FC<GarmentCleanupProps> = ({ imageUrl, onComplete, onSkip, onBack }) => {
  // No aspectRatio passed - this editor sizes its canvas once at creation
  // (see measureContainerWithRetry below) and never resizes it afterward,
  // unlike the other editors, so it doesn't use the hook's resize-fitting.
  const { canvasRef, fabricCanvasRef, containerRef } = useFabricCanvas();

  const [mode, setMode] = useState<ToolMode>('erase');
  const [brushSize, setBrushSize] = useState(30);
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // History for Undo/Redo
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);

  const updateHistoryButtons = () => {
    setCanUndo(historyIndex.current > 0);
    setCanRedo(historyIndex.current < history.current.length - 1);
  };

  const saveHistory = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const json = JSON.stringify(canvas.toObject());
    
    if (historyIndex.current < history.current.length - 1) {
      history.current = history.current.slice(0, historyIndex.current + 1);
    }

    history.current.push(json);
    historyIndex.current = history.current.length - 1;
    updateHistoryButtons();
  };

  const loadFromHistory = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const json = history.current[historyIndex.current];
    await canvas.loadFromJSON(json);
    
    // After loading, we must ensure all paths in 'erase' mode maintain their composite op
    canvas.getObjects().forEach(obj => {
      if (obj.type === 'path' && (obj as any).isEraserPath) {
        obj.globalCompositeOperation = 'destination-out';
      }
    });
    
    canvas.renderAll();
    updateHistoryButtons();
  };

  const handleUndo = () => {
    if (historyIndex.current > 0) {
      historyIndex.current--;
      loadFromHistory();
    }
  };

  const handleRedo = () => {
    if (historyIndex.current < history.current.length - 1) {
      historyIndex.current++;
      loadFromHistory();
    }
  };

  const handleReset = async () => {
    if (history.current.length > 0) {
      history.current = [history.current[0]];
      historyIndex.current = 0;
      loadFromHistory();
    }
  };

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    let canvas: Canvas;
    let isDisposed = false;

    const init = async () => {
      const dimensions = await measureContainerWithRetry(containerRef.current);

      if (isDisposed || dimensions.width === 0) return;

      canvas = new Canvas(canvasRef.current!, {
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: 'transparent',
        isDrawingMode: true,
        enableRetinaScaling: true
      });

      fabricCanvasRef.current = canvas;

      try {
        const isLocalBlob = imageUrl.startsWith('blob:');
        const img = await FabricImage.fromURL(imageUrl, isLocalBlob ? {} : { crossOrigin: 'anonymous' });
        
        if (isDisposed) return;

        const scale = Math.min(
          (canvas.width! * 0.8) / img.width!,
          (canvas.height! * 0.8) / img.height!
        );
        
        img.set({
          scaleX: scale,
          scaleY: scale,
          left: canvas.width! / 2,
          top: canvas.height! / 2,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          // @ts-ignore
          isBaseImage: true
        });

        canvas.add(img);
        
        // Initial Brush Setup
        updateBrush(canvas, mode);

        canvas.renderAll();
        saveHistory();
        setIsReady(true);
      } catch (err) {
        console.error("Cleanup Studio Error:", err);
        setIsReady(true);
      }

      canvas.on('path:created', (opt) => {
        const path = opt.path;
        if (mode === 'erase') {
           // EXPLICITLY set the composite operation on the path itself
           path.set({
             globalCompositeOperation: 'destination-out',
             // @ts-ignore
             isEraserPath: true
           });
        }
        canvas.renderAll();
        saveHistory();
      });
      
      // Wheel Zoom
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let zoomVal = canvas.getZoom();
        zoomVal *= 0.999 ** delta;
        if (zoomVal > 10) zoomVal = 10;
        if (zoomVal < 0.5) zoomVal = 0.5;
        canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), zoomVal);
        setZoom(zoomVal);
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // Space Pan
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          canvas.isDrawingMode = false;
          canvas.defaultCursor = 'grab';
        }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          canvas.isDrawingMode = true;
          canvas.defaultCursor = 'crosshair';
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      let isPanning = false;
      canvas.on('mouse:down', (opt) => {
        // TPointerEvent is MouseEvent | TouchEvent | PointerEvent - only the
        // first and third carry clientX/clientY directly. Panning is
        // mouse/pointer-only (this canvas has no touch-drag support), so a
        // TouchEvent here just skips starting a pan rather than corrupting
        // the viewport transform with NaN as it silently did before.
        if ((!canvas.isDrawingMode || opt.e.altKey) && 'clientX' in opt.e) {
          isPanning = true;
          canvas.selection = false;
          canvas.lastPosX = opt.e.clientX;
          canvas.lastPosY = opt.e.clientY;
        }
      });
      canvas.on('mouse:move', (opt) => {
        if (isPanning && 'clientX' in opt.e) {
          const e = opt.e;
          const vpt = canvas.viewportTransform!;
          vpt[4] += e.clientX - canvas.lastPosX;
          vpt[5] += e.clientY - canvas.lastPosY;
          canvas.requestRenderAll();
          canvas.lastPosX = e.clientX;
          canvas.lastPosY = e.clientY;
        }
      });
      canvas.on('mouse:up', () => { isPanning = false; });

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    };

    init();

    return () => {
      isDisposed = true;
      if (canvas) canvas.dispose();
    };
  }, [imageUrl]);

  const updateBrush = (canvas: Canvas, currentMode: ToolMode) => {
    if (!canvas) return;

    if (currentMode === 'pan') {
      canvas.isDrawingMode = false;
      return;
    }

    canvas.isDrawingMode = true;
    const brush = new PencilBrush(canvas);
    brush.width = brushSize;
    
    if (currentMode === 'erase') {
      brush.color = 'black'; // Color doesn't matter for destination-out
      // @ts-ignore
      brush.globalCompositeOperation = 'destination-out';
    } else {
      // Restore uses source-over to paint back (assuming white/light mannequin bg)
      brush.color = 'white'; 
      // @ts-ignore
      brush.globalCompositeOperation = 'source-over';
    }

    canvas.freeDrawingBrush = brush;
    
    // Cursor matches brush size
    const cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize}" height="${brushSize}" viewBox="0 0 ${brushSize} ${brushSize}"><circle cx="${brushSize/2}" cy="${brushSize/2}" r="${brushSize/2 - 1}" style="fill:none;stroke:white;stroke-width:1;opacity:0.5"/></svg>') ${brushSize/2} ${brushSize/2}, crosshair`;
    canvas.freeDrawingCursor = cursor;
  };

  useEffect(() => {
    if (fabricCanvasRef.current && isReady) {
      updateBrush(fabricCanvasRef.current, mode);
    }
  }, [mode, brushSize, isReady]);

  const handleFinish = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    setIsProcessing(true);

    // Snapshot with proper scale
    const vpt = canvas.viewportTransform;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    
    const dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier: 2,
      enableRetinaScaling: true
    });

    if (vpt) canvas.setViewportTransform(vpt);
    
    onComplete(dataUrl);
    setIsProcessing(false);
  };

  if (!imageUrl) return null;

  return (
    <div className={`flex flex-col h-full space-y-6 transition-all duration-700 ${isReady ? 'opacity-100' : 'opacity-0 scale-95'}`}>
      <div className="flex items-center justify-between px-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Sparkles className="text-accent" size={20} />
            <h2 className="text-3xl font-light tracking-tighter text-white uppercase italic">Cleanup Studio</h2>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-text-secondary uppercase opacity-40">
            <Info size={10} />
            <span>Erase mannequin pieces, inner shirts, or artifacts</span>
          </div>
        </div>

        <div className="flex bg-white/5 rounded-2xl p-1 border border-white/5">
           <button onClick={() => setMode('erase')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'erase' ? 'bg-accent text-white' : 'text-text-secondary hover:text-white'}`}><Eraser size={12} /><span>Erase</span></button>
           <button onClick={() => setMode('restore')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'restore' ? 'bg-emerald-500 text-white' : 'text-text-secondary hover:text-white'}`}><Brush size={12} /><span>Restore</span></button>
           <button onClick={() => setMode('pan')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'pan' ? 'bg-white/10 text-white' : 'text-text-secondary hover:text-white'}`}><Hand size={12} /><span>Pan</span></button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <aside className="w-20 flex flex-col items-center gap-4 py-6 bg-white/[0.02] border border-white/5 rounded-[2.5rem] shrink-0">
          <button disabled={!canUndo} onClick={handleUndo} className={`p-4 rounded-2xl transition-all ${canUndo ? 'text-white hover:bg-white/5' : 'text-white/10 cursor-not-allowed'}`}><Undo2 size={20} /></button>
          <button disabled={!canRedo} onClick={handleRedo} className={`p-4 rounded-2xl transition-all ${canRedo ? 'text-white hover:bg-white/5' : 'text-white/10 cursor-not-allowed'}`}><Redo2 size={20} /></button>
          <div className="h-px w-10 bg-white/5 my-2" />
          <button onClick={() => setZoom(z => Math.min(z + 0.2, 5))} className="p-4 rounded-2xl text-text-secondary hover:text-white transition-all"><ZoomIn size={20} /></button>
          <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="p-4 rounded-2xl text-text-secondary hover:text-white transition-all"><ZoomOut size={20} /></button>
          <button onClick={handleReset} className="p-4 rounded-2xl text-red-400/40 hover:text-red-400 transition-all mt-auto"><RotateCcw size={20} /></button>
        </aside>

        <main ref={containerRef} className="flex-1 relative bg-[#0a0a0a] rounded-[3rem] border border-white/5 overflow-hidden group">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <canvas ref={canvasRef} />
          <div className="absolute bottom-8 left-8 flex items-center gap-4">
             <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/5 text-[9px] font-black uppercase text-white/50">Zoom: {Math.round(zoom * 100)}%</div>
             <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/5 text-[9px] font-black uppercase text-white/50">Mode: {mode}</div>
          </div>
        </main>

        <aside className="w-72 flex flex-col gap-6 shrink-0">
          <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 space-y-8 backdrop-blur-xl">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-accent">
                <Brush size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Brush Size</span>
              </div>
              <div className="flex justify-between text-[9px] font-black text-text-secondary opacity-60"><span>{brushSize}px</span></div>
              <input type="range" min="5" max="150" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-accent" />
            </div>
          </div>

          <div className="mt-auto space-y-4">
            <button onClick={handleFinish} disabled={isProcessing} className="w-full py-7 bg-accent hover:bg-accent-hover text-white rounded-[2.5rem] font-black text-xs tracking-[0.5em] uppercase transition-all shadow-2xl shadow-accent/20 flex items-center justify-center gap-3">
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Save size={18} />}
              <span>Finalize & Next</span>
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={onBack} className="py-5 bg-white/5 hover:bg-white/10 text-white rounded-[2rem] font-black text-[9px] tracking-[0.3em] uppercase transition-all">Back</button>
              <button onClick={onSkip} className="py-5 bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white rounded-[2rem] font-black text-[9px] uppercase transition-all">Skip AI</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default GarmentCleanup;
