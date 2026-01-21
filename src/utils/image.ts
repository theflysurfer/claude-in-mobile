import * as fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ImageResult {
  data: string;
  mimeType: string;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function compressScreenshot(
  buffer: Buffer,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<ImageResult> {
  const { maxWidth = 800, maxHeight = 1400, quality = 70 } = options;

  const tmpInput = `/tmp/screenshot_${Date.now()}_in.png`;
  const tmpOutput = `/tmp/screenshot_${Date.now()}_out.jpg`;

  await fs.writeFile(tmpInput, buffer);

  try {
    await execAsync(
      `ffmpeg -i ${tmpInput} -vf "scale='min(${maxWidth},iw):min(${maxHeight},ih)'" ` +
      `-q:v ${quality} ${tmpOutput}`
    );

    const compressed = await fs.readFile(tmpOutput);
    await fs.unlink(tmpInput);
    await fs.unlink(tmpOutput);

    return {
      data: compressed.toString("base64"),
      mimeType: "image/jpeg",
    };
  } catch {
    // Fallback: return original as PNG
    await fs.unlink(tmpInput);
    return {
      data: buffer.toString("base64"),
      mimeType: "image/png",
    };
  }
}
