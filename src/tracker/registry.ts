// 🎛 Counter registry - maps a mode id to its IRepCounter. Add new mechanics here.

import type { IRepCounter } from './IRepCounter';
import { SuiiRepCounter } from './SuiiRepCounter';
import { DrumRepCounter } from './DrumRepCounter';
import { MbappeRepCounter } from './MbappeRepCounter';
import { GuessPlayerCounter } from './GuessPlayerCounter';

export function pickCounter(mode: string): IRepCounter {
  switch (mode) {
    case 'siuu': // documented raise-to-sky config (suiicontext.md)
      return new SuiiRepCounter();
    case 'drum':
      return new DrumRepCounter();
    case 'mbappe':
      return new MbappeRepCounter();
    case 'guess':
      return new GuessPlayerCounter();
    default:
      return new SuiiRepCounter();
  }
}
