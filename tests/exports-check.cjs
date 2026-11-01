'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const project = path.resolve(__dirname, '..');
const dist = path.join(project, 'dist');
const engine = require(path.join(dist, 'art-engine.js'));
const kit = require(path.join(dist, 'export-kit.js'));
const loadSharp = require('../scripts/load-sharp.cjs');
const decode = text => text.replace(/&(amp|quot|lt|gt|#39);/g, (match, entity) => ({ amp: '&', quot: '"', lt: '<', gt: '>', '#39': "'" })[entity]);
async function verifyExports(options = {}) {
  const sharp = options.sharp || loadSharp();
  const data = JSON.parse(fs.readFileSync(path.join(dist, 'data/periods.json'), 'utf8'));
  const browserData = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(dist, 'data/periods.js'), 'utf8'), browserData);
  assert.equal(kit.datasetIdentity(browserData.window.WHEELPRINTS_DATA), kit.datasetIdentity(data), 'Browser and builder must use identical source data.');
  const manifestContext = {};
  vm.runInNewContext(fs.readFileSync(path.join(dist, 'data/exports.js'), 'utf8'), manifestContext);
  const manifest = manifestContext.WHEELPRINTS_EXPORTS;
  const count = data.periods.length * engine.styles.length * engine.palettes.length;
  assert.equal(Object.keys(manifest.entries).length, count);
  let fileCount = 0, totalBytes = 0;
  const seeds = new Set();
  for (const period of data.periods) for (const style of engine.styles) for (const palette of engine.palettes) {
    const value = kit.snapshot(data, period, { style, palette });
    const entry = kit.staticEntry(manifest, data, value);
    assert.ok(entry, 'Every offered combination must resolve to a static entry: ' + kit.key(value));
    seeds.add(value.record.seedHex);
    for (const [extension, file] of Object.entries(entry.files)) {
      assert.match(file.path, /^exports\/Wheelprints_[A-Za-z0-9_.-]+\.(svg|png|json)$/);
      assert.equal(file.path, 'exports/' + value.baseName + '.' + extension);
      const bytes = fs.readFileSync(path.join(dist, file.path));
      assert.equal(bytes.length, file.bytes);
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256);
      fileCount++; totalBytes += bytes.length;
    }
    const svg = fs.readFileSync(path.join(dist, entry.files.svg.path), 'utf8');
    const jsonText = fs.readFileSync(path.join(dist, entry.files.json.path), 'utf8');
    const record = JSON.parse(jsonText);
    assert.equal(svg, kit.svg(value));
    assert.equal(jsonText, kit.recordText(value));
    assert.deepEqual(record.source.chainVerification, data.chainVerification);
    assert.equal(record.seed, engine.seed(record.source.period, record.artisticSettings));
    const embedded = svg.match(/<metadata id="wheelprints-source">([^<]+)<\/metadata>/);
    assert.ok(embedded); assert.deepEqual(JSON.parse(decode(embedded[1])), record);
    assert.equal(svg.replace(embedded[0], ''), engine.render(record.source.period, { ...record.artisticSettings, progress: 1, size: 1600 }));
    assert.ok(!/NaN|Infinity|undefined|<script|<foreignObject/.test(svg));
    const svgInfo = await sharp(Buffer.from(svg)).metadata();
    assert.equal(svgInfo.width, 1600); assert.equal(svgInfo.height, 1600);
    const pngPath = path.join(dist, entry.files.png.path);
    const pngInfo = await sharp(pngPath).metadata();
    assert.equal(pngInfo.format, 'png'); assert.equal(pngInfo.width, 2400); assert.equal(pngInfo.height, 2400);
    if (!options.portable) {
    const savedPixels = await sharp(pngPath).ensureAlpha().raw().toBuffer();
    const expectedPixels = await sharp(Buffer.from(svg), { density: 108 }).ensureAlpha().raw().toBuffer();
    assert.ok(savedPixels.equals(expectedPixels), 'PNG pixels must match the corresponding source SVG: ' + kit.key(value));
    }
  }
  assert.equal(fileCount, count * 3); assert.equal(seeds.size, count);
  const first = kit.snapshot(data, data.periods[0], { style: 'orbit', palette: 'mineral' });
  assert.equal(kit.staticEntry(null, data, first), null);
  assert.equal(kit.staticEntry({ ...manifest, rendererVersion: 'stale' }, data, first), null);
  assert.equal(kit.staticEntry(manifest, { ...data, capturedAt: 'changed' }, first), null);
  const altered = kit.snapshot(data, { ...data.periods[0], description: 'A different source record' }, first.settings);
  assert.equal(kit.staticEntry(manifest, data, altered), null, 'Static metadata must match the complete chosen snapshot, not only its art seed.');
  console.log('PASS: ' + count + ' exact source/treatment mappings, ' + fileCount + ' files, valid 1600px SVG and 2400px PNG, matching JSON/embedded provenance, hashes, and stale-manifest fallback.');
  console.log(options.portable ? 'PORTABLE MODE: raster pixel comparison not performed; exact archived PNG bytes were hash-verified.' : 'PASS: all PNG raster pixels match the current renderer/font environment.');
  console.log('Static files: ' + totalBytes + ' bytes (' + (totalBytes / 1048576).toFixed(1) + ' MiB).');
  return { combinations: count, files: fileCount, totalBytes };
}
module.exports = { verifyExports };
if (require.main === module) verifyExports({ portable: process.argv.includes('--portable') }).catch(error => { console.error(error); process.exitCode = 1; });
