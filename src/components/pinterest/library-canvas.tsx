'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PinterestPinGrid } from '@/components/pinterest/pinterest-pin-grid';
import { Button } from '@/components/ui/button';

type Pin = {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  link: string | null;
  createdAt?: string;
  isVideo?: boolean;
  boardId?: string;
};

type Board = {
  id: string;
  name: string;
};

export function LibraryCanvas() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(false);
  // Single mode: Grid (cloud removed)

  // Compute pins to display first so hooks below can safely depend on it
  const displayedPins = useMemo(() => {
    if (selectedBoardId === 'all') return pins;
    return pins.filter(p => p.boardId === selectedBoardId);
  }, [pins, selectedBoardId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [pRes, bRes] = await Promise.all([
          fetch('/api/local/pinterest/pins'),
          fetch('/api/local/pinterest/boards'),
        ]);
        const pJson = await pRes.json();
        const bJson = await bRes.json();
        setPins(pJson.pins || []);
        setBoards((bJson.boards || []).map((b: any) => ({ id: b.id, name: b.name })));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Nudge Pinterest to build embeds when pins change
  useEffect(() => {
    const build = () => {
      try { (window as any).PinUtils?.build(); } catch {}
    };
    const t = setTimeout(build, 100);
    return () => clearTimeout(t);
  }, [displayedPins.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Cloud mode removed: keep simple grid headerless view */}

      <div className="flex-1 overflow-auto p-4">
        {displayedPins.length > 0 ? (
          <PinterestPinGrid pins={displayedPins} maxColumns={3} />
        ) : (
          <div className="h-full grid place-items-center text-muted-foreground text-sm">
            {loading ? 'Loading…' : 'No cached pins yet. Use Sync in the Library sidebar to fetch once, then they persist here.'}
          </div>
        )}
      </div>
      {/* Bottom controls removed */}
    </div>
  );
}
