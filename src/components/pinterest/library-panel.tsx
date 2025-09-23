'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PinterestBoardList } from '@/components/pinterest/pinterest-board-list';
import { PinterestPinGrid } from '@/components/pinterest/pinterest-pin-grid';
import { Button } from '@/components/ui/button';

interface Board {
  id: string;
  name: string;
  description: string | null;
  pinCount: number;
  createdAt?: string;
  previewImage?: string | null;
}

interface Pin {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  link: string | null;
  boardName?: string;
  createdAt?: string;
  isVideo?: boolean;
}

export function LibraryPanel() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  // syncing removed with hidden button

  const loadBoards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/local/pinterest/boards');
      const data = await res.json();
      setBoards(data.boards || []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual refresh removed from UI to simplify sidebar

  const loadPins = useCallback(async (boardId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/local/pinterest/boards/${boardId}/pins`);
      const data = await res.json();
      setPins(data.pins || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // initial load
    loadBoards();
  }, [loadBoards]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">Library</div>
      </div>

      {/* Boards list */}
      <div className="min-h-0 overflow-auto rounded-lg">
        <PinterestBoardList boards={boards} />
      </div>

      {/* Select board input */}
      <div className="flex items-center gap-2">
        <select
          className="w-full border rounded-md p-2 text-sm bg-background"
          value={selectedBoardId ?? ''}
          onChange={(e) => {
            const id = e.target.value || null;
            setSelectedBoardId(id);
            if (id) loadPins(id);
          }}
        >
          <option value="">Select a board…</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Pins preview (official embeds) */}
      {selectedBoardId && pins.length > 0 && (
        <div className="min-h-0 overflow-auto">
          <PinterestPinGrid pins={pins} title={boards.find(b => b.id === selectedBoardId)?.name} />
        </div>
      )}

      {selectedBoardId && !loading && pins.length === 0 && (
        <div className="text-xs text-muted-foreground">No pins found in board.</div>
      )}
    </div>
  );
}
