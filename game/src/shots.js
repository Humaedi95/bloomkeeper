// The screenshot scenes behind ?shot=start|play|bloom|end|win. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot (collect pollen, then bloom the
// nearest bud, while keeping clear of wasps), so the frame is what a short
// game really looks like and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 20;
const BLOOM_SECONDS = 45;
const MID_SECONDS = 28;
const END_LIMIT_SECONDS = 600;
const WIN_LIMIT_SECONDS = 600;

/** How far ahead, in seconds, the autopilot checks a wasp: the play and win
 *  pilots look well ahead and keep their hearts; the end pilot looks only a
 *  moment ahead, so it is caught out as a hurried player is. */
const HORIZON_PLAY = 50;
const HORIZON_WIN = 50;
const HORIZON_END = 50;
/** Steer toward the goal (pollen, then the nearest bud), unless a wasp is too close.
 *  `horizon` is the flee radius: a careful pilot flees from far away, a hurried
 *  one only at the last moment, so it is caught out. */
function autopilot(world, horizon) {
  const state = world.state;
  const bee = state.bee;
  const target = state.pollenCarried === 0 ? world.nearestPollen() : world.nearestUnbloomedFlower();
  const goal = target === null ? { x: FIELD.width / 2, y: FIELD.height / 2 } : target;
  const dx = goal.x - bee.x;
  const dy = goal.y - bee.y;
  const length = Math.hypot(dx, dy) || 1;
  const wanted = { x: dx / length, y: dy / length };
  const nearest = world.nearestWasp();
  if (nearest !== null && Math.hypot(nearest.x - bee.x, nearest.y - bee.y) < horizon) {
    // Flee: run directly away from the wasp.
    const away = { x: (bee.x - nearest.x) / horizon, y: (bee.y - nearest.y) / horizon };
    const awayLength = Math.hypot(away.x, away.y) || 1;
    return { x: away.x / awayLength, y: away.y / awayLength };
  }
  return wanted;
}

/** Run the world forward for `seconds`, steered by the autopilot, until it ends. */
function simulate(world, seconds, horizon) {
  for (let index = 0; index < seconds / STEP; index += 1) {
    const steer = autopilot(world, horizon);
    if (world.step(STEP, steer, false, false) & EVENT_OVER) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    simulate(world, PLAY_SECONDS, HORIZON_PLAY);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'bloom') {
    simulate(world, BLOOM_SECONDS, HORIZON_PLAY);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'mid') {
    simulate(world, MID_SECONDS, HORIZON_PLAY);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    simulate(world, END_LIMIT_SECONDS, HORIZON_END);
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  if (name === 'win') {
    simulate(world, WIN_LIMIT_SECONDS, HORIZON_WIN);
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, null, false, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
