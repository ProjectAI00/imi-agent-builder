'use client';

import { z } from 'zod';
import React, { useEffect, useMemo, useRef } from 'react';

declare global {
  interface Window {
    PinUtils?: {
      build(): void;
    };
  }
}

export const pinterestPinGridSchema = z.object({
  pins: z.array(
    z.object({
      id: z.string(),
      title: z.string().nullable(),
      description: z.string().nullable(),
      imageUrl: z.string(),
      imageWidth: z.number().optional(),
      imageHeight: z.number().optional(),
      link: z.string().nullable(),
      boardName: z.string().optional(),
      createdAt: z.string().optional(),
      isVideo: z.boolean().optional(),
    })
  ),
  query: z.string().optional(),
  title: z.string().optional(),
  maxColumns: z.number().optional(),
  shuffle: z.boolean().optional(),
});

export type PinterestPinGridProps = z.infer<typeof pinterestPinGridSchema>;

export const PinterestPinGrid: React.FC<PinterestPinGridProps> = ({
  pins,
  query,
  title,
  maxColumns,
  shuffle = true,
}) => {
  const pinElMap = useRef<Map<string, HTMLElement>>(new Map());
  const seeded = useRef<number>(Math.floor(Math.random() * 1_000_000));

  const basePins = useMemo(() => (Array.isArray(pins) ? pins : []), [pins]);

  const pinsOrdered = useMemo(() => {
    if (!shuffle) return basePins;
    // Shuffle once per mount using a seeded pseudo-random (xorshift)
    let x = seeded.current || 123456789;
    const rnd = () => (x ^= x << 13, x ^= x >> 17, x ^= x << 5, (x >>> 0) / 0xffffffff);
    const arr = [...basePins];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [basePins, shuffle]);
  // Ensure Pinterest SDK is present and (re)build embeds when pins change
  useEffect(() => {
    const build = () => {
      try {
        window.PinUtils?.build();
      } catch {}
    };

    // If already loaded, build now and once again shortly (covers late layout)
    if (window.PinUtils) {
      build();
      const t = setTimeout(build, 300);
      return () => clearTimeout(t);
    }

    // Otherwise, append the script (singleton) and build on load
    const existing = document.querySelector('script[src="https://assets.pinterest.com/js/pinit.js"]') as HTMLScriptElement | null;
    const onLoad = () => build();
    if (existing) {
      existing.addEventListener('load', onLoad, { once: true });
      return () => existing.removeEventListener('load', onLoad);
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://assets.pinterest.com/js/pinit.js';
    script.addEventListener('load', onLoad, { once: true });
    document.head.appendChild(script);

    return () => script.removeEventListener('load', onLoad);
  }, [pinsOrdered.length]);

  // No placeholders; only render the official embed anchors

  // Global scroll-to handler so AI/tools can jump to a pin id
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ pinId: string; highlight?: boolean }>;
      const id = ce.detail?.pinId;
      if (!id) return;
      const el = pinElMap.current.get(id) || document.getElementById(`pin-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      if (ce.detail?.highlight) {
        el.classList.add('lib-highlight');
        setTimeout(() => el.classList.remove('lib-highlight'), 1500);
      }
    };
    window.addEventListener('library:scrollToPin', handler as EventListener);
    return () => window.removeEventListener('library:scrollToPin', handler as EventListener);
  }, []);

  if (!basePins || basePins.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">No pins found</div>
          <div className="text-sm">
            {query ? `No results for "${query}"` : 'Try a different search term'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      {title && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
          {query && (
            <p className="text-gray-600">
              {basePins.length} {basePins.length === 1 ? 'pin' : 'pins'} found for "{query}"
            </p>
          )}
        </div>
      )}

      {/* Masonry columns (no gaps). Control max columns via prop to keep cards readable. */}
      <div
        className="[column-fill:_balance]"
        style={{
          columnGap: '1rem',
          columnCount: Math.max(1, Math.min(maxColumns ?? 3, 8)),
        }}
      >
        {pinsOrdered.map((pin) => (
          <div
            key={pin.id}
            id={`pin-${pin.id}`}
            data-pin-id={pin.id}
            ref={(el) => {
              if (el) pinElMap.current.set(pin.id, el);
              else pinElMap.current.delete(pin.id);
            }}
            className="relative inline-block w-full break-inside-avoid mb-4 rounded-2xl overflow-hidden align-top"
            data-pin-host
          >
            <a
              data-pin-do="embedPin"
              data-pin-width="medium"
              data-pin-hover="true"
              href={`https://www.pinterest.com/pin/${pin.id}/`}
              className="block"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
