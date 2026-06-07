// SIUUU — Cristiano Ronaldo's landing celebration as a TWO-PHASE gesture:
//
//   Phase 1 (ARM):  arms up & together/crossed near the head
//   Phase 2 (FIRE): swing them down & out WIDE to the hips
//
// A rep only fires if FIRE is preceded by ARM — so just standing with your arms
// out won't count; you have to do the whole swing. This is a small state machine
// (idle → armed → fire → idle) layered on pattern-A style thresholds.
//
// Copied from the SuiiRepCounter skeleton — KEEPS the visibility-recovery guard,
// the refractory window, and the getDebug() slice; only the detection logic is new.

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
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

// Tunables — sane defaults; tune on-device via ?debug=1 (§13 step 7).
const UP_ENTER = 0.3; // wristYRelative > this (both) = hands up near head
const UP_NARROW_MAX = 1.2; // horizontal wrist spread/bodyScale < this = together/crossed
const DOWN_MAX = 0.1; // wristYRelative < this (both) = fists low at hips
const WIDE_ENTER = 1.7; // horizontal wrist spread/bodyScale > this = arms wide
const REFRACTORY_MS = 350; // min gap between fires
const ARM_TIMEOUT_MS = 2500; // armed state expires if you don't complete the swing
const VIS_RECOVERY_THRESHOLD = 0.4;
const HANDS_READY_THRESHOLD = 0.5;

export class SiuuRepCounter implements IRepCounter {
  private reps = 0;
  private armed = false;
  private armedAt = 0;
  private lastFireTs = 0;
  private lastFrameVisible = false;
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
    this.armedAt = 0;
    this.lastFireTs = 0;
    this.lastFrameVisible = false;
    this.debug = emptyDebug();
  }

  processFrame(lm: NormalizedLandmark[], ts: number) {
    const features: UpperBodyFeatures = extractFeatures(lm);
    const wristVisMin = Math.min(
      features.left.visibilityMin,
      features.right.visibilityMin
    );
    const visibleNow = wristVisMin > VIS_RECOVERY_THRESHOLD;
    const handsReady = wristVisMin > HANDS_READY_THRESHOLD;

    // 🔒 Visibility recovery — never fire on the re-acquisition frame.
    if (!visibleNow) {
      this.lastFrameVisible = false;
      this.armed = false; // dropping out of frame cancels a pending swing
      this.debug = {
        ...emptyDebug(),
        features,
        wristVisMin,
        visibleNow: false,
        handsReady,
      };
      return;
    }
    if (!this.lastFrameVisible) {
      this.lastFrameVisible = true;
      this.debug = {
        ...emptyDebug(),
        features,
        wristVisMin,
        visibleNow: true,
        handsReady,
        visibilityRecoverySuppressed: true,
      };
      return;
    }

    // --- signals ------------------------------------------------------------
    const wL = lm[L.L_WRIST];
    const wR = lm[L.R_WRIST];
    const hSpread = Math.abs(wL.x - wR.x) / features.bodyScale; // horizontal spread
    const armsUp =
      features.left.wristYRelative > UP_ENTER &&
      features.right.wristYRelative > UP_ENTER;
    const upNarrow = hSpread < UP_NARROW_MAX;
    const bothDown =
      features.left.wristYRelative < DOWN_MAX &&
      features.right.wristYRelative < DOWN_MAX;
    const wide = hSpread > WIDE_ENTER;

    // --- state machine: idle → armed → fire ---------------------------------
    let firedSide: FrameDebug['firedSide'] = null;

    if (this.armed && ts - this.armedAt > ARM_TIMEOUT_MS) {
      this.armed = false; // took too long; require a fresh wind-up
    }

    if (!this.armed) {
      if (armsUp && upNarrow) {
        this.armed = true; // wind-up detected (hands crossed/up near head)
        this.armedAt = ts;
      }
    } else if (
      bothDown &&
      wide &&
      ts - this.lastFireTs > REFRACTORY_MS
    ) {
      // completed the swing down-and-wide → SIUUU
      this.armed = false;
      this.lastFireTs = ts;
      this.reps += 1;
      firedSide = 'LEFT_UP';
      this.onRepFn?.({
        timestamp: ts,
        arm: 'cross',
        phase: 'sync',
        totalReps: this.reps,
        confidence: wristVisMin,
      });
    }

    this.debug = {
      ...emptyDebug(),
      features,
      combined: hSpread,
      wristVisMin,
      visibleNow: true,
      handsReady,
      firedSide,
      siuu: {
        hSpread,
        armsUp,
        upNarrow,
        bothDown,
        wide,
        state: this.armed ? 'ARMED' : 'IDLE',
      },
    };
  }
}
