import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClothingCategory, PersonaType, type ClothingItem, type PersonaState } from '../types';
import { EXPORT_HEIGHT, EXPORT_WIDTH, renderOutfitToBlob, renderOutfitToCanvas } from '../utils/outfitImage';
import { makeItem } from '../test/fixtures';

// Task 102: the picture of an outfit. jsdom has no canvas, so the 2D context is a recorder and the
// image loading / mask maths (covered by their own code) are replaced.
const masks: Record<string, string> = {};
vi.mock('../hooks/useOcclusionMasks', () => ({
  loadImage: vi.fn(async (url: string) => ({ src: url, naturalWidth: 418, naturalHeight: 597 })),
  computeOcclusionMasks: vi.fn(async () => masks),
}));

type Call = [string, ...unknown[]];

// A fake 2D context that records the calls that matter, per canvas.
function fakeContext(log: Call[], tag: string) {
  const record = (name: string) => (...args: unknown[]) => {
    log.push([`${tag}:${name}`, ...args]);
  };
  return {
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    drawImage: record('drawImage'),
    fillRect: record('fillRect'),
    fillText: record('fillText'),
    beginPath: record('beginPath'),
    rect: record('rect'),
    clip: record('clip'),
    set fillStyle(_v: string) {},
    set globalAlpha(_v: number) {},
    set globalCompositeOperation(v: string) {
      log.push([`${tag}:composite`, v]);
    },
    set textAlign(_v: string) {},
    set font(_v: string) {},
  };
}

let log: Call[];
let canvasCount: number;

beforeEach(() => {
  log = [];
  canvasCount = 0;
  for (const k of Object.keys(masks)) delete masks[k];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const tag = (this as HTMLCanvasElement & { _tag?: string })._tag ?? `c${canvasCount++}`;
    (this as HTMLCanvasElement & { _tag?: string })._tag = tag;
    return fakeContext(log, tag) as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
    cb(new Blob(['png'], { type: 'image/png' }));
  } as never);
});

const persona = (over: Partial<PersonaState> = {}): PersonaState => ({
  type: PersonaType.MALE,
  topIds: [],
  bottomIds: [],
  leftShoeId: null,
  rightShoeId: null,
  accessoryIds: [],
  jacketIds: [],
  dressIds: [],
  ...over,
});

const top = (itemId: number, imageUrl: string): ClothingItem =>
  makeItem({
    itemId,
    imageUrl,
    category: ClothingCategory.TOP,
    personaType: PersonaType.MALE,
    transform: { x: 300, y: 400, scaleX: 1, scaleY: 1, rotation: 0, width: 200, height: 250 },
  });

const drawn = () => log.filter(([name]) => name.endsWith(':drawImage')).map(([, img]) => (img as { src: string }).src);

describe('renderOutfitToCanvas', () => {
  it('makes a 3:4 portrait', async () => {
    const canvas = await renderOutfitToCanvas(persona(), []);
    expect(canvas.width).toBe(EXPORT_WIDTH);
    expect(canvas.height).toBe(EXPORT_HEIGHT);
    expect(EXPORT_WIDTH / EXPORT_HEIGHT).toBeCloseTo(0.75, 5);
  });

  it('draws the figure first, then each garment', async () => {
    await renderOutfitToCanvas(persona({ topIds: [1] }), [top(1, 'https://img/shirt.png')]);

    expect(drawn()).toEqual(['/personas/male-base.png', 'https://img/shirt.png']);
  });

  it('places a garment by its centre, scaled to the picture size', async () => {
    await renderOutfitToCanvas(persona({ topIds: [1] }), [top(1, 'https://img/shirt.png')]);

    const k = EXPORT_WIDTH / 750;
    const translate = log.find(([name]) => name.endsWith(':translate'));
    expect(translate?.[1]).toBeCloseTo(300 * k, 3);
    expect(translate?.[2]).toBeCloseTo(400 * k, 3);
    const garmentDraw = log.filter(([name]) => name.endsWith(':drawImage'))[1];
    // Drawn at the top-left of its own box with its scaled size.
    expect(garmentDraw[4]).toBeCloseTo(200 * k, 3);
    expect(garmentDraw[5]).toBeCloseTo(250 * k, 3);
  });

  it('stacks by z order: a jacket goes over a top', async () => {
    const jacket = makeItem({
      itemId: 2,
      imageUrl: 'https://img/jacket.png',
      category: ClothingCategory.JACKET,
      personaType: PersonaType.MALE,
      transform: { x: 375, y: 420, scaleX: 1, scaleY: 1, rotation: 0, width: 300, height: 300 },
    });
    await renderOutfitToCanvas(persona({ topIds: [1], jacketIds: [2] }), [top(1, 'https://img/shirt.png'), jacket]);

    expect(drawn()).toEqual(['/personas/male-base.png', 'https://img/shirt.png', 'https://img/jacket.png']);
  });

  it('cuts a garment with its occlusion mask before laying it on the picture', async () => {
    masks['top-1'] = 'data:image/png;base64,MASK';
    await renderOutfitToCanvas(persona({ topIds: [1] }), [top(1, 'https://img/shirt.png')]);

    // The mask is applied on a scratch canvas with destination-in, then that canvas is drawn.
    expect(log.some(([name, op]) => name.endsWith(':composite') && op === 'destination-in')).toBe(true);
    const sources = drawn();
    expect(sources).toContain('data:image/png;base64,MASK');
  });

  it('skips a garment whose picture cannot be loaded instead of failing', async () => {
    const mod = await import('../hooks/useOcclusionMasks');
    vi.mocked(mod.loadImage).mockImplementation(async (url: string) =>
      url.includes('broken') ? null : ({ src: url, naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement)
    );
    await renderOutfitToCanvas(persona({ topIds: [1] }), [top(1, 'https://img/broken.png')]);

    expect(drawn()).toEqual(['/personas/male-base.png']);
  });
});

describe('renderOutfitToBlob', () => {
  it('returns a PNG blob', async () => {
    const blob = await renderOutfitToBlob(persona(), [], 'Look');
    expect(blob.type).toBe('image/png');
  });

  it('rejects with a clear error when the browser refuses to export the canvas', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((() => {
      throw new DOMException('tainted', 'SecurityError');
    }) as never);

    await expect(renderOutfitToBlob(persona(), [])).rejects.toThrow(/could not be created/i);
  });
});
