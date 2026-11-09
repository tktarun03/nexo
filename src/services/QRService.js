// Local QR generation (no network) plus readability checks.
import QRCode from 'qrcode';

// Thresholds from testing phone cameras against phone screens at arm's length.
const COMFORT_VERSION = 15; // 77×77 modules: scans instantly
const DENSE_VERSION = 25; // 117×117 modules: scans, but needs steady hands/brightness

export function utf8Length(text) {
  return new TextEncoder().encode(text).length;
}

/**
 * Inspect a payload before rendering.
 * @returns {{ok:boolean, level:'good'|'dense'|'too-dense'|'too-large', version:number, modules:number, bytes:number, ecl:string}}
 */
export function analyse(text, displayPx = 280) {
  const bytes = utf8Length(text);
  for (const ecl of ['M', 'L']) {
    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: ecl });
      const version = qr.version;
      const modules = qr.modules.size;
      const pxPerModule = displayPx / (modules + 8);
      let level = 'good';
      if (version > DENSE_VERSION || pxPerModule < 2) level = 'too-dense';
      else if (version > COMFORT_VERSION) level = 'dense';
      return { ok: true, level, version, modules, bytes, ecl, pxPerModule };
    } catch {
      /* try lower error correction */
    }
  }
  return { ok: false, level: 'too-large', version: 0, modules: 0, bytes, ecl: '', pxPerModule: 0 };
}

/** Pure black-on-white SVG with a 4-module quiet zone. */
export async function toSVG(text, ecl = 'M') {
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: ecl,
    margin: 4,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

export async function toCanvas(text, { ecl = 'M', size = 1024 } = {}) {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: ecl,
    margin: 4,
    width: size,
    color: { dark: '#000000', light: '#ffffff' },
  });
  return canvas;
}

export async function toPNGBlob(text, opts) {
  const canvas = await toCanvas(text, opts);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'));
}

/** Decode a QR from ImageData using the bundled jsQR (lazy-loaded). */
export async function decodeImageData(imageData) {
  const { default: jsQR } = await import('jsqr');
  const res = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  return res ? res.data : null;
}

/** Self-check: encode → render → decode round trip. */
export async function roundTrip(text) {
  const canvas = await toCanvas(text, { size: 600 });
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return (await decodeImageData(data)) === text;
}
