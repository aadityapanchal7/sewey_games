'use client';

// 3. The screen machine. One component holds a Screen union + active mode +
// last-result data, conditionally renders one screen. Background music is
// started/stopped here in an effect keyed on (ready, screen) - but ONLY after the
// Ready Gate opens.

import { useEffect, useState } from 'react';
import { Audio } from './audio';
import { MODE_BY_ID, type Mode } from './modes';
import { getModeStats, recordPlay } from './store/scores';
import { processUnlocks } from './store/unlocks';
import Landing from './screens/Landing';
import ModeSelect from './screens/ModeSelect';
import InGame from './screens/InGame';
import ResultCard from './screens/ResultCard';
import StubScreen from './screens/StubScreen';

type Screen = 'landing' | 'modes' | 'ingame' | 'stub' | 'result';

export interface ResultData {
  modeId: string;
  score: number;
  isBest: boolean;
}

export default function App() {
  const [ready, setReady] = useState(false); // 🔒 Ready Gate flag
  const [screen, setScreen] = useState<Screen>('landing');
  const [activeMode, setActiveMode] = useState<Mode | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);

  useEffect(() => {
    if (!ready) return; // 🔒 gate
    if (screen === 'landing' || screen === 'modes' || screen === 'result') {
      Audio.startBg('chrome');
    }
  }, [ready, screen]);

  const onPlay = () => {
    // the ONE landing button - unlock everything inside the gesture.
    Audio.unlock();
    Audio.startBg('chrome');
    setReady(true);
    setScreen('modes');
  };

  const pickMode = (mode: Mode) => {
    setActiveMode(mode);
    Audio.stopBg();
    setScreen(mode.wired ? 'ingame' : 'stub');
  };

  const endGame = (score: number) => {
    Audio.stopBg();
    if (activeMode) {
      const prevBest = getModeStats(activeMode.id).bestScore;
      const stats = recordPlay(activeMode.id, score);
      processUnlocks();
      setResult({
        modeId: activeMode.id,
        score,
        isBest: score > prevBest && score > 0,
      });
      void stats;
    }
    setScreen('result');
  };

  return (
    <main className="grid-bg" style={{ width: '100%', height: '100%' }}>
      {screen === 'landing' && <Landing onPlay={onPlay} />}
      {screen === 'modes' && (
        <ModeSelect onPick={pickMode} onBack={() => setScreen('landing')} />
      )}
      {screen === 'ingame' && activeMode && (
        <InGame
          mode={activeMode}
          onEnd={endGame}
          onBack={() => setScreen('modes')}
        />
      )}
      {screen === 'stub' && activeMode && (
        <StubScreen mode={activeMode} onBack={() => setScreen('modes')} />
      )}
      {screen === 'result' && result && (
        <ResultCard
          result={result}
          onPlayAgain={() => {
            const m = MODE_BY_ID[result.modeId];
            if (m) pickMode(m);
          }}
          onModes={() => setScreen('modes')}
        />
      )}
    </main>
  );
}
