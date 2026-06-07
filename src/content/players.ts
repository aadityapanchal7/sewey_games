// World Cup trivia for GUESS THE GOAT. Each question shows a clue and two player
// cards (left / right); the player points to the correct one.

export interface Player {
  name: string;
  flag: string;
}

export interface Question {
  prompt: string;
  left: Player;
  right: Player;
  correct: 'left' | 'right';
}

const M = (name: string, flag: string): Player => ({ name, flag });

export const QUESTIONS: Question[] = [
  { prompt: '🏆 Won the 2022 World Cup', left: M('Messi', '🇦🇷'), right: M('Mbappé', '🇫🇷'), correct: 'left' },
  { prompt: 'Famous "SIUUU" celebration', left: M('Mbappé', '🇫🇷'), right: M('Ronaldo', '🇵🇹'), correct: 'right' },
  { prompt: '2022 WC Golden Boot (8 goals)', left: M('Mbappé', '🇫🇷'), right: M('Messi', '🇦🇷'), correct: 'left' },
  { prompt: '🇧🇷 Samba star, Brazil #10', left: M('Neymar', '🇧🇷'), right: M('Haaland', '🇳🇴'), correct: 'left' },
  { prompt: 'The Egyptian King 🇪🇬', left: M('Salah', '🇪🇬'), right: M('Kane', '🏴'), correct: 'left' },
  { prompt: '🏴 England captain & striker', left: M('Modrić', '🇭🇷'), right: M('Kane', '🏴'), correct: 'right' },
  { prompt: 'Won the 2018 World Cup, France', left: M('Mbappé', '🇫🇷'), right: M('Messi', '🇦🇷'), correct: 'left' },
  { prompt: 'Norway goal machine, Man City', left: M('Haaland', '🇳🇴'), right: M('Vinícius', '🇧🇷'), correct: 'left' },
  { prompt: '🇵🇹 All-time top intl scorer', left: M('Ronaldo', '🇵🇹'), right: M('Neymar', '🇧🇷'), correct: 'left' },
  { prompt: 'Croatia maestro, 2018 Golden Ball', left: M('Modrić', '🇭🇷'), right: M('Mbappé', '🇫🇷'), correct: 'left' },
  { prompt: '8 Ballon d’Ors 🐐', left: M('Messi', '🇦🇷'), right: M('Lewandowski', '🇵🇱'), correct: 'left' },
  { prompt: 'Poland’s prolific striker', left: M('Lewandowski', '🇵🇱'), right: M('Salah', '🇪🇬'), correct: 'left' },
  { prompt: '🇧🇷 Real Madrid samba winger', left: M('Vinícius', '🇧🇷'), right: M('Kane', '🏴'), correct: 'left' },
  { prompt: 'Germany legend, 2014 WC winner', left: M('Müller', '🇩🇪'), right: M('Salah', '🇪🇬'), correct: 'left' },
];

// Fisher-Yates with an injected RNG (avoids Math.random at module scope concerns).
export function shuffledQuestions(): Question[] {
  const a = [...QUESTIONS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
