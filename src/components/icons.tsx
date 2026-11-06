// Íconos de trazo simple, los mismos del prototipo.
const PATHS = {
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  wallet: "M3 7h18v12H3zM3 7l3-3h12M16 13h2",
  grain: "M12 21V9M12 9c0-3 2-5.5 4.5-6 0 3-2 5.5-4.5 6zM12 9C12 6 10 3.5 7.5 3c0 3 2 5.5 4.5 6zM12 15c0-3 2-5.5 4.5-6 0 3-2 5.5-4.5 6zM12 15c0-3-2-5.5-4.5-6 0 3 2 5.5 4.5 6z",
  cal: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  bank: "M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18M12 3l9 5H3z",
  flow: "M3 17l6-6 4 4 8-8M15 7h6v6",
  pie: "M12 3v9h9M21 12a9 9 0 1 1-9-9",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  scale: "M12 3v18M5 7h14M5 7l-3 7h6zM19 7l-3 7h6zM8 21h8",
  spark: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z",
  file: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  toggle: "M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7zM8 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  tag: "M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01",
  repeat: "M17 2l4 4-4 4M3 12v-2a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 12v2a4 4 0 0 1-4 4H3",
  db: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  menu: "M4 6h16M4 12h16M4 18h16",
  plus: "M12 5v14M5 12h14",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
