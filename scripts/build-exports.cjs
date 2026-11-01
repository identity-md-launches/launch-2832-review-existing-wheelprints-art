'use strict';
// Regenerate the finite recorded-data beta exports. Tested with Node.js 24 and Sharp 0.35.5 (Node.js >=20.9 required).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const project = path.resolve(__dirname, '..');
const dist = path.join(project, 'dist');
const engine = require(path.join(dist, 'art-engine.js'));
const kit = require(path.join(dist, 'export-kit.js'));
const data = JSON.parse(fs.readFileSync(path.join(dist, 'data/periods.json'), 'utf8'));
const sharp = require('./load-sharp.cjs')();
sharp.concurrency(2);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
function save(baseName, extension, contents) {
  const relative = 'exports/' + baseName + '.' + extension;
  fs.writeFileSync(path.join(dist, relative), contents);
  return { path: relative, bytes: contents.length, sha256: sha256(contents) };
}
(async function () {
  fs.mkdirSync(path.join(dist, 'exports'), { recursive: true });
  const manifest = {
    formatVersion: 1, exportVersion: kit.version, rendererVersion: engine.version,
    datasetIdentity: kit.datasetIdentity(data),
    pngRenderer: { library: 'sharp', version: sharp.versions.sharp, svgDensity: 108 },
    entries: {}
  };
  for (const period of data.periods) {
    for (const style of engine.styles) {
      for (const palette of engine.palettes) {
        const value = kit.snapshot(data, period, { style, palette });
        const svg = Buffer.from(kit.svg(value));
        const json = Buffer.from(kit.recordText(value));
        // Render the 1600px SVG directly at 1.5x density; avoid upscaling a raster.
        const png = await sharp(svg, { density: 108 }).png({ compressionLevel: 9 }).toBuffer();
        manifest.entries[kit.key(value)] = {
          baseName: value.baseName, seedHex: value.record.seedHex,
          files: { svg: save(value.baseName, 'svg', svg), png: save(value.baseName, 'png', png), json: save(value.baseName, 'json', json) }
        };
        console.log('Built ' + kit.key(value));
      }
    }
  }
  const content = '(function(root){var value=' + JSON.stringify(manifest) + ';if(typeof module==="object"&&module.exports)module.exports=value;root.WHEELPRINTS_EXPORTS=value;})(typeof globalThis!=="undefined"?globalThis:this);\n';
  fs.writeFileSync(path.join(dist, 'data/exports.js'), content);
  await require(path.join(project, 'tests/exports-check.cjs')).verifyExports({ sharp });
  console.log('Static export generation complete. Sharp ' + sharp.versions.sharp + '.');
})().catch(error => { console.error(error); process.exitCode = 1; });
