'use strict';
// Focused application-state checks. Browser download events and raster output are verified separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const engine = require(path.join(root, 'dist/art-engine.js'));
const exportKit = require(path.join(root, 'dist/export-kit.js'));
const exportManifest = require(path.join(root, 'dist/data/exports.js'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'dist/data/periods.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const code = fs.readFileSync(path.join(root, 'dist/app.js'), 'utf8');
const required = ['export-recovery', 'proof-export-recovery', 'share-print', 'share-link-box', 'share-url'];
for (const id of required) assert.ok(html.includes('id="' + id + '"'), 'Missing app markup: ' + id);
assert.match(html, /id="studio-heading"[^>]*tabindex="-1"|tabindex="-1"[^>]*id="studio-heading"/);

function harness(initial, dataset = data, manifest) {
  const elements = new Map(), all = [], downloads = [], blobs = new Map(), timers = new Map(), frames = new Map(), images = [];
  const events = new Map();
  let blobCount = 0, timerCount = 0, frameCount = 0, now = 0, pendingRaster;
  class Element {
    constructor(tag, id) {
      this.tagName = tag.toUpperCase(); this.id = id || ''; this.dataset = {}; this.attributes = {};
      this.listeners = new Map(); this.children = []; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.hidden = false;
      all.push(this); if (id) elements.set(id, this);
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
    replaceChildren(...children) { this.children = children; }
    addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(handler); }
    dispatch(type, details = {}) { for (const fn of this.listeners.get(type) || []) fn.call(this, { target: this, ...details }); }
    click() { if (this.tagName === 'A') downloads.push({ href: this.href, name: this.download }); else this.dispatch('click'); }
    querySelector() { return null; }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    scrollIntoView(value) { this.scrolled = value; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    getBoundingClientRect() { return { left: 10, right: 100, top: 10, bottom: 100 }; }
  }
  const document = {
    activeElement: null,
    getElementById(id) { return elements.get(id) || null; },
    createElement(tag) {
      const element = new Element(tag);
      if (tag === 'canvas') {
        element.getContext = () => ({ drawImage(image) { element.drawnImage = image; } });
        element.toBlob = callback => { pendingRaster = callback; };
      }
      return element;
    },
    querySelectorAll(selector) {
      const dataKey = { '[data-record]': 'record', '[data-style]': 'style', '[data-palette]': 'palette' }[selector];
      if (dataKey) return all.filter(e => e.dataset[dataKey] !== undefined);
      return all.filter(e => e.tagName === 'BUTTON' || e.tagName === 'INPUT');
    }
  };
  document.body = new Element('body');
  for (const match of html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const element = new Element(match[1], match[2]);
    element.hidden = /\bhidden\b/.test(match[0]);
  }
  for (const attribute of ['style', 'palette']) for (const match of html.matchAll(new RegExp('data-' + attribute + '="([^"]+)"', 'g'))) {
    const element = new Element('button'); element.dataset[attribute] = match[1];
  }
  const location = new URL(initial);
  const historyEntries = [location.href]; let historyIndex = 0;
  const history = {
    state: null,
    pushState(state, unused, url) { this.state = state; location.href = String(url); historyEntries.splice(++historyIndex); historyEntries.push(location.href); },
    replaceState(state, unused, url) { this.state = state; location.href = String(url); historyEntries[historyIndex] = location.href; },
    back() { if (historyIndex > 0) { location.href = historyEntries[--historyIndex]; (events.get('popstate') || []).forEach(fn => fn()); } }
  };
  class AppURL extends URL {
    static createObjectURL(blob) { const url = 'blob:test-' + ++blobCount; blobs.set(url, blob); return url; }
    static revokeObjectURL(url) { blobs.delete(url); }
  }
  class AppImage { constructor() { images.push(this); } }
  const sandbox = {
    WHEELPRINTS_DATA: JSON.parse(JSON.stringify(dataset)), Wheelprints: engine, WheelprintsExportKit: exportKit, WHEELPRINTS_EXPORTS: manifest, document, location, history,
    URL: AppURL, URLSearchParams, Blob, Image: AppImage, navigator: { onLine: true }, isSecureContext: true,
    performance: { now: () => now },
    requestAnimationFrame(fn) { const id = ++frameCount; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn, delay) { const id = ++timerCount; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, fn) { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); },
    matchMedia() { return { matches: true }; }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'dist/app.js' });
  return {
    el: id => elements.get(id), find: (key, value) => all.find(e => String(e.dataset[key]) === String(value)),
    document, downloads, blobs, timers, images, history, location, sandbox,
    frame(time) { now = time; const next = [...frames.values()]; frames.clear(); next.forEach(fn => fn(time)); },
    raster(blob) { pendingRaster(blob); }
  };
}
function decode(text) { return text.replace(/&(amp|quot|lt|gt|#39);/g, (match, entity) => ({ amp: '&', quot: '"', lt: '<', gt: '>', '#39': "'" })[entity]); }
function links(box) { return box.children[1].children; }
async function latestRecord(h, box = 'export-recovery') {
  const anchor = links(h.el(box)).find(a => /\.json$/.test(a.download || ''));
  return JSON.parse(await h.blobs.get(anchor.href).text());
}
(async function () {
  const h = harness('https://wheelprints.example/studio?record=round-517&form=current&palette=midnight&utm_source=private-context#studio');
  assert.equal(h.el('print-title').textContent, 'Pulse');
  assert.equal(h.el('canvas-type').textContent, 'CURRENT / MIDNIGHT');
  assert.equal(h.find('record', 1).getAttribute('aria-pressed'), 'true');
  h.el('share-print').click();
  const cleanLink = h.el('share-url').value;
  assert.equal(cleanLink, 'https://wheelprints.example/studio?record=round-517&form=current&palette=midnight');
  assert.equal(h.el('share-link-box').hidden, false);
  assert.equal(h.document.activeElement, h.el('share-url'));
  assert.equal(h.el('share-url').selected, true);
  let copied;
  h.sandbox.navigator.clipboard = { writeText(value) { copied = value; return Promise.resolve(); } };
  h.el('share-print').click(); await Promise.resolve();
  assert.equal(copied, cleanLink); assert.match(h.el('app-status').textContent, /copied/);
  h.sandbox.navigator.clipboard = { writeText() { return Promise.reject(new Error('denied')); } };
  h.el('share-print').click(); await Promise.resolve();
  assert.match(h.el('app-status').textContent, /selected/);

  h.el('play').click(); h.frame(9000);
  assert.match(h.el('app-status').textContent, /complete/);
  h.el('play').click();
  assert.equal(h.el('app-status').textContent, 'Replaying Pulse construction.');
  assert.equal(h.el('play').getAttribute('aria-label'), 'Pause artwork construction');
  h.el('play').click();
  assert.equal(h.el('play').getAttribute('aria-label'), 'Play artwork construction');
  h.el('progress').value = 25; h.el('progress').dispatch('input');
  assert.equal(h.el('progress').getAttribute('aria-valuetext'), '25% constructed');
  assert.equal(h.el('play-label').textContent, 'Play');

  h.find('record', 2).click(); h.find('style', 'bloom').click();
  assert.equal(h.el('print-title').textContent, 'Surge'); assert.equal(h.el('canvas-type').textContent, 'BLOOM / MIDNIGHT');
  h.history.back();
  assert.equal(h.el('canvas-type').textContent, 'CURRENT / MIDNIGHT');
  h.history.back(); assert.equal(h.el('print-title').textContent, 'Pulse');
  h.el('study-grid').children[0].click();
  assert.equal(h.el('print-title').textContent, 'Drift');
  assert.equal(h.el('canvas-type').textContent, 'ORBIT / MINERAL');
  assert.equal(h.document.activeElement, h.el('studio-heading'));
  assert.equal(h.el('studio').scrolled.behavior, 'auto');

  h.el('progress').value = 25; h.el('progress').dispatch('input');
  h.el('export-svg').click();
  const svgLinks = links(h.el('export-recovery'));
  const svg = await h.blobs.get(svgLinks[0].href).text();
  assert.equal(svgLinks[0].download, 'Wheelprints_Drift_orbit_mineral.svg');
  assert.equal(svgLinks[1].target, '_blank'); assert.equal(svgLinks[1].rel, 'noopener noreferrer');
  assert.equal(h.el('export-recovery').hidden, false);
  const match = svg.match(/<metadata id="wheelprints-source">([^<]+)<\/metadata>/);
  assert.ok(match, 'SVG embeds its export record.');
  const embedded = JSON.parse(decode(match[1]));
  assert.deepEqual(embedded, await latestRecord(h), 'The image links to its exact embedded source record.');
  assert.equal(embedded.prototypeVersion, '0.2');
  assert.equal(embedded.seed, engine.seed(embedded.source.period, embedded.artisticSettings));
  assert.equal(embedded.source.period.coreAddress, data.coreAddress);
  assert.equal(embedded.source.period.streamId, data.streamId);
  assert.equal(embedded.source.period.chainId, data.chainId);
  if (data.chainVerification) assert.deepEqual(embedded.source.chainVerification, data.chainVerification);
  assert.equal(svg.replace(match[0], ''), engine.render(embedded.source.period, { ...embedded.artisticSettings, size: 1600, progress: 1 }), 'Saved record reproduces the full engine SVG exactly, even when export started during replay.');
  assert.ok(h.blobs.has(svgLinks[0].href), 'A prepared save link remains available.');

  h.el('show-proof').click(); assert.equal(h.el('proof-dialog').open, true);
  assert.ok(h.el('proof-fields').innerHTML.includes(data.streamId));
  h.el('export-json').click();
  assert.deepEqual(await latestRecord(h, 'proof-export-recovery'), embedded);
  h.el('close-proof').click(); assert.equal(h.el('proof-dialog').open, false);

  h.el('export-png').click(); assert.equal(h.el('export-png').disabled, true);
  const rendering = h.images.at(-1);
  const frozenSvg = await h.blobs.get(rendering.src).text();
  h.find('record', 2).click(); h.find('style', 'current').click(); h.find('palette', 'ember').click();
  rendering.onload(); h.raster(new Blob(['raster-placeholder'], { type: 'image/png' }));
  assert.equal(h.el('export-png').disabled, false);
  assert.equal(links(h.el('export-recovery'))[0].download, 'Wheelprints_Drift_orbit_mineral.png');
  const pngRecord = await latestRecord(h);
  assert.deepEqual(pngRecord, embedded, 'Changing selection during PNG rendering cannot change its matching record.');
  assert.ok(frozenSvg.includes('data-wp-progress="1"'));
  assert.equal(h.el('print-title').textContent, 'Surge');
  assert.match(h.el('app-status').textContent, /Drift PNG prepared/);
  h.el('export-png').click(); h.images.at(-1).onerror();
  assert.equal(h.el('export-png').disabled, false);
  assert.equal(h.el('export-png').getAttribute('aria-busy'), null);
  assert.match(h.el('app-status').textContent, /could not finish/);

  const corroboration = data.chainVerification;
  if (corroboration) {
    const checked = harness('https://wheelprints.example/', { ...data, chainVerification: corroboration });
    checked.el('show-proof').click(); checked.el('export-json').click();
    const checkedRecord = await latestRecord(checked, 'proof-export-recovery');
    assert.deepEqual(checkedRecord.source.chainVerification, corroboration, 'Corroboration details survive export without entering art identity.');
    assert.equal(checkedRecord.seed, embedded.seed);
    assert.ok(checked.el('proof-fields').innerHTML.includes(corroboration.configurationRead.readAtBlockNumber));
    assert.ok(checked.el('proof-fields').innerHTML.includes(corroboration.configurationRead.readAtBlockHash));
  }
  const stable = harness('https://wheelprints.example/?record=round-517&form=bloom&palette=ember', data, exportManifest);
  for (const ext of ['svg', 'png', 'json']) {
    stable.el('export-' + ext).click();
    const prepared = links(stable.el(ext === 'json' ? 'proof-export-recovery' : 'export-recovery'));
    const files = exportManifest.entries['round-517/bloom/ember'].files;
    assert.equal(prepared[0].href, 'https://wheelprints.example/exports/Wheelprints_Pulse_bloom_ember.' + ext + '?v=' + files[ext].sha256);
    if (ext !== 'json') assert.equal(prepared[2].href, 'https://wheelprints.example/exports/Wheelprints_Pulse_bloom_ember.json?v=' + files.json.sha256);
  }
  assert.equal(stable.images.length, 0, 'Static PNG delivery must not start a canvas render.');
  assert.equal(stable.blobs.size, 0, 'Static delivery uses ordinary file URLs for image and record.');
  const offline = harness('https://wheelprints.example/', data, exportManifest);
  offline.sandbox.navigator.onLine = false;
  offline.el('export-svg').click();
  assert.match(links(offline.el('export-recovery'))[0].href, /^blob:/);
  const stale = harness('https://wheelprints.example/', data, { ...exportManifest, datasetIdentity: 'stale' });
  stale.el('export-svg').click();
  assert.match(links(stale.el('export-recovery'))[0].href, /^blob:/);
  const foreignBase = harness('https://wheelprints.example/', data, exportManifest);
  foreignBase.document.baseURI = 'https://different.example/';
  foreignBase.el('export-svg').click();
  assert.match(links(foreignBase.el('export-recovery'))[0].href, /^blob:/, 'Static links cannot route to a different origin.');
  const invalid = harness('https://wheelprints.example/?record=missing&form=unknown&palette=other');
  assert.equal(invalid.el('print-title').textContent, 'Drift');
  assert.equal(invalid.el('canvas-type').textContent, 'ORBIT / MINERAL');
  console.log('PASS: same-origin static delivery; missing, offline, and stale-manifest Blob fallback; whitelisted sharing; replay/navigation/focus; exact exported provenance; and async PNG identity.');
  console.log('Note: this harness checks application state and Blob contents, not browser save events or PNG raster pixels.');
})().catch(error => { console.error(error); process.exitCode = 1; });
