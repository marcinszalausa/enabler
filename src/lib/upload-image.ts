import "server-only";
import sharp from "sharp";
import { UPLOAD_MAX_SIDE } from "@/lib/source-image";

// Decodes an uploaded photo and stores it as an upright JPEG of at most
// 2048 px. Throws when the file isn't an image sharp can read.
export async function normalizeUpload(file: File) {
  const out = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: UPLOAD_MAX_SIDE, height: UPLOAD_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: out.data, width: out.info.width, height: out.info.height };
}
