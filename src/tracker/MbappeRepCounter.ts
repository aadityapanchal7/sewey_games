// MBAPPÉ - fold both hands onto your chest, open out, then fold back = 1 rep.
//
// Robustness (post-review):
//  - distances normalized by SHOULDER WIDTH (not the hip-inflated bodyScale), which
//    gives a much wider fold↔unfold separation at selfie distance.
//  - "unfolded" = the FARTHER wrist leaves (distMax) OR an arm extends (elbow angle);
//    "on chest" = the NEARER wrist arrives (distMin). The old "both wrists past 1.35"
//    never armed for an asymmetric/quick unfold.
//  - shared shoulder-based VisibilityGate.

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  dist,
  extractFeatures,
  L,
  type UpperBodyFeatures,
} from './FeatureExtractor';
import {
  emptyDebug,
  type FrameDebug,
  type IRepCounter,
  type RepEvent,
} from './IRepCounter';
import { VisibilityGate } from './VisibilityGate';

const CHEST_RADIUS = 1.0; // nearer wrist within this (×shoulderWidth) of chest = folded
const RELEASE = 1.5; // farther wrist beyond this = unfolded
const ELBOW_OPEN = 120; // ...or an arm extended past this angle = unfolded
const REFRACTORY_MS = 350;

export class MbappeRepCounter implements IRepCounter {
  private reps = 0;
  private hasLeft = false;
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
    this.hasLeft = false;
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
      this.debug = { ...base, visibilityRecoverySuppressed: true };
      return;
    }

    const sL = lm[L.L_SHOULDER];
    const sR = lm[L.R_SHOULDER];
    const chest = { x: (sL.x + sR.x) / 2, y: (sL.y + sR.y) / 2 };
    const wL = lm[L.L_WRIST];
    const wR = lm[L.R_WRIST];
    const dL = dist({ x: wL.x, y: wL.y }, chest) / features.shoulderWidth;
    const dR = dist({ x: wR.x, y: wR.y }, chest) / features.shoulderWidth;
    const distMax = Math.max(dL, dR);
    const distMin = Math.min(dL, dR);
    const maxElbow = Math.max(features.left.elbowAngle, features.right.elbowAngle);

    const onChest = distMin < CHEST_RADIUS;
    const unfolded = distMax > RELEASE || maxElbow > ELBOW_OPEN;

    let firedSide: FrameDebug['firedSide'] = null;
    if (unfolded) {
      this.hasLeft = true;
    } else if (onChest && this.hasLeft && ts - this.lastFireTs > REFRACTORY_MS) {
      this.hasLeft = false;
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

    this.debug = {
      ...base,
      combined: distMin,
      firedSide,
      mbappe: { distMax, distMin, onChest, hasLeft: this.hasLeft },
    };
  }
}
