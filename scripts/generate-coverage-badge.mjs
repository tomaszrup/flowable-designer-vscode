import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const inputPath = process.argv[2] ?? 'coverage/coverage-summary.json';
const outputPath = process.argv[3] ?? 'coverage/badge.svg';
const metric = process.argv[4] ?? 'lines';

const colorStops = [
  { min: 90, color: '#4c1', badgeColor: 'brightgreen' },
  { min: 80, color: '#97ca00', badgeColor: 'green' },
  { min: 70, color: '#dfb317', badgeColor: 'yellow' },
  { min: 60, color: '#fe7d37', badgeColor: 'orange' },
  { min: 0, color: '#e05d44', badgeColor: 'red' },
];

const summary = JSON.parse(await readFile(inputPath, 'utf8'));
const percentage = Number(summary?.total?.[metric]?.pct);

if (!Number.isFinite(percentage)) {
  throw new TypeError(`Coverage metric "${metric}" was not found in ${inputPath}.`);
}

const label = 'coverage';
const value = `${percentage.toFixed(1)}%`;
const selectedColor = colorStops.find((stop) => percentage >= stop.min) ?? colorStops.at(-1);
const color = selectedColor?.color ?? '#e05d44';
const badgeColor = selectedColor?.badgeColor ?? 'red';

const labelWidth = Math.max(64, label.length * 7 + 16);
const valueWidth = Math.max(48, value.length * 7 + 16);
const totalWidth = labelWidth + valueWidth;
const jsonOutputPath = path.join(path.dirname(outputPath), 'badge.json');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="badge-gradient" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-opacity=".3"/>
    <stop offset="1" stop-opacity=".5"/>
  </linearGradient>
  <mask id="badge-mask">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#badge-mask)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#badge-gradient)"/>
  </g>
  <g fill="#fff" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>
`;

const badgeJson = JSON.stringify(
  {
    schemaVersion: 1,
    label,
    message: value,
    color: badgeColor,
  },
  null,
  2,
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg, 'utf8');
await writeFile(jsonOutputPath, badgeJson, 'utf8');
