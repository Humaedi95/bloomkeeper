// A small seeded random generator (mulberry32) so a ?seed=N run is repeatable:
// the same seed always grows the same garden and the same wasp pattern.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a value in [min, max) from the seeded generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}
