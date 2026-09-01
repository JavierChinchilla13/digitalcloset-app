import { Object as FabricObject } from 'fabric';

/**
 * Customizes Fabric.js selection controls to match the app's aesthetic.
 */
export const customizeFabricControls = () => {
  // Use a modern, clean style for handles
  const controlConfig = {
    borderColor: '#5B8CFF', // Accent color
    cornerColor: '#FFFFFF',
    cornerStrokeColor: '#5B8CFF',
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
    mtrControl.offsetY = -40;
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
