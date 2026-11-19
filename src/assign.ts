/**
 * Logica di assegnazione ai tavoli.
 *
 * Per ogni tavolo con posti liberi si calcola un COSTO (più basso = meglio):
 *   distanza dal profilo del tavolo (seed del facilitatore, altrimenti media degli occupanti)
 *   + penalità per persone dello stesso gruppo (azienda / dipartimento Danfoss) già sedute
 *   + penalità se il tavolo ha già "troppe" persone dello stesso genere rispetto alla quota globale
 *   + regola "almeno N esterni per tavolo": gli interni (Danfoss) non possono occupare i posti
 *     che servono ancora agli esterni; gli esterni sono attratti dai tavoli sotto il minimo
 *   + regola "nessun esterno da solo": i colleghi della stessa azienda esterna si siedono a coppie;
 *     chi resterebbe spaiato si unisce a una coppia e forma un trio (3 = trio, 5 = 2+3, 7 = 2+2+3)
 *   + leggera preferenza per i tavoli meno pieni
 * Il "gruppo" è l'azienda per gli esterni e il dipartimento per Danfoss; la penalità "stesso gruppo"
 * si applica solo agli interni, perché per gli esterni la coppia è voluta.
 * Il tavolo con costo minimo vince; a parità decide il caso.
 */
import { DIM_KEYS, SCORE_MAX } from './quiz';

export interface TableState {
  id: number;
  capacity: number;
  seed: number[] | null;          // vettore del facilitatore
  occupants: { vector: number[] | null; group: string; gender: string; internal: boolean }[];
}

export interface Candidate {
  vector: number[]; group: string; gender: string; internal: boolean;
  /** Solo esterni: colleghi della stessa azienda ancora da assegnare (escluso il candidato). */
  remaining?: number;
}

export interface Weights {
  maxSameGroup: number; groupSoft: number; groupHard: number; fill: number;
  gender: number;                       // peso del bilanciamento di genere
  genderShare: Record<string, number>;  // quota globale per genere, es. { M: 0.79, F: 0.21 }
  minExternal: number;                  // minimo di esterni per tavolo (0 = regola spenta)
  externalPull: number;                 // sconto per un esterno verso un tavolo sotto il minimo
  buddyPull: number;                    // sconto per un esterno verso il tavolo dove un collega è solo
  buddies: boolean;                     // regola "nessun esterno da solo" attiva
  remainingByGroup?: Record<string, number>; // esterni ancora da assegnare, per azienda (stato, fornito dal chiamante)
}
export const DEFAULT_WEIGHTS: Weights = { maxSameGroup: 2, groupSoft: 1.5, groupHard: 12, fill: 4, gender: 3, genderShare: {}, minExternal: 2, externalPull: 3, buddyPull: 25, buddies: true };

const countGroup = (t: TableState, group: string) => (group ? t.occupants.filter(o => o.group === group).length : 0);
const externalGroupsAt = (t: TableState) => { const c: Record<string, number> = {}; for (const o of t.occupants) if (!o.internal && o.group) c[o.group] = (c[o.group] || 0) + 1; return c; };
const pairExistsElsewhere = (all: TableState[], group: string, except: TableState) => all.some(t => t !== except && countGroup(t, group) >= 2);

/**
 * Posti che un'azienda esterna presente al tavolo deve ancora vedersi riservati, dato il numero di colleghi
 * non ancora assegnati (w.remainingByGroup). Uno solo al tavolo: gli serve il compagno (1), o due compagni
 * se l'azienda è di tre persone in tutto (trio). Una coppia con un ultimo collega in arrivo e nessun'altra
 * coppia altrove: 1 posto per il trio.
 */
function seatsNeededByGroup(t: TableState, group: string, count: number, w: Weights, all: TableState[]): number {
  const r = w.remainingByGroup?.[group] ?? 0;
  if (count === 1) return r === 0 ? 0 : (count + r === 3 ? 2 : 1);
  if (count >= 2) return r === 1 && !pairExistsElsewhere(all, group, t) ? 1 : 0;
  return 0;
}
/** Posti da lasciare liberi al tavolo per i colleghi delle ALTRE aziende esterne già presenti. */
export function seatsNeededByOthers(t: TableState, exceptGroup: string, w: Weights, all: TableState[]): number {
  if (!w.buddies) return 0;
  let n = 0;
  for (const [g, c] of Object.entries(externalGroupsAt(t))) if (g !== exceptGroup) n += seatsNeededByGroup(t, g, c, w, all);
  return n;
}
/** Aziende esterne presenti al tavolo con una sola persona (per il pannello e i test). */
export function openPairs(t: TableState, exceptGroup = ''): number {
  return Object.entries(externalGroupsAt(t)).filter(([g, n]) => n === 1 && g !== exceptGroup).length;
}
/** Posti che un interno NON può occupare: servono agli esterni per il minimo o per i colleghi in arrivo. */
export function seatsReservedForExternals(t: TableState, w: Weights, all: TableState[] = [t]): number {
  const ext = t.occupants.filter(o => !o.internal).length;
  const forMinimum = w.minExternal > 0 ? Math.max(0, w.minExternal - ext) : 0;
  return Math.max(forMinimum, seatsNeededByOthers(t, '', w, all));
}
/** Il candidato può sedersi a questo tavolo rispettando le regole? */
export function canSeat(t: TableState, c: Candidate, w: Weights, all: TableState[] = [t]): boolean {
  const free = t.capacity - t.occupants.length;
  if (free <= 0) return false;
  if (c.internal) return free - 1 >= seatsReservedForExternals(t, w, all);
  if (!w.buddies || !c.group) return true;
  const mine = countGroup(t, c.group);
  const others = seatsNeededByOthers(t, c.group, w, all); // posti da lasciare ai colleghi delle altre aziende
  const remaining = c.remaining ?? 0;
  const total = mine + 1 + remaining;                    // quanti saremo in tutto, della mia azienda
  if (mine === 1) return free - (total === 3 ? 2 : 1) >= others;      // raggiungo il collega (e, se siamo in tre, tengo il posto al terzo)
  if (mine >= 2) return remaining === 0 && free - 1 >= others;         // mi unisco a una coppia solo se sono l'ultimo (trio)
  if (remaining === 0) return free - 1 >= others;                      // ultimo e nessun collega seduto: tavolo normale
  return free - (total === 3 ? 3 : 2) >= others;                       // apro una coppia (o un trio): posto per chi arriva
}
/** True se un collega dello stesso gruppo è già seduto a qualche tavolo. */
export const groupSeatedSomewhere = (tables: TableState[], group: string) => !!group && tables.some(t => countGroup(t, group) > 0);

const MAX_DIST = Math.sqrt(DIM_KEYS.length * (2 * SCORE_MAX) ** 2); // distanza massima tra due profili

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
  const same = countGroup(t, c.group);
  // Stesso gruppo: penalità solo per gli interni (dipartimenti Danfoss). Per gli esterni vale la regola dei compagni.
  let groupPenalty = 0;
  if (c.internal || !w.buddies) groupPenalty = same < w.maxSameGroup ? same * w.groupSoft : w.groupHard + (same - w.maxSameGroup) * w.groupHard;
  else if (same === 1) groupPenalty = -w.buddyPull;                   // il collega è solo: lo raggiungo
  else if (same >= 2) groupPenalty = (same - 1) * w.groupSoft;         // trio ammesso, ma preferisco la coppia più piccola
  const fill = (t.occupants.length / Math.max(1, t.capacity)) * w.fill;
  // Genere: quante persone di questo genere ci sarebbero dopo l'ingresso, rispetto a quante
  // "dovrebbero" essercene secondo la quota globale. Il surplus viene penalizzato: così la
  // minoranza viene distribuita su tutti i tavoli invece di concentrarsi.
  let genderPenalty = 0;
  const share = c.gender ? w.genderShare[c.gender] : undefined;
  if (share !== undefined && share > 0 && share < 1) {
    const same = t.occupants.filter(o => o.gender === c.gender).length;
    const expected = share * (t.occupants.length + 1);
    genderPenalty = Math.max(0, same + 1 - expected) * w.gender;
  }
  // Esterni: attratti dai tavoli che non hanno ancora raggiunto il minimo.
  let externalBonus = 0;
  if (!c.internal && seatsReservedForExternals(t, w) > 0) externalBonus = -w.externalPull;
  return dist + groupPenalty + fill + genderPenalty + externalBonus;
}

/** Tavoli ordinati dal migliore al peggiore (solo quelli con posti liberi). */
export function rankTables(tables: TableState[], c: Candidate, w: Weights, rnd: () => number = Math.random): number[] {
  let free = tables.filter(t => canSeat(t, c, w, tables));
  // Ultimo della sua azienda e i colleghi sono già seduti: non deve restare solo, va da loro.
  if (!c.internal && w.buddies && c.group && (c.remaining ?? 0) === 0 && groupSeatedSomewhere(tables, c.group)) {
    const withMates = free.filter(t => countGroup(t, c.group) > 0);
    if (withMates.length) free = withMates;
  }
  // Se la riserva per gli esterni non lascia alcun tavolo a un interno, meglio sederlo comunque che lasciarlo in piedi.
  if (!free.length) free = tables.filter(t => t.occupants.length < t.capacity);
  return free
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
  fixed: { guestId: number; tableId: number; vector: number[] | null; group: string; gender: string; internal: boolean }[],
  movable: { guestId: number; vector: number[]; group: string; gender: string; internal: boolean }[],
  w: Weights,
  rounds = 30,
): Map<number, number> {
  let best: Map<number, number> | null = null;
  let bestCost = Infinity;
  for (let r = 0; r < rounds; r++) {
    const state: TableState[] = tables.map(t => ({ id: t.id, capacity: t.capacity, seed: t.seed, occupants: [] }));
    const byId = new Map(state.map(t => [t.id, t]));
    for (const f of fixed) byId.get(f.tableId)?.occupants.push({ vector: f.vector, group: f.group, gender: f.gender, internal: f.internal });
    // Esterni prima, azienda per azienda (ordine delle aziende casuale), così le coppie si formano in sequenza.
    const shuffled = [...movable].sort(() => Math.random() - 0.5);
    const groupOrder = new Map<string, number>();
    for (const m of shuffled) if (!m.internal && !groupOrder.has(m.group)) groupOrder.set(m.group, groupOrder.size);
    const order = shuffled.sort((a, b) => Number(a.internal) - Number(b.internal) || (groupOrder.get(a.group) ?? 0) - (groupOrder.get(b.group) ?? 0));
    const left: Record<string, number> = {};
    for (const m of order) if (!m.internal) left[m.group] = (left[m.group] || 0) + 1;
    const wr: Weights = { ...w, remainingByGroup: left };
    const result = new Map<number, number>();
    let total = 0;
    for (const m of order) {
      if (!m.internal) left[m.group]--;
      const cand: Candidate = { ...m, remaining: m.internal ? undefined : left[m.group] };
      const ranked = rankTables(state, cand, wr);
      if (!ranked.length) { total = Infinity; break; }
      const t = byId.get(ranked[0])!;
      total += tableCost(t, cand, wr);
      t.occupants.push({ vector: m.vector, group: m.group, gender: m.gender, internal: m.internal });
      result.set(m.guestId, t.id);
    }
    if (total < bestCost) { bestCost = total; best = result; }
  }
  return best ?? new Map();
}

/** Quota globale per genere calcolata sulla lista invitati (solo generi valorizzati). */
export function genderShares(genders: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const g of genders) if (g) { counts[g] = (counts[g] || 0) + 1; total++; }
  const out: Record<string, number> = {};
  for (const [g, n] of Object.entries(counts)) out[g] = n / total;
  return out;
}
