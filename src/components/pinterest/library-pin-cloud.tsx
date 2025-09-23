'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Cloud } from 'react-icon-cloud';
import { cloudProps } from '@/components/ui/interactive-icon-cloud';

type Pin = {
  id: string;
  title: string | null;
  imageUrl: string;
};

export function LibraryPinCloud({ pins, max = 40 }: { pins: Pin[]; max?: number }) {
  const seeded = useRef<number>(Math.floor(Math.random() * 1_000_000));
  const [tick, setTick] = useState(0);
  const embedSet = useRef<Set<string>>(new Set());

  const data = useMemo(() => {
    const base = Array.isArray(pins) ? pins.slice(0, max) : [];
    // Seeded shuffle so order changes between refreshes
    let x = seeded.current || 123456789;
    const rnd = () => (x ^= x << 13, x ^= x >> 17, x ^= x << 5, (x >>> 0) / 0xffffffff);
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base;
  }, [pins, max]);

  // Build embeds lazily when nodes are on screen inside the cloud container
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const id = (e.target as HTMLElement).dataset.pinId;
        if (id && !embedSet.current.has(id)) { embedSet.current.add(id); changed = true; }
      }
      if (changed) {
        setTick((v) => v + 1);
        try { (window as any).PinUtils?.build(); } catch {}
        setTimeout(() => { try { (window as any).PinUtils?.build(); } catch {} }, 50);
      }
    }, { root: null, rootMargin: '400px' });
    data.forEach((p) => {
      const el = document.getElementById(`cloudpin-${p.id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [data]);

  const [modalPin, setModalPin] = useState<string | null>(null);

  return (
    <div className="relative">
      {/* @ts-ignore Cloud types */}
      <Cloud {...cloudProps}>
        <>
          {data.map((p) => (
            <a
              key={p.id}
              id={`cloudpin-${p.id}`}
              data-pin-id={p.id}
              href={`https://www.pinterest.com/pin/${p.id}/`}
              onClick={(e) => { e.preventDefault(); setModalPin(p.id); }}
              style={{ display: 'inline-block', width: 220 }}
            >
              <img src={p.imageUrl} alt={p.title ?? 'pin'} className="block w-full h-auto object-cover rounded-xl" />
            </a>
          ))}
        </>
      </Cloud>

      {modalPin && (
        <EmbedModal pinId={modalPin} onClose={() => setModalPin(null)} />
      )}
    </div>
  );
}

function EmbedModal({ pinId, onClose }: { pinId: string; onClose: () => void }) {
  useEffect(() => {
    try { (window as any).PinUtils?.build(); } catch {}
    const t = setTimeout(() => { try { (window as any).PinUtils?.build(); } catch {} }, 50);
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onEsc); };
  }, [pinId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-2 flex justify-end">
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="px-4 pb-6">
          <a data-pin-do="embedPin" data-pin-width="large" data-pin-hover="false" href={`https://www.pinterest.com/pin/${pinId}/`} className="block" />
        </div>
      </div>
    </div>
  );
}
