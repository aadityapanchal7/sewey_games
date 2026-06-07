# Vision Game Blueprint — build a camera/pose-driven motion game with this exact setup & feel

> **What this document is.** A complete, self-contained spec for reproducing the
> architecture, performance characteristics, visual/audio "feel," and engineering
> conventions of **Brain Rot Battles** (BRB) — a browser-based, mobile-first,
> MediaPipe-pose-driven motion game — on a **different game concept**.
>
> **How to use it (read this first).** Feed this file into a fresh repo along with
> your new game idea. Then:
> 1. **KEEP VERBATIM** everything marked 🔒 — the tracker math, filter constants,
>    the Ready Gate, the per-frame performance rule, the design tokens. These are
>    the "feel" and the things that break subtly if reinvented.
> 2. **ADAPT** everything marked 🎛 — the specific game mechanic, the mode list,
>    the copy/theme, the scoring rule. This is where *your* game lives.
> 3. Work the **Porting Playbook (§13)** — it's a decision procedure that turns
>    "my game is "X"" into a concrete list of files to write.
>
> Throughout, **BRB's "67 wrist-pump" game is the worked example**, not the target.
> Your game will have a different motion (a squat counter, a head-dodge, a
> hand-clap rhythm game, a balance hold, whatever). The engine and the feel stay
> the same; only the *mechanic layer* changes.

---

## 0. The feel, in one paragraph

A kid is bored in class on their phone. They open a URL, tap one big wobbly
button, point the webcam at themselves, and within seconds they're frantically
doing some absurd physical motion while a meme-styled HUD counts "reps," cartoon
words fly off the screen, chiptune SFX fire on every hit, and a 20-second timer
runs out. Everything is **mobile-first, instant, offline-capable, privacy-safe
(camera never leaves the device), and loud/wonky/funny**. Nothing serious,
nothing laggy, nothing that asks you to read. That tone — *immediate, tactile,
meme-native, zero-friction* — is the product. Preserve it.

---

## 1. The laws (non-negotiable principles)

These are ranked. When in doubt, obey the earlier one.

### 1.1 🔒 The Ready Gate is law
**Nothing async, sensor-touching, or network-touching fires before the user's
first explicit tap on the landing screen.** No `AudioContext`, no
`getUserMedia`, no MediaPipe init, no model download, no auth, no preloads. The
landing screen is *wordmark + one button + nothing else*. Every expensive thing
is unlocked **inside the click handler** of that button (browser autoplay/gesture
policies require this, and it keeps first paint instant). This is an
architectural constraint, not a UX preference — do not bypass it "for testing."

### 1.2 🔒 The tracker substrate is law
The smoothing filter, its constants, the feature math, and the detector
thresholds are **tuned, fragile, and verbatim**. The `OneEuroFilter` constants
are `mincutoff = 1.0`, `beta = 0.007`. Do not "improve" the math, the state
transitions, or the thresholds. If something seems wrong, *say so before
changing it*. (BRB shipped a v1 bug precisely because an LLM "improved" the
filter math.)

### 1.3 🔒 The tracker callback is NOT a React re-render
The per-frame tracker loop runs at camera framerate (~30–60 Hz). **It must never
call `setState`.** Per-frame values live in `useRef` and are written directly to
the DOM (e.g. `element.style.left = ...`) inside a `requestAnimationFrame` loop.
React state updates fire **only** on discrete game events — a completed rep (the
`onRep` callback, ~2–10 Hz), a phase change, the per-second timer. Violating this
is the #1 source of "the game lags."

### 1.4 🔒 Verbatim is verbatim
When this doc (or a referenced source file) says "keep verbatim," reproduce it
character-for-character. Reserved for the substrate (§4) and the design tokens
(§7).

### 1.5 Mobile-first
Unprefixed styles = mobile portrait base. `md:`/`lg:` (≥768px) are *upgrades*.
Touch targets ≥ 44×44px. Body/input text ≥ 16px (smaller triggers iOS
auto-zoom-on-focus). One screen, no scroll where avoidable.

### 1.6 Debug overlay first
For anything sensor/motion/camera-dependent, build the **debug overlay before the
feature**. You cannot validate a pose detector from a phone without seeing the
live signal values. The overlay reads the same `FrameDebug` the detector emits.

### 1.7 Diagnose before fixing
For a motion bug, write **three ranked hypotheses** before touching code. Sensor
features are non-deterministic; guessing wastes the user's testing time.

---

## 2. Tech stack (exact, and why)

| Concern | Choice | Why (keep unless you have a reason) |
|---|---|---|
| Framework | **Next.js 15 App Router** | SSR shell + static export friendliness, API routes for uploads/tokens |
| UI | **React 19** + **TypeScript** | `useSyncExternalStore`, concurrent-safe |
| Styling | **Tailwind 3** + CSS custom properties | utility classes + design tokens (§7) |
| Vision | **@mediapipe/tasks-vision** (`PoseLandmarker`, `FaceLandmarker`) | on-device, GPU-delegated, no upload |
| Audio | **howler** | survives mobile autoplay policy where raw `<audio>` fails |
| State | plain modules + `useSyncExternalStore` | stores are local-first modules; **no Redux/zustand needed** |
| Analytics | `@vercel/analytics` | one event per real round |
| Uploads (optional) | `@vercel/blob` | client-upload tokens via a route handler |
| Auth/backend (optional) | **Firebase Auth + Supabase** | see §10 |
| Deploy | **Vercel** | preview-per-branch |

**App entry shape (KEEP):** `app/page.tsx` is a thin `'use client'` wrapper that
renders `src/App.tsx`. The whole game is effectively a single-page client app
inside Next; `App.tsx` is a `useState` **screen machine**. `app/layout.tsx` holds
`<head>` font preconnects + the metadata/viewport (`viewport-fit=cover`,
`themeColor`).

```
app/
  layout.tsx          # fonts, metadata, viewport
  page.tsx            # 'use client' → <App/>
  api/                # (optional) route handlers (upload tokens, etc.)
src/
  App.tsx             # screen machine (landing→modes→ingame→result→submit)
  modes.ts            # 🎛 the Mode[] config — drives everything
  audio.ts            # Howler-backed synthesized audio (§6)
  index.css           # 🔒 design tokens + wonk classes + keyframes (§7)
  screens/            # Landing, ModeSelect, InGame, ResultCard, StubScreen, Submit
  components/         # Glyphs, DebugOverlay, HUD bits, per-mode visual layers
  store/              # scores.ts, unlocks.ts (local-first, merge-ready)
  tracker/            # 🔒 the vision substrate (§4) + per-mechanic counters
  auth/               # (optional) firebase + supabase (§10)
```

---

## 3. The screen machine (App.tsx)

🎛 Adapt the screen *names/contents*; 🔒 keep the *pattern*: one component holds a
`Screen` union in `useState`, plus the active mode and last-result data, and
conditionally renders one screen. Background music is started/stopped here in an
effect keyed on `(ready, screen)`, **but only after the Ready Gate opens**.

```tsx
type Screen = 'landing' | 'modes' | 'ingame' | 'stub' | 'result' | 'submit';

const [ready, setReady] = useState(false);          // Ready Gate flag
const [screen, setScreen] = useState<Screen>('landing');
const [activeMode, setActiveMode] = useState<Mode | null>(null);

useEffect(() => {
  if (!ready) return;                                // 🔒 gate
  if (screen === 'landing' || screen === 'modes' || screen === 'result')
    Audio.startBg('chrome');
}, [ready, screen]);

const onPlay = () => {                               // the ONE landing button
  Audio.unlock();                                    // 🔒 unlock inside the gesture
  Audio.startBg('chrome');
  setReady(true);
  setScreen('modes');
};
```

Game-end flow: `endGame(score)` stops bg, records the play to the local store,
processes unlocks, stashes the result, and routes to `'result'`.

---

## 4. 🔒 The vision tracker substrate (THE reusable engine)

This is the heart. It is **mechanic-agnostic**: camera → MediaPipe → raw
landmarks → smoothing → features → a **detector** → discrete `RepEvent`s. Your
game swaps **only the detector** (an `IRepCounter` implementation). Everything
else is reused verbatim.

### 4.0 Pipeline

```
HTMLVideoElement (getUserMedia, facingMode:'user', mirrored scaleX(-1))
   │  requestAnimationFrame loop @ camera fps
   ▼
PoseLandmarker.detectForVideo(video, now)  → NormalizedLandmark[] (33 pose pts)
FaceLandmarker.detectForVideo(...)         → optional face box
   │  raw landmarks + performance.now() timestamp
   ▼
IRepCounter.processFrame(landmarks, ts)
   ├─ OneEuroFilter per coordinate (jitter rejection)   🔒 constants are law
   ├─ extractFeatures()  → angles, body-scale-normalized positions, visibility
   ├─ visibility-recovery guard (don't fire on re-acquire)
   └─ DETECTOR (your mechanic) → fires onRep({totalReps,...}) on a completed rep
   │
   ▼
onRep callback  → setScore(e.totalReps) + SFX + screen shake + flying word
getDebug()      → FrameDebug (for the overlay)
```

### 4.1 🔒 OneEuroFilter (verbatim — Casiez 2012)

Speed-adaptive low-pass. Low cutoff at rest (kills jitter), opens up during fast
motion. **`mincutoff=1.0`, `beta=0.007` are LAW.**

```ts
class LowPassFilter {
  private y: number | null = null;
  filter(x: number, alpha: number): number {
    const y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    this.y = y; return y;
  }
  lastRawValue() { return this.y; }
  setLastRawValue(v: number) { this.y = v; }
}

export class OneEuroFilter {
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;
  constructor(private mincutoff = 1.0, private beta = 0.007, private dcutoff = 1.0) {}
  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(x: number, timestamp: number): number {
    const dt = this.lastTime === null ? 1 / 30 : (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const prev = this.xFilter.lastRawValue() ?? x;
    const dx = (x - prev) / dt;
    const edx = this.dxFilter.filter(dx, this.alpha(this.dcutoff, dt));
    const cutoff = this.mincutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, this.alpha(cutoff, dt));
  }
}
```

> **Subtle but critical (KEEP):** Filter the landmarks for *display/feature*
> smoothing, but feed the **detector raw landmarks** when the motion is fast. At
> 5+ Hz the filter damps oscillation below the detector's thresholds and you
> *undercount*. Reject rest-noise inside the detector with an amplitude floor,
> not with more smoothing.

### 4.2 🔒 FeatureExtractor (landmark indices + body-scale normalization)

All positions are normalized by **body scale** (shoulder-mid to hip-mid distance)
so the game works at any distance from the camera. Angles are in degrees.

```ts
export const L = { L_SHOULDER:11, R_SHOULDER:12, L_ELBOW:13, R_ELBOW:14,
                   L_WRIST:15, R_WRIST:16, L_HIP:23, R_HIP:24 };

// angleAt(vertex, a, c): joint angle in degrees, 0..180
// dist(a,b): euclidean in normalized coords
// bodyScale = max(dist(shoulderMid, hipMid), 1e-4)
// wristYRelative = (shoulderY - wristY) / bodyScale   // + when wrist above shoulder
// per-arm visibilityMin = min(shoulder, elbow, wrist visibility)
```

`extractFeatures(landmarks)` returns `{ left, right, bodyScale, tHasValidFrame }`
where each arm has `{ elbowAngle, wristYRelative, visibilityMin }`. **Adapt which
features you compute** to your mechanic (legs → use hips/knees/ankles 23–28; head
tilt → use nose/eyes/ears 0–10; etc.), but **keep the body-scale normalization
discipline** — never use raw pixel/normalized distances without scaling.

### 4.3 🔒 The extension point — `IRepCounter`

**This interface is the contract every mechanic implements.** It is the single
seam between the reusable substrate and your game.

```ts
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
  leftVel: number | null; rightVel: number | null;
  quorum: { left: number; right: number };
  firedSide: 'LEFT_UP' | 'RIGHT_UP' | null;
  visibilityRecoverySuppressed: boolean;
  visibleNow: boolean;
  handsReady: boolean;
  wristVisMin: number;
  // 🎛 add a per-mechanic debug slice, e.g.:  suii?: { both:number; inUp:boolean }
}

export interface IRepCounter {
  onRep(fn: (e: RepEvent) => void): void;
  processFrame(lm: NormalizedLandmark[], ts: number): void;
  getReps(): number;
  getDebug(): FrameDebug;
  reset(): void;
}
```

> 🎛 `RepEvent`/`FrameDebug` are shaped around BRB's two-arm games. Generalize the
> field names if your game isn't arm-based (e.g. `arm` → `side`/`limb`), but keep
> `totalReps`, `timestamp`, `confidence`, and a per-mechanic debug slice.

### 4.4 The detector patterns (pick one per mechanic)

Three proven shapes. **Choose by the *shape of the motion*, not the body part.**

**(A) Hysteresis threshold (single state flag).** *Best for: a thing goes
up/past a line, then comes back.* One rep = signal crosses `ENTER`, then falls
back below `EXIT` (`EXIT < ENTER` gives hysteresis), guarded by a refractory
window. This is the simplest and the template for most new mechanics. BRB's
`SuiiRepCounter` (both wrists raised) is exactly this:

```ts
const UP_ENTER = 0.35, UP_EXIT = 0.1, REFRACTORY_MS = 250;
// per frame, after visibility checks:
const both = Math.min(features.left.wristYRelative, features.right.wristYRelative);
if (!this.inUp && both > UP_ENTER && ts - this.lastFireTs > REFRACTORY_MS) {
  this.inUp = true; this.lastFireTs = ts; this.reps += 1;
  this.onRepFn({ timestamp: ts, arm: 'cross', phase: 'sync',
                 totalReps: this.reps, confidence: wristVisMin });
} else if (this.inUp && both < UP_EXIT) {
  this.inUp = false;               // re-arm
}
```

**(B) Four-state cycle machine.** *Best for: a full back-and-forth gesture (a
curl, a squat, a punch-retract).* States `EXTENDED → FLEXING → FLEXED →
EXTENDING → EXTENDED`; a rep fires on the close of the cycle, with a min-interval
cooldown. BRB's `ArmStateMachine` thresholds (elbow degrees):
`extendExit:140, flexEnter:80, flexExit:100, extendEnter:150, minVisibility:0.5`.

**(C) Multi-signal AND-gate.** *Best for: noisy/ambiguous motions that need
several independent confirmations to avoid false positives.* A rep fires only
when **all** conditions agree on one frame. BRB's `ConfirmedReversalDetector`
(alternating seesaw) requires: (1) cross-side reversal vs last fired side,
(2) anti-phase velocities both above a floor, (3) amplitude floor
`|combined| > 0.02` body-scale, (4) cooldown `> 60ms`. It medians 6 landmarks per
side to reject outliers. Use this when (A)/(B) over- or under-count.

### 4.5 🔒 Visibility recovery (every detector must handle this)

When the user steps out of frame and back, MediaPipe re-acquires landmarks with a
jump. **Do not fire on the re-acquisition frame.** Pattern, present in every
counter:

```ts
const visibleNow = wristVisMin > 0.4;     // VIS_RECOVERY_THRESHOLD
if (!visibleNow) { this.lastFrameVisible = false; /* suspend, store empty debug */ return; }
if (!this.lastFrameVisible) {              // first frame back
  this.reArmWithoutFiring();               // rebuild filters, clear velocity history
  this.lastFrameVisible = true; return;    // consume this frame, fire nothing
}
// ...normal processing...
```

Also expose `handsReady = wristVisMin > 0.5` (a stricter "ready to play"
threshold the loading screen uses).

### 4.6 🔒 initTracker (MediaPipe wiring + the frame loop)

```ts
export async function initTracker(video, mode, onRep): Promise<TrackerHandle> {
  const mobile = isMobileDevice();                       // UA + maxTouchPoints
  const tier = mobile ? 'lite' : 'full';                 // model size by device
  const vision = await FilesetResolver.forVisionTasks(/* CDN wasm */);
  const pose = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: poseUrl(tier), delegate: 'GPU' },
    runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  const counter: IRepCounter = pickCounter(mode);        // 🎛 your registry
  counter.onRep(onRep);

  const loop = () => {
    if (stopped) return;
    if (video.readyState >= 2) {
      const now = performance.now();
      const res = pose.detectForVideo(video, now);
      const lm = res.landmarks?.[0] ?? null;
      if (lm) counter.processFrame(lm, now);             // ← per-frame, NO setState
      last = { poseLandmarks: lm, debug: counter.getDebug(),
               cameraFps, landmarkFps, modelTier: tier, firstLandmarkAt, handsReady };
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return { counter, stop, getLastFrame: () => last };
}
```

- **Model tiers:** `lite` on mobile, `full` on desktop. Models load from the
  MediaPipe CDN (`storage.googleapis.com/mediapipe-models/...`) — first load is
  the slow part; that's why the loading screen exists (§5).
- **FPS counters:** keep rolling 1-second windows of frame timestamps for the
  debug overlay (`cameraFps`, `landmarkFps`).
- `getLastFrame()` is the **pull** interface React polls in rAF — never pushed.

### 4.7 Recipe: add a NEW mechanic

1. Decide the **signal** from features (an angle, a normalized position, a
   distance, a velocity, a face/hand box).
2. Pick a **detector pattern** (A/B/C in §4.4).
3. Write `src/tracker/<Name>RepCounter.ts implements IRepCounter`. Copy an
   existing counter as the skeleton (keep the visibility-recovery + refractory
   scaffolding; swap only the detection logic). Add a per-mechanic debug slice.
4. Register it in `initTracker`'s `pickCounter(mode)`.
5. Add a `FrameDebug` field + a row in the debug overlay so you can tune it on a
   phone.
6. Tune thresholds **on-device** via the overlay. Do not tune blind.

---

## 5. The InGame screen (camera lifecycle + HUD)

🔒 Keep the **phase machine** and the **per-frame-DOM-not-React** discipline.
🎛 Adapt copy, the visual layer, and the scoring source.

### 5.1 Phase machine
```ts
type Phase = 'permission' | 'loading' | 'ready-prompt' | 'countdown' | 'playing' | 'ending';
```
- `permission` — a card explaining "this uses your webcam, runs on-device,
  nothing is uploaded." Big **start** button.
- `loading` — **`getUserMedia` is called inside the start click** (gesture), then
  `initTracker`. A **checkpoint list** fills in: `camera connected → AI tracker
  loaded → I see you → show both hands`. Auto-promotes to `ready-prompt` once all
  four are green (with a 500ms hands-ready debounce). A 12s timeout → retry card.
- `ready-prompt` — "you're up · <mode>", how-to-play line, pulsing **ready ▶**.
- `countdown` — 3·2·1·GO (700ms each). On GO: `counter.reset()`, `setScore(0)`,
  `track('played',{mode})`, → `playing`. *Reps during loading/countdown must not
  pre-load the score.*
- `playing` — 20s round. HUD: score chip (center), timer bar (right), back
  (left), mode tag (bottom). Each rep → `setScore`, SFX, 240ms screen-shake,
  a flying mode word (`float-out` keyframe).
- `ending` — dim overlay + giant "TIME"; after 900ms call `onEnd(scoreRef.current)`.

> **StrictMode trap (KEEP):** keep the per-second timer updater *pure*
> (`setTime(s => s-1)`); put side-effects (ending the round) in a **separate
> effect** keyed on the phase, or StrictMode's double-invoke ends the round twice.

### 5.2 Per-frame hand dots (the perf template)
A `requestAnimationFrame` loop reads `tracker.getLastFrame().poseLandmarks` and
writes `dot.style.left/top/opacity` **directly**. `x` is mirrored
(`(1 - lw.x) * 100%`) because the `<video>` is `scaleX(-1)`. **No React state in
this loop.** This is the canonical example of §1.3.

### 5.3 Debug overlay
Toggle via `?debug=1` query string **or** a 700ms long-press anywhere. Renders
the live `FrameDebug` (fps, visibility, the per-mechanic signal values, fired
side). Build it before tuning any detector (§1.6).

---

## 6. Audio (Howler, synthesized, gesture-unlocked)

🔒 Keep the **unlock model** and the bank structure. 🎛 Adapt the actual sounds.

- **Nothing touches `AudioContext` until `unlock()` is called from the Ready Gate
  click.** `unlock()` builds every `Howl` (which constructs Howler's context
  inside the gesture) and resumes a suspended context.
- SFX are **synthesized in-code** (WebAudio buffer → base64 WAV → `Howl`), so
  there are no audio asset files to ship. Helpers build tone envelopes
  (`sine/square/triangle/sawtooth` + slide + decay) and filtered noise. (You can
  instead ship real audio files; the synthesized approach is just zero-asset.)
- **Banks:** `click[]` (randomized), `hover`, `rep[modeId][]` (per-mechanic hit
  sounds), `bg[modeId]` (looped chiptune beds). A `safe(fn)` wrapper no-ops when
  `!_unlocked || _muted`.
- API surface: `unlock, isUnlocked, click, hover, rep(mode), startBg(key),
  stopBg, setMuted, isMuted, preview(mode)`.
- **Mute** routes through `Howler.mute(v)` and stops/restarts the bg loop.

---

## 7. 🔒 Visual design system — the "wonk" look

This **is** the feel. Reproduce the tokens and classes verbatim; theme by
swapping the palette values, not the system.

### 7.1 Design tokens (CSS custom properties)
```css
:root {
  --bg:#f3e8b8; --bg-2:#ead27a; --ink:#1a1410; --ink-soft:#4a3a28;
  --paper:#fff8e1; --hot:#ff3b1f; --lime:#b4e34a; --grape:#8b5cf6;
  --sky:#5cc8ff; --pink:#ff7ab8; --tape:#ffd23f;
  --shadow:4px 4px 0 #1a1410; --shadow-lg:8px 8px 0 #1a1410;
}
```
🎛 Re-theme by changing these. Keep the **hard offset shadow** (`Npx Npx 0 ink`,
no blur) — it's the signature.

### 7.2 The "wonk" primitives
Asymmetric border-radius + thick ink border + hard offset shadow = hand-drawn
feel. **Every interactive surface is wonky.**
```css
.wonk     { border:4px solid var(--ink);
            border-radius:18px 22px 16px 24px / 22px 18px 24px 16px;
            box-shadow:var(--shadow); background:var(--paper); }
.wonk-lg  { border:5px solid var(--ink);
            border-radius:22px 28px 18px 30px / 28px 18px 30px 22px;
            box-shadow:var(--shadow-lg); }
.wonk-sm  { border:3px solid var(--ink);
            border-radius:12px 16px 10px 18px / 16px 12px 18px 10px;
            box-shadow:3px 3px 0 var(--ink); }
.btn-wonk { /* like .wonk + */ cursor:pointer; font-weight:600;
            transition:transform 90ms, box-shadow 90ms; user-select:none; }
.btn-wonk:hover  { transform:translate(-1px,-1px); box-shadow:5px 5px 0 var(--ink); }
.btn-wonk:active { transform:translate(3px,3px);  box-shadow:1px 1px 0 var(--ink); }
```

### 7.3 Type
- **Display:** `Bungee` (`.display`), big chunky headlines, paired with a colored
  text-shadow (`textShadow:'3px 3px 0 var(--hot)'`).
- **Body:** `Fredoka`. **Mono:** `Space Mono` (`.mono`) for labels/meta in
  UPPERCASE with letter-spacing.
- Load via `<link>` in `app/layout.tsx` with `preconnect`.

### 7.4 Texture + motion
- Backgrounds: `.paper-bg` (radial grit) + `.grid-bg` (28px graph-paper grid).
- `.tape` (skewed washi-tape rectangles), `.stripes`.
- Keyframes (KEEP, they're used everywhere): `pop-in`, `float-out` (flying hit
  words, uses `--dx/--dy/--dr`), `shake` (`.shake` 240ms on every rep), `wobble`,
  `pulse-hot`, `drift`, `ready-pulse`, `stamp-in` (rubber-stamp slam on results),
  `burst`/`target-pop-in`, `count-up-bounce`.
- Tailwind maps the tokens to color/font utilities (`bg-hot`, `font-display`,
  …) — see `tailwind.config.js`. Most layout is **inline styles**; classes carry
  the wonk + animations.

### 7.5 Mobile rules baked into CSS
`html,body,#root{height:100%}`, `body{overflow:hidden}`, `button,input{font-size:16px}`,
touch targets ≥44px. Responsive only via `@media (min-width:768px)`.

---

## 8. Screens (flow + the non-game ones)

🎛 All copy/theme adapts; 🔒 the *structure* of Landing and the loading flow stays.

- **Landing (Ready Gate):** wordmark + one big pulsing **play** button + a small
  credit/CTA. **Nothing else, nothing async.** The button is the unlock point.
- **ModeSelect:** a top control bar (back · auth · mute), a vertically-biased
  centered content block (title + a 2-col mobile / 3-col ≥768px wonky mode grid +
  CTA + contact), and a footer wordmark. One screen, no scroll. Locked modes are
  grayed with an unlock requirement; tapping a locked card shakes it. Hover/tap
  plays a sound and previews the mode's rep SFX.
- **ResultCard:** rubber-stamp slam-in of the score, "new best" treatment, and
  buttons: play again / another mode / submit.
- **StubScreen:** placeholder for modes that aren't wired yet (`mode.wired:false`).
- **Submit (optional):** the "post your clip" flow — client uploads to Vercel
  Blob via a token from `app/api/upload`. 🎛 Drop entirely if your game has no UGC.

> **Layout idiom worth copying:** to bias content above center on mobile but
> revert to top-aligned stacking on desktop, use two flex spacers with classes
> whose `flex-grow` is `1`/`3` on mobile and `0` at ≥768px (collapses to original
> stacking). See `.ms-spacer` / `.ms-spacer-bottom`.

---

## 9. Data & persistence (local-first, merge-ready)

🔒 Keep the **local-first, single-module, future-auth-adoptable** shape. 🎛 Adapt
the actual fields and the progression rules.

- `store/scores.ts` — per-mode `{ bestScore, plays, lastScore, total }` in
  `localStorage` (`brb:scores:v1`). Pure read/write helpers
  (`getAllStats, getModeStats, recordPlay`). Designed so an auth layer can adopt
  everything via `getAllStats()` + merge **without changing call sites**.
- `store/unlocks.ts` — a derived unlock ladder: cumulative `total` in a "gateway"
  mode crosses a goal → unlocks the next tier. Stored as a set
  (`brb:unlocks:v1`); also recomputable from totals.
- **Merge discipline (KEEP):** when a cloud copy exists, merge by **max per field
  per mode** so progress can never go backwards.
- Add a tiny `subscribe(cb)` emitter fired on write, so a sync layer can react
  without touching the existing API.

---

## 10. (Optional) Auth + backend module — Firebase Auth → Supabase

Include this if you want accounts/cross-device sync. It's wired to be **lazy and
latency-free**. The hard-won gotchas are flagged — keep them.

- **Providers:** **Anonymous guest** (auto, silent — progress syncs before any
  login) **+ Google** via **account linking** (`linkWithPopup`, same uid → guest
  progress retained; `credential-already-in-use` → sign into the existing account
  and let the local stores merge).
- **Bridge:** **Supabase Third-Party Auth** validates the Firebase JWT directly;
  the client passes the token via `createClient(url, key, { accessToken })`. **No
  server hop, no service-role secret, no firebase-admin.**
- 🔒 **Lazy-load everything.** `import('firebase/*')` and
  `import('@supabase/supabase-js')` only inside functions, never at module top —
  keeps both SDKs out of the landing bundle (loads only post-gate). Reactivity via
  `useSyncExternalStore` over a plain module store.
- 🔒 **No per-frame cost.** Auth touches React state only on login/logout. Cloud
  writes are **debounced and fire on end-of-round**, never during gameplay.
- 🔒 **RLS gotcha (this WILL bite you):** Firebase ID tokens carry **no
  `role: authenticated` claim**, so Supabase runs requests as `anon`. Write RLS
  policies `to anon, authenticated` and gate on the token's **`sub`**:
  `using ((select auth.jwt()->>'sub') = uid)`. A request with no token has no
  `sub` → `NULL = uid` → denied. Grant table privileges to both roles.
- 🔒 **COOP header:** Google sign-in uses a **popup** (a redirect would reload the
  SPA back through the Ready Gate). Set
  `Cross-Origin-Opener-Policy: same-origin-allow-popups` in `next.config.mjs`
  `headers()` or the popup's `window.closed` poll is blocked.
- **Data:** `profiles(uid, display_name, photo_url)` + `scores(uid, mode_id, …)`;
  unlocks recomputed from totals. After linking, Google profile fields live in
  `user.providerData` (top-level `displayName/photoURL` stay null) — read from
  there.
- **Env (all `NEXT_PUBLIC_*`):** if any of the 6 keys is missing, auth
  **self-disables** (button hides, app runs as before). Ship a `.env.example` +
  a setup doc.

---

## 11. 🎛 The Mode config (drives everything)

A single `Mode[]` array is the data that every screen reads. **This is your main
adaptation surface.**

```ts
export interface Mode {
  id: string;        // stable key, used by tracker registry + stores + audio
  name: string;      // display name
  tagline: string;   // ready-prompt subtitle
  color: string;     // accent (HUD numbers, flying words)
  bg: string;        // card background
  hot: boolean;      // "HOT" badge
  repNoun: string;   // "reps" / "squeezes" / pluralized score unit
  hitWord: string;   // the word that flies off on each hit ("67!", "TUNG!")
  sample: string;    // onomatopoeia shown on the card
  wired: boolean;    // true → InGame; false → StubScreen
}
```
Add `MODE_BY_ID = Object.fromEntries(MODES.map(m => [m.id, m]))`. To add a game
variant: append a `Mode`, implement its `IRepCounter`, register it in
`initTracker`, add its audio `rep`/`bg`, and (optionally) its visual layer
component.

---

## 12. Process & conventions

- **Commits:** `<scope>: <imperative>` (`tracker: …`, `audio: …`, `ux: …`). Keep
  scannable.
- **Branches/deploys:** work on a branch, push to a **Vercel preview**, report the
  URL + a numbered test-hypothesis list, wait for human confirmation before
  merging to main. Never `git push --force`/`reset --hard` without authorization.
- **Plans:** write plans in plain English for a non-engineer owner — every section
  gets a paragraph-length jargon-free translation alongside the technical body.
- **New deps:** name the tradeoff before adding.
- **Don't:** modify the substrate math/constants; skip the Ready Gate "for
  testing"; call `setState` in the per-frame loop; write multi-paragraph code
  comments (comments explain *why*, not *what*).

---

## 13. 🎛 Porting playbook — turn "my game is X" into files

This is the procedure to run on a **new** game concept.

### Step 1 — classify the input
- **Body part(s):** arms (11–22), legs (23–28), head/face (0–10 or FaceLandmarker),
  hands (HandLandmarker), full-body posture.
- **Sensor:** PoseLandmarker (default), FaceLandmarker (head/expression),
  HandLandmarker (fingers), or a combination.

### Step 2 — classify the motion shape → pick a detector (§4.4)
| Motion shape | Pattern | Example |
|---|---|---|
| cross a line and return | **(A) hysteresis** | raise both arms (suii), jump, head-nod |
| full back-and-forth cycle | **(B) 4-state machine** | curl, squat, punch |
| alternating two sides | **(C) AND-gate reversal** | seesaw wrist-pump (67) |
| ambiguous / false-positive-prone | **(C) AND-gate** | add more confirmations |
| tap a moving target | target-hit (not pose reps) | punch a sprite (bonesmash) |

### Step 3 — define the signal from features
Compute the minimal scalar(s) that move when the motion happens, **always
body-scale-normalized**. E.g. squat → `(hipY - kneeY)/bodyScale`; head tilt →
ear-height difference / bodyScale; clap → wrist-to-wrist distance / bodyScale.

### Step 4 — write `src/tracker/<X>RepCounter.ts`
Copy `SuiiRepCounter` (pattern A) or `RepCounter`+`ConfirmedReversalDetector`
(pattern C) as the skeleton. **Keep** the visibility-recovery guard, the
refractory/cooldown, and the `getDebug()` slice. Swap only the detection logic.

### Step 5 — register + expose debug
Add to `initTracker`'s counter registry; add a `FrameDebug` field; add an overlay
row.

### Step 6 — content
Add the `Mode`(s); add `rep`/`bg` audio; write the how-to-play line; (optional)
add a per-mode visual layer component (like `SuiiSkeleton`/`MustardBottle`).

### Step 7 — tune on-device
Open `?debug=1` on a phone, watch the signal, set `ENTER/EXIT/REFRACTORY` (or the
state thresholds / AND-gate floors) until counting matches reality. **Never tune
blind.**

### Step 8 — keep the feel
Reuse Landing/Ready-Gate, ModeSelect, the InGame phase machine + HUD, the audio
unlock model, and the entire §7 design system **unchanged**. Only the mechanic
layer is new.

---

## 14. Acceptance checklist (a faithful port passes all of these)

- [ ] Landing shows only wordmark + one button; **zero** network/sensor/audio
      activity until it's tapped (check DevTools Network/Console).
- [ ] First paint is instant on a mid mobile device.
- [ ] Camera + model init happen **inside** the start gesture, behind a checkpoint
      loading screen with a timeout/retry.
- [ ] During play, the per-frame loop writes the DOM directly; **no `setState` per
      frame** (profiler shows React commits only on reps/timer).
- [ ] A rep fires SFX + 240ms shake + a flying hit word; the score chip updates.
- [ ] OneEuroFilter constants are `1.0 / 0.007`, unchanged.
- [ ] Each detector handles visibility recovery without a phantom rep.
- [ ] `?debug=1` (and long-press) shows live signal values.
- [ ] 20s round, 3·2·1·GO, score zeroed at GO, "TIME" ending, result card.
- [ ] Everything is wonky (asymmetric radius + hard offset shadow), Bungee
      headlines, mobile-first, 44px targets, 16px text, one screen no-scroll.
- [ ] Progress persists locally; (if auth) guest→Google linking keeps progress,
      RLS gates on `sub`, SDKs lazy-load, COOP header present.

---

### Appendix — file-to-concept map (BRB, for reference)
`tracker/OneEuroFilter.ts` (🔒 filter) · `tracker/FeatureExtractor.ts` (🔒 features)
· `tracker/IRepCounter.ts` (🔒 contract) · `tracker/ArmStateMachine.ts` (pattern B)
· `tracker/ConfirmedReversalDetector.ts` + `RepCounter.ts` (pattern C, the 67
mechanic) · `tracker/SuiiRepCounter.ts` (pattern A, simplest example) ·
`tracker/initTracker.ts` (MediaPipe + loop) · `screens/InGame.tsx` (phase machine
+ HUD) · `audio.ts` (Howler unlock model) · `index.css` (🔒 design system) ·
`modes.ts` (🎛 config) · `store/*` (local-first) · `auth/*` + `supabase/schema.sql`
(optional backend).
