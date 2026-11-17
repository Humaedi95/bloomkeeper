// Bloomkeeper's rules and state, with no drawing and no browser in it:
// Pip the bee, the garden's flowers, drifting pollen, chasing wasps,
// power-ups, the daylight timer, score, hearts and combos. step() advances
// one fixed step and returns what happened as bit flags, so the caller can
// react (and play sounds) without the world knowing about screens or sound.

import {
  BEE, BLOOM_POINTS, COMBO_BONUS, COMBO_WINDOW, DAYLIGHT_SECONDS, FIELD,
  FLOWERS_TOTAL, FLOWER_HUES, HEARTS, LEVEL, POLLEN, POLLEN_PER_BLOOM,
  POLLEN_POINTS, POOL_SIZE, POWERUP, WASP,
} from './config.js';
import { range } from './random.js';

export const EVENT_COLLECT = 1;
export const EVENT_BLOOM = 2;
export const EVENT_HIT = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_POWERUP = 32;
export const EVENT_DASH = 64;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createWorld(random) {
  const bee = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
    invulnerable: 0, shield: false, swift: 0, dashTime: 0, dashCooldown: 0,
    facing: 1, wing: 0,
  };
  const flowers = [];
  const pollen = [];
  const wasps = [];
  const powerups = [];
  const particles = [];
  const state = {
    bee, flowers, pollen, wasps, powerups, particles,
    score: 0, hearts: HEARTS, blooms: 0, pollenCarried: 0,
    combo: 0, comboTimer: 0, elapsed: 0, level: 1,
    pollenTimer: 0.4, waspTimer: 5, powerupTimer: POWERUP.interval,
    won: false, over: false, overReason: '',
  };

  function scatterFlowers() {
    flowers.length = 0;
    const cols = 4;
    const rows = 3;
    for (let index = 0; index < FLOWERS_TOTAL; index += 1) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = 110 + col * 360 + range(random, -70, 70);
      const y = 130 + row * 150 + range(random, -45, 45);
      flowers.push({
        x, y, bloomed: false, bloomAnim: 0, progress: 0,
        hue: FLOWER_HUES[index % FLOWER_HUES.length], sway: random() * Math.PI * 2,
      });
    }
  }

  function reset() {
    bee.x = FIELD.width / 2;
    bee.y = FIELD.height / 2;
    bee.vx = 0; bee.vy = 0;
    bee.invulnerable = 0; bee.shield = false; bee.swift = 0;
    bee.dashTime = 0; bee.dashCooldown = 0;
    scatterFlowers();
    pollen.length = 0;
    wasps.length = 0;
    powerups.length = 0;
    particles.length = 0;
    state.score = 0;
    state.hearts = HEARTS;
    state.blooms = 0;
    state.pollenCarried = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.elapsed = 0;
    state.level = 1;
    state.pollenTimer = 0.4;
    state.waspTimer = 5;
    state.powerupTimer = POWERUP.interval;
    state.won = false;
    state.over = false;
    state.overReason = '';
  }

  function burst(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      if (particles.length >= POOL_SIZE) return;
      const angle = random() * Math.PI * 2;
      const velocity = range(random, speed * 0.3, speed);
      particles.push({
        x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
        life: range(random, 0.4, 0.9), maxLife: 0.9, color, size: range(random, 2, 5),
      });
    }
  }

  function spawnPollen() {
    let active = 0;
    for (const puff of pollen) if (puff.active) active += 1;
    if (active >= POLLEN.maxOnField) return;
    pollen.push({
      active: true, x: range(random, 60, FIELD.width - 60),
      y: range(random, 90, FIELD.groundY - 60),
      phase: random() * Math.PI * 2, bob: 0,
    });
  }

  function spawnWasp() {
    let active = 0;
    for (const wasp of wasps) if (wasp.active) active += 1;
    if (active >= WASP.maxOnField) return;
    const fromLeft = random() < 0.5;
    wasps.push({
      active: true,
      x: fromLeft ? -30 : FIELD.width + 30,
      y: range(random, 80, FIELD.groundY - 80),
      vx: 0, vy: 0, wobble: random() * Math.PI * 2, life: WASP.lifetime,
      speed: Math.min(WASP.maxSpeed, WASP.speed + WASP.speedPerBloom * state.blooms),
    });
  }

  function spawnPowerup() {
    const kind = POWERUP.kinds[Math.floor(random() * POWERUP.kinds.length)];
    powerups.push({
      active: true, kind,
      x: range(random, 80, FIELD.width - 80),
      y: range(random, 100, FIELD.groundY - 80), phase: 0,
    });
  }

  function nearestUnbloomedFlower() {
    let best = null;
    let bestDistance = Infinity;
    for (const flower of flowers) {
      if (flower.bloomed) continue;
      const d = distance(bee, flower);
      if (d < bestDistance) { bestDistance = d; best = flower; }
    }
    return best;
  }

  function nearestPollen() {
    let best = null;
    let bestDistance = Infinity;
    for (const puff of pollen) {
      if (!puff.active) continue;
      const d = distance(bee, puff);
      if (d < bestDistance) { bestDistance = d; best = puff; }
    }
    return best;
  }

  function nearestWasp() {
    let best = null;
    let bestDistance = Infinity;
    for (const wasp of wasps) {
      if (!wasp.active) continue;
      const d = distance(bee, wasp);
      if (d < bestDistance) { bestDistance = d; best = wasp; }
    }
    return best;
  }

  /**
   * One fixed step. `steer` is a unit {x, y} direction or null (drift to a
   * stop); `dash` asks for a burst of speed if its cooldown has passed.
   * With `harmless` set (the title screen's backdrop) wasps never sting and
   * nothing scores.
   */
  function step(dt, steer, dash, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    const speed = BEE.speed * (bee.swift > 0 ? BEE.swiftMultiplier : 1);
    if (dash && bee.dashCooldown <= 0 && steer !== null) {
      bee.dashTime = BEE.dashSeconds;
      bee.dashCooldown = BEE.dashCooldown;
      events |= EVENT_DASH;
    }
    if (bee.dashCooldown > 0) bee.dashCooldown -= dt;
    if (bee.swift > 0) bee.swift -= dt;
    if (bee.invulnerable > 0) bee.invulnerable -= dt;

    const moving = bee.dashTime > 0 ? BEE.dashSpeed : speed;
    if (bee.dashTime > 0) bee.dashTime -= dt;
    if (steer !== null) {
      bee.vx = steer.x * moving;
      bee.vy = steer.y * moving;
      if (steer.x !== 0) bee.facing = steer.x > 0 ? 1 : -1;
    } else {
      bee.vx *= 0.86;
      bee.vy *= 0.86;
    }
    bee.x = Math.min(FIELD.width - BEE.radius, Math.max(BEE.radius, bee.x + bee.vx * dt));
    bee.y = Math.min(FIELD.groundY - BEE.radius, Math.max(70, bee.y + bee.vy * dt));
    bee.wing += dt * (steer === null ? 14 : 30);

    // Pollen drifts in and is collected on touch.
    state.pollenTimer -= dt;
    if (state.pollenTimer <= 0) {
      spawnPollen();
      state.pollenTimer = POLLEN.interval + random() * POLLEN.intervalJitter;
    }
    for (const puff of pollen) {
      if (!puff.active) continue;
      puff.bob += dt;
      puff.y += Math.sin(puff.bob * 2) * POLLEN.drift * dt * 0.3;
      if (!harmless && distance(bee, puff) < BEE.radius + POLLEN.radius + 6) {
        puff.active = false;
        state.pollenCarried += 1;
        if (!harmless) state.score += POLLEN_POINTS;
        burst(puff.x, puff.y, '#ffd94d', 8, 90);
        events |= EVENT_COLLECT;
      }
    }

    // A bud blooms when the bee lingers on it while carrying pollen:
    // pollination takes 1.0 s of contact, so a wasp can catch a bee that
    // stays too long. Progress fades if the bee flies away.
    for (const flower of flowers) {
      if (flower.bloomed) {
        if (flower.bloomAnim < 1) flower.bloomAnim = Math.min(1, flower.bloomAnim + dt * 2);
        continue;
      }
      if (!harmless && state.pollenCarried >= POLLEN_PER_BLOOM && distance(bee, flower) < BEE.radius + 26) {
        flower.progress = Math.min(1, flower.progress + dt / 1.0);
      } else if (flower.progress > 0) {
        flower.progress = Math.max(0, flower.progress - dt * 0.5);
      }
      if (!harmless && flower.progress >= 1) {
        flower.bloomed = true;
        flower.bloomAnim = 0.2;
        state.pollenCarried -= POLLEN_PER_BLOOM;
        state.blooms += 1;
        state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
        state.comboTimer = COMBO_WINDOW;
        state.score += BLOOM_POINTS + (state.combo - 1) * COMBO_BONUS;
        burst(flower.x, flower.y - 20, flower.hue, 16, 140);
        burst(flower.x, flower.y - 20, '#ffd94d', 8, 100);
        events |= EVENT_BLOOM;
        if (state.blooms >= FLOWERS_TOTAL) {
          state.won = true;
          state.over = true;
          state.overReason = 'win';
          state.score += Math.max(0, Math.ceil(DAYLIGHT_SECONDS - state.elapsed)) * 10;
          events |= EVENT_WIN | EVENT_OVER;
          return events;
        }
      }
    }

    // Wasps arrive over time and chase the bee.
    state.waspTimer -= dt;
    if (state.waspTimer <= 0) {
      spawnWasp();
      const interval = Math.max(WASP.minInterval, WASP.interval * (WASP.intervalScale ** (state.level - 1)));
      state.waspTimer = interval;
    }
    for (const wasp of wasps) {
      if (!wasp.active) continue;
      wasp.life -= dt;
      if (wasp.life <= 0) { wasp.active = false; continue; }
      wasp.wobble += dt * 2;
      const dx = bee.x - wasp.x;
      const dy = bee.y - wasp.y;
      const length = Math.hypot(dx, dy) || 1;
      const wobbleX = Math.cos(wasp.wobble) * 30;
      wasp.vx += ((dx / length) * wasp.speed + wobbleX - wasp.vx) * Math.min(1, WASP.turn * dt);
      wasp.vy += ((dy / length) * wasp.speed - wasp.vy) * Math.min(1, WASP.turn * dt);
      wasp.x += wasp.vx * dt;
      wasp.y += wasp.vy * dt;
      if (wasp.x < -60 || wasp.x > FIELD.width + 60 || wasp.y < -60 || wasp.y > FIELD.height + 60) {
        wasp.active = false;
        continue;
      }
      if (!harmless && bee.invulnerable <= 0 && distance(bee, wasp) < BEE.radius + WASP.radius - 2) {
        wasp.active = false;
        if (bee.shield) {
          bee.shield = false;
          bee.invulnerable = BEE.invulnerable;
          burst(bee.x, bee.y, '#7fd4ff', 14, 160);
          events |= EVENT_HIT;
        } else {
          state.hearts -= 1;
          bee.invulnerable = BEE.invulnerable;
          state.combo = 0;
          state.comboTimer = 0;
          burst(bee.x, bee.y, '#e5534b', 14, 160);
          events |= EVENT_HIT;
          if (state.hearts <= 0) {
            state.over = true;
            state.overReason = 'stung';
            events |= EVENT_OVER;
            return events;
          }
        }
      }
    }

    // Power-ups: a shield that blocks one sting, or swift wings.
    state.powerupTimer -= dt;
    if (state.powerupTimer <= 0) {
      spawnPowerup();
      state.powerupTimer = POWERUP.interval;
    }
    for (const powerup of powerups) {
      if (!powerup.active) continue;
      powerup.phase += dt;
      if (!harmless && distance(bee, powerup) < BEE.radius + 18) {
        powerup.active = false;
        if (powerup.kind === 'shield') bee.shield = true;
        else bee.swift = BEE.swiftSeconds;
        burst(powerup.x, powerup.y, '#7fd4ff', 12, 120);
        events |= EVENT_POWERUP;
      }
    }

    // Daylight runs out: dusk ends the game unless every flower bloomed.
    if (!harmless && state.elapsed >= DAYLIGHT_SECONDS) {
      state.over = true;
      state.overReason = 'dusk';
      events |= EVENT_OVER;
      return events;
    }

    for (const particle of particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
    }

    return events;
  }

  reset();
  return {
    state, reset, step,
    nearestUnbloomedFlower, nearestPollen, nearestWasp,
  };
}
