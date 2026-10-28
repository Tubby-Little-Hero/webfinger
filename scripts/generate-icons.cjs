// ============================================================
// Generate extension icons as simple PNG files
// 使用纯 Node.js (zlib) 生成 icon PNG 文件
// ============================================================

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

// Ensure directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function createPNG(width, height, pixels) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const idx = y * (1 + width * 4) + 1 + x * 4;
      const p = pixels[y * width + x] || [100, 100, 240, 255];
      rawData[idx] = p[0];     // R
      rawData[idx + 1] = p[1]; // G
      rawData[idx + 2] = p[2]; // B
      rawData[idx + 3] = p[3]; // A
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // Build PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Colors
const BG = [15, 15, 25, 255];       // Dark background
const ACCENT = [99, 102, 241, 255]; // Indigo accent
const ACCENT2 = [129, 140, 248, 255]; // Light indigo
const WHITE = [226, 232, 240, 240]; // Semi-transparent white

// Draw a simple shield/fingerprint icon pattern
function drawIconPattern(w, h) {
  const pixels = [];
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.4;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Shield shape
      const topY = cy - r * 0.9;
      const bottomY = cy + r;
      const midY = topY + (bottomY - topY) * 0.3;
      const bottomPoint = cy + r * 0.95;

      let insideShield = false;
      if (y >= topY && y <= bottomPoint) {
        const t = (y - topY) / (bottomPoint - topY);
        const shieldW = r * (1 - t * 0.3);
        const extraW = y > midY ? 0 : r * 0.2 * (1 - (y - topY) / (midY - topY));
        const halfW = shieldW + extraW;
        insideShield = Math.abs(dx) < halfW;
      }

      // Edge detection for outline
      let isEdge = false;
      if (insideShield) {
        const edgeDist = 1.5;
        for (let dy2 = -1; dy2 <= 1; dy2++) {
          for (let dx2 = -1; dx2 <= 1; dx2++) {
            if (dx2 === 0 && dy2 === 0) continue;
            const nx = x + dx2, ny = y + dy2;
            // Check if neighbor would be outside
            const nt = (ny - topY) / (bottomPoint - topY);
            const nShieldW = r * (1 - nt * 0.3);
            const nExtraW = ny > midY ? 0 : r * 0.2 * (1 - (ny - topY) / (midY - topY));
            const nHalfW = nShieldW + nExtraW;
            if (Math.abs(nx - cx) >= nHalfW || ny < topY || ny > bottomPoint) {
              isEdge = true;
              break;
            }
          }
          if (isEdge) break;
        }
      }

      // Inner fingerprint lines (horizontal arcs)
      let isLine = false;
      if (insideShield && !isEdge) {
        const innerY = (y - topY) / (bottomPoint - topY);
        // Draw fingerprint-like curves
        for (let line = 1; line <= 4; line++) {
          const lineY = 0.25 + line * 0.15;
          if (Math.abs(innerY - lineY) < 0.04) {
            const curveCenter = cx + Math.sin(innerY * 3) * r * 0.1;
            const curveWidth = r * 0.5 * (1 - innerY * 0.6);
            if (Math.abs(x - curveCenter) < curveWidth) {
              isLine = true;
            }
          }
        }
      }

      if (isEdge) {
        pixels.push(ACCENT2);
      } else if (isLine) {
        pixels.push(ACCENT2);
      } else if (insideShield) {
        pixels.push(ACCENT);
      } else {
        // Rounded corners: fade edges
        const cornerDist = Math.max(
          Math.max(x, w - x) / (w * 0.15),
          Math.max(y, h - y) / (h * 0.15)
        );
        if (cornerDist < 1 && cornerDist > 0.5) {
          const alpha = Math.round(BG[3] * (cornerDist - 0.5) / 0.5);
          pixels.push([BG[0], BG[1], BG[2], Math.max(0, alpha)]);
        } else if (cornerDist <= 0.5) {
          pixels.push([BG[0], BG[1], BG[2], 0]);
        } else {
          pixels.push(BG);
        }
      }
    }
  }

  return pixels;
}

// Generate icons
const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const pixels = drawIconPattern(size, size);
  const png = createPNG(size, size, pixels);
  const filePath = path.join(ICONS_DIR, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created ${filePath} (${png.length} bytes)`);
}

console.log('\n✅ All icons generated successfully!');
