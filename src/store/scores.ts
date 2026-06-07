// 9. Local-first scores store. Pure read/write helpers + a subscribe emitter so a
// future sync layer can adopt everything via getAllStats() + merge WITHOUT
// changing call sites. Merge discipline: max per field per mode.

const KEY = 'vg:scores:v1';

export interface ModeStats {
  bestScore: number;
  plays: number;
  lastScore: number;
  total: number;
}

export type AllStats = Record<string, ModeStats>;

const emptyMode = (): ModeStats => ({
  bestScore: 0,
  plays: 0,
  lastScore: 0,
  total: 0,
});

const listeners = new Set<() => void>();

function read(): AllStats {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function write(s: AllStats) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  listeners.forEach((cb) => cb());
}

export function getAllStats(): AllStats {
  return read();
}

export function getModeStats(modeId: string): ModeStats {
  return read()[modeId] ?? emptyMode();
}

export function recordPlay(modeId: string, score: number): ModeStats {
  const all = read();
  const prev = all[modeId] ?? emptyMode();
  const next: ModeStats = {
    bestScore: Math.max(prev.bestScore, score),
    plays: prev.plays + 1,
    lastScore: score,
    total: prev.total + score,
  };
  all[modeId] = next;
  write(all);
  return next;
}

// max-per-field merge so progress can never go backwards.
export function mergeStats(cloud: AllStats) {
  const all = read();
  for (const [id, c] of Object.entries(cloud)) {
    const p = all[id] ?? emptyMode();
    all[id] = {
      bestScore: Math.max(p.bestScore, c.bestScore),
      plays: Math.max(p.plays, c.plays),
      lastScore: c.lastScore || p.lastScore,
      total: Math.max(p.total, c.total),
    };
  }
  write(all);
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
