// Per-mode visual layer for the SIUUU game (like BRB's SuiiSkeleton). Renders the
// radiant World Cup atmosphere over the camera feed:
//   - slow-spinning gold sunburst rays (ambient "radiant" glow)
//   - a gold sunburst BURST that fires on every hit (re-mounts on hitKey change)
//   - a red/green vignette so the whole screen reads Portugal
//
// Mounted by InGame only while mode.id === 'siuu'. Sits BELOW the HUD.

import { PT_GREEN, PT_RED, RADIANT_GOLD } from '../modes';

const rays = (color: string) =>
  `repeating-conic-gradient(from 0deg, ${color} 0deg 6deg, transparent 6deg 18deg)`;

export default function SiuuLayer({
  hitKey,
  streak,
  active,
}: {
  hitKey: number;
  streak: number;
  active: boolean;
}) {
  // glow intensifies with streak
  const heat = Math.min(1, streak / 8);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* red/green Portugal vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, transparent 45%, ${PT_GREEN}33 80%, ${PT_RED}55 130%)`,
        }}
      />

      {/* ambient slow-spinning gold rays */}
      <div
        className="spin-slow radiant-pulse"
        style={{
          position: 'absolute',
          left: '50%',
          top: '46%',
          width: '160vmax',
          height: '160vmax',
          marginLeft: '-80vmax',
          marginTop: '-80vmax',
          background: rays(`${RADIANT_GOLD}22`),
          opacity: 0.3 + heat * 0.3,
        }}
      />

      {/* per-hit gold sunburst — re-mounts each hit so the burst replays */}
      {active && (
        <div
          key={hitKey}
          className="burst"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '70vmin',
            height: '70vmin',
            marginLeft: '-35vmin',
            marginTop: '-35vmin',
            background: `radial-gradient(circle, ${RADIANT_GOLD}cc 0%, ${RADIANT_GOLD}55 30%, transparent 60%), ${rays(
              `${RADIANT_GOLD}88`
            )}`,
            borderRadius: '50%',
          }}
        />
      )}
    </div>
  );
}
