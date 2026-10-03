import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import LayerPanel from '../components/LayerPanel';
import { ClothingCategory as C } from '../types';
import { makeItem } from '../test/fixtures';

// Task 92: layers can be reordered by dragging the grip handle with a finger (HTML5
// drag and drop doesn't work on a touch screen), not only with the arrows.
const items = [
  makeItem({ itemId: 1, name: 'Pants', category: C.BOTTOM }),
  makeItem({ itemId: 2, name: 'Tee', category: C.TOP }),
  makeItem({ itemId: 3, name: 'Jacket', category: C.JACKET }),
];
// bottom layer first: the panel lists the front-most (Jacket) at the top.
const stack = [1, 2, 3];

function renderPanel() {
  const onReorder = vi.fn();
  const onMove = vi.fn();
  const { container } = render(
    <LayerPanel
      stack={stack}
      items={items}
      selectedId={null}
      onSelect={() => {}}
      onMove={onMove}
      onReorder={onReorder}
      isCustom={false}
      onReset={() => {}}
    />
  );
  // jsdom has no layout: give the three rows 100px each, Jacket (front) on top.
  const lis = Array.from(container.querySelectorAll('li'));
  lis.forEach((li, index) => {
    li.getBoundingClientRect = () => ({ top: index * 100, bottom: index * 100 + 90, left: 0, right: 300, width: 300, height: 90, x: 0, y: index * 100, toJSON() {} });
  });
  return { onReorder, onMove };
}

const drag = (id: number, fromY: number, toY: number, pointerType = 'touch') => {
  const grip = screen.getByTestId(`layer-grip-${id}`);
  fireEvent.pointerDown(grip, { pointerId: 1, pointerType, clientY: fromY });
  fireEvent.pointerMove(grip, { pointerId: 1, pointerType, clientY: toY });
  fireEvent.pointerUp(grip, { pointerId: 1, pointerType, clientY: toY });
};

describe('LayerPanel touch drag', () => {
  it('dragging the front piece down to the last row sends it to the back', () => {
    const { onReorder } = renderPanel();
    drag(3, 10, 250); // Jacket: row 0 -> row 2 (back-most = index 0 of the stack)
    expect(onReorder).toHaveBeenCalledWith(3, 0);
  });

  it('dragging the back piece up to the first row brings it to the front', () => {
    const { onReorder } = renderPanel();
    drag(1, 210, 5); // Pants: row 2 -> row 0 (front-most = last index of the stack)
    expect(onReorder).toHaveBeenCalledWith(1, 2);
  });

  it('dragging to the middle row moves it one place', () => {
    const { onReorder } = renderPanel();
    drag(3, 10, 120); // Jacket: row 0 -> row 1
    expect(onReorder).toHaveBeenCalledWith(3, 1);
  });

  it('letting go on its own row changes nothing', () => {
    const { onReorder } = renderPanel();
    drag(2, 110, 130);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('a cancelled drag (the system took the touch) changes nothing', () => {
    const { onReorder } = renderPanel();
    const grip = screen.getByTestId('layer-grip-3');
    fireEvent.pointerDown(grip, { pointerId: 1, pointerType: 'touch', clientY: 10 });
    fireEvent.pointerMove(grip, { pointerId: 1, pointerType: 'touch', clientY: 250 });
    fireEvent.pointerCancel(grip, { pointerId: 1, pointerType: 'touch' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('shows the row it would land on, and the dragged row follows the finger', () => {
    renderPanel();
    const grip = screen.getByTestId('layer-grip-3');
    fireEvent.pointerDown(grip, { pointerId: 1, pointerType: 'touch', clientY: 10 });
    fireEvent.pointerMove(grip, { pointerId: 1, pointerType: 'touch', clientY: 120 });

    expect(screen.getByTestId('layer-row-3').style.transform).toBe('translateY(110px)');
    expect(screen.getByTestId('layer-row-2')).toHaveAttribute('data-drop-target', 'true');
  });

  it('a mouse does not start the handle drag (it uses the row\'s own drag and drop)', () => {
    const { onReorder } = renderPanel();
    drag(3, 10, 250, 'mouse');
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('the arrows still work', () => {
    const { onMove } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /send tee back/i }));
    expect(onMove).toHaveBeenCalledWith(2, 'down');
  });
});
