'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';

type Pin = {
  id: string;
  title: string | null;
  description?: string | null;
  imageUrl: string;
  link: string | null;
  boardId?: string;
};

type Board = { id: string; name: string };

const BoardNode: React.FC<{ data: { title: string; width: number; height: number } }> = ({ data, children }) => {
  return (
    <div style={{ width: data.width, height: data.height }} className="rounded-lg border border-slate-200 bg-white/70 shadow-sm">
      <div className="px-3 py-2 text-xs text-slate-600 border-b border-slate-200 truncate">
        {data.title}
      </div>
      <div className="p-2 overflow-visible relative w-full h-[calc(100%-28px)]">
        {children}
      </div>
    </div>
  );
};

const PinEmbedNode: React.FC<{ data: { id: string; imageUrl?: string; size: number } }> = ({ data }) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);
  const builtRef = React.useRef(false);

  // Intersection-based lazy rendering to avoid mounting hundreds of iframes at once
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        setVisible(true);
      }
    }, { root: null, rootMargin: '2000px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || builtRef.current) return;
    // Build once when visible
    try { (window as any).PinUtils?.build(); } catch {}
    const t = setTimeout(() => { try { (window as any).PinUtils?.build(); } catch {} }, 50);
    builtRef.current = true;
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div ref={hostRef} style={{ width: data.size }} className="rounded-md overflow-hidden">
      {visible ? (
        <a
          data-pin-do="embedPin"
          data-pin-width="medium"
          data-pin-hover="false"
          href={`https://www.pinterest.com/pin/${data.id}/`}
          className="block"
        />
      ) : (
        <img src={data.imageUrl || ''} alt="pin" style={{ width: data.size, height: data.size }} className="block object-cover bg-slate-100" />
      )}
    </div>
  );
};

const nodeTypes = { board: BoardNode as any, pin: PinEmbedNode as any };

export function LibraryFlowCanvas({ pins, boards }: { pins: Pin[]; boards: Board[] }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [embedPinId, setEmbedPinId] = useState<string | null>(null);

  // Build layout once from data
  useEffect(() => {
    const byBoard = new Map<string, Pin[]>();
    pins.forEach((p) => {
      const b = p.boardId || 'unknown';
      if (!byBoard.has(b)) byBoard.set(b, []);
      byBoard.get(b)!.push(p);
    });

    const boardCols = 3; // number of board columns across canvas
    const pad = 24; // inner padding for board node
    const tile = 160; // pin thumbnail size
    const gap = 12; // gap between pins
    const colsPerBoard = 4; // pins per row inside board
    const header = 28; // board header height

    const boardWidth = colsPerBoard * tile + (colsPerBoard - 1) * gap + pad * 2;
    const boardRowGap = 120;
    const boardColGap = 80;

    const n: Node[] = [];
    let idx = 0;
    for (const [boardId, list] of byBoard.entries()) {
      const row = Math.floor(idx / boardCols);
      const col = idx % boardCols;
      const rowsInside = Math.ceil(list.length / colsPerBoard) || 1;
      const boardHeight = header + pad * 2 + rowsInside * tile + (rowsInside - 1) * gap;
      const x = col * (boardWidth + boardColGap);
      const y = row * (boardHeight + boardRowGap);

      // Parent Board node
      n.push({
        id: `board-${boardId}`,
        type: 'board',
        position: { x, y },
        data: { title: boards.find(b => b.id === boardId)?.name || 'Board', width: boardWidth, height: boardHeight },
        style: { padding: 0 },
        draggable: false,
      });

      // Child Pin nodes (official embed inside each node)
      list.forEach((p, i) => {
        const r = Math.floor(i / colsPerBoard);
        const c = i % colsPerBoard;
        const px = pad + c * (tile + gap);
        const py = header + pad + r * (tile + gap);
        n.push({
          id: `pin-${p.id}`,
          type: 'pin',
          parentNode: `board-${boardId}`,
          extent: 'parent',
          position: { x: px, y: py },
          data: { id: p.id, imageUrl: p.imageUrl, size: tile },
          draggable: false,
          selectable: true,
        });
      });
      idx++;
    }
    setNodes(n);
    setEdges([]);
  }, [pins, boards]);

  // Fit the full view once nodes are ready
  const [rfInstance, setRfInstance] = useState<any>(null);
  useEffect(() => {
    if (!rfInstance || nodes.length === 0) return;
    const t = setTimeout(() => rfInstance.fitView({ padding: 0.2 }), 0);
    return () => clearTimeout(t);
  }, [nodes, rfInstance]);

  // Click → open embed modal
  const onNodeClick = (_: any, node: Node) => {
    if (node.type === 'pin') {
      const id = (node.data as any)?.id as string;
      setEmbedPinId(id);
    }
  };

  return (
    <div className="w-full h-full">
      <ReactFlow
        style={{ width: '100%', height: '100%' }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onInit={setRfInstance}
        onNodeClick={onNodeClick}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        panOnScroll
        panOnDrag
        selectionOnDrag={false}
        zoomOnDoubleClick={false}
      >
        <Background gap={16} color="#e2e8f0" />
        <Controls position="bottom-right" />
      </ReactFlow>

      {/* Simple modal with official embed */}
      {embedPinId && (
        <EmbedModal pinId={embedPinId} onClose={() => setEmbedPinId(null)} />
      )}
    </div>
  );
}

function EmbedModal({ pinId, onClose }: { pinId: string; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    try { (window as any).PinUtils?.build(); } catch {}
    const t = setTimeout(() => { try { (window as any).PinUtils?.build(); } catch {} }, 100);
    return () => { document.removeEventListener('keydown', onEsc); clearTimeout(t); };
  }, [pinId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-2 flex justify-end">
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="px-4 pb-6">
          <a
            data-pin-do="embedPin"
            data-pin-width="large"
            data-pin-hover="false"
            href={`https://www.pinterest.com/pin/${pinId}/`}
            className="block"
          />
        </div>
      </div>
    </div>
  );
}
