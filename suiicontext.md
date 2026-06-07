# Suii mode — exact configuration reference

Every concrete numeric/config value that defines the **suii** game ("celebrate
like a goat" — raise both arms to the sky), grouped by source file. Companion to
`VISION_GAME_BLUEPRINT.md` — suii is the simplest worked example of detector
**pattern A (hysteresis threshold)**.

> Note: there is **no parameter literally named `hspread`** in the suii code. The
> only "horizontal spread" knob is the flying-hit-word scatter in `InGame.tsx`
> (`addFlash()`), included in §6 below.

---

## 1. Rep detection — `src/tracker/SuiiRepCounter.ts`

Core gameplay tuning (pattern A: hysteresis). One rep = **both wrists** rise above
`UP_ENTER`, then both fall back below `UP_EXIT`, with a refractory window.

| Constant | Value | Meaning |
|---|---|---|
| `VIS_RECOVERY_THRESHOLD` | `0.4` | min wrist visibility to process a frame at all |
| `HANDS_READY_THRESHOLD` | `0.5` | stricter "ready to play" visibility gate |
| `UP_ENTER` | `0.35` | BOTH wrists this far above shoulders (body-scale units) → fires a rep |
| `UP_EXIT` | `0.1` | both must fall back to ~shoulder level to re-arm |
| `REFRACTORY_MS` | `250` | min ms between fires (anti double-count) |

- **Signal:** `both = min(left.wristYRelative, right.wristYRelative)`, where
  `wristYRelative = (shoulderY − wristY) / bodyScale` (positive when wrist is
  above the shoulder, in torso-height units).
- **Fire condition:** `!inUp && both > UP_ENTER && ts - lastFireTs > REFRACTORY_MS`
  → increment, set `inUp`. Re-arm when `inUp && both < UP_EXIT`.
- **RepEvent emitted:** `{ arm:'cross', phase:'sync', totalReps, confidence:wristVisMin }`.
- **Tuning guide:** raise `UP_ENTER` if hovering hands phantom-count; lower it if
  full raises are missed.

---

## 2. Skeleton overlay — `src/components/SuiiSkeleton.tsx`

Suii's signature live upper-body skeleton, drawn over the mirrored webcam feed.
(InGame hides the normal hand-dots for suii: `mode.id !== 'suii'`.) Per-frame SVG
attribute writes via refs in a rAF loop — no React state.

| Constant | Value |
|---|---|
| `VIS` | `0.4` — min landmark visibility to draw a joint/bone |
| `JOINTS` | `[0, 11, 12, 13, 14, 15, 16, 23, 24]` (nose, shoulders, elbows, wrists, hips) |
| `WRISTS` | `{15, 16}` |
| `BONES` | `[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24]]` |

Render attributes:
- **bone `<line>`:** `stroke=var(--paper)`, `strokeWidth=5`, `strokeLinecap=round`,
  opacity `0 → 0.9` when both endpoints visible.
- **joint `<circle>`:** `r = 13` (wrists) / `7` (others); `fill = var(--hot)`
  (wrists) / `var(--paper)` (others); `stroke=var(--ink)`, `strokeWidth=3`.
- **Coords:** `viewBox` tracked to pixel size via `ResizeObserver`; x mirrored:
  `px = (1 − x) * w`, `py = y * h`. `preserveAspectRatio="none"`, `zIndex:10`,
  `pointerEvents:none`.

---

## 3. Mode config — `src/modes.ts`

```ts
{ id:'suii', name:'suii', tagline:'celebrate like a goat',
  color:'#5cc8ff', bg:'#d4f0ff', hot:false,
  repNoun:'suiis', hitWord:'SUIIII!', sample:'suiiii · sewey', wired:true }
```

How-to-play line (`InGame.tsx` `MODE_INSTRUCTIONS.suii`):
`'celebrate · arm up · point to the sky'`

---

## 4. Audio — `src/audio.ts`

**Rep SFX** (fires on every counted suii):
```ts
suiiRep = buildEnvelope(freq:440, dur:0.5, type:'sawtooth', gain:0.18, slide:240)
          → makeHowlFromBuffer(..., { volume: 0.85 })
rep.suii = [suiiRep]
```

**Background loop** (`buildBgLoop('suii')`, non-chrome branch):
```ts
tempo     = 150 bpm        beat = 60/150 = 0.4 s
bassNotes = [82, 82, 110, 82, 98, 98, 130, 98]
melNotes  = [440, 523, 587, 523, 440, 392, 440, 523]   // melody on even beats only
mix scale = 0.6            Howl: { loop:true, volume:0.45 }
```

Preview (hover on the mode card) routes through `rep('suii')`.

---

## 5. Unlock ladder — `src/store/unlocks.ts`

```ts
suii is unlocked by:  tung      // UNLOCKS.tung = ['bonesmash','suii']
suii's own goal:      150       // GOALS.suii — cumulative points to clear
suii unlocks:         mustard, johnpork   // UNLOCKS.suii = ['mustard','johnpork']
```

---

## 6. Shared round / HUD constants (also apply to suii) — `src/screens/InGame.tsx`

```ts
round length            = 20 s
countdown               = 3·2·1·GO, 700 ms per step
ending settle           = 900 ms
screen shake            = 240 ms per rep
CAMERA_INIT_TIMEOUT_MS  = 12000
HANDS_READY_DEBOUNCE_MS = 500
```

**Flying hit-word scatter** (`addFlash()` — the only "horizontal spread" knob,
shared by all modes):
```ts
x  = 50 + (rand − 0.5) * 20     // start x %, ±10% horizontal spread  ← likely "hspread"
dx = (rand − 0.5) * 240         // horizontal drift, ±120 px
dy = −120 − rand * 80           // upward drift
dr = (rand − 0.5) * 36          // rotation, ±18°
lifetime = 900 ms
```
