/**
 * LIQO gamification — pure, deterministic leaderboard scoring.
 *
 * Salesperson points are derived ONLY from logged journey outcomes (the
 * `sessions` table / offline session log), so the leaderboard is explainable
 * and tamper-evident: every point traces back to a bill. No randomness.
 *
 * Points per completed bill:
 *   +100  base (a sale closed: bought-recommended OR bought-different)
 *   +120 × max(0, itemsPerBill − 1)   reward attach (the north-star metric)
 *   +60   if the customer bought the recommended pick (trust in the engine)
 *
 * Weekly = last 7 days, monthly = last 30 days, relative to `nowISO`.
 */

export interface SessionRecord {
  userId: string | null;
  storeId: string | null;
  /** bought-recommended | bought-different | still-thinking | new-customer | null */
  outcome: string | null;
  itemsPerBill: number | null;
  total: number | null;
  /** ISO timestamp (client ts, else server created_at). */
  ts: string | null;
}

export interface RosterEntry {
  name: string;
  storeId: string;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  storeId: string;
  weekPoints: number;
  monthPoints: number;
  bills: number;
  itemsPerBill: number;
  recoRate: number;
  streak: number;
}

const BILL_POINTS = 100;
const IPB_BONUS = 120;
const RECO_BONUS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Outcomes that count as a closed sale (a "bill"). */
export function isBill(outcome: string | null): boolean {
  return outcome === "bought-recommended" || outcome === "bought-different";
}

/** Points awarded for a single completed bill (0 for a non-sale). */
export function pointsForSession(s: SessionRecord): number {
  if (!isBill(s.outcome)) return 0;
  const ipb = s.itemsPerBill ?? 1;
  let pts = BILL_POINTS + IPB_BONUS * Math.max(0, ipb - 1);
  if (s.outcome === "bought-recommended") pts += RECO_BONUS;
  return Math.round(pts);
}

const dayKey = (iso: string): string => iso.slice(0, 10);

/** Consecutive calendar days (UTC) ending at `now` that have ≥1 bill. */
function computeStreak(billDays: Set<string>, now: number): number {
  let streak = 0;
  for (let d = 0; d < 400; d++) {
    const key = dayKey(new Date(now - d * DAY_MS).toISOString());
    if (billDays.has(key)) streak++;
    else if (d === 0) continue; // today may be empty mid-shift; don't break the run
    else break;
  }
  return streak;
}

/**
 * Aggregate session records into one leaderboard row per roster member.
 * Members with no bills appear with zeros (so the whole team is visible).
 */
export function computeLeaderboard(
  sessions: SessionRecord[],
  roster: Record<string, RosterEntry>,
  nowISO: string,
): LeaderboardRow[] {
  const now = Date.parse(nowISO);
  const acc = new Map<string, {
    storeId: string; week: number; month: number; bills: number; ipbSum: number; reco: number; days: Set<string>;
  }>();
  const ensure = (id: string) => {
    let a = acc.get(id);
    if (!a) { a = { storeId: "", week: 0, month: 0, bills: 0, ipbSum: 0, reco: 0, days: new Set() }; acc.set(id, a); }
    return a;
  };

  for (const s of sessions) {
    if (!s.userId || !isBill(s.outcome)) continue;
    const ts = s.ts ? Date.parse(s.ts) : NaN;
    if (Number.isNaN(ts)) continue;
    const ageDays = (now - ts) / DAY_MS;
    if (ageDays > 30 || ageDays < -1) continue; // ignore stale / clock-skewed future
    const a = ensure(s.userId);
    if (s.storeId) a.storeId = s.storeId;
    const pts = pointsForSession(s);
    a.month += pts;
    if (ageDays <= 7) a.week += pts;
    a.bills += 1;
    a.ipbSum += s.itemsPerBill ?? 1;
    if (s.outcome === "bought-recommended") a.reco += 1;
    a.days.add(dayKey(new Date(ts).toISOString()));
  }

  // Emit a row for every roster member (active or not), plus any unknown ids seen.
  const ids = new Set<string>([...Object.keys(roster), ...acc.keys()]);
  const rows: LeaderboardRow[] = [];
  for (const id of ids) {
    const a = acc.get(id);
    const meta = roster[id];
    rows.push({
      userId: id,
      name: meta?.name ?? id,
      storeId: meta?.storeId ?? a?.storeId ?? "",
      weekPoints: a?.week ?? 0,
      monthPoints: a?.month ?? 0,
      bills: a?.bills ?? 0,
      itemsPerBill: a && a.bills > 0 ? a.ipbSum / a.bills : 0,
      recoRate: a && a.bills > 0 ? a.reco / a.bills : 0,
      streak: a ? computeStreak(a.days, now) : 0,
    });
  }
  rows.sort((x, y) => y.monthPoints - x.monthPoints);
  return rows;
}

/**
 * Overlay locally-logged sessions on top of a seeded/baseline board (offline
 * demo): a signed-in salesperson sees their own row climb as they close
 * journeys, while the rest of the seeded board stays put.
 */
export function mergeLeaderboard(
  base: LeaderboardRow[],
  sessions: SessionRecord[],
  nowISO: string,
): LeaderboardRow[] {
  const roster: Record<string, RosterEntry> = {};
  for (const r of base) roster[r.userId] = { name: r.name, storeId: r.storeId };
  const deltas = new Map(computeLeaderboard(sessions, roster, nowISO).map((r) => [r.userId, r]));

  const merged = base.map((b) => {
    const d = deltas.get(b.userId);
    if (!d || d.bills === 0) return b;
    const bills = b.bills + d.bills;
    return {
      ...b,
      weekPoints: b.weekPoints + d.weekPoints,
      monthPoints: b.monthPoints + d.monthPoints,
      bills,
      itemsPerBill: (b.itemsPerBill * b.bills + d.itemsPerBill * d.bills) / Math.max(1, bills),
      recoRate: (b.recoRate * b.bills + d.recoRate * d.bills) / Math.max(1, bills),
      streak: Math.max(b.streak, d.streak),
    };
  });
  merged.sort((x, y) => y.monthPoints - x.monthPoints);
  return merged;
}
