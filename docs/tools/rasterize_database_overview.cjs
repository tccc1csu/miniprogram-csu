// Rasterize the deterministic SVG, preserving the Windows Chinese fonts.
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('../../../tmp/database-layout-runtime/node_modules/@resvg/resvg-js');
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'diagrams/database/db-overview.svg');
const svg = fs.readFileSync(svgPath);
const renderer = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Microsoft YaHei' } });
fs.writeFileSync(svgPath.replace(/\.svg$/, '.png'), renderer.render().asPng());
const preview = new Resvg(svg, { fitTo: { mode: 'width', value: 2300 }, font: { loadSystemFonts: true, defaultFontFamily: 'Microsoft YaHei' } });
fs.writeFileSync(svgPath.replace(/\.svg$/, '-preview.png'), preview.render().asPng());
console.log('Rendered overview PNG and preview from the exact SVG.');
