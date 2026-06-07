// GUESS THE GOAT overlay: a clue banner + two player cards beside the player's
// head. Reads the tracker frame in its own rAF to (a) keep the cards at head
// height and (b) fill a point-and-hold progress bar on whichever side is being
// pointed at. Selection/scoring is handled by InGame via the counter's onRep.

import { useEffect, useRef } from 'react';
import type { Question } from '../content/players';
import type { LastFrame } from '../tracker/initTracker';

export interface GuessFlash {
  side: 'left' | 'right';
  correct: boolean;
}

function Card({
  cardRef,
  player,
  flash,
  alignRight,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  player: { name: string; flag: string };
  flash: GuessFlash | null;
  alignRight: boolean;
}) {
  const bg = flash ? (flash.correct ? 'var(--lime)' : 'var(--hot)') : 'var(--paper)';
  return (
    <div
      ref={cardRef}
      className={`wonk-lg ${flash ? 'pop-in' : ''}`}
      style={{
        position: 'absolute',
        [alignRight ? 'right' : 'left']: 12,
        top: '40%',
        transform: 'translateY(-50%)',
        width: 'min(36vw, 168px)',
        padding: '14px 10px',
        textAlign: 'center',
        background: bg,
        overflow: 'hidden',
        zIndex: 14,
      }}
    >
      <div style={{ fontSize: 'clamp(34px, 11vw, 56px)', lineHeight: 1 }}>
        {player.flag}
      </div>
      <div
        className="display"
        style={{ fontSize: 'clamp(15px, 4.6vw, 22px)', marginTop: 6, color: 'var(--ink)' }}
      >
        {player.name}
      </div>
      {/* point-and-hold progress fill */}
      <div
        data-fill
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 6,
          width: '0%',
          background: 'var(--gold)',
        }}
      />
    </div>
  );
}

export default function GuessLayer({
  question,
  getFrame,
  flash,
}: {
  question: Question;
  getFrame: () => LastFrame | null;
  flash: GuessFlash | null;
}) {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const setRing = (card: HTMLDivElement | null, prog: number) => {
      if (!card) return;
      const fill = card.querySelector('[data-fill]') as HTMLElement | null;
      if (fill) fill.style.width = `${prog * 100}%`;
      card.style.borderColor = prog > 0 ? 'var(--gold)' : 'var(--ink)';
    };
    const loop = () => {
      const f = getFrame();
      const lm = f?.poseLandmarks;
      const g = f?.debug?.guess as
        | { side: 'left' | 'right' | null; progress: number }
        | undefined;
      const nose = lm?.[0];
      if (nose && (nose.visibility ?? 1) > 0.2) {
        const topPct = `${Math.max(18, Math.min(72, nose.y * 100))}%`;
        if (leftRef.current) leftRef.current.style.top = topPct;
        if (rightRef.current) rightRef.current.style.top = topPct;
      }
      const side = g?.side ?? null;
      const prog = g?.progress ?? 0;
      setRing(leftRef.current, side === 'left' ? prog : 0);
      setRing(rightRef.current, side === 'right' ? prog : 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getFrame]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 14 }}>
      {/* clue banner */}
      <div
        style={{
          position: 'absolute',
          top: 70,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(86vw, 460px)',
        }}
      >
        <div
          className="wonk"
          style={{ padding: '10px 16px', textAlign: 'center', background: 'var(--gold)' }}
        >
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink)' }}>
            who is it?
          </div>
          <div
            className="display"
            style={{ fontSize: 'clamp(15px, 4.4vw, 22px)', color: 'var(--ink)', marginTop: 2 }}
          >
            {question.prompt}
          </div>
        </div>
      </div>

      <Card
        cardRef={leftRef}
        player={question.left}
        flash={flash?.side === 'left' ? flash : null}
        alignRight={false}
      />
      <Card
        cardRef={rightRef}
        player={question.right}
        flash={flash?.side === 'right' ? flash : null}
        alignRight={true}
      />
    </div>
  );
}
