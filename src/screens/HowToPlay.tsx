// How-to-play overlay - a full-screen panel listing every game and the steps to
// perform it. Reads MODES (the single source of truth) so it stays in sync as
// games are added/edited. Opened from the ModeSelect "how to play" button.

import { Audio } from '../audio';
import { MODES } from '../modes';

export default function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(10, 31, 18, 0.82)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 16,
      }}
    >
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: 560,
          marginBottom: 12,
        }}
      >
        <h2
          className="display"
          style={{
            fontSize: 'clamp(22px, 6vw, 34px)',
            margin: 0,
            color: '#fff',
            textShadow: '3px 3px 0 var(--hot)',
          }}
        >
          HOW TO PLAY
        </h2>
        <button
          className="btn-wonk"
          onClick={() => {
            Audio.click();
            onClose();
          }}
          style={{ padding: '8px 16px', minHeight: 44, background: 'var(--gold)' }}
        >
          <span className="display" style={{ fontSize: 16 }}>
            ✕
          </span>
        </button>
      </div>

      {/* how-it-works strip */}
      <div
        className="wonk-sm"
        style={{
          width: '100%',
          maxWidth: 560,
          padding: '10px 14px',
          marginBottom: 12,
          background: 'var(--paper)',
        }}
      >
        <div style={{ fontSize: 14, color: 'var(--ink)' }}>
          📷 It’s a <b>camera game</b> - strike each celebration with your body and the
          webcam counts your score. Runs <b>on-device</b>; nothing is uploaded.
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6 }}>
          stand back so your head + hands fit · each round is 20 seconds
        </div>
      </div>

      {/* per-game cards (scrollable) */}
      <div
        className="no-scrollbar"
        style={{
          width: '100%',
          maxWidth: 560,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingBottom: 8,
        }}
      >
        {MODES.map((m) => (
          <div key={m.id} className="wonk" style={{ padding: 14, background: m.bg }}>
            <div className="display" style={{ fontSize: 20, color: 'var(--ink)' }}>
              {m.emoji} {m.name}
            </div>
            <ol
              style={{
                margin: '8px 0 0',
                paddingLeft: 20,
                color: 'var(--ink)',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {m.howTo.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 8 }}>
              📸 {m.framingHint}
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn-wonk ready-pulse"
        onClick={() => {
          Audio.click();
          onClose();
        }}
        style={{ marginTop: 12, padding: '12px 32px', background: 'var(--lime)' }}
      >
        <span className="display">got it ▶</span>
      </button>
    </div>
  );
}
