// 8. StubScreen — placeholder for modes that aren't wired yet (mode.wired:false).

import type { Mode } from '../modes';

export default function StubScreen({
  mode,
  onBack,
}: {
  mode: Mode;
  onBack: () => void;
}) {
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
        gap: 20,
        padding: 24,
      }}
    >
      <div className="wonk-lg" style={{ padding: 28, textAlign: 'center' }}>
        <h2 className="display" style={{ fontSize: 32, margin: 0 }}>
          {mode.name}
        </h2>
        <p className="mono" style={{ fontSize: 12, marginTop: 12 }}>
          coming soon
        </p>
      </div>
      <button
        className="btn-wonk"
        onClick={onBack}
        style={{ padding: '12px 28px' }}
      >
        ← back
      </button>
    </div>
  );
}
