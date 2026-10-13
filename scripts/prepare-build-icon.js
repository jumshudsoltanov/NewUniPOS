/**
 * UniPOS build ikonu: logo.png → ortadakı mavi kart, CloPOS tərzi
 * yuvarlaq künclü ağ fon + şəffaf künclər; Explorer-də qara fon üçün
 * alpha=0 piksellərdə RGB ağ saxlanılır.
 */
const path = require("path");
const fs = require("fs");

const inputPath = path.join(
  __dirname,
  "..",
  "electron",
  "static",
  "images",
  "logo.png",
);
const outputPng = path.join(
  __dirname,
  "..",
  "electron",
  "static",
  "images",
  "logo-build.png",
);
const outputIco = path.join(
  __dirname,
  "..",
  "electron",
  "static",
  "images",
  "logo-build.ico",
);

const OUT_SIZE = 256;
/** 256px üçün loqo maksimum tərəf (təxminən CloPOS nisbəti). */
const LOGO_MAX_256 = 210;
/** 256px üçün yuvarlaqlaşdırma radiusu (eyni nisbət kiçik ölçülərdə tətbiq olunur). */
const RX_256 = 56;

/** ICO üçün ölçülər (Explorer / .exe ikonu üçün). */
const ICO_SIZES = [256, 128, 96, 64, 48, 32, 16];

/** Yuvarlaq künclər və loqo üçün daxili render ölçüsü (supersampling — keyfiyyət). */
const SUPER_MAX = 2048;
/** Final ölçüyə nisbət: məs. 256 → 2048px-də birləşdirib sonra endiririk. */
const SUPER_FACTOR = 8;

/** PNG çıxış (itkisiz sıxılma səviyyəsi + effort). */
const PNG_HIGH = {
  compressionLevel: 2,
  effort: 10,
  adaptiveFiltering: true,
};
const PNG_LOSSLESS_INTERMEDIATE = { compressionLevel: 0, effort: 1 };

function isInnerBlue(r, g, b, a) {
  return a > 200 && r < 100 && b > 200 && g > 90 && g < 200;
}

function findInnerBlueBBox(data, w, h, channels) {
  const sx = Math.floor(w / 2);
  const sy = Math.floor(h * 0.4);
  const seedIdx = (sy * w + sx) * channels;
  const sr = data[seedIdx];
  const sg = data[seedIdx + 1];
  const sb = data[seedIdx + 2];
  const sa = data[seedIdx + 3];
  if (!isInnerBlue(sr, sg, sb, sa)) {
    return null;
  }

  const vis = new Uint8Array(w * h);
  const stack = [[sx, sy]];
  vis[sy * w + sx] = 1;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const p = ny * w + nx;
      if (vis[p]) continue;
      const i = p * channels;
      if (!isInnerBlue(data[i], data[i + 1], data[i + 2], data[i + 3]))
        continue;
      vis[p] = 1;
      stack.push([nx, ny]);
    }
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  if (bw < 50 || bh < 50) return null;
  return { left: minX, top: minY, width: bw, height: bh };
}

/**
 * Alpha=0 olan piksellərdə RGB=255 — Windows Explorer bəzən alpha səhv oxuyanda qara göstərirdi.
 */
async function sanitizeTransparentRgb(sharp, pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png(PNG_HIGH)
    .toBuffer();
}

/**
 * Yuvarlaq künclü ağ squircle + mərkəzdə loqo, kvadrat size×size.
 * Əvvəlcə böyük “iş” ölçüsündə birləşdirir, sonra Lanczos3 ilə endirir (kənarlar və loqo daha təmiz).
 */
async function renderIconAtSize(sharp, innerPngBuffer, size) {
  const work = Math.min(SUPER_MAX, Math.max(size * SUPER_FACTOR, size));
  const logoMaxWork = Math.max(8, Math.floor((work * LOGO_MAX_256) / OUT_SIZE));
  const rxWork = Math.max(2, Math.floor((work * RX_256) / OUT_SIZE));

  const logoInput = await sharp(innerPngBuffer)
    .resize(logoMaxWork, logoMaxWork, {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png(PNG_LOSSLESS_INTERMEDIATE)
    .toBuffer();

  const meta = await sharp(logoInput).metadata();
  const rw = meta.width;
  const rh = meta.height;
  const left = Math.floor((work - rw) / 2);
  const top = Math.floor((work - rh) / 2);

  const whiteRoundedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${work}" height="${work}">
  <rect width="${work}" height="${work}" rx="${rxWork}" ry="${rxWork}" fill="#ffffff"/>
</svg>`;

  // İki addım: Sharp bəzən eyni zəncirdə composite-dən sonrakı resize-u səhv sıralayır
  // və böyük loqonu kiçik fona “qoymaq” kimi xəta verir.
  const composedHi = await sharp(Buffer.from(whiteRoundedSvg))
    .resize(work, work)
    .ensureAlpha()
    .composite([{ input: logoInput, left, top, blend: "over" }])
    .ensureAlpha()
    .png(PNG_LOSSLESS_INTERMEDIATE)
    .toBuffer();

  const composed = await sharp(composedHi)
    .resize(size, size, {
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png(PNG_HIGH)
    .toBuffer();

  return sanitizeTransparentRgb(sharp, composed);
}

async function run() {
  // Git-də hazır, yüksək keyfiyyətli logo-build.ico var (sharp + klassik BMP ICO ilə yaradılıb).
  // Hər build-də onu logo.png-dən yenidən yaratmaq keyfiyyəti aşağı salırdı. Yalnız FORCE_ICON=1 ilə yenidən yarat.
  if (fs.existsSync(outputIco) && fs.existsSync(outputPng) && process.env.FORCE_ICON !== "1") {
    console.log("[prepare-build-icon] mövcud logo-build.ico saxlanılır (yenidən yaratmaq üçün FORCE_ICON=1)");
    return;
  }
  // İkon artıq mövcuddursa yenidən hazırlamağa ehtiyac yoxdur
  if (fs.existsSync(outputIco) && fs.existsSync(outputPng)) {
    console.log(
      "[prepare-build-icon] logo-build.ico artıq mövcuddur, yenidən yaradılmır.",
    );
    return;
  }

  try {
    const sharp = require("sharp");
    const { default: pngToIco } = await import("png-to-ico");

    const { data, info } = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const ch = info.channels;

    let box = findInnerBlueBBox(data, w, h, ch);
    if (!box) {
      box = { left: 500, top: 505, width: 1431, height: 1563 };
      console.warn(
        "[prepare-build-icon] flood-fill tapılmadı, sabit korp istifadə olunur",
      );
    }

    const innerPng = await sharp(inputPath)
      .extract({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      })
      .ensureAlpha()
      .png(PNG_LOSSLESS_INTERMEDIATE)
      .toBuffer();

    const png256 = await renderIconAtSize(sharp, innerPng, OUT_SIZE);
    fs.writeFileSync(outputPng, png256);

    const icoBuffers = [];
    for (const s of ICO_SIZES) {
      icoBuffers.push(await renderIconAtSize(sharp, innerPng, s));
    }

    const icoBuf = await pngToIco(icoBuffers);
    fs.writeFileSync(outputIco, icoBuf);

    console.log(
      "[prepare-build-icon] logo-build.ico hazırdır (yuvarlaq ağ fon, supersampling, yüksək keyfiyyət)",
    );
  } catch (e) {
    console.error("[prepare-build-icon]", e.message);
    process.exit(1);
  }
}

run();
