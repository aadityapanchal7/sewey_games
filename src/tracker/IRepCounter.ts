// 🔒 4.3 The extension point - the single seam between the reusable substrate
// and your game. Each mechanic implements IRepCounter; everything else is reused.

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { UpperBodyFeatures } from './FeatureExtractor';

export interface RepEvent {
  timestamp: number;
  arm: 'left' | 'right' | 'cross';
  phase: 'alternating' | 'sync' | 'mixed';
  totalReps: number;
  confidence: number;
}

export interface FrameDebug {
  features: UpperBodyFeatures | null;
  combined: number | null;
  leftVel: number | null;
  rightVel: number | null;
  quorum: { left: number; right: number };
  firedSide: 'LEFT_UP' | 'RIGHT_UP' | null;
  visibilityRecoverySuppressed: boolean;
  visibleNow: boolean;
  handsReady: boolean;
  wristVisMin: number;
  // 🎛 per-mechanic debug slice (added by each counter), e.g.:
  //   suii?: { both: number; inUp: boolean }
  [key: string]: unknown;
}

export interface IRepCounter {
  onRep(fn: (e: RepEvent) => void): void;
  processFrame(lm: NormalizedLandmark[], ts: number): void;
  getReps(): number;
  getDebug(): FrameDebug;
  reset(): void;
}

export const emptyDebug = (): FrameDebug => ({
  features: null,
  combined: null,
  leftVel: null,
  rightVel: null,
  quorum: { left: 0, right: 0 },
  firedSide: null,
  visibilityRecoverySuppressed: false,
  visibleNow: false,
  handsReady: false,
  wristVisMin: 0,
});
