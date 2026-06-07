// World Cup celebration FX over the camera feed, shared by every mode:
//   - ambient slow-spinning gold rays
//   - a confetti burst + center flash on each hit (re-spawns on hitKey change)
// Themed by the mode's colors. Sits below the HUD.

import { useMemo } from 'react';

interface Piece {
  x: number;
  color: string;
  cd: number;
  delay: number;
  cr: number;
  w: number;
  h: number;
}

const GOLD = '#ffcf33';

export default function WorldCupFx({
  hitKey,
  colors,
  active,
}: {
  hitKey: number;
  colors: string[];
  active: boolean;
}) {
  const palette = colors.length ? [...colors, GOLD, '#ffffff'] : [GOLD];

  // a fresh confetti batch per hit (keyed by hitKey via useMemo)
  const pieces = useMemo<Piece[]>(() => {
    if (!hitKey) return [];
    return Array.from({ length: 18 }, (_, i) => ({
      x: Math.random() * 100,
      color: palette[i % palette.length],
      cd: 1.8 + Math.random() * 1.2,
      delay: Math.random() * 0.2,
      cr: (Math.random() - 0.5) * 1080,
      w: 7 + Math.random() * 7,
      h: 10 + Math.random() * 10,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitKey]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* ambient gold rays */}
      <div
        className="spin-slow radiant-pulse"
        style={{
          position: 'absolute',
          left: '50%',
          top: '44%',
          width: '170vmax',
          height: '170vmax',
          marginLeft: '-85vmax',
          marginTop: '-85vmax',
          background: `repeating-conic-gradient(from 0deg, ${GOLD}1c 0deg 6deg, transparent 6deg 18deg)`,
          opacity: 0.3,
        }}
      />

      {/* center flash on each hit */}
      {active && hitKey > 0 && (
        <div
          key={`burst-${hitKey}`}
          className="burst"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '64vmin',
            height: '64vmin',
            marginLeft: '-32vmin',
            marginTop: '-32vmin',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${palette[0]}aa 0%, ${GOLD}55 32%, transparent 62%)`,
          }}
        />
      )}

      {/* confetti */}
      {active &&
        pieces.map((p, i) => (
          <span
            key={`${hitKey}-${i}`}
            className="confetti-fall"
            style={
              {
                position: 'absolute',
                left: `${p.x}%`,
                top: 0,
                width: p.w,
                height: p.h,
                background: p.color,
                border: '1px solid rgba(10,31,18,0.4)',
                '--cd': `${p.cd}s`,
                '--cdelay': `${p.delay}s`,
                '--cr': `${p.cr}deg`,
              } as React.CSSProperties
            }
          />
        ))}
    </div>
  );
}
