(function () {
  'use strict';

  var CATEGORY_LABELS = {
    registry_fragmentation: 'Registry fragmentation',
    mrv_capacity: 'MRV & verification capacity',
    price_transparency: 'Price transparency',
    benefit_sharing: 'Benefit-sharing disclosure',
    land_tenure: 'Land tenure & consent',
    market_data: 'Market & transaction data',
    cobenefit_data: 'Co-benefit / SDG data',
    other: 'Other'
  };

  var STATUS_LABELS = {
    open: 'Open',
    improving: 'Improving',
    partially_resolved: 'Partially resolved',
    resolved: 'Resolved',
    pending_review: 'Pending review',
    verified: 'Verified',
    rejected: 'Not confirmed'
  };

  var supabase = null;
  var allGaps = [];
  var activeCategory = 'all';
  var activeSeverity = 'all';

  function initClient() {
    if (!window.supabase || !window.OMC_CONFIG) return null;
    return window.supabase.createClient(window.OMC_CONFIG.supabaseUrl, window.OMC_CONFIG.supabaseAnonKey);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function safeUrl(url) {
    if (!url) return '';
    try {
      var parsed = new URL(url, window.location.href);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
    } catch (e) { /* fall through */ }
    return '';
  }

  function formatDate(d) {
    if (!d) return '';
    var date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function gapCardHtml(gap) {
    return (
      '<article class="gap-card" data-category="' + escapeHtml(gap.category) + '" data-severity="' + escapeHtml(gap.severity) + '">' +
        '<div class="gap-card-top">' +
          '<span class="pill pill-severity pill-' + escapeHtml(gap.severity) + '">' + escapeHtml(gap.severity) + '</span>' +
          '<span class="pill pill-status pill-status-' + escapeHtml(gap.status) + '">' + escapeHtml(STATUS_LABELS[gap.status] || gap.status) + '</span>' +
        '</div>' +
        '<h3>' + escapeHtml(gap.title) + '</h3>' +
        '<div class="gap-meta">' + escapeHtml(CATEGORY_LABELS[gap.category] || gap.category) + ' &middot; ' + escapeHtml(gap.geography) + '</div>' +
        '<p class="gap-summary">' + escapeHtml(gap.summary) + '</p>' +
        '<details class="gap-evidence">' +
          '<summary>Evidence</summary>' +
          '<p>' + escapeHtml(gap.evidence) + '</p>' +
        '</details>' +
        '<div class="gap-source">' +
          '<a href="' + escapeHtml(safeUrl(gap.source_url)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(gap.source_name) + ' &#8599;</a>' +
          '<span class="gap-verified">Verified ' + formatDate(gap.last_verified) + '</span>' +
        '</div>' +
      '</article>'
    );
  }

  function renderGaps() {
    var grid = document.getElementById('gap-grid');
    var empty = document.getElementById('gap-empty');
    if (!grid) return;

    var filtered = allGaps.filter(function (g) {
      var catOk = activeCategory === 'all' || g.category === activeCategory;
      var sevOk = activeSeverity === 'all' || g.severity === activeSeverity;
      return catOk && sevOk;
    });

    grid.innerHTML = filtered.map(gapCardHtml).join('');
    if (empty) empty.style.display = filtered.length ? 'none' : 'block';

    var countEl = document.getElementById('gap-count');
    if (countEl) countEl.textContent = filtered.length + ' of ' + allGaps.length + ' tracked gaps';
  }

  function renderCategoryFilters() {
    var wrap = document.getElementById('category-filters');
    if (!wrap) return;
    var cats = ['all'].concat(Object.keys(CATEGORY_LABELS).filter(function (c) { return c !== 'other'; }));
    wrap.innerHTML = cats.map(function (c) {
      var label = c === 'all' ? 'All categories' : CATEGORY_LABELS[c];
      return '<button type="button" class="chip" data-category="' + c + '">' + label + '</button>';
    }).join('');
    wrap.querySelectorAll('.chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCategory = btn.getAttribute('data-category');
        wrap.querySelectorAll('.chip').forEach(function (b) { b.classList.remove('chip-active'); });
        btn.classList.add('chip-active');
        renderGaps();
      });
    });
    wrap.querySelector('.chip').classList.add('chip-active');
  }

  function renderSeverityFilters() {
    var wrap = document.getElementById('severity-filters');
    if (!wrap) return;
    var sevs = ['all', 'critical', 'high', 'medium', 'low'];
    wrap.innerHTML = sevs.map(function (s) {
      return '<button type="button" class="chip chip-sev" data-severity="' + s + '">' + (s === 'all' ? 'All severities' : s) + '</button>';
    }).join('');
    wrap.querySelectorAll('.chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeSeverity = btn.getAttribute('data-severity');
        wrap.querySelectorAll('.chip').forEach(function (b) { b.classList.remove('chip-active'); });
        btn.classList.add('chip-active');
        renderGaps();
      });
    });
    wrap.querySelector('.chip').classList.add('chip-active');
  }

  function renderSummaryStats() {
    var byStatus = { open: 0, improving: 0, partially_resolved: 0, resolved: 0 };
    var critical = 0;
    allGaps.forEach(function (g) {
      byStatus[g.status] = (byStatus[g.status] || 0) + 1;
      if (g.severity === 'critical') critical++;
    });
    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total-gaps', allGaps.length);
    set('stat-critical-gaps', critical);
    set('stat-improving-gaps', byStatus.improving + byStatus.partially_resolved);
    set('stat-open-gaps', byStatus.open);
  }

  function loadGaps() {
    var grid = document.getElementById('gap-grid');
    if (!supabase) {
      if (grid) grid.innerHTML = '<p class="load-error">Live registry unavailable right now &mdash; the database connection did not load.</p>';
      return;
    }
    supabase
      .from('data_gaps')
      .select('*')
      .order('severity', { ascending: true })
      .then(function (res) {
        if (res.error) {
          if (grid) grid.innerHTML = '<p class="load-error">Could not load the live registry: ' + escapeHtml(res.error.message) + '</p>';
          return;
        }
        var order = { critical: 0, high: 1, medium: 2, low: 3 };
        allGaps = (res.data || []).sort(function (a, b) { return order[a.severity] - order[b.severity]; });
        renderCategoryFilters();
        renderSeverityFilters();
        renderSummaryStats();
        renderGaps();
      });
  }

  function submissionCardHtml(s) {
    return (
      '<div class="signal-card">' +
        '<div class="signal-top">' +
          '<span class="pill pill-status pill-status-' + escapeHtml(s.status) + '">' + escapeHtml(STATUS_LABELS[s.status] || s.status) + '</span>' +
          '<span class="signal-date">' + formatDate(s.created_at) + '</span>' +
        '</div>' +
        '<h4>' + escapeHtml(s.title) + '</h4>' +
        '<div class="gap-meta">' + escapeHtml(CATEGORY_LABELS[s.category] || s.category) + ' &middot; ' + escapeHtml(s.geography) + '</div>' +
        '<p>' + escapeHtml(s.description) + '</p>' +
        (safeUrl(s.source_url) ? '<a href="' + escapeHtml(safeUrl(s.source_url)) + '" target="_blank" rel="noopener noreferrer">Reference &#8599;</a>' : '') +
      '</div>'
    );
  }

  function loadSubmissions() {
    var list = document.getElementById('signal-list');
    if (!supabase || !list) return;
    supabase
      .from('gap_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) {
          list.innerHTML = '<p class="signal-empty">No community signals submitted yet. Be the first to flag a gap you have encountered.</p>';
          return;
        }
        list.innerHTML = res.data.map(submissionCardHtml).join('');
      });
  }

  function wireForm() {
    var form = document.getElementById('signal-form');
    if (!form) return;
    var statusEl = document.getElementById('signal-form-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!supabase) {
        if (statusEl) statusEl.textContent = 'Submission is unavailable right now — the database connection did not load.';
        return;
      }
      var payload = {
        title: form.title.value.trim(),
        category: form.category.value,
        geography: form.geography.value.trim(),
        description: form.description.value.trim(),
        source_url: form.source_url.value.trim() || null,
        submitter_name: form.submitter_name.value.trim() || null
      };
      if (!payload.title || !payload.geography || !payload.description) {
        if (statusEl) statusEl.textContent = 'Please fill in title, geography, and description.';
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      if (statusEl) statusEl.textContent = 'Submitting...';
      supabase.from('gap_submissions').insert(payload).then(function (res) {
        if (btn) btn.disabled = false;
        if (res.error) {
          if (statusEl) statusEl.textContent = 'Could not submit: ' + res.error.message;
          return;
        }
        if (statusEl) statusEl.textContent = 'Thank you — your signal is live below, flagged as pending review.';
        form.reset();
        loadSubmissions();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    supabase = initClient();
    loadGaps();
    loadSubmissions();
    wireForm();

    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });
})();
