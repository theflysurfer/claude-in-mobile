import type { UiElement } from "../adb/ui-parser.js";
export interface CompressOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxSizeBytes?: number;
}
/**
 * Compress PNG screenshot to WebP greyscale using sharp.
 * WebP is ~30-50% smaller than JPEG for UI content (flat colors, text).
 * Greyscale removes color info unnecessary for UI automation.
 */
export declare function compressScreenshot(pngBuffer: Buffer, options?: CompressOptions): Promise<{
    data: string;
    mimeType: string;
}>;
/**
 * Get original image as base64 PNG (no compression)
 */
export declare function toBase64Png(buffer: Buffer): {
    data: string;
    mimeType: string;
};
export interface AnnotateResult {
    image: {
        data: string;
        mimeType: string;
    };
    elements: Array<{
        index: number;
        label: string;
        clickable: boolean;
        center: {
            x: number;
            y: number;
        };
    }>;
}
/**
 * Annotate a screenshot with colored bounding boxes and element numbers.
 * Green = clickable, Red = non-clickable.
 * Returns compressed annotated image + element index.
 */
export declare function annotateScreenshot(pngBuffer: Buffer, elements: UiElement[], compressOptions?: CompressOptions): Promise<AnnotateResult>;
//# sourceMappingURL=image.d.ts.map