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
        renderDashboard();
        renderTicker();
      });
  }

  var allMarketIndicators = [];

  function groupBy(arr, key) {
    var out = {};
    arr.forEach(function (item) { (out[item[key]] = out[item[key]] || []).push(item); });
    return out;
  }

  function loadMarketIndicators() {
    if (!supabase) return;
    supabase
      .from('market_indicators')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) return;
        allMarketIndicators = res.data;
        renderMarketCharts();
        renderTicker();
      });
  }

  function renderMarketCharts() {
    if (!window.OMC_CHARTS || !allMarketIndicators.length) return;
    var groups = groupBy(allMarketIndicators, 'chart_group');

    if (groups.registry_split) {
      var segs = groups.registry_split.map(function (r, i) {
        return { label: r.label, value: r.value, color: i === 0 ? 'var(--accent)' : 'var(--amber)' };
      });
      OMC_CHARTS.renderStackedProgress('chart-registry-split', 'chart-registry-split-legend', segs);
    }

    if (groups.kncr_progress) {
      var k = groups.kncr_progress[0];
      OMC_CHARTS.renderMeter('meter-kncr', k.value, 100, k.label);
    }

    if (groups.price_range) {
      OMC_CHARTS.renderBarChart(
        'chart-price',
        groups.price_range.map(function (r) { return { label: r.label, value: r.value, color: 'var(--accent)' }; }),
        { tableId: 'table-price', tableHeader: 'Price point', unit: ' €/t' }
      );
    }

    if (groups.benefit_share) {
      OMC_CHARTS.renderBarChart(
        'chart-benefit',
        groups.benefit_share.map(function (r) { return { label: r.label, value: r.value, color: 'var(--accent)' }; }),
        { tableId: 'table-benefit', tableHeader: 'Framework', unit: '%' }
      );
    }

    if (groups.scaleup) {
      OMC_CHARTS.renderBarChart(
        'chart-scaleup',
        groups.scaleup.map(function (r) { return { label: r.label, value: r.value, color: 'var(--accent)' }; }),
        { tableId: 'table-scaleup', tableHeader: 'Period', unit: ' idx' }
      );
    }
  }

  function renderTicker() {
    var track = document.getElementById('ticker-track');
    if (!track || !allGaps.length || !allMarketIndicators.length) return;

    var items = [];
    items.push({ k: 'TRACKED DATA GAPS', v: String(allGaps.length) });
    var critical = allGaps.filter(function (g) { return g.severity === 'critical'; }).length;
    items.push({ k: 'CRITICAL SEVERITY', v: String(critical) });

    var byGroup = groupBy(allMarketIndicators, 'chart_group');
    if (byGroup.kncr_progress) items.push({ k: 'KNCR INTEGRATION', v: byGroup.kncr_progress[0].value + '%' });
    var arrRow = byGroup.price_range && byGroup.price_range.filter(function (r) { return r.label.indexOf('East Africa') === 0; })[0];
    if (arrRow) items.push({ k: 'EAST AFRICA ARR AVG', v: '€' + arrRow.value + '/t' });
    var verraRow = byGroup.registry_split && byGroup.registry_split.filter(function (r) { return r.label === 'Verra'; })[0];
    if (verraRow) items.push({ k: 'VERRA SHARE', v: verraRow.value + '%' });
    items.push({ k: 'REGISTRY LAST REVIEWED', v: '17 SEP 2026' });

    var html = items.map(function (it) {
      return '<span class="ticker-item"><span class="dot"></span><span class="k">' + escapeHtml(it.k) + '</span> <span class="v">' + escapeHtml(it.v) + '</span></span>';
    }).join('');
    track.innerHTML = html + html;
  }

  var SEVERITY_COLORS = { critical: 'var(--critical)', high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)' };
  var SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
  var RESOLVE_COLORS = {
    open: 'var(--resolve-open)',
    improving: 'var(--resolve-improving)',
    partially_resolved: 'var(--resolve-partial)',
    resolved: 'var(--resolve-resolved)'
  };
  var RESOLVE_ORDER = ['open', 'improving', 'partially_resolved', 'resolved'];

  function renderDashboard() {
    if (!window.OMC_CHARTS || !allGaps.length) return;

    var severityCounts = {};
    var categoryCounts = {};
    var statusCounts = {};
    allGaps.forEach(function (g) {
      severityCounts[g.severity] = (severityCounts[g.severity] || 0) + 1;
      categoryCounts[g.category] = (categoryCounts[g.category] || 0) + 1;
      statusCounts[g.status] = (statusCounts[g.status] || 0) + 1;
    });

    OMC_CHARTS.renderBarChart(
      'chart-severity',
      SEVERITY_ORDER.filter(function (s) { return severityCounts[s]; }).map(function (s) {
        return { label: s.charAt(0).toUpperCase() + s.slice(1), value: severityCounts[s] || 0, color: SEVERITY_COLORS[s] };
      }),
      { tableId: 'table-severity', tableHeader: 'Severity', unit: ' gaps' }
    );

    var categoryRows = Object.keys(categoryCounts)
      .map(function (c) { return { label: CATEGORY_LABELS[c] || c, value: categoryCounts[c], color: 'var(--accent)' }; })
      .sort(function (a, b) { return b.value - a.value; });
    OMC_CHARTS.renderBarChart('chart-category', categoryRows, { tableId: 'table-category', tableHeader: 'Category', unit: ' gaps' });

    OMC_CHARTS.renderStackedProgress(
      'chart-resolution',
      'chart-resolution-legend',
      RESOLVE_ORDER.map(function (s) {
        return { label: STATUS_LABELS[s], value: statusCounts[s] || 0, color: RESOLVE_COLORS[s] };
      })
    );

    var resolvedish = (statusCounts.improving || 0) + (statusCounts.partially_resolved || 0) + (statusCounts.resolved || 0);
    OMC_CHARTS.renderMeter('meter-resolution', resolvedish, allGaps.length, 'of tracked gaps improving or resolved');
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

  // ---------- community signal intake chatbot (rule-based, no AI) ----------

  var CHAT_STEPS = [
    { key: 'title', prompt: "Hi! I can help you flag a data gap you've run into. What should I call it? (a short title)" },
    { key: 'category', prompt: 'Which category fits best?', quickReplies: Object.keys(CATEGORY_LABELS).map(function (k) { return { value: k, label: CATEGORY_LABELS[k] }; }) },
    { key: 'geography', prompt: 'Where does this apply? (a county, country, or region)' },
    { key: 'description', prompt: "Tell me more — what's missing, unclear, or hard to verify?" },
    { key: 'source_url', prompt: 'Got a reference link? Paste it, or send "skip".', optional: true },
    { key: 'submitter_name', prompt: 'Want to share your name? Type it, or send "skip".', optional: true }
  ];

  var chatState = { stepIndex: 0, answers: {}, awaitingConfirm: false };

  function chatAppend(role, text) {
    var log = document.getElementById('chat-log');
    if (!log) return;
    var div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function chatClearQuickReplies() {
    var wrap = document.getElementById('chat-quick-replies');
    if (wrap) wrap.innerHTML = '';
  }

  function chatShowQuickReplies(options) {
    var wrap = document.getElementById('chat-quick-replies');
    if (!wrap) return;
    wrap.innerHTML = '';
    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt.label;
      btn.addEventListener('click', opt.onClick);
      wrap.appendChild(btn);
    });
  }

  function chatAskCurrentStep() {
    chatClearQuickReplies();
    if (chatState.stepIndex >= CHAT_STEPS.length) {
      chatShowSummary();
      return;
    }
    var step = CHAT_STEPS[chatState.stepIndex];
    chatAppend('bot', step.prompt);
    if (step.quickReplies) {
      chatShowQuickReplies(step.quickReplies.map(function (o) {
        return { label: o.label, onClick: function () { chatHandleAnswer(o.label, o.value); } };
      }));
    }
  }

  function chatHandleAnswer(displayText, rawValue) {
    var step = CHAT_STEPS[chatState.stepIndex];
    var value = rawValue !== undefined ? rawValue : displayText;
    if (!step.optional && !String(value).trim()) {
      chatAppend('bot', 'I need something there — mind trying again?');
      return;
    }
    if (step.optional && /^skip$/i.test(String(value).trim())) value = '';
    chatAppend('user', displayText);
    chatState.answers[step.key] = String(value).trim();
    chatState.stepIndex++;
    chatAskCurrentStep();
  }

  function chatShowSummary() {
    var a = chatState.answers;
    chatAppend('bot', 'Here’s what I’ve got: "' + a.title + '" (' + (CATEGORY_LABELS[a.category] || a.category) + ', ' + a.geography + '). Want me to submit it?');
    chatState.awaitingConfirm = true;
    chatShowQuickReplies([
      { label: 'Yes, submit it', onClick: chatConfirmSubmit },
      { label: 'Start over', onClick: chatRestart }
    ]);
  }

  function chatConfirmSubmit() {
    chatState.awaitingConfirm = false;
    chatClearQuickReplies();
    chatSubmit();
  }

  function chatSubmit() {
    if (!supabase) {
      chatAppend('bot', 'Submission is unavailable right now — the database connection did not load.');
      return;
    }
    var a = chatState.answers;
    var payload = {
      title: a.title,
      category: a.category,
      geography: a.geography,
      description: a.description,
      source_url: a.source_url || null,
      submitter_name: a.submitter_name || null
    };
    chatAppend('bot', 'Submitting…');
    supabase.from('gap_submissions').insert(payload).then(function (res) {
      if (res.error) {
        chatAppend('bot', 'Could not submit: ' + res.error.message);
        return;
      }
      chatAppend('bot', 'Thanks — your signal is live in the log to the left, flagged as pending review. Flag another?');
      chatShowQuickReplies([{ label: 'Flag another gap', onClick: chatRestart }]);
      loadSubmissions();
    });
  }

  function chatRestart() {
    chatState = { stepIndex: 0, answers: {}, awaitingConfirm: false };
    var log = document.getElementById('chat-log');
    if (log) log.innerHTML = '';
    chatAskCurrentStep();
  }

  function initChatbot() {
    var form = document.getElementById('chat-input-form');
    var input = document.getElementById('chat-input');
    if (!form || !input) return;

    chatAskCurrentStep();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      input.value = '';

      if (chatState.awaitingConfirm) {
        chatAppend('user', text);
        if (/^(y|yes|submit|confirm)/i.test(text)) {
          chatConfirmSubmit();
        } else {
          chatAppend('bot', 'Use a button above to confirm or start over — or type "yes" to submit.');
        }
        return;
      }

      var step = CHAT_STEPS[chatState.stepIndex];
      if (step && step.quickReplies) {
        var match = step.quickReplies.filter(function (o) { return o.label.toLowerCase() === text.toLowerCase(); })[0];
        if (!match) {
          chatAppend('user', text);
          chatAppend('bot', 'Pick one of the categories above, or type its name exactly.');
          return;
        }
        chatHandleAnswer(match.label, match.value);
        return;
      }
      chatHandleAnswer(text);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    supabase = initClient();
    loadGaps();
    loadMarketIndicators();
    loadSubmissions();
    initChatbot();

    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });
})();
