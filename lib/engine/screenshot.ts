import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export function highlightDiff(left: Buffer, right: Buffer): Buffer | null {
  let imgA: PNG;
  let imgB: PNG;
  try {
    imgA = PNG.sync.read(left);
    imgB = PNG.sync.read(right);
  } catch {
    return null;
  }
  const width = Math.min(imgA.width, imgB.width);
  const height = Math.min(imgA.height, imgB.height);
  if (!width || !height) return null;
  const crop = (img: PNG) => {
    if (img.width === width && img.height === height) return img.data;
    const out = new PNG({ width, height });
    PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
    return out.data;
  };
  const diff = new PNG({ width, height });
  pixelmatch(crop(imgA), crop(imgB), diff.data, width, height, {
    threshold: 0.12,
    includeAA: false,
    diffColor: [226, 255, 77],
  });
  return PNG.sync.write(diff);
}

function paint(png: PNG, x: number, y: number, w: number, h: number, color: [number, number, number]) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= png.width || yy >= png.height) continue;
      const index = (png.width * yy + xx) << 2;
      png.data[index] = color[0];
      png.data[index + 1] = color[1];
      png.data[index + 2] = color[2];
      png.data[index + 3] = 255;
    }
  }
}

export function demoPlate(shift: number): Buffer {
  const png = new PNG({ width: 640, height: 360 });
  paint(png, 0, 0, 640, 360, [18, 17, 14]);
  paint(png, 36, 40, 220, 18, [243, 236, 223]);
  paint(png, 36, 78, 420, 10, [90, 84, 74]);
  paint(png, 36, 104, 360, 10, [90, 84, 74]);
  paint(png, 36 + shift, 160, 180, 48, [226, 255, 77]);
  paint(png, 36, 240, 280, 10, [90, 84, 74]);
  return PNG.sync.write(png);
}
