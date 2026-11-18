// Copies perpmath engine result files into src/data/backtests/ as slim JSON.
//
//   node scripts/backtests-import.mjs <results-folder-or-file> [more ...]
//   node scripts/backtests-import.mjs ../perpmath-engine/results
//
// For every `*.json` result (schema version 1, see the engine's
// docs/output-format.md) it writes src/data/backtests/<name>.json with
// everything the site shows: config, data range, costs, timing, both metric
// blocks and their daily equity points, the engine version and the run
// timestamp. The per-trade list is dropped; it is most of the file and the
// site does not print it.
//
// Each slim file also records where it came from (`source`): the original file
// name, the SHA-256 of its bytes, and the engine version that wrote it. To
// check a page against the engine repository, hash the file in results/ and
// compare.
//
// The output does not depend on when the script runs, so running it again on
// the same input writes the same bytes.
//
// Exit codes: 0 = written, 1 = a result file is missing, unreadable or not a
// valid result (nothing is written), 2 = bad usage.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SCHEMA_VERSION = 1;
const OUT_DIR = fileURLToPath(new URL('../src/data/backtests/', import.meta.url));

const TOP_KEYS = [
  'schema_version',
  'package',
  'package_version',
  'generated_at',
  'strategy',
  'symbol',
  'interval',
  'config',
  'data',
  'costs',
  'timing',
  'split',
];
const SAMPLE_KEYS = ['first_bar', 'last_bar', 'bars', 'metrics', 'signals'];
const METRIC_KEYS = [
  'trades',
  'insufficient_sample',
  'win_rate_pct',
  'avg_r',
  't_stat',
  't_stat_n',
  'total_return_pct',
  'max_drawdown_pct',
  'final_equity',
];

/** File name -> slug: "fvg-btcusdt.json" -> "fvg-btcusdt". */
export function slugOf(fileName) {
  const slug = basename(fileName).replace(/\.json$/i, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`"${fileName}": the name must be lower-case letters, digits and hyphens, because it becomes the page address`);
  }
  return slug;
}

function sample(doc, key, label) {
  const block = doc[key];
  if (!block || typeof block !== 'object') throw new Error(`${label}: "${key}" is missing`);
  for (const k of SAMPLE_KEYS) {
    if (!(k in block)) throw new Error(`${label}: "${key}.${k}" is missing`);
  }
  for (const k of METRIC_KEYS) {
    if (!(k in block.metrics)) throw new Error(`${label}: "${key}.metrics.${k}" is missing`);
  }
  const curve = block.equity_curve;
  if (!Array.isArray(curve) || curve.length < 2) {
    throw new Error(`${label}: "${key}.equity_curve" needs at least two points`);
  }
  for (const point of curve) {
    if (typeof point?.t !== 'string' || !Number.isFinite(Date.parse(point.t)) || !Number.isFinite(point.equity)) {
      throw new Error(`${label}: "${key}.equity_curve" has a point without a valid time and equity`);
    }
  }
  return {
    first_bar: block.first_bar,
    last_bar: block.last_bar,
    bars: block.bars,
    metrics: block.metrics,
    signals: block.signals,
    equity_curve: curve.map((point) => ({ t: point.t, equity: point.equity })),
  };
}

/**
 * Build the slim document from a parsed result and the raw bytes it was parsed
 * from. Throws when the result is not a schema-1 document with both samples.
 */
export function slim(doc, { fileName, bytes }) {
  const label = fileName;
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error(`${label}: not a JSON object`);
  if (doc.schema_version !== SCHEMA_VERSION) {
    throw new Error(`${label}: schema_version is ${JSON.stringify(doc.schema_version)}, this script reads version ${SCHEMA_VERSION}`);
  }
  for (const k of TOP_KEYS) {
    if (!(k in doc)) throw new Error(`${label}: "${k}" is missing`);
  }
  if (typeof doc.split?.oos_start !== 'string') throw new Error(`${label}: "split.oos_start" is missing`);

  return {
    slug: slugOf(fileName),
    source: {
      file: basename(fileName),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      engine: doc.package,
      engine_version: doc.package_version,
      trades_dropped: true,
    },
    schema_version: doc.schema_version,
    package: doc.package,
    package_version: doc.package_version,
    generated_at: doc.generated_at,
    strategy: doc.strategy,
    symbol: doc.symbol,
    interval: doc.interval,
    config: doc.config,
    data: doc.data,
    costs: doc.costs,
    timing: doc.timing,
    split: doc.split,
    in_sample: sample(doc, 'in_sample', label),
    out_of_sample: sample(doc, 'out_of_sample', label),
    warnings: Array.isArray(doc.warnings) ? doc.warnings : [],
    disclaimer: typeof doc.disclaimer === 'string' ? doc.disclaimer : '',
  };
}

/** Readable JSON, with each equity point kept on one line. */
export function serialize(slimDoc) {
  return (
    JSON.stringify(slimDoc, null, 2).replace(
      /\{\s+"t": ("[^"]+"),\s+"equity": (-?[0-9.eE+-]+)\s+\}/g,
      '{ "t": $1, "equity": $2 }',
    ) + '\n'
  );
}

function resultFiles(target) {
  const full = resolve(target);
  if (!existsSync(full)) throw new Error(`${target}: not found`);
  if (!statSync(full).isDirectory()) return [full];
  const found = readdirSync(full)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort()
    .map((name) => join(full, name));
  if (found.length === 0) throw new Error(`${target}: no .json result files in this folder`);
  return found;
}

function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.error('usage: node scripts/backtests-import.mjs <results-folder-or-file> [more ...]');
    return 2;
  }

  // Read and check everything first; write only when every file is good.
  const outputs = [];
  try {
    for (const file of argv.flatMap(resultFiles)) {
      const bytes = readFileSync(file);
      let doc;
      try {
        doc = JSON.parse(bytes.toString('utf8'));
      } catch (error) {
        throw new Error(`${basename(file)}: not valid JSON (${error.message})`);
      }
      const slimDoc = slim(doc, { fileName: basename(file), bytes });
      if (outputs.some((o) => o.slug === slimDoc.slug)) throw new Error(`${slimDoc.slug}: given twice`);
      outputs.push({ slug: slimDoc.slug, text: serialize(slimDoc), sourceBytes: bytes.length, doc: slimDoc });
    }
  } catch (error) {
    console.error(`backtests-import: ${error.message}`);
    console.error('backtests-import: nothing was written.');
    return 1;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const out of outputs) {
    const target = join(OUT_DIR, `${out.slug}.json`);
    writeFileSync(target, out.text, 'utf8');
    const kept = Buffer.byteLength(out.text, 'utf8');
    console.log(
      `${out.slug}: ${out.sourceBytes} -> ${kept} bytes, engine ${out.doc.source.engine_version}, sha256 ${out.doc.source.sha256.slice(0, 12)}...`,
    );
  }
  console.log(`backtests-import: wrote ${outputs.length} file(s) to src/data/backtests/`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
