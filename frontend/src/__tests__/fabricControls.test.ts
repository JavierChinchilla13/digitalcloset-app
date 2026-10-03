import { describe, expect, it } from 'vitest';
import { Object as FabricObject } from 'fabric';

import { customizeFabricControls } from '../components/editor/FabricControls';

// Task 93: on a phone a finger has to grab the selection handles. The drawn handle stays
// 12px (it must fit the CANVAS_PAD margin around the stage); the area that grabs it for
// touch / pen input is widened.
describe('customizeFabricControls', () => {
  it('draws 12px handles but grabs them from a 36px area when touched', () => {
    customizeFabricControls();
    expect(FabricObject.prototype.cornerSize).toBe(12);
    expect(FabricObject.prototype.touchCornerSize).toBe(36);
  });
});
