/* Lucide-style icon set — 24×24 viewBox, stroke-width 2, round caps/joins, no fill.
   In production use lucide-react; these are inline copies for the kit. */

const Icon = ({ d, size = 18, fill = 'none', style, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
       style={{ flex: 'none', ...style }} {...rest}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICON = {
  home:    "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  calendar:["M8 2v4M16 2v4M3 9h18","M5 5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"],
  users:   ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2","M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8","M22 21v-2a4 4 0 0 0-3-3.87"],
  brush:   ["M4 20c2-1 3-3 3-5a3 3 0 1 1 5 2","M14 12l7-7a2 2 0 0 0-3-3l-7 7"],
  chart:   "M3 3v18h18M7 15l4-5 3 3 5-7",
  bell:    ["M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9","M13.7 21a2 2 0 0 1-3.4 0"],
  link:    ["M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1","M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"],
  copy:    ["M8 4h10a2 2 0 0 1 2 2v10","M16 8H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z"],
  check:   "M4 12.5 9.5 18 20 6",
  chevronUp:  "M6 15l6-6 6 6",
  chevronDown:"M6 9l6 6 6-6",
  chevronLeft:"M15 18l-6-6 6-6",
  chevronRight:"M9 18l6-6-6-6",
  search:  ["M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z","M21 21l-4.3-4.3"],
  plus:    "M12 5v14M5 12h14",
  more:    "M12 6h.01M12 12h.01M12 18h.01",
  pencil:  ["M12 20h9","M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
  upload:  ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","M17 8l-5-5-5 5","M12 3v12"],
  download:["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","M7 10l5 5 5-5","M12 15V3"],
  globe:   ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z","M3 12h18","M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"],
  info:    ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z","M12 16v-4M12 8h.01"],
  shield:  ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z","M9 12l2 2 4-4"],
  lock:    ["M5 11h14v10H5z","M8 11V7a4 4 0 0 1 8 0v4"],
  pin:     ["M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z","M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  clock:   ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z","M12 7v5l3 2"],
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  play:    "M7 4l12 8-12 8z",
  file:    ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6"],
  star:    "M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.8 6.7 19.7l1.1-6.1L3.4 9.4l6-.8z",
};

/* Babel-standalone evaluates external scripts in their own scope; publish
   the shared helpers so the screen files can reach them. */
window.Icon = Icon;
window.ICON = ICON;
