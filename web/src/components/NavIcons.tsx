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
  menu: I("M4 7h16M4 12h16M4 17h16"),
};
