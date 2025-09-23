'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Pin = {
  id: string;
  title: string | null;
  imageUrl: string;
  boardId?: string;
};

type Board = { id: string; name: string };

type Rect = { x: number; y: number; w: number; h: number; pinId: string; };

export function LibraryCanvasView({ pins, boards, onOpenPin }: { pins: Pin[]; boards: Board[]; onOpenPin?: (id: string) => void }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);

  // Preload images
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    const next: Record<string, HTMLImageElement> = {};
    pins.forEach((p) => {
      if (!p.imageUrl) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = p.imageUrl;
      img.onload = () => setImages((prev) => ({ ...prev, [p.id]: img }));
    });
  }, [pins]);

  // Layout: cluster pins by board in a grid of clusters
  const { rects, bounds, clusters } = useMemo(() => {
    const byBoard = new Map<string, Pin[]>();
    for (const p of pins) {
      const b = p.boardId || 'unknown';
      if (!byBoard.has(b)) byBoard.set(b, []);
      byBoard.get(b)!.push(p);
    }

    const clusterPad = 48; // space around each cluster
    const thumb = 160; // thumbnail size
    const gap = 12; // gap between thumbs
    const colsPerCluster = 4;

    const ids = Array.from(byBoard.keys());
    const clusterCols = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
    const clusterW = colsPerCluster * thumb + (colsPerCluster - 1) * gap + clusterPad * 2;
    const clusterH = 3 * thumb + 2 * gap + clusterPad * 2; // 3 rows per cluster (grows if overflow)

    const rects: Rect[] = [];
    const clusters: { id: string; x: number; y: number; w: number; h: number; name: string }[] = [];

    ids.forEach((boardId, idx) => {
      const row = Math.floor(idx / clusterCols);
      const col = idx % clusterCols;
      const cx = col * (clusterW + 64);
      const cy = row * (clusterH + 64);
      const name = boards.find(b => b.id === boardId)?.name || 'Board';
      clusters.push({ id: boardId, x: cx, y: cy, w: clusterW, h: clusterH, name });

      const items = byBoard.get(boardId)!;
      let r = 0, c = 0;
      const innerX = cx + clusterPad;
      const innerY = cy + clusterPad + 18; // room for label
      items.forEach((p, i) => {
        const x = innerX + c * (thumb + gap);
        const y = innerY + r * (thumb + gap);
        rects.push({ x, y, w: thumb, h: thumb, pinId: p.id });
        c++; if (c >= colsPerCluster) { c = 0; r++; }
      });
    });

    const totalCols = Math.min(clusterCols, ids.length);
    const totalRows = Math.ceil(ids.length / clusterCols);
    const width = totalCols * (clusterW + 64) - 64;
    const height = totalRows * (clusterH + 64) - 64;
    return { rects, clusters, bounds: { w: width, h: height } };
  }, [pins, boards]);

  // Resize
  useEffect(() => {
    const el = wrapRef.current!;
    const obs = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDims({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Pan/zoom handlers
  const screenToWorld = useCallback((sx: number, sy: number) => {
    return { x: (sx - offset.x) / scale, y: (sy - offset.y) / scale };
  }, [offset.x, offset.y, scale]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom to cursor
      const zoom = Math.exp(-e.deltaY * 0.0015);
      const mx = e.nativeEvent.offsetX, my = e.nativeEvent.offsetY;
      const wx = (mx - offset.x) / scale; const wy = (my - offset.y) / scale;
      const newScale = Math.max(0.2, Math.min(3, scale * zoom));
      const nx = mx - wx * newScale; const ny = my - wy * newScale;
      setScale(newScale); setOffset({ x: nx, y: ny });
    } else {
      // Pan
      setOffset({ x: offset.x - e.deltaX, y: offset.y - e.deltaY });
    }
  }, [scale, offset]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }, [offset.x, offset.y]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return;
    setOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, [isPanning]);
  const onMouseUp = useCallback(() => { setIsPanning(false); panStart.current = null; }, []);

  // Click handling
  const onClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left; const sy = e.clientY - rect.top;
    const { x, y } = screenToWorld(sx, sy);
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        onOpenPin?.(r.pinId);
        break;
      }
    }
  }, [rects, screenToWorld, onOpenPin]);

  // Draw
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, dims.w, dims.h);
    ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, bounds.w, bounds.h);

    // Clusters (board labels)
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#64748b';
    clusters.forEach(c => {
      ctx.fillText(c.name, c.x + 8, c.y + 12);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(c.x + 4, c.y + 16, c.w - 8, c.h - 20);
    });

    // Thumbnails
    rects.forEach(r => {
      const img = images[r.pinId];
      if (img) {
        // draw with small rounded corners
        const rr = 8;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(r.x + rr, r.y);
        ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr);
        ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr);
        ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rr);
        ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rr);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, r.x, r.y, r.w, r.h);
        ctx.restore();
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      } else {
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      }
    });
  }, [dims.w, dims.h, scale, offset.x, offset.y, images, rects, clusters, bounds]);

  return (
    <div ref={wrapRef} className="w-full h-full" onWheel={onWheel}>
      <canvas
        ref={canvasRef}
        width={dims.w}
        height={dims.h}
        className="w-full h-full cursor-grab"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={onClick}
      />
    </div>
  );
}

