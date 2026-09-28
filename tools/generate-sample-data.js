// Generates data/analytics.json: 30 days of sample website analytics.
// Optional tooling, not a build step. Run: node tools/generate-sample-data.js
'use strict';

const fs = require('fs');
const path = require('path');

// Seeded PRNG (mulberry32) so the output is reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const jitter = (spread) => 1 + (rand() * 2 - 1) * spread;

const DAYS = 30;
const END = new Date(Date.UTC(2026, 8, 27)); // last day included

// Base daily visits per source, and how much each source's visitors bounce.
const SOURCES = {
  organic:  { visits: 420, bounce: 0.42 },
  direct:   { visits: 260, bounce: 0.35 },
  referral: { visits: 120, bounce: 0.38 },
  social:   { visits: 150, bounce: 0.58 },
  paid:     { visits: 90,  bounce: 0.50 },
};

// Share of traffic, pages per visit, and typical seconds on page.
const PAGES = {
  '/':               { share: 0.30, ppv: 1.8, time: 45 },
  '/pricing':        { share: 0.14, ppv: 1.5, time: 95 },
  '/features':       { share: 0.12, ppv: 1.6, time: 80 },
  '/blog':           { share: 0.12, ppv: 2.2, time: 60 },
  '/blog/launch':    { share: 0.10, ppv: 1.3, time: 190 },
  '/docs':           { share: 0.10, ppv: 2.6, time: 150 },
  '/about':          { share: 0.07, ppv: 1.2, time: 55 },
  '/contact':        { share: 0.05, ppv: 1.1, time: 40 },
};

const rows = [];
for (let d = DAYS - 1; d >= 0; d--) {
  const day = new Date(END);
  day.setUTCDate(END.getUTCDate() - d);
  const date = day.toISOString().slice(0, 10);
  const weekday = day.getUTCDay();
  const weekendDip = weekday === 0 || weekday === 6 ? 0.7 : 1;
  const trend = 1 + ((DAYS - 1 - d) / DAYS) * 0.25;

  for (const [source, s] of Object.entries(SOURCES)) {
    for (const [page, p] of Object.entries(PAGES)) {
      const visits = Math.max(1, Math.round(s.visits * p.share * weekendDip * trend * jitter(0.2)));
      const pageviews = Math.max(visits, Math.round(visits * p.ppv * jitter(0.1)));
      const bounceRate = Math.min(0.95, s.bounce * jitter(0.15));
      const bounces = Math.round(visits * bounceRate);
      const timeOnPageSec = Math.round(pageviews * p.time * jitter(0.2));
      rows.push({ date, source, page, visits, pageviews, bounces, timeOnPageSec });
    }
  }
}

const out = path.join(__dirname, '..', 'data', 'analytics.json');
fs.writeFileSync(out, JSON.stringify(rows) + '\n');
console.log(`Wrote ${rows.length} rows to ${path.relative(process.cwd(), out)}`);
