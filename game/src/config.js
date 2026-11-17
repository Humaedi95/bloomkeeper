// Bloomkeeper: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720, groundY: 600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Daylight lasts this long; bloom all flowers before dusk to win. */
export const DAYLIGHT_SECONDS = 100;

export const BEE = {
  radius: 16,
  speed: 340,
  dashSpeed: 720,
  dashSeconds: 0.18,
  dashCooldown: 2.0,
  swiftMultiplier: 1.45,
  swiftSeconds: 6,
  invulnerable: 1.5,
};

export const HEARTS = 3;

export const FLOWERS_TOTAL = 12;
export const POLLEN_PER_BLOOM = 1;
export const BLOOM_POINTS = 25;
export const POLLEN_POINTS = 5;
export const COMBO_WINDOW = 6;
export const COMBO_BONUS = 5;

export const POLLEN = {
  radius: 9,
  interval: 1.1,
  intervalJitter: 0.7,
  drift: 26,
  maxOnField: 6,
};

export const WASP = {
  radius: 15,
  speed: 165,
  speedPerBloom: 7,
  maxSpeed: 235,
  interval: 5.5,
  intervalScale: 0.95,
  minInterval: 3.0,
  maxOnField: 5,
  turn: 2.6,
  lifetime: 13,
};

export const POWERUP = {
  interval: 22,
  kinds: ['shield', 'swift'],
};

/** Seconds of play per difficulty step; wasps get faster as flowers bloom. */
export const LEVEL = { seconds: 15, max: 8 };

export const POOL_SIZE = 96;

export const PALETTE = {
  skyTop: '#7ec8f2',
  skyBottom: '#cfeef7',
  duskTop: '#5a4a8a',
  duskBottom: '#f2a35e',
  grass: '#5da24a',
  grassDark: '#4a8a3c',
  soil: '#7a5230',
  bee: '#f7c948',
  beeStripe: '#2b2b2b',
  wasp: '#3a2f2f',
  waspStripe: '#f2c94c',
  pollen: '#ffd94d',
  panel: '#20301c',
  text: '#ffffff',
  muted: '#d8e8c8',
  gold: '#ffd94d',
  pink: '#ff7fa5',
  white: '#ffffff',
};

export const FLOWER_HUES = ['#ff7fa5', '#ff9f5a', '#b388ff', '#ff6b6b', '#ffd166', '#7fd4ff'];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'bloomkeeper.best';
