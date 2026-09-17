(function () {
  'use strict';

  var tooltipEl = null;
  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'chart-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function showTooltip(x, y, label, value) {
    var el = ensureTooltip();
    el.textContent = '';
    var strong = document.createElement('strong');
    strong.textContent = value;
    el.appendChild(strong);
    el.appendChild(document.createTextNode(' ' + label));
    el.style.left = x + 14 + 'px';
    el.style.top = y + 14 + 'px';
    el.classList.add('visible');
  }
  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
  }

  function wireTooltip(node, label, value) {
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', label + ': ' + value);
    node.addEventListener('mousemove', function (e) { showTooltip(e.clientX, e.clientY, label, value); });
    node.addEventListener('mouseleave', hideTooltip);
    node.addEventListener('focus', function () {
      var rect = node.getBoundingClientRect();
      showTooltip(rect.right, rect.top, label, value);
    });
    node.addEventListener('blur', hideTooltip);
  }

  function make(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderTableFallback(containerId, headers, rows) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    var details = document.createElement('details');
    details.className = 'view-table';
    var summary = document.createElement('summary');
    summary.textContent = 'View as table';
    details.appendChild(summary);
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var htr = document.createElement('tr');
    headers.forEach(function (h) { var th = document.createElement('th'); th.textContent = h; htr.appendChild(th); });
    thead.appendChild(htr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      r.forEach(function (v) { var td = document.createElement('td'); td.textContent = String(v); tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    details.appendChild(table);
    container.appendChild(details);
  }

  // Horizontal bar chart. data: [{label, value, color}]
  function renderBarChart(containerId, data, opts) {
    var container = document.getElementById(containerId);
    if (!container) return;
    opts = opts || {};
    container.innerHTML = '';
    var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));

    data.forEach(function (d) {
      var row = make('div', 'bar-chart-row');
      row.appendChild(make('div', 'bar-label', d.label));
      var track = make('div', 'bar-track');
      var fill = make('div', 'bar-fill');
      fill.style.width = (max ? (d.value / max) * 100 : 0) + '%';
      fill.style.background = d.color || 'var(--accent)';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(make('div', 'bar-value', String(d.value)));
      wireTooltip(row, d.label, String(d.value) + (opts.unit || ''));
      container.appendChild(row);
    });

    if (opts.tableId) {
      renderTableFallback(opts.tableId, [opts.tableHeader || 'Category', 'Count'], data.map(function (d) { return [d.label, d.value]; }));
    }
  }

  // 100%-stacked ordinal progress bar. segments: [{label, value, color}]
  function renderStackedProgress(containerId, legendId, segments) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    var total = segments.reduce(function (s, d) { return s + d.value; }, 0) || 1;
    segments.forEach(function (seg) {
      if (!seg.value) return;
      var pct = (seg.value / total) * 100;
      var s = make('div', 'stack-seg');
      s.style.width = pct + '%';
      s.style.background = seg.color;
      wireTooltip(s, seg.label, seg.value + ' of ' + total);
      container.appendChild(s);
    });
    if (legendId) {
      var legend = document.getElementById(legendId);
      if (legend) {
        legend.innerHTML = '';
        segments.forEach(function (seg) {
          var key = make('span', 'key');
          var sw = make('span', 'swatch');
          sw.style.background = seg.color;
          key.appendChild(sw);
          key.appendChild(document.createTextNode(seg.label + ' (' + seg.value + ')'));
          legend.appendChild(key);
        });
      }
    }
  }

  function renderMeter(containerId, value, max, label) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var pct = max ? Math.min(100, (value / max) * 100) : 0;
    container.innerHTML = '';
    container.appendChild(make('div', 'meter-value', Math.round(pct) + '%'));
    container.appendChild(make('div', 'meter-label', label));
    var track = make('div', 'meter-track');
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', label + ': ' + Math.round(pct) + ' percent');
    var fill = make('div', 'meter-fill');
    fill.style.width = pct + '%';
    track.appendChild(fill);
    container.appendChild(track);
  }

  window.OMC_CHARTS = {
    renderBarChart: renderBarChart,
    renderStackedProgress: renderStackedProgress,
    renderMeter: renderMeter,
    renderTableFallback: renderTableFallback
  };
})();
