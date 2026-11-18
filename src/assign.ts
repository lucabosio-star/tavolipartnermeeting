/**
 * Logica di assegnazione ai tavoli.
 *
 * Per ogni tavolo con posti liberi si calcola un COSTO (più basso = meglio):
 *   distanza dal profilo del tavolo (seed del facilitatore, altrimenti media degli occupanti)
 *   + penalità per persone dello stesso gruppo (azienda / dipartimento Danfoss) già sedute
 *   + leggera preferenza per i tavoli meno pieni
 * Il tavolo con costo minimo vince; a parità decide il caso.
 */
import { DIM_KEYS } from './quiz';

export interface TableState {
  id: number;
  capacity: number;
  seed: number[] | null;          // vettore del facilitatore
  occupants: { vector: number[] | null; group: string }[];
}

export interface Candidate { vector: number[]; group: string }

export interface Weights { maxSameGroup: number; groupSoft: number; groupHard: number; fill: number }
export const DEFAULT_WEIGHTS: Weights = { maxSameGroup: 2, groupSoft: 1.5, groupHard: 12, fill: 4 };

const MAX_DIST = Math.sqrt(DIM_KEYS.length * 16); // 8 con 4 dimensioni in [-2,2]

export function distance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

export function tableProfile(t: TableState): number[] | null {
  if (t.seed) return t.seed;
  const vs = t.occupants.map(o => o.vector).filter((v): v is number[] => !!v);
  if (!vs.length) return null;
  return DIM_KEYS.map((_, i) => vs.reduce((acc, v) => acc + v[i], 0) / vs.length);
}

export function tableCost(t: TableState, c: Candidate, w: Weights): number {
  const profile = tableProfile(t);
  // Tavolo senza profilo: costo neutro a metà scala, così non attira né respinge.
  const dist = profile ? distance(profile, c.vector) : MAX_DIST / 2;
  const same = c.group ? t.occupants.filter(o => o.group === c.group).length : 0;
  const groupPenalty = same < w.maxSameGroup ? same * w.groupSoft : w.groupHard + (same - w.maxSameGroup) * w.groupHard;
  const fill = (t.occupants.length / Math.max(1, t.capacity)) * w.fill;
  return dist + groupPenalty + fill;
}

/** Tavoli ordinati dal migliore al peggiore (solo quelli con posti liberi). */
export function rankTables(tables: TableState[], c: Candidate, w: Weights, rnd: () => number = Math.random): number[] {
  return tables
    .filter(t => t.occupants.length < t.capacity)
    .map(t => ({ id: t.id, cost: tableCost(t, c, w) + rnd() * 1e-6 }))
    .sort((a, b) => a.cost - b.cost)
    .map(x => x.id);
}

/**
 * Riassegnazione globale (solo da admin): facilitatori fissi, tutti gli altri ridistribuiti.
 * Prova più ordini casuali e tiene la soluzione con costo totale minimo.
 */
export function rebalance(
  tables: { id: number; capacity: number; seed: number[] | null }[],
  fixed: { guestId: number; tableId: number; vector: number[] | null; group: string }[],
  movable: { guestId: number; vector: number[]; group: string }[],
  w: Weights,
  rounds = 30,
): Map<number, number> {
  let best: Map<number, number> | null = null;
  let bestCost = Infinity;
  for (let r = 0; r < rounds; r++) {
    const state: TableState[] = tables.map(t => ({ id: t.id, capacity: t.capacity, seed: t.seed, occupants: [] }));
    const byId = new Map(state.map(t => [t.id, t]));
    for (const f of fixed) byId.get(f.tableId)?.occupants.push({ vector: f.vector, group: f.group });
    const order = [...movable].sort(() => Math.random() - 0.5);
    const result = new Map<number, number>();
    let total = 0;
    for (const m of order) {
      const ranked = rankTables(state, m, w);
      if (!ranked.length) { total = Infinity; break; }
      const t = byId.get(ranked[0])!;
      total += tableCost(t, m, w);
      t.occupants.push({ vector: m.vector, group: m.group });
      result.set(m.guestId, t.id);
    }
    if (total < bestCost) { bestCost = total; best = result; }
  }
  return best ?? new Map();
}
