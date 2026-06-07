// 🔒 4.2 FeatureExtractor - landmark indices + body-scale normalization.
//
// ROBUSTNESS (post-review): the original bodyScale = shoulderMid→hipMid distance
// breaks for the real user - a kid holding a phone close, hips OFF-SCREEN. MediaPipe
// still emits EXTRAPOLATED hip coords pushed below the frame, which inflates and
// jitters bodyScale, so every normalized threshold becomes unreachable. We now
// anchor bodyScale on SHOULDER WIDTH (always in-frame, stable) and only trust the
// hip-based torso height when both hips are actually visible.

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export const L = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
} as const;

export interface ArmFeatures {
  elbowAngle: number; // degrees, 0..180
  wristYRelative: number; // (shoulderY - wristY) / bodyScale; + when wrist above shoulder
  visibilityMin: number; // min(shoulder, elbow, wrist) visibility
  wristVis: number; // wrist visibility alone
  wristX: number; // raw normalized x of the wrist
  wristY: number; // raw normalized y of the wrist
}

export interface UpperBodyFeatures {
  left: ArmFeatures;
  right: ArmFeatures;
  bodyScale: number; // robust scale (shoulder-width anchored)
  shoulderWidth: number; // dist(L_SHOULDER, R_SHOULDER), raw normalized
  shoulderMidX: number; // raw normalized x of shoulder midpoint
  shoulderVisMax: number; // max(L_SHOULDER, R_SHOULDER) visibility - gate basis
  anyWristVis: number; // max wrist visibility of the two arms
  hipsValid: boolean; // both hips actually visible (>0.5)
  usedHipScale: boolean; // which scale branch produced bodyScale (for debug)
  nose: { x: number; y: number; visibility: number };
  tHasValidFrame: boolean;
}

type V = { x: number; y: number };

const inFrame = (lm: NormalizedLandmark): boolean =>
  lm.x >= -0.08 && lm.x <= 1.08 && lm.y >= -0.08 && lm.y <= 1.08;

// Defuse the `?? 0` landmine: if a landmark exists with valid in-frame x/y but the
// model didn't populate visibility, treat it as visible rather than coercing to 0
// (a missing-metadata gap should not zero out the whole detection pipeline).
const vis = (lm: NormalizedLandmark | undefined): number => {
  if (lm == null) return 0;
  if (typeof lm.visibility === 'number' && lm.visibility > 0) return lm.visibility;
  return inFrame(lm) ? 1 : 0;
};

const pt = (lm: NormalizedLandmark | undefined): V => ({
  x: lm?.x ?? 0,
  y: lm?.y ?? 0,
});

export function dist(a: V, b: V): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const mid = (a: V, b: V): V => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// joint angle at `vertex`, formed by rays to `a` and `c`. degrees 0..180.
export function angleAt(vertex: V, a: V, c: V): number {
  const v1x = a.x - vertex.x;
  const v1y = a.y - vertex.y;
  const v2x = c.x - vertex.x;
  const v2y = c.y - vertex.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 < 1e-6 || m2 < 1e-6) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function armFeatures(
  lm: NormalizedLandmark[],
  shoulderI: number,
  elbowI: number,
  wristI: number,
  bodyScale: number
): ArmFeatures {
  const shoulder = pt(lm[shoulderI]);
  const elbow = pt(lm[elbowI]);
  const wrist = pt(lm[wristI]);
  return {
    elbowAngle: angleAt(elbow, shoulder, wrist),
    // y grows downward, so (shoulderY - wristY) is positive when wrist is ABOVE.
    wristYRelative: (shoulder.y - wrist.y) / bodyScale,
    visibilityMin: Math.min(vis(lm[shoulderI]), vis(lm[elbowI]), vis(lm[wristI])),
    wristVis: vis(lm[wristI]),
    wristX: wrist.x,
    wristY: wrist.y,
  };
}

export function extractFeatures(lm: NormalizedLandmark[]): UpperBodyFeatures {
  const shoulderL = pt(lm[L.L_SHOULDER]);
  const shoulderR = pt(lm[L.R_SHOULDER]);
  const shoulderMid = mid(shoulderL, shoulderR);
  const hipMid = mid(pt(lm[L.L_HIP]), pt(lm[L.R_HIP]));

  const shoulderWidth = Math.max(dist(shoulderL, shoulderR), 1e-3);
  const hipsValid = Math.min(vis(lm[L.L_HIP]), vis(lm[L.R_HIP])) > 0.5;
  const torsoH = dist(shoulderMid, hipMid);

  // Anchor on shoulder width; use real torso height only when hips are trustworthy.
  const rawScale = hipsValid ? torsoH : shoulderWidth * 1.8;
  // Clamp so a collapsed/exploded estimate can't wreck the ratio.
  const bodyScale = Math.min(
    Math.max(rawScale, shoulderWidth * 1.2, 0.12),
    Math.max(shoulderWidth * 2.4, 0.6)
  );

  const left = armFeatures(lm, L.L_SHOULDER, L.L_ELBOW, L.L_WRIST, bodyScale);
  const right = armFeatures(lm, L.R_SHOULDER, L.R_ELBOW, L.R_WRIST, bodyScale);

  const shoulderVisMax = Math.max(vis(lm[L.L_SHOULDER]), vis(lm[L.R_SHOULDER]));
  const anyWristVis = Math.max(left.wristVis, right.wristVis);
  const noseLm = lm[L.NOSE];

  return {
    left,
    right,
    bodyScale,
    shoulderWidth,
    shoulderMidX: shoulderMid.x,
    shoulderVisMax,
    anyWristVis,
    hipsValid,
    usedHipScale: hipsValid,
    nose: { x: noseLm?.x ?? 0.5, y: noseLm?.y ?? 0, visibility: vis(noseLm) },
    tHasValidFrame: shoulderVisMax > 0.3,
  };
}
