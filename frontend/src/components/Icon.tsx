/** Stroke icons drawn for Ghost Protocol (24px grid, 1.8 stroke, currentColor). */
const PATHS: Record<string, string> = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  cases: "M4 6h16M4 12h16M4 18h10",
  timeline: "M3 12h18M7 8v8M12 5v14M17 9v6",
  graph: "M6 6a2 2 0 1 0 0 .01M18 6a2 2 0 1 0 0 .01M12 18a2 2 0 1 0 0 .01M7.5 7.5 11 16.5M16.5 7.5 13 16.5M8 6h8",
  conflicts: "M5 21V4M5 4h11l-2 4 2 4H5",
  hypotheses: "M12 4v16M5 8h14M5 8l-2 6a3 3 0 0 0 4 0zM19 8l-2 6a3 3 0 0 0 4 0zM8 20h8",
  evidence: "M7 3h7l5 5v13H7zM14 3v5h5",
  intake: "M12 16V4M7 9l5-5 5 5M5 20h14",
  report: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4",
  audit: "M12 7v5l3 2M21 12a9 9 0 1 1-9-9",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  play: "M8 5v14l11-7z",
  reset: "M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5",
  arrow: "M5 12h14M13 6l6 6-6 6",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
