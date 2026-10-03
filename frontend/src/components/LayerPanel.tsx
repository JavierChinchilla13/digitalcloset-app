import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, RotateCcw } from 'lucide-react';
import { ClothingCategory, type ClothingItem } from '../types';
import CroppedThumbnail from './CroppedThumbnail';
import { useMediaQuery } from '../hooks/useMediaQuery';

// Task 86: the stacking order of the pieces on the persona, front first. Pick a
// piece here (or by clicking it on the persona) and move it toward the front or
// the back - e.g. pants over the shirt, or pants over the shoes. Changing the
// order only edits the draft; it is saved with the outfit.
//
// Three ways to reorder: the arrows (anywhere), HTML5 drag and drop of a whole row
// (a mouse), and - Task 92 - dragging the grip handle with a finger or pen. HTML5
// drag and drop doesn't work from a touch screen, so the handle runs its own
// pointer-event drag: the row follows the finger, the row it would land on is
// outlined, and releasing moves the piece there.
interface LayerPanelProps {
  // Item ids, bottom layer first (the order they are drawn in).
  stack: number[];
  items: ClothingItem[];
  selectedId: number | null;
  onSelect: (itemId: number | null) => void;
  onMove: (itemId: number, direction: 'up' | 'down') => void;
  // Drag and drop: the piece was dropped on the row that is now at `toIndex` of
  // the stack (0 = back-most).
  onReorder: (itemId: number, toIndex: number) => void;
  // True once the order differs from the default stacking.
  isCustom: boolean;
  onReset: () => void;
}

const LayerPanel: React.FC<LayerPanelProps> = ({ stack, items, selectedId, onSelect, onMove, onReorder, isCustom, onReset }) => {
  const byId = new Map(items.map((item) => [item.itemId, item]));
  // Front-most first, like the layers list in an image editor.
  const rows = [...stack].reverse();

  // Drag and drop state: the piece being dragged and the row it is over.
  const [dragId, setDragId] = useState<number | null>(null);
  const [overRow, setOverRow] = useState<number | null>(null);
  const endDrag = () => {
    setDragId(null);
    setOverRow(null);
  };

  // Touch drag (finger / pen) from the grip handle.
  const touchScreen = useMediaQuery('(hover: none)', false);
  const itemEls = useRef(new Map<number, HTMLElement>());
  const [pointerDrag, setPointerDrag] = useState<{ id: number; startY: number; dy: number } | null>(null);

  // The row under the finger: the last one whose top is above it (rows are listed
  // top to bottom, and the dragged row's own wrapper never moves - only its content).
  const rowAtY = (y: number) => {
    let result = 0;
    rows.forEach((rowId, index) => {
      const el = itemEls.current.get(rowId);
      if (el && y >= el.getBoundingClientRect().top) result = index;
    });
    return result;
  };
  const startPointerDrag = (e: React.PointerEvent<HTMLElement>, id: number, rowIndex: number) => {
    if (e.pointerType === 'mouse') return; // a mouse uses the row's HTML5 drag
    try {
      // Keeps the move/up events coming to the handle even when the finger leaves it.
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // The pointer is already gone (a stale touch) - the drag simply won't track.
    }
    setPointerDrag({ id, startY: e.clientY, dy: 0 });
    setDragId(id);
    setOverRow(rowIndex);
  };
  const movePointerDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (!pointerDrag) return;
    setPointerDrag({ ...pointerDrag, dy: e.clientY - pointerDrag.startY });
    setOverRow(rowAtY(e.clientY));
  };
  const endPointerDrag = (commit: boolean) => {
    if (!pointerDrag) return;
    const from = rows.indexOf(pointerDrag.id);
    if (commit && overRow != null && overRow !== from) onReorder(pointerDrag.id, stack.length - 1 - overRow);
    setPointerDrag(null);
    endDrag();
  };

  return (
    <div data-testid="layer-panel" className="w-full md:w-64 shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-medium text-text-primary tracking-[0.3em] uppercase opacity-50">Layers</h4>
        {isCustom && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors"
            title="Back to the default order"
          >
            <RotateCcw size={10} /> Reset order
          </button>
        )}
      </div>

      <p className="text-[9px] leading-relaxed text-text-secondary opacity-60 uppercase tracking-widest">
        <span className="touch:hidden">Drag a piece to reorder it, or click it (here or on the persona) and use the arrows.</span>
        <span className="hidden touch:inline">Drag the handle to reorder a piece, or tap it (here or on the persona) and use the arrows.</span>
      </p>

      <ul className="space-y-1.5">
        {rows.map((id, rowIndex) => {
          const item = byId.get(id);
          if (!item) return null;
          const selected = id === selectedId;
          const isFront = rowIndex === 0;
          const isBack = rowIndex === rows.length - 1;
          return (
            <li
              key={id}
              ref={(el) => {
                if (el) itemEls.current.set(id, el);
                else itemEls.current.delete(id);
              }}
            >
              <div
                data-testid={`layer-row-${id}`}
                data-selected={selected}
                data-drop-target={dragId != null && dragId !== id && overRow === rowIndex}
                style={pointerDrag?.id === id ? { transform: `translateY(${pointerDrag.dy}px)`, position: 'relative', zIndex: 20 } : undefined}
                draggable={!touchScreen}
                onDragStart={(e) => {
                  setDragId(id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(id));
                }}
                onDragOver={(e) => {
                  if (dragId == null) return;
                  e.preventDefault(); // allows the drop
                  e.dataTransfer.dropEffect = 'move';
                  if (overRow !== rowIndex) setOverRow(rowIndex);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId != null) onReorder(dragId, stack.length - 1 - rowIndex);
                  endDrag();
                }}
                onDragEnd={endDrag}
                onClick={() => onSelect(selected ? null : id)}
                className={`flex items-center gap-2 p-2 rounded-xl border cursor-grab active:cursor-grabbing ${
                  pointerDrag?.id === id ? 'shadow-xl bg-background-secondary border-accent' : 'transition-all'
                } ${
                  dragId === id && pointerDrag?.id !== id ? 'opacity-40' : ''
                } ${
                  dragId != null && dragId !== id && overRow === rowIndex
                    ? 'border-accent border-dashed bg-accent/5'
                    : selected
                      ? 'border-accent bg-accent/10'
                      : 'border-ink/5 bg-ink/[0.02] hover:border-ink/20'
                }`}
              >
                <div
                  data-testid={`layer-grip-${id}`}
                  onPointerDown={(e) => startPointerDrag(e, id, rowIndex)}
                  onPointerMove={movePointerDrag}
                  onPointerUp={() => endPointerDrag(true)}
                  onPointerCancel={() => endPointerDrag(false)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 touch-none flex items-center justify-center touch:w-9 touch:h-12 touch:-ml-1"
                >
                  <GripVertical size={14} className="text-text-secondary opacity-40 touch:opacity-70 touch:w-5 touch:h-5" aria-hidden />
                </div>
                <div className="w-9 h-12 rounded-lg overflow-hidden bg-ink/5 shrink-0">
                  <CroppedThumbnail imageUrl={item.imageUrl} transform={item.transform} alt={item.name} className="w-full h-full" fit="contain" />
                </div>
                <p className="flex-1 min-w-0 text-[10px] font-bold uppercase tracking-wider text-text-primary line-clamp-2">
                  {item.name}
                  {item.category === ClothingCategory.SHOES && item.side && (
                    <span className="text-accent"> · {item.side}</span>
                  )}
                </p>
                <div className="flex flex-col gap-1 touch:flex-row touch:gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    aria-label={`Bring ${item.name} forward`}
                    title="Bring forward"
                    disabled={isFront}
                    onClick={() => onMove(id, 'up')}
                    className="p-1 touch:w-10 touch:h-10 touch:flex touch:items-center touch:justify-center rounded-md bg-ink/5 hover:bg-ink/10 text-text-secondary hover:text-text-primary disabled:opacity-20 disabled:pointer-events-none transition-all"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    aria-label={`Send ${item.name} back`}
                    title="Send back"
                    disabled={isBack}
                    onClick={() => onMove(id, 'down')}
                    className="p-1 touch:w-10 touch:h-10 touch:flex touch:items-center touch:justify-center rounded-md bg-ink/5 hover:bg-ink/10 text-text-secondary hover:text-text-primary disabled:opacity-20 disabled:pointer-events-none transition-all"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LayerPanel;
