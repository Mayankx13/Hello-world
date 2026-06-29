/** Small inline icons for the shell brand + navigation. */
import type { JSX } from "react";

export function Bolt(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="#F6A21E" />
    </svg>
  );
}

const I = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const NavIcon: Record<string, JSX.Element> = {
  sales: I("M12 3a4 4 0 0 1 4 4c0 2-1.5 3-2 4M12 17v.5M6 20a6 6 0 0 1 12 0"),
  inventory: I("M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10"),
  command: I("M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"),
  leaderboard: I("M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM5 5H3v2a3 3 0 0 0 2 3M19 5h2v2a3 3 0 0 1-2 3"),
  config: I("M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4"),
  data: I("M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"),
  people: I("M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7 0a3 3 0 1 0 0-6M3 20a6 6 0 0 1 12 0M16 14a6 6 0 0 1 5 6"),
  incentives: I("M12 2v20M12 4a4 4 0 0 0-4 4c0 2 1.5 3 4 3.5s4 1.5 4 3.5a4 4 0 0 1-4 4M7 6a5 5 0 0 1 10 0M7 18a5 5 0 0 0 10 0"),
  feedback: I("M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z"),
  offers: I("M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V5a2 2 0 0 1 2-2h6.6a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8ZM7.5 7.5h.01"),
  menu: I("M4 7h16M4 12h16M4 17h16"),
};
