// SAMBA DRUMS - hands up in front, drum them up & down. Each down-stroke = 1 rep.
//
// Robustness (post-review):
//  - REMOVED the elbow "extended" hard gate: when arms point toward the camera the
//    2D elbow angle foreshortens to ~90-130°, so the gate punished CORRECT form and
//    reset `armed` every frame. Vertical hysteresis + refractory are enough.
//  - drives `level` from the better-visibility arm (one garbage arm can't damp it).
//  - fires on a relative DROP from a short rolling max, so it works regardless of
//    the absolute baseline / camera height.
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

const HIGH_ENTER = 0.06; // level above this = "hands up", arm for the smack
const DROP = 0.1; // level must fall this far below the armed peak = drum hit
const LOW_FLOOR = -0.04; // ...or simply fall below this absolute level
const REFRACTORY_MS = 120;

export class DrumRepCounter implements IRepCounter {
  private reps = 0;
  private armed = false;
  private peak = 0;
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
    this.armed = false;
    this.peak = 0;
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
      this.armed = false;
      this.debug = { ...base, visibilityRecoverySuppressed: true };
      return;
    }

    // level from the better-visibility arm
    const level =
      features.left.wristVis >= features.right.wristVis
        ? features.left.wristYRelative
        : features.right.wristYRelative;

    let firedSide: FrameDebug['firedSide'] = null;
    if (!this.armed) {
      if (level > HIGH_ENTER) {
        this.armed = true;
        this.peak = level;
      }
    } else {
      if (level > this.peak) this.peak = level;
      const dropped = level < this.peak - DROP || level < LOW_FLOOR;
      if (dropped && ts - this.lastFireTs > REFRACTORY_MS) {
        this.armed = false;
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
      }
    }

    this.debug = {
      ...base,
      combined: level,
      firedSide,
      drum: { level, armed: this.armed, peak: this.peak },
    };
  }
}
