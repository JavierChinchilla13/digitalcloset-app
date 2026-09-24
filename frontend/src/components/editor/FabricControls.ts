import { Object as FabricObject } from 'fabric';
import { getStageAccentHex } from '../../utils/themeColors';

/**
 * Customizes Fabric.js selection controls to match the app's aesthetic.
 */
export const customizeFabricControls = () => {
  // Use a modern, clean style for handles. Task 71: borderColor/
  // cornerStrokeColor were hard-coded to the app's old blue accent -
  // now read the stage's own accent (see utils/themeColors.ts).
  const controlConfig = {
    borderColor: getStageAccentHex(),
    cornerColor: '#FFFFFF',
    cornerStrokeColor: getStageAccentHex(),
    cornerSize: 12,
    transparentCorners: false,
    cornerStyle: 'circle' as const,
    borderDashArray: [3, 3],
    borderScaleFactor: 2,
    padding: 10,
  };

  // Apply to the base Object prototype so all new objects get it
  Object.assign(FabricObject.prototype, controlConfig);

  // Custom rotation handle (mtr)
  // In Fabric v6+, controls are often managed via the defaultControls object or instance controls
  const mtrControl = FabricObject.prototype.controls?.mtr;
  if (mtrControl) {
    mtrControl.y = -0.5;
    // Was -40. With the 10px object padding and the 12px handle, -20 puts the
    // handle's outer edge ~36px above the object - within ClothingCanvas's
    // CANVAS_PAD margin, so it stays visible at the top edge of the stage.
    mtrControl.offsetY = -20;
  }
};

/**
 * Locks an object so it cannot be selected or moved.
 */
export const lockObject = (obj: FabricObject) => {
  obj.set({
    selectable: false,
    evented: false,
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    hasControls: false,
    hasBorders: false,
  });
};
