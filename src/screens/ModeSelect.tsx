// 8. ModeSelect — top control bar (back · mute), a vertically-biased centered
// content block (title + wonky mode grid), footer wordmark. One screen, no
// scroll. Locked modes grayed; tapping a locked card shakes it.

import { useState } from 'react';
import { Audio } from '../audio';
import { MODES, type Mode } from '../modes';
import { isUnlocked } from '../store/unlocks';

export default function ModeSelect({
  onPick,
  onBack,
}: {
  onPick: (m: Mode) => void;
  onBack: () => void;
}) {
  const [muted, setMuted] = useState(Audio.isMuted());
  const [shakeId, setShakeId] = useState<string | null>(null);

  const toggleMute = () => {
    const v = !muted;
    Audio.setMuted(v);
    setMuted(v);
  };

  const tap = (m: Mode) => {
    if (!isUnlocked(m.id)) {
      Audio.click();
      setShakeId(m.id);
      setTimeout(() => setShakeId(null), 260);
      return;
    }
    Audio.click();
    onPick(m);
  };

  return (
    <div
      className="paper-bg"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
      }}
    >
      {/* top control bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          className="btn-wonk"
          onClick={() => {
            Audio.click();
            onBack();
          }}
          style={{ padding: '8px 16px', minHeight: 44 }}
        >
          ← back
        </button>
        <button
          className="btn-wonk"
          onClick={toggleMute}
          style={{ padding: '8px 16px', minHeight: 44, minWidth: 44 }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className="ms-spacer" />

      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <h2
          className="display"
          style={{
            fontSize: 'clamp(26px, 7vw, 44px)',
            margin: 0,
            color: '#fff',
            textShadow: '3px 3px 0 var(--hot)',
          }}
        >
          PICK YOUR CELEBRATION
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
          maxWidth: 680,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {MODES.map((m) => {
          const locked = !isUnlocked(m.id);
          return (
            <button
              key={m.id}
              className={`btn-wonk ${shakeId === m.id ? 'shake' : ''}`}
              onMouseEnter={() => Audio.hover()}
              onClick={() => tap(m)}
              style={{
                background: locked ? '#cabfa0' : m.bg,
                opacity: locked ? 0.6 : 1,
                padding: 18,
                minHeight: 120,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                textAlign: 'left',
                position: 'relative',
              }}
            >
              {m.hot && !locked && (
                <span
                  className="mono"
                  style={{
                    position: 'absolute',
                    top: -10,
                    right: -8,
                    background: 'var(--hot)',
                    color: '#fff',
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 8,
                    border: '2px solid var(--ink)',
                    transform: 'rotate(6deg)',
                  }}
                >
                  HOT
                </span>
              )}
              <span
                className="display"
                style={{ fontSize: 22, color: 'var(--ink)' }}
              >
                {locked ? '🔒' : m.name}
              </span>
              <span
                className="mono"
                style={{ fontSize: 11, color: 'var(--ink-soft)' }}
              >
                {locked ? 'locked' : m.sample}
              </span>
            </button>
          );
        })}
      </div>

      <div className="ms-spacer-bottom" />

      <div style={{ textAlign: 'center' }}>
        <span
          className="mono"
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}
        >
          🏆 world cup celebrations
        </span>
      </div>
    </div>
  );
}
