import { pipeline, env, type ImageSegmentationPipeline, type ImageSegmentationOutput } from '@huggingface/transformers';

// Configuration for Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

class SegmentationService {
  private segmenter: ImageSegmentationPipeline | null = null;
  private segmenterModel = 'Xenova/segformer_b2_clothes';

  async initSegmenter() {
    if (this.segmenter) return;
    try {
      console.log('Initializing Modular Engine...');
      // @ts-expect-error - image_processor_only avoids tokenizer 404s
      this.segmenter = await pipeline('image-segmentation', this.segmenterModel, { 
        device: 'webgpu',
        image_processor_only: true 
      }) as ImageSegmentationPipeline;
    } catch (err) {
      console.warn("WebGPU not available for segmenter, falling back to WASM/CPU");
      // @ts-expect-error
      this.segmenter = await pipeline('image-segmentation', this.segmenterModel, {
        image_processor_only: true
      }) as ImageSegmentationPipeline;
    }
  }

  /**
   * Modular Jacket Segmentation (Torso + Sleeves).
   * REFACTORED: Now uses a 'Non-Destructive' approach that preserves manual cleanup.
   */
  async segmentJacket(imageSource: string | HTMLImageElement | File): Promise<Map<string, Blob>> {
    await this.initSegmenter();
    if (!this.segmenter) throw new Error("Segmenter not initialized");

    let source: string;
    if (imageSource instanceof File) {
      source = await this.fileToDataURL(imageSource);
    } else if (imageSource instanceof HTMLImageElement) {
      source = imageSource.src;
    } else {
      source = imageSource;
    }

    try {
      const output = await this.segmenter(source);
      return this.processOutputNonDestructive(output, source);
    } catch (err) {
      console.error("AI Segmentation failed:", err);
      return new Map();
    }
  }

  /**
   * NON-DESTRUCTIVE PROCESSING
   * 1. Detect Sleeves using AI.
   * 2. Extract Sleeves using AI masks.
   * 3. Calculate Torso as (Original Image - Sleeve Masks).
   * This ensures that any pixels the user manually cleaned/kept are preserved in the Torso.
   */
  private async processOutputNonDestructive(output: ImageSegmentationOutput, originalSource: string): Promise<Map<string, Blob>> {
    const labelMap: Record<string, string> = {
      'Left-arm': 'leftSleeve',
      'Right-arm': 'rightSleeve',
      'Gloves': 'leftSleeve',
    };

    const originalImg = await this.loadImage(originalSource);
    const results = new Map<string, Blob>();
    const w = originalImg.width;
    const h = originalImg.height;

    // 1. Identify Sleeve Segments
    const leftSleeveSegments = output.filter(s => labelMap[s.label] === 'leftSleeve');
    const rightSleeveSegments = output.filter(s => labelMap[s.label] === 'rightSleeve');

    const hasAISleeves = leftSleeveSegments.length > 0 || rightSleeveSegments.length > 0;

    if (hasAISleeves) {
      console.log('AI detected sleeves. Performing non-destructive extraction...');
      
      // Create Sleeve Blobs
      if (leftSleeveSegments.length > 0) {
        const leftBlob = await this.createBlobFromSegments(leftSleeveSegments, originalImg);
        results.set('leftSleeve', leftBlob);
      }
      if (rightSleeveSegments.length > 0) {
        const rightBlob = await this.createBlobFromSegments(rightSleeveSegments, originalImg);
        results.set('rightSleeve', rightBlob);
      }

      // 2. CREATE NON-DESTRUCTIVE TORSO
      // Torso = Original - (Left Mask + Right Mask)
      const torsoCanvas = document.createElement('canvas');
      torsoCanvas.width = w;
      torsoCanvas.height = h;
      const tCtx = torsoCanvas.getContext('2d')!;
      
      // Draw the full cleaned image
      tCtx.drawImage(originalImg, 0, 0);
      
      // Subtract sleeve areas
      tCtx.globalCompositeOperation = 'destination-out';
      [...leftSleeveSegments, ...rightSleeveSegments].forEach(segment => {
        const maskCanvas = this.segmentToMaskCanvas(segment, w, h);
        tCtx.drawImage(maskCanvas, 0, 0);
      });

      const torsoBlob = await new Promise<Blob>((resolve) => torsoCanvas.toBlob(b => resolve(b!), 'image/png'));
      results.set('torso', torsoBlob);
      
    } else {
      // 3. Fallback: Geometric Smart Split (still non-destructive)
      console.warn('AI did not detect sleeves. Using Geometric Non-Destructive Split.');
      
      const splits = [
        { name: 'leftSleeve', x: 0, width: w * 0.28 },
        { name: 'torso', x: w * 0.28, width: w * 0.44 },
        { name: 'rightSleeve', x: w * 0.72, width: w * 0.28 }
      ];

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      for (const split of splits) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(originalImg, 0, 0);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = 'white';
        ctx.fillRect(split.x, 0, split.width, h);
        ctx.globalCompositeOperation = 'source-over';

        const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
        results.set(split.name, blob);
      }
    }

    return results;
  }

  /**
   * Helper to convert a single segment mask to a canvas
   */
  private segmentToMaskCanvas(segment: any, targetWidth: number, targetHeight: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = segment.mask.width;
    canvas.height = segment.mask.height;
    const ctx = canvas.getContext('2d')!;
    
    const maskData = segment.mask.data;
    const rgbaData = new Uint8ClampedArray(maskData.length * 4);
    for (let i = 0; i < maskData.length; ++i) {
      rgbaData[i * 4] = 0; rgbaData[i * 4 + 1] = 0; rgbaData[i * 4 + 2] = 0;
      rgbaData[i * 4 + 3] = maskData[i] > 0 ? 255 : 0;
    }
    const imageData = new ImageData(rgbaData, segment.mask.width, segment.mask.height);
    ctx.putImageData(imageData, 0, 0);

    // Resize to target dimensions if needed
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      const resized = document.createElement('canvas');
      resized.width = targetWidth;
      resized.height = targetHeight;
      resized.getContext('2d')!.drawImage(canvas, 0, 0, targetWidth, targetHeight);
      return resized;
    }
    return canvas;
  }

  private async createBlobFromSegments(segments: any[], originalImg: HTMLImageElement): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = originalImg.width;
    canvas.height = originalImg.height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    for (const segment of segments) {
      const maskCanvas = this.segmentToMaskCanvas(segment, canvas.width, canvas.height);
      ctx.drawImage(maskCanvas, 0, 0);
    }

    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(originalImg, 0, 0);

    return new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
  }

  private fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  }

  private loadImage(source: string | HTMLImageElement): Promise<HTMLImageElement> {
    if (source instanceof HTMLImageElement) return Promise.resolve(source);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.src = source;
    });
  }
}

export const segmentationService = new SegmentationService();
