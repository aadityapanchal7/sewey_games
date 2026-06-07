// 🎛 The Mode config — the single data source every screen reads. Four World Cup
// celebration games. To add a variant: append a Mode, implement its IRepCounter,
// register it in tracker/registry.ts, add audio rep/bg, optional visual layer.

export interface Mode {
  id: string; // stable key, used by tracker registry + stores + audio
  name: string; // display name
  emoji: string; // card icon
  tagline: string; // ready-prompt subtitle
  instructions: string; // how-to-play line (in-game)
  framingHint: string; // camera-framing tip (shown during loading + ready)
  color: string; // accent (HUD numbers)
  bg: string; // card background (color OR css gradient)
  hot: boolean; // "HOT" badge
  repNoun: string; // pluralized score unit
  hitWord: string; // word that flies off on each hit
  sample: string; // onomatopoeia on the card
  wired: boolean; // true → InGame; false → StubScreen
  hitColors?: string[]; // flying-word colors, cycled per hit
  scoring?: 'counter' | 'quiz'; // how score is produced (default 'counter')
  showFace?: boolean; // overlay the Speed face on the player
}

// World Cup nation palettes
export const PT_RED = '#e63946';
export const PT_GREEN = '#0f9d58';
export const BR_GREEN = '#16a34a';
export const BR_GOLD = '#ffcf33';
export const FR_BLUE = '#2b6cd4';
export const FR_RED = '#e63946';
export const RADIANT_GOLD = '#ffcf33';

export const MODES: Mode[] = [
  {
    id: 'siuu',
    name: 'SIUUU',
    emoji: '🐐',
    tagline: 'raise both arms to the sky · SIUUU!',
    instructions: 'raise an arm up to the sky to score',
    framingHint: 'Hold the phone back so your head AND hands fit on screen.',
    color: RADIANT_GOLD,
    bg: `radial-gradient(circle at 50% 30%, ${RADIANT_GOLD} 0%, ${PT_GREEN} 75%, ${PT_RED} 140%)`,
    hot: true,
    repNoun: 'siuuus',
    hitWord: 'SIUUU!',
    sample: 'siuuu~',
    wired: true,
    hitColors: [PT_RED, PT_GREEN],
    scoring: 'counter',
    showFace: true,
  },
  {
    id: 'drum',
    name: 'SAMBA DRUMS',
    emoji: '🥁',
    tagline: 'arms out · drum up & down',
    instructions: 'hands up in front · drum them up & down',
    framingHint: 'Step back so both hands are visible in front of you.',
    color: BR_GOLD,
    bg: `radial-gradient(circle at 50% 30%, ${BR_GOLD} 0%, ${BR_GREEN} 80%)`,
    hot: false,
    repNoun: 'beats',
    hitWord: 'BOOM!',
    sample: 'dum-dum~',
    wired: true,
    hitColors: [BR_GREEN, BR_GOLD],
    scoring: 'counter',
  },
  {
    id: 'mbappe',
    name: 'MBAPPÉ',
    emoji: '🇫🇷',
    tagline: 'hands on chest · unfold · repeat',
    instructions: 'fold hands on chest · open out · fold back',
    framingHint: 'Keep your head and chest in frame.',
    color: FR_BLUE,
    bg: `radial-gradient(circle at 50% 30%, ${FR_BLUE} 0%, #1b3a8a 80%, ${FR_RED} 150%)`,
    hot: true,
    repNoun: 'celebrations',
    hitWord: 'MBAPPÉ!',
    sample: 'arms-cross~',
    wired: true,
    hitColors: [FR_BLUE, FR_RED],
    scoring: 'counter',
  },
  {
    id: 'guess',
    name: 'GUESS THE GOAT',
    emoji: '⚽',
    tagline: 'point to the right player',
    instructions: 'point one hand left or right · hold to pick',
    framingHint: 'Keep your shoulders in frame, then point.',
    color: RADIANT_GOLD,
    bg: `radial-gradient(circle at 50% 30%, ${RADIANT_GOLD} 0%, #c98a00 90%)`,
    hot: true,
    repNoun: 'correct',
    hitWord: 'GOAL!',
    sample: 'who is it?',
    wired: true,
    hitColors: [RADIANT_GOLD, '#ffffff'],
    scoring: 'quiz',
  },
];

export const MODE_BY_ID: Record<string, Mode> = Object.fromEntries(
  MODES.map((m) => [m.id, m])
);
