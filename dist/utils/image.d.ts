export interface ImageResult {
    data: string;
    mimeType: string;
}
export interface CompressOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
}
/**
 * Compress PNG image buffer
 * - Resize if larger than max dimensions
 * - Convert to JPEG with specified quality
 * Returns base64 encoded JPEG
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
//# sourceMappingURL=image.d.ts.map