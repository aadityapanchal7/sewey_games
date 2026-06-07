// 🔒 4.6 initTracker — MediaPipe wiring + the frame loop.
// The per-frame loop NEVER calls setState. React pulls getLastFrame() in its own
// rAF loop. Model tiers: lite on mobile, full on desktop. Models load from the
// MediaPipe CDN — first load is the slow part (that's why the loading screen
// exists).

import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import type { FrameDebug, IRepCounter, RepEvent } from './IRepCounter';
import { pickCounter } from './registry';

// Pin WASM to the EXACT installed JS version so the proto decoder and bindings
// always agree (a skew can silently zero out landmark visibility).
const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const POSE_MODEL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
};

export interface LastFrame {
  poseLandmarks: NormalizedLandmark[] | null;
  debug: FrameDebug;
  cameraFps: number;
  landmarkFps: number;
  modelTier: 'lite' | 'full';
  firstLandmarkAt: number | null;
  handsReady: boolean;
}

export interface TrackerHandle {
  counter: IRepCounter;
  stop: () => void;
  getLastFrame: () => LastFrame | null;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const uaMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|Windows Phone/i.test(
    ua
  );
  const touch = (navigator.maxTouchPoints ?? 0) > 1;
  return uaMobile || (touch && window.innerWidth < 900);
}

// rolling 1-second FPS window
function makeFps() {
  let stamps: number[] = [];
  return {
    tick(now: number) {
      stamps.push(now);
      const cutoff = now - 1000;
      while (stamps.length && stamps[0] < cutoff) stamps.shift();
    },
    get() {
      return stamps.length;
    },
  };
}

export async function initTracker(
  video: HTMLVideoElement,
  mode: string,
  onRep: (e: RepEvent) => void
): Promise<TrackerHandle> {
  const mobile = isMobileDevice();
  const tier: 'lite' | 'full' = mobile ? 'lite' : 'full';

  const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
  const pose = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL[tier], delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.4, // easier partial-body acquisition (selfie framing)
    minTrackingConfidence: 0.4,
  });

  const counter: IRepCounter = pickCounter(mode);
  counter.onRep(onRep);

  let stopped = false;
  let last: LastFrame | null = null;
  let firstLandmarkAt: number | null = null;
  const cam = makeFps();
  const land = makeFps();

  const loop = () => {
    if (stopped) return;
    if (video.readyState >= 2) {
      const now = performance.now();
      cam.tick(now);
      const res = pose.detectForVideo(video, now);
      const lm = res.landmarks?.[0] ?? null;
      if (lm) {
        land.tick(now);
        if (firstLandmarkAt === null) firstLandmarkAt = now;
        counter.processFrame(lm, now); // ← per-frame, NO setState
      }
      const debug = counter.getDebug();
      last = {
        poseLandmarks: lm,
        debug,
        cameraFps: cam.get(),
        landmarkFps: land.get(),
        modelTier: tier,
        firstLandmarkAt,
        handsReady: !!debug.handsReady,
      };
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    counter,
    stop: () => {
      stopped = true;
      pose.close();
    },
    getLastFrame: () => last,
  };
}
