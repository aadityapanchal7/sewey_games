'use client';

// 5. InGame - camera lifecycle + HUD. KEEP: the phase machine and the
// per-frame-DOM-not-React discipline. 🎛 Adapt copy, visual layer, scoring source.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from '../audio';
import type { Mode } from '../modes';
import { initTracker, type TrackerHandle } from '../tracker/initTracker';
import type { RepEvent } from '../tracker/IRepCounter';
import type { LastFrame } from '../tracker/initTracker';
import DebugOverlay from '../components/DebugOverlay';
import WorldCupFx from '../components/WorldCupFx';
import MoveDemo from '../components/MoveDemo';
import GuessLayer, { type GuessFlash } from '../components/GuessLayer';
import { shuffledQuestions, type Question } from '../content/players';

const STREAK_WINDOW_MS = 2500; // consecutive hits within this keep the streak alive
const ANSWER_DELAY_MS = 700; // pause to show correct/wrong before the next question

type Phase =
  | 'permission'
  | 'loading'
  | 'ready-prompt'
  | 'countdown'
  | 'playing'
  | 'ending';

const ROUND_SECONDS = 20;
const LOAD_TIMEOUT_MS = 8000;
const READY_ACCUMULATE_MS = 250; // accumulated ready-time to auto-promote
const LIVENESS_FALLBACK_MS = 2500; // once a body's been seen this long, always promote

interface FlyWord {
  id: number;
  text: string;
  x: number;
  dx: number;
  dy: number;
  dr: number;
  color: string;
}

export default function InGame({
  mode,
  onEnd,
  onBack,
}: {
  mode: Mode;
  onEnd: (score: number) => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('permission');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [countdown, setCountdown] = useState<string>('3');
  const [checkpoints, setCheckpoints] = useState({
    camera: false,
    tracker: false,
    seeYou: false,
    hands: false,
  });
  const [loadError, setLoadError] = useState(false);
  const [flyWords, setFlyWords] = useState<FlyWord[]>([]);
  const [shakeKey, setShakeKey] = useState(0);
  const [streak, setStreak] = useState(0);
  const [debug, setDebug] = useState(false);
  const [qIndex, setQIndex] = useState(0); // quiz: current question index
  const [guessFlash, setGuessFlash] = useState<GuessFlash | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef<TrackerHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const phaseRef = useRef<Phase>('permission');
  const scoreRef = useRef(0);
  const flyIdRef = useRef(0);
  const streakRef = useRef(0);
  const lastRepTsRef = useRef(0);
  const questionsRef = useRef<Question[]>([]);
  const qIndexRef = useRef(0);
  const answeringRef = useRef(false);

  phaseRef.current = phase;
  scoreRef.current = score;

  // shuffle the quiz deck once on mount
  useEffect(() => {
    questionsRef.current = shuffledQuestions();
  }, []);

  // stable frame getter for child overlays (GuessLayer)
  const getFrame = useCallback(
    (): LastFrame | null => trackerRef.current?.getLastFrame() ?? null,
    []
  );

  // ---- debug toggle: ?debug=1 or 700ms long-press --------------------------
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      setDebug(true);
    }
    let t: ReturnType<typeof setTimeout> | null = null;
    const down = () => {
      t = setTimeout(() => setDebug((d) => !d), 700);
    };
    const up = () => t && clearTimeout(t);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  // ---- celebration helpers (discrete events - setState here is fine) -------
  const bumpStreak = useCallback((ts: number) => {
    const within = ts - lastRepTsRef.current < STREAK_WINDOW_MS;
    streakRef.current = within ? streakRef.current + 1 : 1;
    lastRepTsRef.current = ts;
    setStreak(streakRef.current);
    Audio.setCrowdIntensity(streakRef.current / 8);
  }, []);

  const addFlash = useCallback((text: string, colors: string[]) => {
    setShakeKey((k) => k + 1);
    const id = flyIdRef.current++;
    const palette = colors.length ? colors : ['#fff'];
    // scatter values per suiicontext.md §6 (addFlash)
    setFlyWords((w) => [
      ...w,
      {
        id,
        text,
        x: 50 + (Math.random() - 0.5) * 20,
        dx: (Math.random() - 0.5) * 240,
        dy: -120 - Math.random() * 80,
        dr: (Math.random() - 0.5) * 36,
        color: palette[id % palette.length],
      },
    ]);
    setTimeout(() => setFlyWords((w) => w.filter((f) => f.id !== id)), 900);
  }, []);

  // quiz answer: e.arm carries the pointed side
  const handleAnswer = useCallback(
    (side: 'left' | 'right', ts: number) => {
      if (answeringRef.current) return;
      const q = questionsRef.current[qIndexRef.current];
      if (!q) return;
      answeringRef.current = true;
      const correct = q.correct === side;
      setGuessFlash({ side, correct });
      if (correct) {
        setScore((s) => s + 1);
        Audio.rep('guess');
        Audio.correct();
        bumpStreak(ts);
        addFlash(mode.hitWord, mode.hitColors ?? [mode.color]);
      } else {
        Audio.wrong();
        setShakeKey((k) => k + 1);
        streakRef.current = 0;
        setStreak(0);
        Audio.setCrowdIntensity(0);
      }
      setTimeout(() => {
        qIndexRef.current =
          (qIndexRef.current + 1) % (questionsRef.current.length || 1);
        setQIndex(qIndexRef.current);
        setGuessFlash(null);
        answeringRef.current = false;
      }, ANSWER_DELAY_MS);
    },
    [mode.hitWord, mode.hitColors, mode.color, addFlash, bumpStreak]
  );

  // ---- onRep (discrete event - setState here is OK, ~2-10Hz) ---------------
  const onRep = useCallback(
    (e: RepEvent) => {
      if (phaseRef.current !== 'playing') return; // don't pre-load during load/countdown
      if (mode.scoring === 'quiz') {
        if (e.arm === 'left' || e.arm === 'right') handleAnswer(e.arm, e.timestamp);
        return;
      }
      setScore(e.totalReps);
      Audio.rep(mode.id);
      bumpStreak(e.timestamp);
      addFlash(mode.hitWord, mode.hitColors ?? [mode.color]);
    },
    [mode.id, mode.scoring, mode.hitWord, mode.color, mode.hitColors, addFlash, bumpStreak, handleAnswer]
  );

  // ---- start: getUserMedia INSIDE the gesture, then initTracker ------------
  const start = async () => {
    Audio.click();
    setPhase('loading');
    setLoadError(false);
    const timeout = setTimeout(() => {
      if (phaseRef.current === 'loading') setLoadError(true);
    }, LOAD_TIMEOUT_MS);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCheckpoints((c) => ({ ...c, camera: true }));

      const handle = await initTracker(video, mode.id, onRep);
      trackerRef.current = handle;
      setCheckpoints((c) => ({ ...c, tracker: true }));
      clearTimeout(timeout);
    } catch (err) {
      console.error('camera/tracker init failed', err);
      clearTimeout(timeout);
      setLoadError(true);
    }
  };

  // ---- checkpoint poller (seeYou / hands) + auto-promote -------------------
  useEffect(() => {
    if (phase !== 'loading') return;
    let readyMs = 0;
    let lastTick = performance.now();
    const id = setInterval(() => {
      const last = trackerRef.current?.getLastFrame();
      if (!last) return;
      const now = performance.now();
      const dt = now - lastTick;
      lastTick = now;

      const seeYou = !!last.poseLandmarks;
      const hands = last.handsReady;
      setCheckpoints((c) =>
        c.seeYou === seeYou && c.hands === hands ? c : { ...c, seeYou, hands }
      );

      // Accumulate ready-time across brief gaps instead of requiring an unbroken run
      // (a single visibility flicker no longer resets the timer → never stuck).
      if (seeYou && hands) readyMs += dt;
      else readyMs = Math.max(0, readyMs - dt * 0.5);
      if (readyMs > READY_ACCUMULATE_MS) {
        setPhase('ready-prompt');
        return;
      }

      // Absolute liveness fallback: once a body has been seen for a while, always
      // proceed regardless of the hands gate.
      if (
        last.firstLandmarkAt != null &&
        now - last.firstLandmarkAt > LIVENESS_FALLBACK_MS
      ) {
        setPhase('ready-prompt');
      }
    }, 120);
    return () => clearInterval(id);
  }, [phase]);

  // ---- per-frame hand dots (THE perf template - direct DOM, no setState) ---
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'ready-prompt' && phase !== 'countdown')
      return;
    let raf = 0;
    const loop = () => {
      const last = trackerRef.current?.getLastFrame();
      const lm = last?.poseLandmarks;
      const container = dotsRef.current;
      if (container && lm) {
        const wrists = [15, 16]; // L/R wrist
        wrists.forEach((idx, i) => {
          const dot = container.children[i] as HTMLElement | undefined;
          const p = lm[idx];
          if (!dot) return;
          if (p && (p.visibility ?? 1) > 0.2) {
            dot.style.opacity = '1';
            dot.style.left = `${(1 - p.x) * 100}%`; // mirrored (video is scaleX(-1))
            dot.style.top = `${p.y * 100}%`;
          } else {
            dot.style.opacity = '0';
          }
        });
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // ---- countdown 3·2·1·GO (700ms each) -------------------------------------
  useEffect(() => {
    if (phase !== 'countdown') return;
    const seq = ['3', '2', '1', 'GO'];
    let i = 0;
    setCountdown(seq[0]);
    Audio.click();
    const id = setInterval(() => {
      i += 1;
      if (i < seq.length) {
        setCountdown(seq[i]);
        Audio.click();
      } else {
        clearInterval(id);
        trackerRef.current?.counter.reset();
        Audio.resetReps(); // start alternating rep sounds from the first clip
        setScore(0);
        setTimeLeft(ROUND_SECONDS);
        streakRef.current = 0;
        lastRepTsRef.current = 0;
        setStreak(0);
        Audio.startCrowd();
        setPhase('playing');
      }
    }, 700);
    return () => clearInterval(id);
  }, [phase]);

  // ---- per-second timer: KEEP PURE (StrictMode trap) -----------------------
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // side-effect of running out of time lives in a SEPARATE effect keyed on time
  useEffect(() => {
    if (phase === 'playing' && timeLeft <= 0) setPhase('ending');
  }, [phase, timeLeft]);

  // streak decay - if no hit lands within the window, cool the crowd back down
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      if (
        streakRef.current > 0 &&
        performance.now() - lastRepTsRef.current > STREAK_WINDOW_MS
      ) {
        streakRef.current = 0;
        setStreak(0);
        Audio.setCrowdIntensity(0);
      }
    }, 400);
    return () => clearInterval(id);
  }, [phase]);

  // ---- ending: dim + "TIME", then onEnd ------------------------------------
  useEffect(() => {
    if (phase !== 'ending') return;
    Audio.stopCrowd();
    const id = setTimeout(() => onEnd(scoreRef.current), 900);
    return () => clearTimeout(id);
  }, [phase, onEnd]);

  // ---- cleanup -------------------------------------------------------------
  useEffect(() => {
    return () => {
      Audio.stopCrowd();
      trackerRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const goReady = () => {
    Audio.click();
    setPhase('countdown');
  };

  const retry = () => {
    setCheckpoints({ camera: false, tracker: false, seeYou: false, hands: false });
    void start();
  };

  // ======================== RENDER ========================
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#000' }}>
      {/* camera feed (mirrored) */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
      />

      {/* per-frame hand dots layer */}
      <div ref={dotsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[0, 1].map((i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              width: 26,
              height: 26,
              marginLeft: -13,
              marginTop: -13,
              borderRadius: '50%',
              background: mode.color,
              border: '3px solid var(--ink)',
              opacity: 0,
              transition: 'opacity 120ms',
            }}
          />
        ))}
      </div>

      {/* World Cup celebration FX (confetti + flash), all modes, below HUD */}
      {(phase === 'countdown' || phase === 'playing' || phase === 'ending') && (
        <WorldCupFx
          hitKey={shakeKey}
          colors={mode.hitColors ?? [mode.color]}
          active={phase === 'playing'}
        />
      )}

      {/* Guess-the-Goat cards beside the head */}
      {mode.scoring === 'quiz' &&
        (phase === 'ready-prompt' || phase === 'countdown' || phase === 'playing') &&
        questionsRef.current[qIndex] && (
          <GuessLayer
            question={questionsRef.current[qIndex]}
            getFrame={getFrame}
            flash={guessFlash}
          />
        )}

      {debug && <DebugOverlay tracker={trackerRef.current} />}

      {/* ---------------- PERMISSION ---------------- */}
      {phase === 'permission' && (
        <Center>
          <div className="wonk-lg" style={{ padding: 26, maxWidth: 360, textAlign: 'center' }}>
            <h2 className="display" style={{ fontSize: 26, margin: 0 }}>
              {mode.name}
            </h2>
            <p style={{ fontSize: 15, margin: '14px 0', color: 'var(--ink-soft)' }}>
              This uses your webcam, runs <b>on-device</b>, and nothing is uploaded.
            </p>
            <button
              className="btn-wonk ready-pulse"
              onClick={start}
              style={{ padding: '14px 32px', background: 'var(--lime)' }}
            >
              <span className="display">start ▶</span>
            </button>
          </div>
        </Center>
      )}

      {/* ---------------- LOADING ---------------- */}
      {phase === 'loading' && (
        <Center>
          <div className="wonk-lg" style={{ padding: 24, minWidth: 280, maxWidth: 360 }}>
            {/* how-to, shown up front so the user knows the motion + framing */}
            <div
              className="wonk-sm"
              style={{ padding: '12px 14px', marginBottom: 16, background: mode.bg }}
            >
              <div className="display" style={{ fontSize: 18, color: 'var(--ink)' }}>
                {mode.emoji} {mode.name}
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 4 }}>
                {mode.instructions}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6 }}>
                📸 {mode.framingHint}
              </div>
            </div>

            <Check ok={checkpoints.camera} label="camera connected" />
            <Check ok={checkpoints.tracker} label="AI tracker loaded" />
            <Check ok={checkpoints.seeYou} label="I see you" />
            <Check ok={checkpoints.hands} label="hands in view (optional)" />

            {/* manual escape hatch - never trap the user once the tracker is up */}
            {checkpoints.tracker && (
              <button
                className="btn-wonk"
                onClick={() => setPhase('ready-prompt')}
                style={{ padding: '10px 22px', marginTop: 14, width: '100%', background: 'var(--lime)' }}
              >
                <span className="display" style={{ fontSize: 16 }}>start anyway →</span>
              </button>
            )}
            {loadError && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--hot)' }}>
                  trouble connecting the camera?
                </p>
                <button className="btn-wonk" onClick={retry} style={{ padding: '8px 20px', marginTop: 6 }}>
                  retry
                </button>
              </div>
            )}
          </div>
        </Center>
      )}

      {/* ---------------- READY PROMPT ---------------- */}
      {phase === 'ready-prompt' && (
        <Center>
          <div className="wonk-lg" style={{ padding: 26, textAlign: 'center', maxWidth: 340 }}>
            <div className="mono" style={{ fontSize: 12 }}>you're up · {mode.name}</div>
            {/* looping stick-figure demo of the move */}
            <div
              className="wonk-sm"
              style={{ padding: '8px 0 2px', margin: '12px auto 6px', background: mode.bg, maxWidth: 180 }}
            >
              <MoveDemo mode={mode.id} />
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink)', opacity: 0.8 }}>
                copy this move
              </div>
            </div>
            <h2 className="display" style={{ fontSize: 20, margin: '6px 0' }}>
              {mode.emoji} {mode.tagline}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink)', margin: '0 0 4px' }}>
              {mode.instructions}
            </p>
            <p className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginBottom: 8 }}>
              📸 {mode.framingHint}
            </p>
            <button
              className="btn-wonk ready-pulse"
              onClick={goReady}
              style={{ padding: '14px 36px', background: 'var(--lime)', marginTop: 6 }}
            >
              <span className="display">ready ▶</span>
            </button>
          </div>
        </Center>
      )}

      {/* ---------------- COUNTDOWN ---------------- */}
      {phase === 'countdown' && (
        <Center>
          <div
            key={countdown}
            className="display pop-in"
            style={{
              fontSize: 'clamp(90px, 30vw, 200px)',
              color: '#fff',
              textShadow: '6px 6px 0 var(--hot)',
            }}
          >
            {countdown}
          </div>
        </Center>
      )}

      {/* ---------------- PLAYING HUD ---------------- */}
      {(phase === 'playing' || phase === 'ending') && (
        <>
          {/* back */}
          <button
            className="btn-wonk"
            onClick={() => {
              Audio.stopCrowd();
              trackerRef.current?.stop();
              streamRef.current?.getTracks().forEach((t) => t.stop());
              onBack();
            }}
            style={{ position: 'absolute', top: 12, left: 12, padding: '8px 14px', minHeight: 44 }}
          >
            ←
          </button>

          {/* score chip (center) */}
          <div
            key={shakeKey}
            className={shakeKey ? 'shake' : ''}
            style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="wonk" style={{ padding: '8px 22px', background: mode.bg }}>
              <span className="display count-up-bounce" key={score} style={{ fontSize: 34, color: 'var(--ink)' }}>
                {score}
              </span>
            </div>
            {streak >= 3 && (
              <div
                className="mono count-up-bounce"
                key={`streak-${streak}`}
                style={{
                  marginTop: 6,
                  textAlign: 'center',
                  fontSize: streak >= 8 ? 16 : 13,
                  color: streak >= 8 ? 'var(--hot)' : '#fff',
                  textShadow: '1px 1px 0 var(--ink)',
                  fontWeight: 700,
                }}
              >
                {streak >= 8 ? '🔥 ON FIRE' : `🔥 x${streak}`}
              </div>
            )}
          </div>

          {/* timer bar (right) */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 14,
              width: 14,
              height: 120,
              border: '3px solid var(--ink)',
              borderRadius: 8,
              background: 'var(--paper)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${(timeLeft / ROUND_SECONDS) * 100}%`,
                background: timeLeft <= 5 ? 'var(--hot)' : 'var(--lime)',
                transition: 'height 1s linear',
              }}
            />
          </div>

          {/* mode tag (bottom) */}
          <div
            className="mono"
            style={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 11,
              color: '#fff',
              textShadow: '1px 1px 0 var(--ink)',
            }}
          >
            {mode.name} · {mode.repNoun}
          </div>

          {/* flying hit words */}
          {flyWords.map((f) => (
            <div
              key={f.id}
              className="display float-out"
              style={
                {
                  position: 'absolute',
                  left: `${f.x}%`,
                  top: '55%',
                  fontSize: 44,
                  color: f.color,
                  textShadow: '2px 2px 0 var(--ink)',
                  '--dx': `${f.dx}px`,
                  '--dy': `${f.dy}px`,
                  '--dr': `${f.dr}deg`,
                } as React.CSSProperties
              }
            >
              {f.text}
            </div>
          ))}
        </>
      )}

      {/* ---------------- ENDING ---------------- */}
      {phase === 'ending' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(26,20,16,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="display pop-in"
            style={{ fontSize: 'clamp(70px, 22vw, 160px)', color: '#fff', textShadow: '6px 6px 0 var(--hot)' }}
          >
            TIME
          </div>
        </div>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {children}
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 15 }}>
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: '3px solid var(--ink)',
          background: ok ? 'var(--lime)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
        }}
      >
        {ok ? '✓' : ''}
      </span>
      <span style={{ opacity: ok ? 1 : 0.6 }}>{label}</span>
    </div>
  );
}
