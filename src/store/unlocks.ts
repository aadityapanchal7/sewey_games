// 9. Derived unlock ladder. Cumulative `total` in a gateway mode crosses a goal
// → unlocks the next tier. Stored as a set, also recomputable from totals.

import { getAllStats } from './scores';

const KEY = 'vg:unlocks:v1';

// 🎛 define your ladder here: { id, requires: { mode, total } }
export interface UnlockRule {
  id: string;
  gatewayMode: string;
  goal: number;
}

export const UNLOCK_RULES: UnlockRule[] = [
  // example: { id: 'mode-b', gatewayMode: 'suii', goal: 50 },
];

function read(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function write(s: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify([...s]));
}

export function isUnlocked(id: string): boolean {
  if (!UNLOCK_RULES.some((r) => r.id === id)) return true; // no rule = always open
  return read().has(id);
}

// recompute from current totals; returns newly unlocked ids.
export function processUnlocks(): string[] {
  const stats = getAllStats();
  const have = read();
  const newly: string[] = [];
  for (const rule of UNLOCK_RULES) {
    if (have.has(rule.id)) continue;
    const total = stats[rule.gatewayMode]?.total ?? 0;
    if (total >= rule.goal) {
      have.add(rule.id);
      newly.push(rule.id);
    }
  }
  write(have);
  return newly;
}
