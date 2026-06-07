// GUESS THE GOAT - point LEFT or RIGHT at a card, hold to lock the answer. Emits a
// RepEvent whose `arm` carries the chosen side; InGame decides correctness.
//
// Robustness (post-review):
//  - side is decided relative to the user's OWN mirrored shoulder-mid x (with a small
//    margin), not an absolute 0.45/0.55 dead-zone that swallowed a centered selfie user.
//  - pointer = the raised arm with the greatest LATERAL displacement (the idle hanging
//    arm can't veto or get mis-selected).
//  - a brief dropout (<150ms) doesn't reset the hold timer.
//  - shared shoulder-based VisibilityGate.

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { extractFeatures, type UpperBodyFeatures } from './FeatureExtractor';
import {
  emptyDebug,
  type FrameDebug,
  type IRepCounter,
  type RepEvent,
} from './IRepCounter';
import { VisibilityGate } from './VisibilityGate';

const RAISE_MIN = 0.05; // wristYRelative above this = hand lifted enough to point
const MARGIN = 0.05; // mirrored-x must clear shoulder-mid by this to pick a side
const HOLD_MS = 450; // hold the point this long to lock the answer
const GRACE_MS = 150; // tolerate a brief loss of the point without resetting

type Side = 'left' | 'right';

export class GuessPlayerCounter implements IRepCounter {
  private reps = 0;
  private candidate: Side | null = null;
  private sideSince = 0;
  private lostAt = 0;
  private emitted = false;
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
    this.candidate = null;
    this.sideSince = 0;
    this.lostAt = 0;
    this.emitted = false;
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
      this.candidate = null;
      this.emitted = false;
      this.debug = { ...base, visibilityRecoverySuppressed: true };
      return;
    }

    const sdisp = 1 - features.shoulderMidX; // mirrored shoulder-mid x
    // raised arms, with their mirrored-x and lateral displacement from body centre
    const arms = [features.left, features.right]
      .filter((a) => a.wristYRelative > RAISE_MIN)
      .map((a) => {
        const disp = 1 - a.wristX;
        return { disp, lateral: Math.abs(disp - sdisp) };
      });

    let side: Side | null = null;
    if (arms.length) {
      const pointer = arms.reduce((m, a) => (a.lateral > m.lateral ? a : m));
      if (pointer.disp < sdisp - MARGIN) side = 'left';
      else if (pointer.disp > sdisp + MARGIN) side = 'right';
    }

    // hold tracking with grace
    if (side) {
      if (side !== this.candidate) {
        this.candidate = side;
        this.sideSince = ts;
        this.emitted = false;
      }
      this.lostAt = 0;
    } else if (this.candidate) {
      if (this.lostAt === 0) this.lostAt = ts;
      if (ts - this.lostAt > GRACE_MS) {
        this.candidate = null;
        this.emitted = false;
        this.lostAt = 0;
      }
    }

    const holdMs = this.candidate ? ts - this.sideSince : 0;
    let firedSide: FrameDebug['firedSide'] = null;
    if (this.candidate && !this.emitted && holdMs >= HOLD_MS) {
      this.emitted = true;
      this.reps += 1;
      firedSide = this.candidate === 'left' ? 'LEFT_UP' : 'RIGHT_UP';
      this.onRepFn?.({
        timestamp: ts,
        arm: this.candidate,
        phase: 'mixed',
        totalReps: this.reps,
        confidence: features.anyWristVis,
      });
    }

    this.debug = {
      ...base,
      firedSide,
      guess: {
        side: this.candidate,
        holdMs,
        progress: this.candidate ? Math.min(1, holdMs / HOLD_MS) : 0,
        raisedL: features.left.wristYRelative > RAISE_MIN,
        raisedR: features.right.wristYRelative > RAISE_MIN,
      },
    };
  }
}
