// Minimal SVG charts. Exposes window.Charts = { lineChart, barChart }.
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function clear(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  // Round the max up to a tidy number so gridlines land on nice values.
  function niceMax(value) {
    if (value <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    const steps = [1, 2, 2.5, 5, 10];
    for (const s of steps) if (value <= s * pow) return s * pow;
    return 10 * pow;
  }

  const fmt = (n) => n.toLocaleString('en-US');

  const tooltip = {
    show(html, x, y) {
      const tip = document.getElementById('tooltip');
      tip.innerHTML = html;
      tip.hidden = false;
      const pad = 12;
      const w = tip.offsetWidth;
      const left = x + pad + w > window.innerWidth ? x - pad - w : x + pad;
      tip.style.left = left + 'px';
      tip.style.top = y + pad + 'px';
    },
    hide() {
      document.getElementById('tooltip').hidden = true;
    },
  };

  // data: { labels: string[], series: [{ name, values: number[] }] }
  // opts: { formatLabel(label) -> short axis text, formatTitle(label) -> tooltip heading }
  function lineChart(svg, data, opts) {
    const W = 960, H = 300;
    const m = { top: 28, right: 16, bottom: 28, left: 48 };
    const iw = W - m.left - m.right;
    const ih = H - m.top - m.bottom;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    clear(svg);

    const n = data.labels.length;
    const max = niceMax(Math.max(1, ...data.series.flatMap((s) => s.values)));
    const x = (i) => m.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v) => m.top + ih - (v / max) * ih;

    // Gridlines and y-axis labels.
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const v = (max / ticks) * t;
      el('line', { class: 'gridline', x1: m.left, x2: W - m.right, y1: y(v), y2: y(v) }, svg);
      const label = el('text', { x: m.left - 8, y: y(v) + 4, 'text-anchor': 'end' }, svg);
      label.textContent = fmt(v);
    }

    // X-axis labels, about one a week.
    const every = Math.max(1, Math.ceil(n / 7));
    data.labels.forEach((lab, i) => {
      if (i % every !== 0 && i !== n - 1) return;
      const t = el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }, svg);
      t.textContent = opts.formatLabel(lab);
    });

    // Lines.
    data.series.forEach((s, si) => {
      const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
      el('path', { class: `line line-${si}`, d }, svg);
    });

    // Legend.
    const legend = el('g', { class: 'legend' }, svg);
    let lx = m.left;
    data.series.forEach((s, si) => {
      el('rect', { class: `legend-swatch-${si}`, x: lx, y: 6, width: 12, height: 3, rx: 1.5 }, legend);
      const t = el('text', { x: lx + 18, y: 12 }, legend);
      t.textContent = s.name;
      lx += 18 + s.name.length * 7 + 20;
    });

    // Hover layer: crosshair, dots and tooltip for the nearest day.
    const hover = el('g', { visibility: 'hidden' }, svg);
    const cross = el('line', { class: 'crosshair', y1: m.top, y2: m.top + ih }, hover);
    const dots = data.series.map((_, si) => el('circle', { class: `dot-${si}`, r: 4 }, hover));
    const overlay = el('rect', { x: m.left, y: m.top, width: iw, height: ih, fill: 'transparent' }, svg);

    overlay.addEventListener('mousemove', (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const local = pt.matrixTransform(svg.getScreenCTM().inverse());
      const i = Math.max(0, Math.min(n - 1, Math.round(((local.x - m.left) / iw) * (n - 1))));
      cross.setAttribute('x1', x(i));
      cross.setAttribute('x2', x(i));
      data.series.forEach((s, si) => {
        dots[si].setAttribute('cx', x(i));
        dots[si].setAttribute('cy', y(s.values[i]));
      });
      hover.setAttribute('visibility', 'visible');
      const rows = data.series.map((s) => `${s.name}: ${fmt(s.values[i])}`).join('<br>');
      tooltip.show(`<strong>${opts.formatTitle(data.labels[i])}</strong>${rows}`, e.clientX, e.clientY);
    });
    overlay.addEventListener('mouseleave', () => {
      hover.setAttribute('visibility', 'hidden');
      tooltip.hide();
    });
  }

  // items: [{ key, label, value }]
  // opts: { selected: key | 'all', onSelect(key) }
  function barChart(svg, items, opts) {
    const rowH = 36;
    const W = 460;
    const m = { top: 4, right: 100, bottom: 4, left: 80 };
    const H = m.top + m.bottom + items.length * rowH;
    const iw = W - m.left - m.right;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    clear(svg);

    const max = Math.max(1, ...items.map((d) => d.value));
    const total = items.reduce((sum, d) => sum + d.value, 0);

    items.forEach((d, i) => {
      const y0 = m.top + i * rowH;
      const row = el('g', { class: 'bar-row', 'data-key': d.key }, svg);
      // Full-width hit area so the whole row is clickable.
      el('rect', { x: 0, y: y0, width: W, height: rowH, fill: 'transparent' }, row);

      const label = el('text', { class: 'bar-label', x: m.left - 10, y: y0 + rowH / 2 + 4, 'text-anchor': 'end' }, row);
      label.textContent = d.label;

      const dim = opts.selected !== 'all' && opts.selected !== d.key;
      el('rect', {
        class: 'bar' + (dim ? ' dim' : ''),
        x: m.left,
        y: y0 + 8,
        width: Math.max(2, (d.value / max) * iw),
        height: rowH - 16,
        rx: 3,
      }, row);

      const value = el('text', { x: m.left + (d.value / max) * iw + 8, y: y0 + rowH / 2 + 4 }, row);
      value.textContent = `${fmt(d.value)} (${Math.round((d.value / total) * 100)}%)`;

      row.addEventListener('click', () => opts.onSelect(d.key));
    });
  }

  window.Charts = { lineChart, barChart };
})();
