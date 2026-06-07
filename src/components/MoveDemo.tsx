// MoveDemo - a small stick figure that demonstrates the celebration for a given
// mode on the ready-prompt, so players see HOW to move before the countdown.
// Pure SVG + CSS (see index.css §7.6) - no assets.
//
// Arms = an upper-arm group (pivots at the shoulder) wrapping a fore-arm group
// (pivots at the elbow). Legs = groups pivoting at the hip. Mode-specific CSS
// classes drive each part; some modes are static (no animation).

const STROKE = 'var(--ink)';
const HIP = { x: 50, y: 78 };

// One arm. Mode classes (md-<mode>-<side>, md-<mode>-<side>-fore) drive rotation.
function Arm({ side, mode }: { side: 'left' | 'right'; mode: string }) {
  const sx = side === 'left' ? 38 : 62; // shoulder x on the 100x120 viewbox
  const sy = 46;
  return (
    <g className={`md-upper md-${mode}-${side}`} style={{ transformOrigin: `${sx}px ${sy}px` }}>
      {/* upper arm: shoulder -> elbow */}
      <line x1={sx} y1={sy} x2={sx} y2={sy + 16} stroke={STROKE} strokeWidth={4} strokeLinecap="round" />
      <g
        className={`md-fore md-${mode}-${side}-fore`}
        style={{ transformOrigin: `${sx}px ${sy + 16}px` }}
      >
        {/* fore-arm: elbow -> hand */}
        <line x1={sx} y1={sy + 16} x2={sx} y2={sy + 30} stroke={STROKE} strokeWidth={4} strokeLinecap="round" />
        <circle cx={sx} cy={sy + 32} r={3.5} fill={STROKE} />
      </g>
    </g>
  );
}

// One leg, pivoting at the hip. Mode class md-<mode>-leg-<side> can spread it.
function Leg({ side, mode }: { side: 'left' | 'right'; mode: string }) {
  const footX = side === 'left' ? 40 : 60;
  return (
    <g className={`md-leg md-${mode}-leg-${side}`} style={{ transformOrigin: `${HIP.x}px ${HIP.y}px` }}>
      <line x1={HIP.x} y1={HIP.y} x2={footX} y2={104} stroke={STROKE} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}

// The jointed arm rig can't reach the opposite armpit, so MBAPPÉ gets a dedicated
// crossed-arms drawing: two straight forearms drawn as an explicit X over the
// chest, hands tucked at the far shoulders - the iconic folded-arms pose.
function CrossedArms() {
  return (
    <>
      {/* right shoulder -> left armpit */}
      <line x1="62" y1="46" x2="40" y2="60" stroke={STROKE} strokeWidth={4} strokeLinecap="round" />
      {/* left shoulder -> right armpit (drawn on top, so it reads as crossed) */}
      <line x1="38" y1="46" x2="60" y2="60" stroke={STROKE} strokeWidth={4} strokeLinecap="round" />
      {/* hands tucked at the far shoulders */}
      <circle cx="40" cy="60" r={3.5} fill={STROKE} />
      <circle cx="60" cy="60" r={3.5} fill={STROKE} />
    </>
  );
}

export default function MoveDemo({ mode }: { mode: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      width="120"
      height="144"
      role="img"
      aria-label="how to move"
      style={{ display: 'block', margin: '0 auto' }}
    >
      {/* head */}
      <circle cx="50" cy="22" r="11" fill="none" stroke={STROKE} strokeWidth={4} />
      {/* torso */}
      <line x1="50" y1="33" x2="50" y2="78" stroke={STROKE} strokeWidth={4} strokeLinecap="round" />
      {/* shoulders */}
      <line x1="38" y1="46" x2="62" y2="46" stroke={STROKE} strokeWidth={4} strokeLinecap="round" />

      {/* legs */}
      <Leg side="left" mode={mode} />
      <Leg side="right" mode={mode} />

      {/* arms - MBAPPÉ uses the dedicated crossed-arms drawing; others the rig */}
      {mode === 'mbappe' ? (
        <CrossedArms />
      ) : (
        <>
          <Arm side="left" mode={mode} />
          <Arm side="right" mode={mode} />
        </>
      )}
    </svg>
  );
}
