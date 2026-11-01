/* Shared source records for browser and prebuilt Wheelprints exports. */
(function (root, factory) {
  var common = typeof module === 'object' && module.exports;
  var api = factory(common ? require('./art-engine.js') : root.Wheelprints);
  if (common) module.exports = api;
  root.WheelprintsExportKit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (engine) {
  'use strict';
  var VERSION = 'wp-export-0.2.1';
  function escaped(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function snapshot(data, period, input) {
    var p = Object.assign({}, period, { chainId: data.chainId, coreAddress: data.coreAddress, streamId: data.streamId || '' });
    var settings = {
      style: engine.styles.includes(input && input.style) ? input.style : 'orbit',
      palette: engine.palettes.includes(input && input.palette) ? input.palette : 'mineral'
    };
    var visualSeed = engine.seed(p, settings);
    var record = {
      project: 'Wheelprints', prototypeVersion: '0.2', rendererVersion: engine.version,
      artworkState: 'Deterministic artwork export; no NFT has been minted', title: p.title,
      artisticSettings: settings, rendering: { svgSize: 1600, finalProgress: 1, pngSize: 2400 },
      seed: visualSeed, seedHex: visualSeed.toString(16).padStart(8, '0'),
      seedPurpose: 'Visual variation only; not a cryptographic commitment or secure randomness',
      source: {
        chainId: data.chainId, chainName: data.chainName, coreAddress: data.coreAddress,
        streamId: data.streamId, releaseId: data.releaseId, period: p,
        capturedAt: data.capturedAt, apiURL: data.sourceURL, verification: data.verification
      },
      replay: 'Construction of deterministic artwork, not a reconstruction of physical wheel trajectory'
    };
    if (data.chainVerification) record.source.chainVerification = JSON.parse(JSON.stringify(data.chainVerification));
    var safeTitle = String(p.title || p.id || 'Study').replace(/[^a-z0-9_.-]+/gi, '_');
    return { sample: p, settings: settings, record: record, baseName: 'Wheelprints_' + safeTitle + '_' + settings.style + '_' + settings.palette };
  }
  function svg(value) {
    var image = engine.render(value.sample, {
      style: value.settings.style, palette: value.settings.palette,
      progress: value.record.rendering.finalProgress, size: value.record.rendering.svgSize
    });
    return image.replace(/(<svg\b[^>]*>)/, '$1<metadata id="wheelprints-source">' + escaped(JSON.stringify(value.record)) + '</metadata>');
  }
  function recordText(value) { return JSON.stringify(value.record, null, 2); }
  function key(value) { return [value.sample.id, value.settings.style, value.settings.palette].join('/'); }
  function datasetIdentity(data) { return JSON.stringify(data); }
  function staticEntry(manifest, data, value) {
    if (!manifest || manifest.formatVersion !== 1 || manifest.exportVersion !== VERSION ||
        manifest.rendererVersion !== engine.version || manifest.datasetIdentity !== datasetIdentity(data)) return null;
    var entry = manifest.entries && manifest.entries[key(value)];
    if (!entry || entry.baseName !== value.baseName || entry.seedHex !== value.record.seedHex) return null;
    var source = data.periods.find(function (p) { return p.id === value.sample.id; });
    if (!source || recordText(snapshot(data, source, value.settings)) !== recordText(value)) return null;
    var extensions = ['svg', 'png', 'json'];
    for (var i = 0; i < extensions.length; i++) {
      var ext = extensions[i], file = entry.files && entry.files[ext];
      if (!file || file.path !== 'exports/' + value.baseName + '.' + ext || !/^[a-f0-9]{64}$/.test(file.sha256)) return null;
    }
    return entry;
  }
  return Object.freeze({ version: VERSION, snapshot: snapshot, svg: svg, recordText: recordText, key: key, datasetIdentity: datasetIdentity, staticEntry: staticEntry });
});
