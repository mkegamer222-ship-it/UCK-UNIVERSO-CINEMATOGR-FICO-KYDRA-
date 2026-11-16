/**
 * icons.js — conjunto de ícones em SVG inline (traço 1.6, 24×24).
 * Uso: icon("play", { size: 16 })
 */

const PATHS = {
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  layers:
    '<path d="m12 3 9 4.5-9 4.5L3 7.5 12 3Z"/><path d="m3 12.5 9 4.5 9-4.5"/><path d="m3 17 9 4.5 9-4.5"/>',
  notes:
    '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h7M9 16h5"/>',
  next: '<circle cx="12" cy="12" r="9"/><path d="m9 15 3-6 3 6M10.2 13.2h3.6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 20.9 10H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  box: '<path d="M20 8.5 12 4 4 8.5v7L12 20l8-4.5z"/><path d="M4 8.5 12 13l8-4.5M12 13v7"/>',
  packs:
    '<path d="M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 8V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M12 8v13"/>',
  server:
    '<rect x="3" y="4" width="18" height="7" rx="1.6"/><rect x="3" y="13" width="18" height="7" rx="1.6"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  instances:
    '<rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/>',
  power: '<path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  terminal: '<path d="m5 7 5 5-5 5M13 17h6"/>',
  warn: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17.5h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.5 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18Z"/>',
  cpu: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><path d="M10 3v3.5M14 3v3.5M10 17.5V21M14 17.5V21M3 10h3.5M3 14h3.5M17.5 10H21M17.5 14H21"/>',
};

export function icon(name, attrs = {}) {
  const d = PATHS[name];
  if (!d) return "";
  const size = attrs.size ?? 16;
  const cls = attrs.class ? ` class="${attrs.class}"` : "";
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${attrs.stroke ?? 1.6}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls}>${d}</svg>`;
}
