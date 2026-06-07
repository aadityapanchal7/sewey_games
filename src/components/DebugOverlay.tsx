// 5.3 Debug overlay - toggle via ?debug=1 or a 700ms long-press. Renders the live
// FrameDebug (fps, visibility, per-mechanic signal, fired side). Build this BEFORE
// tuning any detector - you cannot validate a pose detector from a phone blind.

import { useEffect, useRef, useState } from 'react';
import type { TrackerHandle } from '../tracker/initTracker';

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ opacity: 0.7 }}>{k}</span>
      <span style={{ fontWeight: 700 }}>{v}</span>
    </div>
  );
}

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '-' : n.toFixed(d);

export default function DebugOverlay({
  tracker,
}: {
  tracker: TrackerHandle | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);

  // poll the pull interface; write into a ref-rendered node ~10Hz (cheap, not per-frame)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  const last = tracker?.getLastFrame();
  const d = last?.debug;
  const suii = d?.suii as { both: number; inUp: boolean } | undefined;
  const drum = d?.drum as { level: number; armed: boolean; peak: number } | undefined;
  const feat = d?.features as
    | {
        bodyScale: number;
        shoulderWidth: number;
        shoulderVisMax: number;
        usedHipScale: boolean;
      }
    | null
    | undefined;
  const mbappe = d?.mbappe as
    | { distMax: number; distMin: number; onChest: boolean; hasLeft: boolean }
    | undefined;
  const guess = d?.guess as
    | { side: string | null; progress: number; raisedL: boolean; raisedR: boolean }
    | undefined;

  return (
    <div
      ref={ref}
      className="mono"
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 50,
        background: 'rgba(26,20,16,0.86)',
        color: '#b4e34a',
        fontSize: 11,
        lineHeight: 1.5,
        padding: 10,
        borderRadius: 8,
        minWidth: 180,
        pointerEvents: 'none',
      }}
    >
      <Row k="cam fps" v={last?.cameraFps ?? 0} />
      <Row k="lm fps" v={last?.landmarkFps ?? 0} />
      <Row k="tier" v={last?.modelTier ?? '-'} />
      <Row k="visible" v={d?.visibleNow ? 'YES' : 'no'} />
      <Row k="hands rdy" v={d?.handsReady ? 'YES' : 'no'} />
      <Row k="wristVis" v={fmt(d?.wristVisMin)} />
      {feat && <Row k="shVis" v={fmt(feat.shoulderVisMax)} />}
      {feat && <Row k="bodyScale" v={fmt(feat.bodyScale)} />}
      {feat && <Row k="shW" v={fmt(feat.shoulderWidth)} />}
      {feat && <Row k="hipScale" v={feat.usedHipScale ? '1' : '0'} />}
      <Row k="combined" v={fmt(d?.combined)} />
      {suii && <Row k="suii.both" v={fmt(suii.both)} />}
      {suii && <Row k="suii.inUp" v={suii.inUp ? '1' : '0'} />}
      {drum && <Row k="drum.level" v={fmt(drum.level)} />}
      {drum && <Row k="drum.peak" v={fmt(drum.peak)} />}
      {drum && <Row k="drum.armed" v={drum.armed ? '1' : '0'} />}
      {mbappe && <Row k="mb.distMax" v={fmt(mbappe.distMax)} />}
      {mbappe && <Row k="mb.onChest" v={mbappe.onChest ? '1' : '0'} />}
      {mbappe && <Row k="mb.hasLeft" v={mbappe.hasLeft ? '1' : '0'} />}
      {guess && <Row k="guess.side" v={guess.side ?? '-'} />}
      {guess && <Row k="guess.prog" v={fmt(guess.progress)} />}
      <Row k="fired" v={d?.firedSide ?? '-'} />
      <Row k="visRecov" v={d?.visibilityRecoverySuppressed ? '1' : '0'} />
      <Row k="reps" v={tracker?.counter.getReps() ?? 0} />
    </div>
  );
}
