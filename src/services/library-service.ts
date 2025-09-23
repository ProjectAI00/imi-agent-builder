export async function searchLibraryPins(params: { query: string; limit?: number }) {
  const q = params.query.trim();
  const res = await fetch(`/api/local/pinterest/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  const pins = Array.isArray(data.pins) ? data.pins : [];
  return { query: q, pins } as { query: string; pins: Array<{ id: string; title: string | null; description: string | null; imageUrl: string; boardName?: string; createdAt?: string }>; };
}

export async function scrollToLibraryPin(params: { pinId: string; highlight?: boolean }) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('library:scrollToPin', { detail: { pinId: params.pinId, highlight: params.highlight ?? true } }));
  }
  return { ok: true } as { ok: boolean };
}

export async function scrollLibraryToQuery(params: { query: string }) {
  const { query, pins } = await searchLibraryPins({ query: params.query });
  const first = pins[0];
  if (first && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('library:scrollToPin', { detail: { pinId: first.id, highlight: true } }));
  }
  return { query, matchCount: pins.length, firstPinId: first?.id } as { query: string; matchCount: number; firstPinId?: string };
}
