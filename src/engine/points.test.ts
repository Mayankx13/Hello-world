import { describe, expect, it } from "vitest";
import { computeLeaderboard, mergeLeaderboard, pointsForSession, isBill, pointsToInr, POINTS_PER_INR, type SessionRecord, type LeaderboardRow } from "./points";

const NOW = "2026-06-24T12:00:00.000Z";
const daysAgo = (n: number) => new Date(Date.parse(NOW) - n * 86400000).toISOString();

describe("pointsForSession", () => {
  it("awards base + reco bonus for a recommended single-item bill", () => {
    expect(pointsForSession({ outcome: "bought-recommended", itemsPerBill: 1 } as SessionRecord)).toBe(160);
  });
  it("awards base only for a non-recommended single-item bill", () => {
    expect(pointsForSession({ outcome: "bought-different", itemsPerBill: 1 } as SessionRecord)).toBe(100);
  });
  it("rewards items-per-bill above 1", () => {
    // 100 base + 120*(2-1) + 60 reco = 280
    expect(pointsForSession({ outcome: "bought-recommended", itemsPerBill: 2 } as SessionRecord)).toBe(280);
  });
  it("scores non-sales at zero", () => {
    expect(pointsForSession({ outcome: "still-thinking", itemsPerBill: 1 } as SessionRecord)).toBe(0);
    expect(isBill("still-thinking")).toBe(false);
    expect(isBill("bought-recommended")).toBe(true);
  });
});

describe("computeLeaderboard", () => {
  const roster = { u1: { name: "A", storeId: "s1" }, u2: { name: "B", storeId: "s1" } };
  const sessions: SessionRecord[] = [
    { userId: "u1", storeId: "s1", outcome: "bought-recommended", itemsPerBill: 2, total: 50000, ts: daysAgo(1) },
    { userId: "u1", storeId: "s1", outcome: "bought-different", itemsPerBill: 1, total: 30000, ts: daysAgo(10) },
    { userId: "u2", storeId: "s1", outcome: "still-thinking", itemsPerBill: 1, total: 0, ts: daysAgo(1) },
  ];
  const rows = computeLeaderboard(sessions, roster, NOW);
  const u1 = rows.find((r) => r.userId === "u1")!;
  const u2 = rows.find((r) => r.userId === "u2")!;

  it("splits weekly vs monthly windows", () => {
    expect(u1.weekPoints).toBe(280);        // only the 1-day-old bill is in the week
    expect(u1.monthPoints).toBe(380);       // 280 + 100 (10 days old)
  });
  it("counts only sales as bills and blends items-per-bill", () => {
    expect(u1.bills).toBe(2);
    expect(u1.itemsPerBill).toBeCloseTo(1.5, 5);
    expect(u1.recoRate).toBeCloseTo(0.5, 5);
  });
  it("includes inactive roster members at zero", () => {
    expect(u2.bills).toBe(0);
    expect(u2.monthPoints).toBe(0);
  });
  it("sorts by monthly points descending", () => {
    expect(rows[0].userId).toBe("u1");
  });

  it("counts reco rate for the app's underscore outcome vocabulary", () => {
    // The PWA emits `bought_recommended` (underscore); the leaderboard must
    // normalise it the same way isBill/pointsForSession do, else recoRate is
    // stuck at 0 on every live deployment.
    const appSessions: SessionRecord[] = [
      { userId: "u9", storeId: "s2", outcome: "bought_recommended", itemsPerBill: 1, total: 40000, ts: daysAgo(1) },
      { userId: "u9", storeId: "s2", outcome: "bought_different", itemsPerBill: 1, total: 30000, ts: daysAgo(2) },
    ];
    const [u9] = computeLeaderboard(appSessions, { u9: { name: "C", storeId: "s2" } }, NOW);
    expect(u9.bills).toBe(2);
    expect(u9.recoRate).toBeCloseTo(0.5, 5);
  });
});

describe("pointsToInr (50 pts = ₹1)", () => {
  it("uses a 50:1 rate", () => {
    expect(POINTS_PER_INR).toBe(50);
    expect(pointsToInr(50)).toBe(1);
    expect(pointsToInr(5000)).toBe(100);
  });
  it("floors partial rupees (never inflates earned value)", () => {
    expect(pointsToInr(160)).toBe(3);   // 160/50 = 3.2 → 3
    expect(pointsToInr(49)).toBe(0);
  });
  it("handles zero / nullish points", () => {
    expect(pointsToInr(0)).toBe(0);
    expect(pointsToInr(undefined as unknown as number)).toBe(0);
  });
});

describe("mergeLeaderboard", () => {
  it("overlays local sessions onto a seeded row", () => {
    const base: LeaderboardRow[] = [
      { userId: "u1", name: "A", storeId: "s1", weekPoints: 1000, monthPoints: 5000, bills: 50, itemsPerBill: 1.4, recoRate: 0.6, streak: 5 },
    ];
    const local: SessionRecord[] = [
      { userId: "u1", storeId: "s1", outcome: "bought-recommended", itemsPerBill: 2, total: 40000, ts: daysAgo(1) },
    ];
    const [u1] = mergeLeaderboard(base, local, NOW);
    expect(u1.weekPoints).toBe(1280);
    expect(u1.monthPoints).toBe(5280);
    expect(u1.bills).toBe(51);
    expect(u1.itemsPerBill).toBeCloseTo(72 / 51, 5);
    expect(u1.streak).toBe(5);
  });
});
