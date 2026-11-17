// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. The garden is drawn fresh every frame:
// sky and sun, grass, flowers opening petal by petal, the bee and wasps,
// pollen sparkles, particles, and a HUD that reads at a glance.

import { BEE, DAYLIGHT_SECONDS, FIELD, FLOWERS_TOTAL, FONT, PALETTE, WASP } from './config.js';
import { EVENT_BLOOM } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) { value = next; text = prefix + next; }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const finalLabel = cachedLabel('Score ');
  const flowersLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    // Callers set textBaseline before calling: 'top' for the HUD, 'alphabetic' for panels.
    context.fillText(value, x, y);
  }

  function drawSky(state) {
    const dusk = Math.min(1, state.elapsed / DAYLIGHT_SECONDS);
    const top = dusk < 0.75 ? PALETTE.skyTop : PALETTE.duskTop;
    const bottom = dusk < 0.75 ? PALETTE.skyBottom : PALETTE.duskBottom;
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // The sun arcs across the sky as daylight runs out.
    const sunX = 120 + (FIELD.width - 240) * dusk;
    const sunY = 150 - Math.sin(dusk * Math.PI) * 70;
    context.fillStyle = '#fff3b0';
    context.beginPath();
    context.arc(sunX, sunY, 34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 243, 176, 0.35)';
    context.beginPath();
    context.arc(sunX, sunY, 52, 0, Math.PI * 2);
    context.fill();
    // Drifting clouds.
    context.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let index = 0; index < 3; index += 1) {
      const cx = ((state.elapsed * 8 + index * 430) % (FIELD.width + 240)) - 120;
      const cy = 70 + index * 46;
      context.beginPath();
      context.arc(cx, cy, 26, 0, Math.PI * 2);
      context.arc(cx + 28, cy - 8, 22, 0, Math.PI * 2);
      context.arc(cx + 56, cy, 24, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawGround(state) {
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = PALETTE.grassDark;
    for (let x = 20; x < FIELD.width; x += 64) {
      context.beginPath();
      context.moveTo(x, FIELD.groundY + 30);
      context.lineTo(x + 8, FIELD.groundY + 8);
      context.lineTo(x + 16, FIELD.groundY + 30);
      context.fill();
    }
    context.fillStyle = PALETTE.soil;
    context.fillRect(0, FIELD.groundY - 4, FIELD.width, 6);
    void state;
  }

  function drawFlower(flower, time) {
    const sway = Math.sin(time * 1.4 + flower.sway) * 3;
    const stemX = flower.x + sway;
    context.strokeStyle = '#3e7d32';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(flower.x, FIELD.groundY);
    context.quadraticCurveTo(flower.x + sway, (FIELD.groundY + flower.y) / 2, stemX, flower.y);
    context.stroke();
    const cx = stemX;
    const cy = flower.y;
    if (flower.bloomed) {
      const open = 10 + flower.bloomAnim * 10;
      context.fillStyle = flower.hue;
      for (let petal = 0; petal < 5; petal += 1) {
        const angle = (petal / 5) * Math.PI * 2 - Math.PI / 2;
        context.beginPath();
        context.ellipse(cx + Math.cos(angle) * open * 0.8, cy + Math.sin(angle) * open * 0.8, open * 0.62, open * 0.45, angle, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = '#ffd94d';
      context.beginPath();
      context.arc(cx, cy, 9, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillStyle = '#8fae7a';
      context.beginPath();
      context.arc(cx, cy, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#6d8f5c';
      context.beginPath();
      context.arc(cx, cy - 4, 5, 0, Math.PI * 2);
      context.fill();
      if (flower.progress > 0) {
        context.strokeStyle = PALETTE.gold;
        context.lineWidth = 4;
        context.beginPath();
        context.arc(cx, cy, 18, -Math.PI / 2, -Math.PI / 2 + flower.progress * Math.PI * 2);
        context.stroke();
      }
    }
  }

  function drawBee(bee) {
    if (bee.invulnerable > 0 && Math.floor(bee.invulnerable * 10) % 2 === 0) return;
    const flap = Math.sin(bee.wing) * 0.5;
    context.fillStyle = 'rgba(255, 255, 255, 0.75)';
    context.beginPath();
    context.ellipse(bee.x - 4, bee.y - 14 - flap * 4, 12, 7, -0.5, 0, Math.PI * 2);
    context.ellipse(bee.x + 6, bee.y - 14 + flap * 4, 12, 7, 0.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.bee;
    context.beginPath();
    context.ellipse(bee.x, bee.y, BEE.radius, BEE.radius * 0.82, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.beeStripe;
    context.fillRect(bee.x - 4, bee.y - BEE.radius * 0.7, 6, BEE.radius * 1.4);
    context.fillRect(bee.x + 5, bee.y - BEE.radius * 0.6, 5, BEE.radius * 1.2);
    context.fillStyle = '#1d1d1d';
    context.beginPath();
    context.arc(bee.x + bee.facing * 9, bee.y - 3, 2.5, 0, Math.PI * 2);
    context.fill();
    if (bee.shield) {
      context.strokeStyle = '#7fd4ff';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(bee.x, bee.y, BEE.radius + 8, 0, Math.PI * 2);
      context.stroke();
    }
    if (bee.dashTime > 0) {
      context.fillStyle = 'rgba(255, 217, 77, 0.5)';
      context.beginPath();
      context.ellipse(bee.x - bee.facing * 22, bee.y, 14, 6, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawWasp(wasp) {
    context.fillStyle = PALETTE.wasp;
    context.beginPath();
    context.ellipse(wasp.x, wasp.y, WASP.radius, WASP.radius * 0.8, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.waspStripe;
    context.fillRect(wasp.x - 3, wasp.y - WASP.radius * 0.7, 5, WASP.radius * 1.4);
    context.fillRect(wasp.x + 5, wasp.y - WASP.radius * 0.6, 4, WASP.radius * 1.2);
    context.fillStyle = '#ff5a5a';
    context.beginPath();
    context.arc(wasp.x + 8, wasp.y - 2, 2.5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.6)';
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(wasp.x - 4, wasp.y - 12, 9, 5, -0.5, 0, Math.PI * 2);
    context.stroke();
  }

  function drawField(state, time) {
    drawSky(state);
    drawGround(state);
    for (const flower of state.flowers) drawFlower(flower, time);
    for (const puff of state.pollen) {
      if (!puff.active) continue;
      const glow = 0.6 + Math.sin(puff.bob * 4) * 0.3;
      context.fillStyle = `rgba(255, 217, 77, ${glow})`;
      context.beginPath();
      context.arc(puff.x, puff.y, 14, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.pollen;
      context.beginPath();
      context.arc(puff.x, puff.y, 8, 0, Math.PI * 2);
      context.fill();
    }
    for (const powerup of state.powerups) {
      if (!powerup.active) continue;
      const bob = Math.sin(powerup.phase * 3) * 4;
      context.fillStyle = powerup.kind === 'shield' ? '#7fd4ff' : '#ff9f5a';
      context.beginPath();
      context.arc(powerup.x, powerup.y + bob, 15, 0, Math.PI * 2);
      context.fill();
      context.textBaseline = 'alphabetic';
      text(powerup.kind === 'shield' ? 'S' : '»', powerup.x, powerup.y + bob + 7, 20, '#20301c', 'center');
    }
    for (const wasp of state.wasps) if (wasp.active) drawWasp(wasp);
    for (const particle of state.particles) {
      if (particle.life <= 0) continue;
      context.fillStyle = particle.color;
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    drawBee(state.bee);
  }

  function drawHud(state, best) {
    context.textBaseline = 'top';
    // A dark strip keeps the HUD readable over the bright sky.
    context.fillStyle = 'rgba(24, 40, 20, 0.55)';
    context.fillRect(0, 0, FIELD.width, 56);
    text(scoreLabel(state.score), 24, 14, 26, PALETTE.text, 'left');
    text(`Flowers ${state.blooms}/${FLOWERS_TOTAL}`, FIELD.width / 2 - 90, 14, 26, PALETTE.text, 'left');
    text(`Pollen ${state.pollenCarried}`, FIELD.width / 2 + 130, 14, 26, PALETTE.gold, 'left');
    if (state.combo > 1) text(`Combo x${state.combo}`, FIELD.width - 320, 14, 26, PALETTE.gold, 'left');
    const heartsX = FIELD.width - 24;
    for (let heart = 0; heart < 3; heart += 1) {
      context.fillStyle = heart < state.hearts ? '#ff6b81' : 'rgba(255,255,255,0.3)';
      const x = heartsX - (2 - heart) * 30;
      context.beginPath();
      context.arc(x - 5, 26, 7, 0, Math.PI * 2);
      context.arc(x + 5, 26, 7, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(x - 11, 28);
      context.lineTo(x, 42);
      context.lineTo(x + 11, 28);
      context.fill();
    }
    // Daylight bar: the sun sets as the bar empties.
    const remaining = Math.max(0, DAYLIGHT_SECONDS - state.elapsed);
    context.fillStyle = 'rgba(255,255,255,0.3)';
    context.fillRect(24, FIELD.height - 22, 260, 10);
    context.fillStyle = remaining < 20 ? '#ff9f5a' : '#ffd94d';
    context.fillRect(24, FIELD.height - 22, 260 * (remaining / DAYLIGHT_SECONDS), 10);
    text(`Daylight ${Math.ceil(remaining)}s`, 292, FIELD.height - 26, 18, PALETTE.text, 'left');
    text(bestLabel(best), FIELD.width - 24, FIELD.height - 26, 18, PALETTE.muted, 'right');
    if (state.bee.shield) text('SHIELD', 24, 62, 18, '#7fd4ff', 'left');
    if (state.bee.swift > 0) text('SWIFT WINGS', 110, 62, 18, '#ff9f5a', 'left');
    void EVENT_BLOOM;
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(32, 48, 28, 0.92)';
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Bloom all 12 flowers before dusk to win.',
    'Collect golden pollen, brush a bud to bloom it.',
    'Dodge the wasps — three stings and the day is done.',
    'Move with WASD or arrows, hold the mouse to steer,',
    'click or Shift to dash. P pauses, M mutes.',
    '',
  ];
  const PAUSED_LINES = ['The wasps will wait for you.'];
  const WIN_LINES = ['', '', ''];
  const LOSE_LINES = ['', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#20301c';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state, time);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('Bloomkeeper', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      if (state.won) {
        WIN_LINES[0] = finalLabel(state.score);
        WIN_LINES[1] = `All ${FLOWERS_TOTAL} flowers bloomed before dusk!`;
        WIN_LINES[2] = bestLabel(best);
        drawPanel('Garden in Bloom!', WIN_LINES, 'Press Space or click to play again');
      } else {
        LOSE_LINES[0] = finalLabel(state.score);
        LOSE_LINES[1] = state.overReason === 'dusk'
          ? `Dusk fell with ${state.blooms} of ${FLOWERS_TOTAL} flowers bloomed.`
          : `Stung out with ${state.blooms} of ${FLOWERS_TOTAL} flowers bloomed.`;
        LOSE_LINES[2] = bestLabel(best);
        drawPanel('Game over', LOSE_LINES, 'Press Space or click to play again');
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
