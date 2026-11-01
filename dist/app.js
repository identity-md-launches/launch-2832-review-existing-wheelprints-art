(function () {
  'use strict';
  var data = window.WHEELPRINTS_DATA, engine = window.Wheelprints, exportKit = window.WheelprintsExportKit;
  var $ = function (id) { return document.getElementById(id); };
  if (!data || !engine || !exportKit || !Array.isArray(data.periods) || !data.periods.length) {
    $('artwork').textContent = 'The studio could not load. Please reload this page.';
    document.querySelectorAll('button, input').forEach(function (control) { control.disabled = true; });
    return;
  }
  var periods = data.periods.map(function (p) {
    return Object.assign({}, p, { chainId: data.chainId, coreAddress: data.coreAddress, streamId: data.streamId || '' });
  });
  var state = { index: 0, style: 'orbit', palette: 'mineral', progress: 1, playing: false };
  var animation = 0, playbackStart = 0, playbackInitial = 0;
  var prepared = { artwork: [], proof: [] };
  var descriptions = {
    orbit: 'Fine lines gather into an orbital sculpture.',
    current: 'A flowing field bends through the recorded moment.',
    bloom: 'A radial structure opens into an intricate bloom.'
  };
  var fmt = function (v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  function current() { return periods[state.index]; }
  function options(progress, size) {
    return { style: state.style, palette: state.palette, progress: progress === undefined ? 1 : progress, size: size || 1000 };
  }
  function escaped(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateLabel(p) {
    var a = new Date(p.startAt), b = new Date(p.endAt);
    var t = function (d) { return d.toISOString().slice(11, 16); };
    return a.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) + ' · ' + t(a) + '–' + t(b) + ' UTC';
  }
  function say(t) { $('app-status').textContent = t; }
  function updateReplayControl() {
    var label = state.playing ? 'Pause' : state.progress >= 1 ? 'Replay' : 'Play';
    $('play-icon').textContent = state.playing ? 'Ⅱ' : '▶';
    $('play-label').textContent = label;
    $('play').setAttribute('aria-label', label + ' artwork construction');
  }
  function stop() {
    state.playing = false;
    cancelAnimationFrame(animation);
    updateReplayControl();
  }
  function setProgress(value) {
    state.progress = Math.max(0, Math.min(1, value));
    var percent = Math.round(state.progress * 100);
    $('progress').value = percent;
    $('progress').setAttribute('aria-valuetext', percent + '% constructed');
    $('progress-value').textContent = percent + '%';
    var svg = $('artwork').querySelector('svg');
    if (svg && engine.setProgress) engine.setProgress(svg, state.progress);
    else $('artwork').innerHTML = engine.render(current(), options(state.progress));
    updateReplayControl();
  }
  function updateButtons() {
    document.querySelectorAll('[data-record]').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.dataset.record) === state.index ? 'true' : 'false'); });
    document.querySelectorAll('[data-style]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.style === state.style ? 'true' : 'false'); });
    document.querySelectorAll('[data-palette]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.palette === state.palette ? 'true' : 'false'); });
  }
  function writeLocation(mode) {
    var url = new URL(location.href);
    url.searchParams.set('record', current().id);
    url.searchParams.set('form', state.style);
    url.searchParams.set('palette', state.palette);
    try {
      if (url.href === location.href) return;
      if (mode === 'push') history.pushState(null, '', url);
      else history.replaceState(history.state, '', url);
    } catch (e) { /* The studio remains usable if this host disallows history updates. */ }
  }
  function readLocation() {
    var params = new URLSearchParams(location.search);
    var index = periods.findIndex(function (p) { return p.id === params.get('record'); });
    var next = {
      index: index >= 0 ? index : 0,
      style: engine.styles.includes(params.get('form')) ? params.get('form') : 'orbit',
      palette: engine.palettes.includes(params.get('palette')) ? params.get('palette') : 'mineral'
    };
    var changed = next.index !== state.index || next.style !== state.style || next.palette !== state.palette;
    state.index = next.index; state.style = next.style; state.palette = next.palette;
    return changed;
  }
  function render(historyMode) {
    stop();
    state.progress = 1;
    var p = current();
    $('artwork').innerHTML = engine.render(p, options(1));
    $('plate-number').textContent = 'STUDY ' + String(state.index + 1).padStart(2, '0') + ' / ' + String(periods.length).padStart(2, '0');
    $('canvas-type').textContent = state.style.toUpperCase() + ' / ' + state.palette.toUpperCase();
    $('print-title').textContent = p.title;
    $('period-date').textContent = dateLabel(p);
    $('work-count').textContent = fmt(p.workUnits);
    $('block-count').textContent = fmt(p.blocks);
    $('style-description').textContent = descriptions[state.style];
    if ($('testnet-link')) {
      var mintURL = new URL('testnet/', document.baseURI || location.href);
      mintURL.search = new URLSearchParams({ record: p.id, form: state.style, palette: state.palette }).toString();
      $('testnet-link').href = mintURL.href;
    }
    $('progress').value = 100;
    $('progress').setAttribute('aria-valuetext', '100% constructed');
    $('progress-value').textContent = '100%';
    if ($('share-link-box')) $('share-link-box').hidden = true;
    updateReplayControl();
    updateButtons();
    say('');
    if (historyMode) writeLocation(historyMode);
  }
  function choose(index) { state.index = index; render('push'); }
  periods.forEach(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.dataset.record = i;
    b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.innerHTML = '<strong>' + escaped(p.title) + '</strong><small>' + fmt(p.workUnits) + ' work · #' + escaped(p.roundStart) + '</small>';
    b.addEventListener('click', function () { choose(i); });
    $('record-options').appendChild(b);
    var card = document.createElement('button');
    card.type = 'button'; card.className = 'study-card';
    card.setAttribute('aria-label', 'Open ' + p.title + ' in the studio');
    card.innerHTML = '<div class="study-art" aria-hidden="true">' + engine.render(p, { style: 'orbit', palette: 'mineral', progress: 1, size: 650 }) + '</div><div class="study-text"><div><h3>' + escaped(p.title) + '</h3><p>ROUND ' + escaped(p.roundStart) + ' / ' + fmt(p.workUnits) + ' WORK / ' + escaped(p.blocks) + ' BLOCKS</p></div><span class="study-arrow" aria-hidden="true">↗</span></div>';
    card.addEventListener('click', function () {
      state.style = 'orbit'; state.palette = 'mineral'; choose(i);
      $('studio-heading').focus({ preventScroll: true });
      $('studio').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      say(p.title + ' opened in the studio.');
    });
    $('study-grid').appendChild(card);
  });
  document.querySelectorAll('[data-style]').forEach(function (b) { b.addEventListener('click', function () { state.style = b.dataset.style; render('push'); }); });
  document.querySelectorAll('[data-palette]').forEach(function (b) { b.addEventListener('click', function () { state.palette = b.dataset.palette; render('push'); }); });
  $('play').addEventListener('click', function () {
    if (state.playing) { stop(); say('Construction paused at ' + Math.round(state.progress * 100) + '%.'); return; }
    if (state.progress >= 1) setProgress(0);
    state.playing = true;
    playbackInitial = state.progress;
    playbackStart = performance.now();
    updateReplayControl();
    say('Replaying ' + current().title + ' construction.');
    function tick(now) {
      if (!state.playing) return;
      setProgress(playbackInitial + (now - playbackStart) / 9000);
      if (state.progress >= 1) { stop(); say('Construction complete. The final print is ready.'); }
      else animation = requestAnimationFrame(tick);
    }
    animation = requestAnimationFrame(tick);
  });
  $('progress').addEventListener('input', function () { stop(); setProgress(Number(this.value) / 100); say(''); });

  // Browser and prebuilt files share the same source-record and SVG assembly.
  function exportSnapshot() {
    return exportKit.snapshot(data, current(), { style: state.style, palette: state.palette });
  }
  function finalSvg(snapshot) { return exportKit.svg(snapshot); }
  function recordBlob(snapshot) { return new Blob([exportKit.recordText(snapshot)], { type: 'application/json' }); }
  function staticFiles(snapshot) {
    if (navigator.onLine === false) return null;
    var entry = exportKit.staticEntry(window.WHEELPRINTS_EXPORTS, data, snapshot);
    if (!entry) return null;
    var urls = {}, extensions = ['svg', 'png', 'json'];
    for (var i = 0; i < extensions.length; i++) {
      var ext = extensions[i], url = new URL(entry.files[ext].path, document.baseURI || location.href);
      if (url.origin !== location.origin) return null;
      url.searchParams.set('v', entry.files[ext].sha256);
      urls[ext] = url.href;
    }
    return urls;
  }
  function readyDownload(blob, ext, snapshot, inProof, files) {
    var key = inProof ? 'proof' : 'artwork';
    var box = $(inProof ? 'proof-export-recovery' : 'export-recovery');
    var urls = [], previous = prepared[key];
    var url = files ? files[ext] : URL.createObjectURL(blob);
    if (!files) urls.push(url);
    var name = snapshot.baseName + '.' + ext;
    var note = document.createElement('p');
    note.className = 'prepared-file';
    note.textContent = snapshot.sample.title + ' · ' + snapshot.settings.style + ' / ' + snapshot.settings.palette + ' · ' + ext.toUpperCase() + ' ready';
    var links = document.createElement('div'); links.className = 'recovery-links';
    function link(href, text, downloadName) {
      var a = document.createElement('a'); a.href = href; a.textContent = text;
      if (downloadName) a.download = downloadName;
      else { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      links.appendChild(a); return a;
    }
    var save = link(url, 'Save ' + ext.toUpperCase(), name);
    link(url, 'Open in new tab');
    if (ext !== 'json') {
      var recordUrl = files ? files.json : URL.createObjectURL(recordBlob(snapshot));
      if (!files) urls.push(recordUrl);
      link(recordUrl, 'Matching source record', snapshot.baseName + '.json');
    }
    box.replaceChildren(note, links);
    box.hidden = false;
    prepared[key] = urls;
    // Keep the visible links alive. Delay cleanup of replaced files so an active save can finish.
    if (previous.length) setTimeout(function () { previous.forEach(function (old) { URL.revokeObjectURL(old); }); }, 60000);
    try { save.click(); } catch (e) { /* The visible links remain available for a deliberate click. */ }
  }
  $('export-svg').addEventListener('click', function () {
    try {
      var snapshot = exportSnapshot();
      var files = staticFiles(snapshot);
      readyDownload(files ? null : new Blob([finalSvg(snapshot)], { type: 'image/svg+xml;charset=utf-8' }), 'svg', snapshot, false, files);
      say(snapshot.sample.title + ' SVG prepared with its source record embedded. Save or open it using the links below.');
    } catch (e) { say('The SVG could not be prepared. Please try again.'); }
  });
  $('export-json').addEventListener('click', function () {
    try {
      var snapshot = exportSnapshot();
      var files = staticFiles(snapshot);
      readyDownload(files ? null : recordBlob(snapshot), 'json', snapshot, true, files);
      say(snapshot.sample.title + ' source record prepared.');
    } catch (e) {
      var box = $('proof-export-recovery'); box.hidden = false;
      box.textContent = 'The source record could not be prepared. Please try again.';
    }
  });
  $('export-png').addEventListener('click', function () {
    var button = this, snapshot = exportSnapshot(), url = '', timer = 0, finished = false;
    var files = staticFiles(snapshot);
    if (files) {
      readyDownload(null, 'png', snapshot, false, files);
      say(snapshot.sample.title + ' PNG ready. Its matching source record is linked below.');
      return;
    }
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    say('Preparing a 2400-pixel ' + snapshot.sample.title + ' print…');
    function finish(out) {
      if (finished) return;
      finished = true; clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
      button.disabled = false; button.removeAttribute('aria-busy');
      if (out) {
        try {
          readyDownload(out, 'png', snapshot, false);
          say(snapshot.sample.title + ' PNG prepared. Its matching source record is linked below.');
          return;
        } catch (e) { /* Report a preparation failure without claiming a download succeeded. */ }
      }
      say('PNG export could not finish. You can still keep the SVG.');
    }
    try {
      url = URL.createObjectURL(new Blob([finalSvg(snapshot)], { type: 'image/svg+xml;charset=utf-8' }));
      var img = new Image();
      img.onload = function () {
        if (finished) return;
        try {
          var canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 2400;
          canvas.getContext('2d').drawImage(img, 0, 0, 2400, 2400);
          canvas.toBlob(finish, 'image/png');
        } catch (e) { finish(null); }
      };
      img.onerror = function () { finish(null); };
      timer = setTimeout(function () { finish(null); }, 30000);
      img.src = url;
    } catch (e) { finish(null); }
  });

  function printLink() {
    var url = new URL(location.href);
    url.search = ''; url.hash = ''; url.username = ''; url.password = '';
    url.searchParams.set('record', current().id);
    url.searchParams.set('form', state.style);
    url.searchParams.set('palette', state.palette);
    return url.href;
  }
  $('share-print').addEventListener('click', function () {
    var url = printLink(), title = current().title;
    function manualCopy() {
      $('share-link-box').hidden = false;
      $('share-url').value = url;
      $('share-url').focus(); $('share-url').select();
      say('The link for ' + title + ' is selected. Copy it to share this print.');
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
      try {
        navigator.clipboard.writeText(url).then(function () { say('Print link for ' + title + ' copied.'); }, manualCopy);
      } catch (e) { manualCopy(); }
    } else manualCopy();
  });
  $('show-proof').addEventListener('click', function () {
    var p = current();
    var rows = [
      ['Study', p.title], ['Source network', data.chainName + ' · ' + data.chainId],
      ['Round', String(p.roundStart)], ['Interval', dateLabel(p)],
      ['Accepted passages', p.workUnits], ['Completed blocks', String(p.blocks)],
      ['Ethereum block', p.sourceBlock], ['Core address', data.coreAddress], ['Source stream', data.streamId],
      ['Transaction', p.sourceTx], ['Renderer', engine.version], ['Form and palette', state.style + ' / ' + state.palette],
      ['Deterministic seed', String(engine.seed(p, options()))], ['Snapshot captured', data.capturedAt]
    ];
    if (data.chainVerification) {
      rows.push(['Recorded values checked', 'Against Sepolia events and historical Core views']);
      var checked = data.chainVerification.configurationRead;
      if (checked && checked.readAtBlockNumber) rows.push(['Verification read block', checked.readAtBlockNumber]);
      if (checked && checked.readAtBlockHash) rows.push(['Verification block hash', checked.readAtBlockHash]);
    }
    $('proof-summary').textContent = p.description;
    $('proof-fields').innerHTML = rows.map(function (r) { return '<div><dt>' + escaped(r[0]) + '</dt><dd>' + escaped(r[1]) + '</dd></div>'; }).join('');
    $('proof-tx').href = 'https://sepolia.etherscan.io/tx/' + p.sourceTx;
    $('proof-export-recovery').hidden = true;
    $('proof-dialog').showModal();
  });
  $('close-proof').addEventListener('click', function () { $('proof-dialog').close(); });
  $('proof-dialog').addEventListener('click', function (e) {
    if (e.target === this) {
      var r = this.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.close();
    }
  });
  window.addEventListener('popstate', function () { if (readLocation()) render(); });
  readLocation();
  render('replace');
})();
