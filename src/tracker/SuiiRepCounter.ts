// SIUUU — raise your arm(s) to the sky, then lower. Pattern (A) hysteresis.
//
// Robustness (post-review):
//  - fires on the BETTER arm (max of the two), not min — at selfie distance one
//    hand often leaves frame, and intent is "hand(s) up".
//  - foreshortening-proof OR-trigger: also counts a raise when a wrist rises above
//    the NOSE in image space (survives an arm tilted toward the lens + the inflated
//    bodyScale denominator).
//  - shared shoulder-based VisibilityGate (loading no longer strands here).

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { extractFeatures, type UpperBodyFeatures } from './FeatureExtractor';
import {
  emptyDebug,
  type FrameDebug,
  type IRepCounter,
  type RepEvent,
} from './IRepCounter';
import { VisibilityGate } from './VisibilityGate';

const UP_ENTER = 0.18; // max(L,R) wristYRelative above this = raised (shoulder-width scale)
const UP_EXIT = 0.05; // must fall back below this to re-arm
const REFRACTORY_MS = 300;

export class SuiiRepCounter implements IRepCounter {
  private reps = 0;
  private inUp = false;
  private lastFireTs = 0;
  private gate = new VisibilityGate();
  private onRepFn: ((e: RepEvent) => void) | null = null;
  private debug: FrameDebug = emptyDebug();

  onRep(fn: (e: RepEvent) => void) {
    this.onRepFn = fn;
  }
  getReps() {
    return this.reps;
  }
  getDebug() {
    return this.debug;
  }
  reset() {
    this.reps = 0;
    this.inUp = false;
    this.lastFireTs = 0;
    this.gate.reset();
    this.debug = emptyDebug();
  }

  processFrame(lm: NormalizedLandmark[], ts: number) {
    const features: UpperBodyFeatures = extractFeatures(lm);
    const g = this.gate.update(features);
    const base = {
      ...emptyDebug(),
      features,
      wristVisMin: features.anyWristVis,
      visibleNow: g.visibleNow,
      handsReady: g.handsReady,
    };

    if (!g.visibleNow) {
      this.debug = base;
      return;
    }
    if (g.recovered) {
      this.inUp = false;
      this.debug = { ...base, visibilityRecoverySuppressed: true };
      return;
    }

    // raised = better arm above threshold OR a wrist above the nose (foreshorten-proof)
    const best = Math.max(features.left.wristYRelative, features.right.wristYRelative);
    const wristAboveNose =
      features.left.wristY < features.nose.y || features.right.wristY < features.nose.y;
    const isUp = best > UP_ENTER || wristAboveNose;
    const isDown = best < UP_EXIT && !wristAboveNose;

    let firedSide: FrameDebug['firedSide'] = null;
    if (!this.inUp && isUp && ts - this.lastFireTs > REFRACTORY_MS) {
      this.inUp = true;
      this.lastFireTs = ts;
      this.reps += 1;
      firedSide = 'LEFT_UP';
      this.onRepFn?.({
        timestamp: ts,
        arm: 'cross',
        phase: 'sync',
        totalReps: this.reps,
        confidence: features.anyWristVis,
      });
    } else if (this.inUp && isDown) {
      this.inUp = false; // re-arm
    }

    this.debug = {
      ...base,
      combined: best,
      firedSide,
      suii: { both: best, inUp: this.inUp },
    };
  }
}
