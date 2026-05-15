import QRCode from "qrcode";

const BASE_W = 900;
const BASE_QR = 420;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function makeQrTransparentDataUrl(qrCanvas: HTMLCanvasElement): string {
  const ctx = qrCanvas.getContext("2d");
  if (!ctx) return qrCanvas.toDataURL("image/png");
  const { width, height } = qrCanvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
    if (lum > 200) {
      d[i + 3] = 0;
    } else {
      d[i] = 26;
      d[i + 1] = 20;
      d[i + 2] = 18;
      d[i + 3] = 235;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return qrCanvas.toDataURL("image/png");
}

export type PosterOptions = {
  eventUrl: string;
  coupleNames: string;
  welcomeMessage: string;
  backgroundPublicUrl?: string | null;
  /** Küçük önizleme için (ör. 360). Boş = tam boy kart. */
  maxCanvasWidth?: number;
};

async function renderEventPosterCanvas(opts: PosterOptions): Promise<HTMLCanvasElement | null> {
  const maxW = opts.maxCanvasWidth ?? BASE_W;
  const scale = Math.min(1, maxW / BASE_W);
  const W = Math.round(BASE_W * scale);
  const QR_SIZE = Math.round(BASE_QR * scale);

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, opts.eventUrl, {
    width: QR_SIZE,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#1a1412", light: "#ffffffff" },
  });
  const qrDataUrl = makeQrTransparentDataUrl(qrCanvas);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.round(W * 1.35);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f6f0e8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (opts.backgroundPublicUrl) {
    try {
      const bg = await loadImage(opts.backgroundPublicUrl);
      const sc = Math.max(canvas.width / bg.width, canvas.height / bg.height);
      const dw = bg.width * sc;
      const dh = bg.height * sc;
      const dx = (canvas.width - dw) / 2;
      const dy = (canvas.height - dh) / 2;
      ctx.save();
      ctx.filter = "saturate(1.05) contrast(1.02)";
      ctx.drawImage(bg, dx, dy, dw, dh);
      ctx.restore();
      ctx.fillStyle = "rgba(246, 240, 232, 0.35)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } catch {
      /* ignore broken bg */
    }
  }

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  const padX = Math.round(48 * scale);
  const padY = Math.round(40 * scale);
  const textBlockH = Math.round(200 * scale);
  ctx.beginPath();
  ctx.roundRect(padX, padY, canvas.width - padX * 2, textBlockH, Math.round(18 * scale));
  ctx.fill();

  ctx.fillStyle = "#1a1412";
  ctx.font = `600 ${Math.round(42 * scale)}px Cormorant Garamond, serif`;
  ctx.textAlign = "center";
  ctx.fillText(opts.coupleNames, canvas.width / 2, padY + Math.round(72 * scale));

  ctx.font = `400 ${Math.round(22 * scale)}px Outfit, system-ui, sans-serif`;
  const msg = wrapText(ctx, opts.welcomeMessage, canvas.width - padX * 2 - Math.round(80 * scale));
  let y = padY + Math.round(118 * scale);
  for (const line of msg.slice(0, 3)) {
    ctx.fillText(line, canvas.width / 2, y);
    y += Math.round(28 * scale);
  }

  const qrImg = await loadImage(qrDataUrl);
  const qx = (canvas.width - QR_SIZE) / 2;
  const qy = padY + textBlockH + Math.round(28 * scale);
  ctx.shadowColor = "rgba(26, 20, 18, 0.18)";
  ctx.shadowBlur = Math.round(28 * scale);
  ctx.shadowOffsetY = Math.round(10 * scale);
  ctx.drawImage(qrImg, qx, qy, QR_SIZE, QR_SIZE);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = "rgba(26,20,18,0.55)";
  ctx.font = `500 ${Math.round(14 * scale)}px Outfit, system-ui, sans-serif`;
  ctx.fillText("Taranarak anı bırakın", canvas.width / 2, qy + QR_SIZE + Math.round(36 * scale));

  return canvas;
}

export async function buildEventPoster(opts: PosterOptions): Promise<string> {
  const canvas = await renderEventPosterCanvas(opts);
  return canvas?.toDataURL("image/png") ?? "";
}

export async function buildEventPosterBlob(opts: PosterOptions): Promise<Blob | null> {
  const canvas = await renderEventPosterCanvas(opts);
  if (!canvas) return null;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("PNG oluşturulamadı"));
      },
      "image/png",
      0.95,
    );
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}
