import { crc32 } from "node:zlib";

// Machine-readable "made with AI" marking for ad files, as platforms (Meta,
// TikTok) and the EU AI Act's transparency rules expect: the IPTC digital
// source type "trainedAlgorithmicMedia" in XMP metadata.

export const AI_SOURCE_TYPE =
  "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";
export const AI_DISCLOSURE_TEXT = "AI-generated ad made with Gooidy";

export const AI_XMP = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" Iptc4xmpExt:DigitalSourceType="${AI_SOURCE_TYPE}" xmp:CreatorTool="Gooidy"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">${AI_DISCLOSURE_TEXT}</rdf:li></rdf:Alt></dc:description></rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="r"?>`;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunk(type: string, data: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

// Adds the XMP packet to a PNG as an uncompressed iTXt chunk right after the
// header chunk. Anything that isn't a PNG, or already carries XMP, is
// returned unchanged.
export function markPngAsAi(png: Uint8Array): Buffer {
  const buf = Buffer.from(png);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return buf;
  if (buf.includes("XML:com.adobe.xmp", 0, "latin1")) return buf;
  const ihdrEnd = 8 + 8 + buf.readUInt32BE(8) + 4;
  const data = Buffer.concat([
    Buffer.from("XML:com.adobe.xmp\0", "latin1"),
    Buffer.from([0, 0]), // not compressed
    Buffer.from("\0\0", "latin1"), // no language tag, no translated keyword
    Buffer.from(AI_XMP, "utf8"),
  ]);
  return Buffer.concat([buf.subarray(0, ihdrEnd), chunk("iTXt", data), buf.subarray(ihdrEnd)]);
}

// Same marking for an image Response (keeps its status and headers).
export async function markImageResponseAsAi(response: Response) {
  if (!response.ok || !response.headers.get("content-type")?.includes("image/png")) return response;
  const body = markPngAsAi(new Uint8Array(await response.arrayBuffer()));
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(new Uint8Array(body), { status: response.status, headers });
}

// ffmpeg arguments that write the disclosure into an MP4's metadata.
export const AI_VIDEO_METADATA_ARGS = [
  "-metadata",
  `comment=${AI_DISCLOSURE_TEXT}. IPTC DigitalSourceType: ${AI_SOURCE_TYPE}`,
  "-metadata",
  `description=${AI_DISCLOSURE_TEXT}`,
];
