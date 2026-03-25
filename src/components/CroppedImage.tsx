import { useEffect, useRef } from 'react';

export function CroppedImage({ src, bbox }: { src: string, bbox: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!src || !bbox || bbox.length !== 4) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const [ymin, xmin, ymax, xmax] = bbox;
      // If bbox is all zeros, it means Gemini couldn't find it
      if (ymin === 0 && xmin === 0 && ymax === 0 && xmax === 0) return;

      const x = (xmin / 1000) * img.width;
      const y = (ymin / 1000) * img.height;
      const w = ((xmax - xmin) / 1000) * img.width;
      const h = ((ymax - ymin) / 1000) * img.height;

      const padding = 20;
      const sx = Math.max(0, x - padding);
      const sy = Math.max(0, y - padding);
      const sw = Math.min(img.width - sx, w + padding * 2);
      const sh = Math.min(img.height - sy, h + padding * 2);

      canvas.width = sw;
      canvas.height = sh;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    };
    img.src = src;
  }, [src, bbox]);

  if (!bbox || bbox.length !== 4 || (bbox[0] === 0 && bbox[1] === 0 && bbox[2] === 0 && bbox[3] === 0)) {
    return null;
  }

  return (
    <canvas 
      ref={canvasRef} 
      className="mt-2 rounded-md border border-slate-200 shadow-sm max-w-full h-auto max-h-32 object-contain bg-white" 
    />
  );
}
