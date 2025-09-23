'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Pin = {
  id: string;
  title: string | null;
  imageUrl: string;
};

interface LibraryCloudProps {
  pins: Pin[];
  maxPins?: number;
}

// A lightweight, dependency-free "thinking cloud" that lays out pins in
// concentric rings and rotates slowly. Each item renders the official
// Pinterest embed anchor, but is built lazily when it nears the viewport.
export function LibraryCloud({ pins, maxPins = 36 }: LibraryCloudProps) {
  const seeded = useRef<number>(Math.floor(Math.random() * 1_000_000));
  const embedSet = useRef<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  const items = useMemo(() => {
    const base = Array.isArray(pins) ? pins.slice(0, maxPins) : [];
    // seeded shuffle
    let x = seeded.current || 123456789;
    const rnd = () => (x ^= x << 13, x ^= x >> 17, x ^= x << 5, (x >>> 0) / 0xffffffff);
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base;
  }, [pins, maxPins]);

  // Lazy-build embeds when items are on screen
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const id = (e.target as HTMLElement).dataset.pinId;
        if (id && !embedSet.current.has(id)) {
          embedSet.current.add(id);
          changed = true;
        }
      }
      if (changed) {
        setTick((v) => v + 1);
        try { (window as any).PinUtils?.build(); } catch {}
        setTimeout(() => { try { (window as any).PinUtils?.build(); } catch {} }, 50);
      }
    }, { root: null, rootMargin: '300px' });

    items.forEach((p) => {
      const el = document.getElementById(`cloud-pin-${p.id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [items]);

  // Layout: concentric rings
  const rings = useMemo(() => {
    const result: Array<{ r: number; items: Pin[] }> = [];
    const perRing = [6, 10, 14, 18];
    let idx = 0;
    let r = 120;
    for (let ri = 0; idx < items.length && ri < perRing.length; ri++) {
      const count = perRing[ri];
      const slice = items.slice(idx, idx + count);
      result.push({ r, items: slice });
      idx += count;
      r += 120;
    }
    if (idx < items.length) {
      result.push({ r, items: items.slice(idx) });
    }
    return result;
  }, [items]);

  return (
    <div className="relative w-full h-[80vh] min-h-[560px] overflow-hidden">
      {/* slow rotation */}
      <div className="absolute inset-0 will-change-transform animate-[spin_80s_linear_infinite] hover:[animation-play-state:paused]">
        {rings.map((ring, ri) => (
          <Ring key={ri} radius={ring.r} items={ring.items} embedSet={embedSet.current} />
        ))}
      </div>
    </div>
  );
}

function Ring({ radius, items, embedSet }: { radius: number; items: Pin[]; embedSet: Set<string> }) {
  const centerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };

  const angleStep = (Math.PI * 2) / Math.max(items.length, 1);

  return (
    <div style={centerStyle}>
      {items.map((p, i) => {
        const a = i * angleStep;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        const style: React.CSSProperties = {
          position: 'absolute',
          transform: `translate(${x}px, ${y}px)`,
          width: 220,
        };
        const showEmbed = embedSet.has(p.id);
        return (
          <div key={p.id} id={`cloud-pin-${p.id}`} data-pin-id={p.id} style={style} className="rounded-2xl overflow-hidden">
            {/* placeholder image to make it instant */}
            <img src={p.imageUrl} alt={p.title ?? 'pin'} className="block w-full h-auto object-cover" />
            {/* overlay anchor for official embed */}
            <a
              style={{ position: 'absolute', inset: 0 }}
              className={showEmbed ? 'block' : 'block pointer-events-none opacity-0'}
              data-pin-do="embedPin"
              data-pin-width="medium"
              data-pin-hover="false"
              href={`https://www.pinterest.com/pin/${p.id}/`}
            />
          </div>
        );
      })}
    </div>
  );
}

