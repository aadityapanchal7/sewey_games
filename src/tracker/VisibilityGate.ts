// Shared visibility gate for every counter. Replaces the copy-pasted wrist-based
// gate that stranded the loading screen and dropped frames mid-motion.
//
// Key changes vs the old per-counter block:
//  - gates on SHOULDER visibility (reliably in-frame), not min() of both wrists
//    (wrists are the least reliable joint, worst exactly when raised/pointed).
//  - handsReady is STICKY (hysteresis) so a single-frame flicker can't reset the
//    loading promotion timer.
//  - only treats the user as "gone" after a SUSTAINED dropout (>=3 frames), and
//    suppresses just one frame on the way back — not on every flicker.

import type { UpperBodyFeatures } from './FeatureExtractor';

const VIS_GATE = 0.25; // shoulderVisMax above this = process the frame
const READY_ENTER = 0.3;
const READY_EXIT = 0.2;
const DROPOUT_FRAMES = 3; // consecutive invisible frames before we call it a real dropout

export interface GateResult {
  visibleNow: boolean; // process this frame at all?
  handsReady: boolean; // sticky "upper body is framed, ready to play"
  recovered: boolean; // first frame back after a sustained dropout → fire nothing, re-arm
}

export class VisibilityGate {
  private invisibleFrames = 0;
  private wasVisible = false;
  private ready = false;

  reset() {
    this.invisibleFrames = 0;
    this.wasVisible = false;
    this.ready = false;
  }

  update(f: UpperBodyFeatures): GateResult {
    const shoulderVis = f.shoulderVisMax;
    const visibleNow = shoulderVis > VIS_GATE;

    if (!visibleNow) {
      this.invisibleFrames += 1;
      if (this.invisibleFrames >= DROPOUT_FRAMES) {
        this.wasVisible = false;
        this.ready = false;
      }
      return { visibleNow: false, handsReady: this.ready, recovered: false };
    }

    const sustainedDropout = this.invisibleFrames >= DROPOUT_FRAMES;
    this.invisibleFrames = 0;
    const recovered = !this.wasVisible && sustainedDropout;
    this.wasVisible = true;

    // sticky handsReady (shoulders + at least one wrist to enter; shoulders to stay)
    if (!this.ready) {
      if (shoulderVis > READY_ENTER && f.anyWristVis > READY_ENTER) this.ready = true;
    } else if (shoulderVis < READY_EXIT) {
      this.ready = false;
    }

    return { visibleNow: true, handsReady: this.ready, recovered };
  }
}
