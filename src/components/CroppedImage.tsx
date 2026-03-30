import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function CroppedImage({ src, bbox }: { src: string, bbox: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!src || !bbox || bbox.length !== 4) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const [ymin, xmin, ymax, xmax] = bbox;
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

  useEffect(() => {
    if (!isOpen || !src || !bbox || bbox.length !== 4) return;
    const img = new Image();
    img.onload = () => {
      const canvas = fullCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const [ymin, xmin, ymax, xmax] = bbox;
      if (ymin === 0 && xmin === 0 && ymax === 0 && xmax === 0) return;

      const x = (xmin / 1000) * img.width;
      const y = (ymin / 1000) * img.height;
      const w = ((xmax - xmin) / 1000) * img.width;
      const h = ((ymax - ymin) / 1000) * img.height;

      ctx.strokeStyle = 'red';
      ctx.lineWidth = Math.max(2, img.width * 0.005);
      ctx.strokeRect(x, y, w, h);
      
      ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
      ctx.fillRect(x, y, w, h);
    };
    img.src = src;
  }, [isOpen, src, bbox]);

  if (!bbox || bbox.length !== 4 || (bbox[0] === 0 && bbox[1] === 0 && bbox[2] === 0 && bbox[3] === 0)) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <canvas 
          ref={canvasRef} 
          className="mt-2 rounded-md border border-slate-200 shadow-sm max-w-full h-auto max-h-32 object-contain bg-white cursor-pointer hover:opacity-80 transition-opacity" 
          title="انقر لتكبير الصورة وتوضيح الملاحظة"
        />
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] p-1 bg-slate-950 border-slate-800 overflow-auto">
        <div className="sr-only">
          <DialogTitle>توضيح الملاحظة على الفاتورة</DialogTitle>
          <DialogDescription>صورة الفاتورة مع تحديد مكان الملاحظة باللون الأحمر</DialogDescription>
        </div>
        <div className="relative w-full h-full flex items-center justify-center">
          <canvas 
            ref={fullCanvasRef} 
            className="max-w-full h-auto object-contain" 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
