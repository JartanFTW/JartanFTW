// King of Thieves-style gems as SVG, drawn from scratch: the colour picks the shape and
// the tier the setting (1-3 bare stone, 4-6 silver rim, 7-8 gold). A gem is a code such
// as "y8": colour r, b, y, g or p, then tier 1-8. Layouts pull this file into their
// script with a Jinja include, so it must not contain Jinja tags itself.

const GEM_COLOURS = {  // highlight, light, mid, dark
  r: ["#ff8a8a", "#f23b3b", "#d01616", "#8e0a0a"],
  b: ["#a8d8ff", "#5aaaf5", "#2a7ee0", "#14509e"],
  y: ["#ffe08a", "#ffbe2e", "#f29a0c", "#b86200"],
  g: ["#c4f27a", "#86d63a", "#56b01a", "#2c720c"],
  p: ["#f7b8ff", "#e06cf5", "#c22fe0", "#7a1499"],
};
const GEM_NAMES = { r: "red", b: "blue", y: "yellow", g: "green", p: "purple" };
const SILVER = ["#ffffff", "#dfe6ee", "#a9b6c4", "#5f6c7a"];
const GOLD = ["#fff1b8", "#ffd45a", "#e9a520", "#9a5a08"];

// Silhouette corners per colour (blue is a circle), and how far each side bulges out.
const GEM_CORNERS = {
  r: [[50, 3], [97, 87], [3, 87]],
  p: [[3, 13], [97, 13], [50, 97]],
  y: [[12, 12], [88, 12], [88, 88], [12, 88]],
  g: [[50, 6], [94, 50], [50, 94], [6, 50]],
  b: null,
};
const GEM_BULGE = { r: 7, p: 7, y: 3, g: 5 };
const GEM_LIGHT = (-135 * Math.PI) / 180;  // light falls from the top left
let gemCount = 0;

function gemCentre(colour) {
  const pts = GEM_CORNERS[colour];
  if (!pts) return [50, 50];
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

// The colour's silhouette as a closed path, scaled about its own centre.
function gemShape(colour, scale = 1) {
  const [cx, cy] = gemCentre(colour);
  if (!GEM_CORNERS[colour]) {
    const r = 43 * scale;
    return `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0Z`;
  }
  const pts = GEM_CORNERS[colour].map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
  const n = pts.length, cut = 0.17;  // each corner is rounded off by this fraction of its sides
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const ends = pts.map((b, i) => [lerp(b, pts[(i - 1 + n) % n], cut), b, lerp(b, pts[(i + 1) % n], cut)]);
  let d = `M${ends[0][2][0]},${ends[0][2][1]}`;
  for (let i = 0; i < n; i++) {
    const start = ends[i][2];
    const [endIn, corner, endOut] = ends[(i + 1) % n];
    const mx = (start[0] + endIn[0]) / 2, my = (start[1] + endIn[1]) / 2;
    const k = (GEM_BULGE[colour] * scale) / Math.max(Math.hypot(mx - cx, my - cy), 1);
    d += ` Q${mx + (mx - cx) * k},${my + (my - cy) * k} ${endIn[0]},${endIn[1]}`;
    d += ` Q${corner[0]},${corner[1]} ${endOut[0]},${endOut[1]}`;
  }
  return d + "Z";
}

// Directions from the centre to each corner, and to the middle of each side.
function gemAngles(colour) {
  const [cx, cy] = gemCentre(colour);
  const deg = (list) => list.map((a) => (a * Math.PI) / 180);
  const pts = GEM_CORNERS[colour];
  if (!pts) return { corners: deg([-135, -45, 45, 135]), sides: deg([-90, 0, 90, 180]) };
  const angle = ([x, y]) => Math.atan2(y - cy, x - cx);
  const mids = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  });
  const sorted = (list) => list.map(angle).sort((a, b) => a - b);
  return { corners: sorted(pts), sides: sorted(mids) };
}

// Facet wedges between consecutive angles, each shaded by how it faces the light.
function gemWedges(colour, angles, [light, mid, dark]) {
  const [cx, cy] = gemCentre(colour);
  const R = 90, at = (a) => `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`;
  return angles.map((a0, i) => {
    const a1 = angles[(i + 1) % angles.length] + (i === angles.length - 1 ? 2 * Math.PI : 0);
    const m = (a0 + a1) / 2, lit = Math.cos(m - GEM_LIGHT);
    const fill = lit > 0.5 ? light : lit > -0.5 ? mid : dark;
    return `<polygon points="${cx},${cy} ${at(a0)} ${at(m)} ${at(a1)}" fill="${fill}"/>`;
  }).join("");
}

function gemSVG(code, size) {
  const colour = code[0], tier = Number(code.slice(1));
  const [hi, light, mid, dark] = GEM_COLOURS[colour];
  const [cx, cy] = gemCentre(colour);
  const metal = tier >= 7 ? GOLD : tier >= 4 ? SILVER : null;
  const inner = metal ? 0.74 : 0.93;
  const uid = `gem${gemCount++}`;
  const defs = [
    `<clipPath id="${uid}c"><path d="${gemShape(colour, inner)}"/></clipPath>`,
    `<clipPath id="${uid}k"><path d="${gemShape(colour, inner * 0.55)}"/></clipPath>`,
  ];
  const gradient = (name, stops) => {
    defs.push(`<linearGradient id="${uid}${name}" x1="0" y1="0" x2="1" y2="1">` +
      stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join("") + "</linearGradient>");
    return `url(#${uid}${name})`;
  };
  const ray = (a, r0, r1) => [cx + r0 * Math.cos(a), cy + r0 * Math.sin(a), cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)];
  const { corners, sides } = gemAngles(colour);

  const parts = [`<path d="${gemShape(colour, 1)}" fill="${(metal || GEM_COLOURS[colour])[3]}"/>`];
  if (metal) {
    parts.push(`<path d="${gemShape(colour, 0.94)}" fill="${gradient("m", [metal[0], metal[1], metal[2], metal[2]])}"/>`);
    parts.push(`<path d="${gemShape(colour, inner + 0.03)}" fill="${metal[3]}"/>`);
  }

  const stone = [gemWedges(colour, tier <= 2 ? corners : [...corners, ...sides].sort((a, b) => a - b), [light, mid, dark])];
  if (tier === 2) stone.push(`<path d="${gemShape(colour, inner * 0.42)}" fill="${dark}" opacity=".75"/>`);
  if (tier >= 3) {  // an inner ring of facets, offset from the outer cut
    stone.push(`<g clip-path="url(#${uid}k)">${gemWedges(colour, sides, [hi, light, mid])}</g>` +
      `<path d="${gemShape(colour, inner * 0.55)}" fill="none" stroke="${dark}" stroke-width="1.5" opacity=".6"/>`);
  }
  if (tier === 5 || tier === 6) {  // silver notches biting in from the middle of each side
    const [reach, width] = tier === 5 ? [22, 11] : [28, 15];
    for (const a of sides) {
      const [x0, y0, x1, y1] = ray(a, 60, 40 - reach);
      const line = (stroke, w) => `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
      stone.push(line(SILVER[3], width + 4) + line(SILVER[1], width));
    }
  }
  if (tier === 7) {  // gold inlay: a framed window held by spokes to the corners
    const g = gradient("i", GOLD.slice(0, 3));
    const frame = gemShape(colour, inner * 0.62);
    stone.push(`<path d="${frame}" fill="none" stroke="${GOLD[3]}" stroke-width="9"/><path d="${frame}" fill="none" stroke="${g}" stroke-width="6"/>`);
    for (const a of corners) {
      const [x0, y0, x1, y1] = ray(a, 24, 60);
      stone.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${g}" stroke-width="6"/>`);
    }
  }
  if (tier === 8) {  // a gold plate with windows onto the stone, and a set centre stone
    const g = gradient("i", GOLD.slice(0, 3));
    stone.push(`<path d="${gemShape(colour, inner * 0.78)}" fill="${g}" stroke="${GOLD[3]}" stroke-width="2.5"/>`);
    for (const a of sides) {
      const [x, y] = ray(a, 27, 0);
      stone.push(`<circle cx="${x}" cy="${y}" r="7.5" fill="${dark}"/><circle cx="${x}" cy="${y}" r="5.5" fill="${light}"/>`);
    }
    stone.push(`<circle cx="${cx}" cy="${cy}" r="13" fill="${GOLD[3]}"/><circle cx="${cx}" cy="${cy}" r="10" fill="${mid}"/>` +
      `<circle cx="${cx - 3}" cy="${cy - 3}" r="3.5" fill="${hi}"/>`);
  }

  parts.push(`<g clip-path="url(#${uid}c)">${stone.join("")}</g>`);
  parts.push(`<path d="${gemShape(colour, inner)}" fill="none" stroke="${dark}" stroke-width="1.5" opacity=".6"/>`);
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><defs>${defs.join("")}</defs>${parts.join("")}</svg>`;
}

// kot-skipper's --gems syntax: "7" is a tier, "r" a colour, "r5" one colour and tier.
function parseGemTarget(target) {
  return (target || "").split(/\s+/).filter(Boolean).map((t) =>
    /^\d$/.test(t) ? { tier: Number(t) } : t.length === 1 ? { colour: t } : { colour: t[0], tier: Number(t.slice(1)) });
}

function gemMatches(code, rules) {
  const colour = code[0], tier = Number(code.slice(1));
  return rules.some((r) => (r.colour === undefined || r.colour === colour) && (r.tier === undefined || r.tier === tier));
}

// "tier 7, tier 8 and red 6"; wrap() decorates each item, say in <b>.
function describeGemTarget(rules, wrap = (w) => w) {
  const words = rules.map((r) => wrap(
    r.colour && r.tier ? `${GEM_NAMES[r.colour]} ${r.tier}` : r.tier ? `tier ${r.tier}` : `any ${GEM_NAMES[r.colour]}`));
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words.join("");
}

// Draw every element with data-gem="y8" (and optional data-size) as a gem.
function drawGems(root = document) {
  for (const el of root.querySelectorAll("[data-gem]")) {
    el.innerHTML = gemSVG(el.dataset.gem, Number(el.dataset.size || 64));
  }
}
