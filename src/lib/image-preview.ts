// Preview responses stay behind the route's existing authorization checks.
export function wantsImagePreview(search: URLSearchParams): boolean {
  return search.get("preview") === "1" && !search.has("download");
}

export async function makeImagePreview(image: Response): Promise<Response> {
  // Keep native processing off the original/export path.
  const { default: sharp } = await import("sharp");
  const bytes = await sharp(Buffer.from(await image.arrayBuffer()), { limitInputPixels: 16_000_000 })
    .resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  const headers = new Headers(image.headers);
  headers.set("content-type", "image/webp");
  headers.delete("content-length");
  return new Response(new Uint8Array(bytes), { status: image.status, headers });
}
