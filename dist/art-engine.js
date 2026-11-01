/* Wheelprints • original deterministic SVG studies • renderer wp-svg-0.1.0
 * Geometry is a visual interpretation of settled work, never a reconstruction
 * of wheel position or a source of unpredictable randomness.
 * No network, clock, external assets, wallet access, or unseeded randomness.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Wheelprints = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'wp-svg-0.1.0';
  const TAU = Math.PI * 2;
  const STYLES = ['orbit', 'current', 'bloom'];
  const PALETTES = {
    mineral: { paper: '#f3f0e7', ink: '#202d37', blue: '#535a88', accent: '#c25937', faint: '#b9b3a4' },
    ember: { paper: '#f4eade', ink: '#3e2e2a', blue: '#a6573e', accent: '#c26932', faint: '#bfae98' },
    midnight: { paper: '#142126', ink: '#d9e3d9', blue: '#87aba9', accent: '#d2dc83', faint: '#536b6e' }
  };
  const cache = new Map();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const fmt = n => (Math.abs(n) < 0.0005 ? 0 : n).toFixed(2);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  function integer(value, label) {
    const s = String(value === undefined || value === null ? '' : value);
    if (!/^\d+$/.test(s)) throw new TypeError(label + ' must be a nonnegative integer.');
    return BigInt(s);
  }
  function boundedNumber(value, ceiling) {
    const c = BigInt(ceiling);
    return Number(value > c ? c : value);
  }
  function options(input) {
    const o = input || {};
    return {
      style: STYLES.includes(o.style) ? o.style : 'orbit',
      palette: Object.prototype.hasOwnProperty.call(PALETTES, o.palette) ? o.palette : 'mineral',
      progress: Number.isFinite(Number(o.progress)) ? clamp(Number(o.progress), 0, 1) : 1,
      size: Number.isFinite(Number(o.size)) ? clamp(Math.round(Number(o.size)), 160, 8192) : 900
    };
  }
  function canonical(sample, o) {
    if (!sample || typeof sample !== 'object') throw new TypeError('A settled period is required.');
    const work = integer(sample.workUnits, 'workUnits');
    const blocks = integer(sample.blocks, 'blocks');
    const first = integer(sample.roundStart, 'roundStart');
    const last = integer(sample.roundEnd, 'roundEnd');
    if (last < first) throw new RangeError('roundEnd must not be before roundStart.');
    return JSON.stringify({
      renderer: VERSION,
      chain: String(sample.chainId || '11155111'),
      core: String(sample.coreAddress || sample.sourceCore || '').toLowerCase(),
      stream: String(sample.streamId || ''),
      transaction: String(sample.sourceTx || '').toLowerCase(),
      first: first.toString(), last: last.toString(),
      work: work.toString(), blocks: blocks.toString(),
      cumulativeWorkEnd: String(sample.cumulativeWorkEnd || ''),
      cumulativeBlockUnitsEnd: String(sample.cumulativeBlockUnitsEnd || ''),
      style: o.style, palette: o.palette
    });
  }
  // FNV-1a over UTF-8 gives a portable 32-bit visual seed, not a proof or hash.
  function hash(text) {
    let h = 0x811c9dc5;
    const bytes = typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(text)
      : unescape(encodeURIComponent(text)).split('').map(c => c.charCodeAt(0));
    for (const byte of bytes) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
    return h >>> 0;
  }
  function random(seed) {
    let n = seed >>> 0;
    return function () {
      n = (n + 0x6d2b79f5) >>> 0;
      let t = n;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seed(sample, input) {
    const o = options(input);
    return hash(canonical(sample, o));
  }
  function features(sample) {
    const work = integer(sample.workUnits, 'workUnits');
    const blocks = integer(sample.blocks, 'blocks');
    const first = integer(sample.roundStart, 'roundStart');
    const last = integer(sample.roundEnd, 'roundEnd');
    if (last < first) throw new RangeError('roundEnd must not be before roundStart.');
    const rounds = last - first + 1n;
    const perRound = boundedNumber(work * 1000n / rounds, 10000000) / 1000;
    return {
      work, blocks, rounds,
      activity: clamp(Math.log1p(perRound) / Math.log(2001), 0, 1),
      cadence: Number(blocks % 7n),
      phase: Number(work % 997n) / 997 * TAU,
      duration: clamp(Math.log1p(boundedNumber(rounds, 100000)) / Math.log(145), 0, 1)
    };
  }
  function pathFrom(points, close) {
    return points.map((p, i) => (i ? 'L' : 'M') + fmt(p[0]) + ',' + fmt(p[1])).join('') + (close ? 'Z' : '');
  }
  function rotate(x, y, a, scale) {
    const c = Math.cos(a), s = Math.sin(a);
    return [450 + scale * (x * c - y * s), 427 + scale * (x * s + y * c)];
  }
  function line(d, color, width, opacity) {
    const numbers = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    let length = 0;
    for (let i = 2; i < numbers.length; i += 2) {
      length += Math.hypot(numbers[i] - numbers[i - 2], numbers[i + 1] - numbers[i - 1]);
    }
    if (d.endsWith('Z')) length += Math.hypot(numbers[0] - numbers[numbers.length - 2], numbers[1] - numbers[numbers.length - 1]);
    return { tag: 'path', d, color, width, opacity, length };
  }
  function orbit(f, rand, palette) {
    const layers = [];
    const rings = Math.round(72 + f.activity * 35);
    const turn = (rand() - 0.5) * 1.7;
    const tilt = lerp(0.46, 1.03, rand());
    const yaw = lerp(-0.5, 0.5, rand());
    const R = lerp(165, 193, rand());
    const tube = lerp(47, 104, f.activity) * lerp(0.86, 1.08, rand());
    const lobes = 2 + f.cadence % 4;
    const twist = (f.cadence % 3 + 1) * (rand() > 0.5 ? 1 : -1);
    const phase = f.phase;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt);
    const project = (t, phi) => {
      const r = R * (1 + 0.11 * Math.cos(lobes * t + phase)) + tube * Math.cos(phi + twist * t);
      let x = r * Math.cos(t);
      let y = r * Math.sin(t);
      let z = tube * Math.sin(phi + twist * t) + 15 * Math.sin(lobes * t + phase);
      const yy = y * cx - z * sx;
      z = y * sx + z * cx;
      const xx = x * cy + z * sy;
      z = -x * sy + z * cy;
      const perspective = 1 + z / 1900;
      return rotate(xx * perspective, yy * perspective, turn, 1.06);
    };
    // Rings are ordered across the tube, building one continuous sculpture.
    for (let i = 0; i < rings; i++) {
      const phi = i / rings * TAU;
      const pts = [];
      for (let j = 0; j <= 250; j++) pts.push(project(j / 250 * TAU, phi));
      const edge = Math.cos(phi - 0.9);
      const accent = i === Math.floor(rings * 0.19) || i === Math.floor(rings * 0.19) + 1;
      const color = accent ? palette.accent : edge > 0.12 ? palette.ink : palette.blue;
      layers.push(line(pathFrom(pts, true), color, accent ? 1.18 : edge > 0.1 ? 0.73 : 0.57, accent ? 0.98 : edge > 0.1 ? 0.78 : 0.43));
    }
    // Quiet meridians reveal the woven, three-dimensional construction.
    for (let i = 0; i < 9; i++) {
      const t = (i / 9 * TAU + phase / 5) % TAU;
      const pts = [];
      for (let j = 0; j <= 80; j++) pts.push(project(t, j / 80 * TAU));
      layers.push(line(pathFrom(pts, true), palette.ink, 0.48, 0.18));
    }
    return layers;
  }
  function current(f, rand, palette) {
    const layers = [];
    const count = Math.round(78 + f.activity * 40);
    const angle = lerp(-0.56, 0.56, rand());
    const phase = f.phase * 0.52 + rand() * 0.4;
    const waves = 2.45 + f.cadence * 0.16;
    const sway = 48 + f.activity * 57;
    const waist = 31 + 17 * rand();
    const swing = rand() > 0.5 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1) * 2 - 1;
      const pts = [];
      for (let j = 0; j <= 220; j++) {
        const t = j / 220 * 2 - 1;
        const envelope = Math.pow(Math.max(0, Math.sin((t + 1) * Math.PI / 2)), 0.35);
        const width = waist + 105 * Math.pow(Math.abs(t), 0.7) + 45 * Math.pow(Math.sin(t * waves + phase), 2);
        const spine = swing * sway * Math.sin(t * waves + phase) + 18 * Math.sin(t * 5.6 - phase);
        const x = spine + u * width + 22 * Math.sin(t * 6 + u * 2.6 + phase) * (1 - u * u) * envelope;
        const y = t * 300 + 27 * Math.cos(u * Math.PI / 2) * Math.sin(t * 3.5 + phase);
        pts.push(rotate(x, y, angle, 0.99));
      }
      const accent = i === Math.round(count * 0.27) || i === Math.round(count * 0.27) + 1;
      layers.push(line(pathFrom(pts, false), accent ? palette.accent : i % 11 < 3 ? palette.blue : palette.ink, accent ? 1.16 : 0.68, accent ? 0.97 : 0.57 + 0.2 * (1 - Math.abs(u))));
    }
    // A handful of longer, lighter contours reveal the edges of the current.
    for (let i = 0; i < 6; i++) {
      const u = (i < 3 ? -1 : 1) * (1.075 + (i % 3) * 0.04);
      const pts = [];
      for (let j = 0; j <= 180; j++) {
        const t = j / 180 * 2 - 1;
        const width = waist + 105 * Math.pow(Math.abs(t), 0.7) + 45 * Math.pow(Math.sin(t * waves + phase), 2);
        const x = swing * sway * Math.sin(t * waves + phase) + 18 * Math.sin(t * 5.6 - phase) + u * width;
        pts.push(rotate(x, t * 300, angle, 0.99));
      }
      layers.push(line(pathFrom(pts, false), palette.blue, 0.48, 0.19));
    }
    return layers;
  }
  function bloom(f, rand, palette) {
    const layers = [];
    const count = Math.round(75 + 33 * f.activity);
    const petals = 3 + f.cadence % 5;
    const turn = rand() * TAU;
    const eccentricity = lerp(0.82, 1.02, rand());
    const curl = lerp(0.52, 1.08, f.activity);
    const phase = f.phase;
    for (let i = 0; i < count; i++) {
      const q = i / (count - 1);
      const radius = 27 + Math.pow(q, 0.83) * 224;
      const pts = [];
      const shift = curl * Math.pow(q, 1.6);
      for (let j = 0; j <= 300; j++) {
        const a = j / 300 * TAU;
        const petal = Math.cos(petals * a + shift + phase);
        const scallop = Math.cos(petals * 2 * a + shift * 1.6 + phase);
        const amp = 0.045 + Math.sin(q * Math.PI * 0.88) * (0.12 + f.activity * 0.065);
        const r = radius * (1 + amp * petal + 0.022 * scallop);
        const x = r * Math.cos(a + shift * 0.16) + 13 * q * Math.sin(phase);
        const y = r * Math.sin(a + shift * 0.16) * eccentricity;
        pts.push(rotate(x, y, turn, 1.06));
      }
      const accent = i === Math.round(count * 0.71) || i === Math.round(count * 0.71) + 1;
      layers.push(line(pathFrom(pts, true), accent ? palette.accent : i % 13 < 4 ? palette.blue : palette.ink, accent ? 1.14 : 0.66, accent ? 0.97 : 0.72));
    }
    // Each petal is signed with one sparse internal ray.
    for (let i = 0; i < petals; i++) {
      const pts = [];
      for (let j = 0; j <= 100; j++) {
        const q = j / 100;
        const a = (i / petals * TAU - phase / petals) + q * curl * 0.17;
        const r = 39 + q * 196;
        pts.push(rotate(r * Math.cos(a), r * Math.sin(a) * eccentricity, turn, 1.06));
      }
      layers.push(line(pathFrom(pts, false), palette.blue, 0.45, 0.23));
    }
    return layers;
  }
  function layerProgress(index, length, progress) {
    if (progress >= 1) return 1;
    if (progress <= 0) return 0;
    const start = index / Math.max(1, length - 1) * 0.78;
    return ease(clamp((progress - start) / 0.22, 0, 1));
  }
  function geometry(sample, o) {
    const canon = canonical(sample, o);
    if (cache.has(canon)) return cache.get(canon);
    const visualSeed = hash(canon);
    const f = features(sample);
    const palette = PALETTES[o.palette];
    const rand = random(visualSeed);
    const makers = { orbit, current, bloom };
    const g = { layers: makers[o.style](f, rand, palette), f, palette, seed: visualSeed, canon };
    if (cache.size > 30) cache.delete(cache.keys().next().value);
    cache.set(canon, g);
    return g;
  }
  function describe(sample, input) {
    const o = options(input), f = features(sample);
    const shape = o.style === 'orbit' ? 'A woven orbit built from nested sculptural contours.' : o.style === 'current' ? 'A continuous ribbon shaped into a flowing field of fine lines.' : 'A radial bloom built from slowly turning contours.';
    return {
      renderer: VERSION,
      style: o.style,
      palette: o.palette,
      seed: seed(sample, o).toString(16).padStart(8, '0'),
      workUnits: f.work.toString(),
      blocks: f.blocks.toString(),
      roundCount: f.rounds.toString(),
      description: shape,
      mapping: {
        work: 'Accepted work per round controls contour density and the width or curl of the form.',
        blocks: 'Completed Squeek blocks control the number of lobes, turns, or oscillations.',
        provenance: 'Source identity, settled interval, and artistic settings determine the repeatable visual seed.',
        replay: 'Replay reveals the drawing construction. It does not reconstruct physical wheel movement.'
      }
    };
  }
  function render(sample, input) {
    const o = options(input), g = geometry(sample, o), p = g.palette;
    const d = describe(sample, o);
    const title = sample.title ? String(sample.title).slice(0, 64) : 'Settled work study';
    const human = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const meta = {
      project: 'Wheelprints', renderer: VERSION,
      title, style: o.style, palette: o.palette, visualSeed: d.seed,
      source: {
        chainId: String(sample.chainId || '11155111'),
        coreAddress: String(sample.coreAddress || sample.sourceCore || ''),
        streamId: String(sample.streamId || ''),
        roundStart: String(sample.roundStart), roundEnd: String(sample.roundEnd),
        workUnits: g.f.work.toString(), completedSqueekBlocks: g.f.blocks.toString(),
        cumulativeWorkEnd: String(sample.cumulativeWorkEnd || ''),
        cumulativeBlockUnitsEnd: String(sample.cumulativeBlockUnitsEnd || ''),
        transactionHash: String(sample.sourceTx || ''),
        ethereumBlockNumber: String(sample.sourceBlock || ''),
        sourceURL: String(sample.sourceURL || ''),
        startAt: sample.startAt || null, endAt: sample.endAt || null
      },
      basis: 'Project API snapshot of settled work. This renderer does not independently verify source data.',
      replay: d.mapping.replay,
      seedPurpose: 'Deterministic visual variation; not cryptographic proof or secure randomness.'
    };
    const paths = g.layers.map((layer, i) => {
      const part = layerProgress(i, g.layers.length, o.progress);
      return '<path data-wp-order="' + i + '" data-wp-base-opacity="' + layer.opacity + '" data-wp-length="' + layer.length.toFixed(4) + '" d="' + layer.d + '" fill="none" stroke="' + layer.color + '" stroke-width="' + layer.width + '" stroke-linecap="round" stroke-linejoin="round" opacity="' + (part === 0 ? 0 : layer.opacity) + '" stroke-dasharray="' + layer.length.toFixed(4) + ' ' + layer.length.toFixed(4) + '" stroke-dashoffset="' + ((1 - part) * layer.length).toFixed(4) + '"/>';
    }).join('');
    const id = d.seed.toUpperCase();
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + o.size + '" height="' + o.size + '" viewBox="0 0 900 900" role="img" aria-label="' + esc(title + ', ' + o.style + ' study from ' + g.f.work + ' accepted work units') + '" data-wp-renderer="' + VERSION + '" data-wp-layer-count="' + g.layers.length + '" data-wp-progress="' + o.progress + '">' +
      '<title>' + esc('Wheelprints — ' + title) + '</title>' +
      '<desc>' + esc(d.description + ' ' + d.mapping.work + ' ' + d.mapping.blocks + ' ' + d.mapping.replay) + '</desc>' +
      '<metadata>' + esc(JSON.stringify(meta)) + '</metadata>' +
      '<rect width="900" height="900" fill="' + p.paper + '"/>' +
      '<g fill="none" stroke="' + p.faint + '" stroke-width="0.55" opacity="0.55"><path d="M52 78V52H78M822 52H848V78M52 822V848H78M822 848H848V822"/><path d="M70 772H830"/></g>' +
      '<g fill="' + p.ink + '" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="9.5" letter-spacing="1.7"><text x="70" y="88">WHEELPRINTS / ' + esc(o.style.toUpperCase()) + '</text><text x="830" y="88" text-anchor="end">' + id + '</text></g>' +
      '<g class="wp-artwork">' + paths + '</g>' +
      '<circle cx="79" cy="801" r="3.4" fill="' + p.accent + '"/>' +
      '<g fill="' + p.ink + '" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"><text x="93" y="805" font-size="11.5" letter-spacing="0.4">' + esc(title) + '</text><text x="830" y="805" text-anchor="end" font-size="9.5" letter-spacing="0.6">' + esc(human(g.f.work)) + ' WORK / ' + esc(human(g.f.blocks)) + ' BLOCKS</text><text x="70" y="826" font-size="8.5" letter-spacing="1.1" opacity="0.55">ROUNDS ' + esc(sample.roundStart) + '–' + esc(sample.roundEnd) + ' / SEPOLIA STUDY</text><text x="830" y="826" text-anchor="end" font-size="8.5" letter-spacing="1.1" opacity="0.55">' + VERSION + '</text></g>' +
      '</svg>';
  }
  function setProgress(svgElement, value) {
    if (!svgElement || typeof svgElement.querySelectorAll !== 'function') return;
    const p = clamp(Number.isFinite(Number(value)) ? Number(value) : 1, 0, 1);
    const paths = svgElement.querySelectorAll('[data-wp-order]');
    for (const path of paths) {
      const i = Number(path.getAttribute('data-wp-order'));
      const q = layerProgress(i, paths.length, p);
      const length = Number(path.getAttribute('data-wp-length'));
      path.setAttribute('stroke-dashoffset', ((1 - q) * length).toFixed(4));
      path.setAttribute('opacity', q === 0 ? '0' : path.getAttribute('data-wp-base-opacity'));
    }
    svgElement.setAttribute('data-wp-progress', String(p));
  }
  return Object.freeze({
    render, seed, describe, setProgress,
    version: VERSION,
    styles: Object.freeze(STYLES.slice()),
    palettes: Object.freeze(Object.keys(PALETTES))
  });
});
