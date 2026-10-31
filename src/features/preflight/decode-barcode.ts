/**
 * Read a boarding-pass barcode (PDF417, Aztec or QR) from a photo or screenshot.
 * Uses the browser's BarcodeDetector when it supports these formats (Chrome on
 * Android), otherwise ZXing, loaded on demand so it never weighs on first paint.
 */
const FORMATS = ["pdf417", "aztec", "qr_code"];

interface Detector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}
type DetectorClass = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
};

async function withNative(img: ImageBitmap): Promise<string | null> {
  const Native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (!Native) return null;
  try {
    const supported = await Native.getSupportedFormats();
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (!formats.length) return null;
    const hits = await new Native({ formats }).detect(img);
    // Some platforms (macOS) report a PDF417 hit with an empty value: fall back to ZXing.
    return hits.find((h) => h.rawValue.trim())?.rawValue ?? null;
  } catch {
    return null;
  }
}

async function withZxing(img: ImageBitmap): Promise<string | null> {
  const zx = await import("@zxing/library");
  const reader = new zx.MultiFormatReader();
  reader.setHints(
    new Map<import("@zxing/library").DecodeHintType, unknown>([
      [
        zx.DecodeHintType.POSSIBLE_FORMATS,
        [zx.BarcodeFormat.PDF_417, zx.BarcodeFormat.AZTEC, zx.BarcodeFormat.QR_CODE],
      ],
      [zx.DecodeHintType.TRY_HARDER, true],
    ]),
  );
  // Phone photos are large: try a few sizes, since ZXing prefers ~1000–2000 px.
  for (const target of [1600, 1000, 2400]) {
    const scale = Math.min(1, target / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const source = new zx.HTMLCanvasElementLuminanceSource(canvas);
    // Upright first; a sideways photo second (rotation can fail on some sources).
    const sources = [() => source, () => source.rotateCounterClockwise()];
    for (const make of sources) {
      try {
        // decodeWithState keeps the format hints set above.
        return reader
          .decodeWithState(new zx.BinaryBitmap(new zx.HybridBinarizer(make())))
          .getText();
      } catch {
        /* not found at this size/rotation */
      } finally {
        reader.reset();
      }
    }
  }
  return null;
}

export async function decodeBarcode(file: Blob): Promise<string | null> {
  const img = await createImageBitmap(file);
  try {
    return (await withNative(img)) ?? (await withZxing(img));
  } finally {
    img.close();
  }
}
