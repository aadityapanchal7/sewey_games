// Landing (Ready Gate). Wordmark + ONE big play button + a small credit.
// NOTHING async fires before the tap. World Cup arena vibe.

export default function Landing({ onPlay }: { onPlay: () => void }) {
  return (
    <div
      className="grid-bg"
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
      <div className="trophy-bob" style={{ fontSize: 72, lineHeight: 1 }}>
        🏆
      </div>

      <div className="tape" style={{ padding: '6px 18px' }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--ink)' }}>
          on-device · nothing uploaded
        </span>
      </div>

      <h1
        className="display"
        style={{
          fontSize: 'clamp(40px, 12vw, 86px)',
          textAlign: 'center',
          color: '#fff',
          textShadow: '4px 4px 0 var(--hot), 7px 7px 0 var(--ink)',
          margin: 0,
        }}
      >
        WORLD CUP
        <br />
        <span style={{ color: 'var(--gold)' }}>CELEBRATIONS</span>
      </h1>

      <button
        className="btn-wonk wobble"
        onClick={onPlay}
        style={{
          fontSize: 28,
          padding: '20px 56px',
          background: 'var(--gold)',
          marginTop: 4,
        }}
      >
        <span className="display">PLAY ▶</span>
      </button>

      <p
        className="mono"
        style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}
      >
        camera on · strike the celebration · score goals
      </p>
    </div>
  );
}
