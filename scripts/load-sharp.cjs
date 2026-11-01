'use strict';
// Ordinary local dependency first; the hosted workspace can supply its installed runtime bundle.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let cached;
module.exports = function loadSharp() {
  if (cached) return cached;
  if (!process.env.FONTCONFIG_FILE && fs.existsSync('/etc/fonts/fonts.conf')) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wheelprints-export-fonts-'));
    const cache = path.join(temp, 'cache');
    fs.mkdirSync(cache);
    const config = path.join(temp, 'fonts.conf');
    fs.writeFileSync(config, '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><include>/etc/fonts/fonts.conf</include><cachedir>' + cache.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</cachedir></fontconfig>');
    process.env.FONTCONFIG_FILE = config;
  }
  try { cached = require('sharp'); }
  catch (error) {
    if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw error;
    cached = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'sharp'));
  }
  return cached;
};
