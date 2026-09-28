// Loads the sample data, aggregates it by the selected source and renders the dashboard.
(function () {
  'use strict';

  const SOURCES = ['organic', 'direct', 'referral', 'social', 'paid'];
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const state = { source: 'all' };
  let rows = [];

  const $ = (sel) => document.querySelector(sel);

  function aggregate(allRows, source) {
    const filtered = source === 'all' ? allRows : allRows.filter((r) => r.source === source);

    const daily = new Map();
    const byPage = new Map();
    for (const r of filtered) {
      const d = daily.get(r.date) || { visits: 0, pageviews: 0 };
      d.visits += r.visits;
      d.pageviews += r.pageviews;
      daily.set(r.date, d);

      const p = byPage.get(r.page) || { page: r.page, visits: 0, pageviews: 0, bounces: 0, timeOnPageSec: 0 };
      p.visits += r.visits;
      p.pageviews += r.pageviews;
      p.bounces += r.bounces;
      p.timeOnPageSec += r.timeOnPageSec;
      byPage.set(r.page, p);
    }

    // Source totals always cover every source so the chart can show the selection in context.
    const bySource = SOURCES.map((key) => ({
      key,
      label: capitalize(key),
      value: allRows.reduce((sum, r) => (r.source === key ? sum + r.visits : sum), 0),
    }));

    const dates = [...daily.keys()].sort();
    return {
      dates,
      visits: dates.map((d) => daily.get(d).visits),
      pageviews: dates.map((d) => daily.get(d).pageviews),
      bySource,
      byPage: [...byPage.values()].sort((a, b) => b.pageviews - a.pageviews),
    };
  }

  const parseDate = (iso) => new Date(iso + 'T00:00:00Z');
  const shortDate = (iso) => parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const longDate = (iso) => parseDate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

  function formatDuration(sec) {
    const s = Math.round(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function setSource(source) {
    state.source = source;
    $('#source-filter').value = source;
    render();
  }

  function render() {
    const agg = aggregate(rows, state.source);

    const scope = state.source === 'all' ? '' : `· ${capitalize(state.source)}`;
    document.querySelectorAll('[data-scope]').forEach((node) => (node.textContent = scope));

    Charts.lineChart($('#time-chart'), {
      labels: agg.dates,
      series: [
        { name: 'Visits', values: agg.visits },
        { name: 'Page views', values: agg.pageviews },
      ],
    }, { formatLabel: shortDate, formatTitle: longDate });

    Charts.barChart($('#source-chart'), agg.bySource, {
      selected: state.source,
      onSelect: (key) => setSource(state.source === key ? 'all' : key),
    });

    const body = $('#pages-body');
    body.textContent = '';
    for (const p of agg.byPage) {
      const tr = document.createElement('tr');
      const cells = [
        [p.page, ''],
        [p.pageviews.toLocaleString('en-US'), 'num'],
        [formatDuration(p.timeOnPageSec / p.pageviews), 'num'],
        [`${((p.bounces / p.visits) * 100).toFixed(1)}%`, 'num'],
      ];
      for (const [text, cls] of cells) {
        const td = document.createElement('td');
        td.textContent = text;
        if (cls) td.className = cls;
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
  }

  function init() {
    const select = $('#source-filter');
    for (const key of SOURCES) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = capitalize(key);
      select.appendChild(opt);
    }
    select.addEventListener('change', () => setSource(select.value));

    fetch('data/analytics.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) throw new Error('no rows in data file');
        rows = data;
        const dates = [...new Set(rows.map((r) => r.date))].sort();
        $('#range').textContent = `${longDate(dates[0])} – ${longDate(dates[dates.length - 1])}`;
        render();
      })
      .catch((err) => {
        const msg = document.createElement('p');
        msg.className = 'error';
        msg.textContent = `Could not load data/analytics.json (${err.message}). If you opened index.html directly, serve the folder instead, e.g. python3 -m http.server.`;
        $('#dashboard').replaceWith(msg);
      });
  }

  init();
})();
