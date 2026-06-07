// 8. ResultCard - rubber-stamp slam-in of the score, "new best" treatment,
// buttons: play again / another mode.

import { useEffect } from 'react';
import { Audio } from '../audio';
import { MODE_BY_ID } from '../modes';
import type { ResultData } from '../App';

export default function ResultCard({
  result,
  onPlayAgain,
  onModes,
}: {
  result: ResultData;
  onPlayAgain: () => void;
  onModes: () => void;
}) {
  const mode = MODE_BY_ID[result.modeId];

  useEffect(() => {
    Audio.rep(result.modeId);
  }, [result.modeId]);

  return (
    <div
      className="paper-bg"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        padding: 24,
      }}
    >
      {result.isBest && (
        <div
          className="tape stamp-in"
          style={{ padding: '6px 16px' }}
        >
          <span className="display" style={{ fontSize: 16, color: 'var(--ink)' }}>
            NEW BEST!
          </span>
        </div>
      )}

      <div
        className="wonk-lg stamp-in"
        style={{
          padding: '36px 48px',
          textAlign: 'center',
          background: mode?.bg ?? 'var(--paper)',
        }}
      >
        <div
          className="display"
          style={{ fontSize: 'clamp(64px, 22vw, 120px)', lineHeight: 1 }}
        >
          {result.score}
        </div>
        <div className="mono" style={{ fontSize: 13, marginTop: 8 }}>
          {mode?.repNoun ?? 'reps'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          className="btn-wonk"
          onClick={() => {
            Audio.click();
            onPlayAgain();
          }}
          style={{ padding: '14px 28px', background: 'var(--lime)' }}
        >
          <span className="display">again ↺</span>
        </button>
        <button
          className="btn-wonk"
          onClick={() => {
            Audio.click();
            onModes();
          }}
          style={{ padding: '14px 28px' }}
        >
          <span className="display">modes</span>
        </button>
      </div>
    </div>
  );
}
