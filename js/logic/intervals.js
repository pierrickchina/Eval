// Minuteur par intervalles (Circuit training) : préparation, puis travail / récupération jusqu'à la durée totale.
export const CT_PRESETS = [5, 8, 12]; // minutes
export const CT_DEFAULT = { work: 30, rest: 15, total: 8, prep: 5 };

/** Phase à l'instant `ms` (temps écoulé depuis le départ). Durées en secondes, total en minutes. */
export function intervalAt(cfg, ms) {
  const prep = (cfg.prep || 0) * 1000, w = cfg.work * 1000, r = cfg.rest * 1000, T = cfg.total * 60000;
  const cycle = w + r;
  const rounds = Math.max(1, Math.ceil(T / cycle));
  if (ms < prep) return { phase: 'prep', round: 0, rounds, left: prep - ms, totalLeft: T };
  const t = ms - prep;
  if (t >= T) return { phase: 'done', round: rounds, rounds, left: 0, totalLeft: 0 };
  const round = Math.floor(t / cycle) + 1;
  const inCycle = t % cycle;
  const end = Math.min(T, (round - 1) * cycle + (inCycle < w ? w : cycle)); // la dernière phase s'arrête à la durée totale
  return { phase: inCycle < w ? 'work' : 'rest', round, rounds, left: end - t, totalLeft: T - t };
}
