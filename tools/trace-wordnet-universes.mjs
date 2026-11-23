// Candidate-only mechanical trace. It does not decide or approve any rights.
// Run with an isolated candidate graph directory and a new output path.
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graphRoot = path.resolve(process.argv[2] || '');
const output = path.resolve(process.argv[3] || '');
if (!process.argv[2] || !process.argv[3] || existsSync(output) || existsSync(`${output}.partial`)) {
  throw Error('Supply a candidate graph and a new output path; traces are never overwritten.');
}
const sha = (x) => createHash('sha256').update(x).digest('hex');
const valueSha = (x) => sha(JSON.stringify(x));
const read = (p) => readFileSync(path.join(root, p));
const graphRead = (p) => readFileSync(path.join(graphRoot, p));
const graphParse = (p) => JSON.parse(graphRead(p));
const requireTrue = (condition, description) => { if (!condition) throw Error(description); };
const ptr = (s) => String(s).replaceAll('~', '~0').replaceAll('/', '~1');
const manifestPath = 'data/universes/manifest.json';
const manifest = graphParse('manifest.json');
requireTrue(/^[a-f0-9]{16}$/.test(manifest.version || '') && Array.isArray(manifest.files), 'Invalid graph manifest');
const base = `data/universes/${manifest.version}`;
const graphBase = manifest.version;
const files = new Map();
for (const item of manifest.files) {
  requireTrue(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(item.path) &&
    !item.path.split('/').some((part) => part === '.' || part === '..'), 'Unsafe artifact path');
  const data = graphRead(`${graphBase}/${item.path}`);
  requireTrue(data.length === item.bytes && sha(data) === item.sha256, `Artifact mismatch: ${item.path}`);
  requireTrue(!files.has(item.path), `Duplicate artifact: ${item.path}`);
  files.set(item.path, item.sha256);
}
const bundleBytes = read('data/vocabulary-bundle.json');
requireTrue(sha(bundleBytes) === manifest.bundleSha256, 'Vocabulary hash mismatch');
const bundle = JSON.parse(bundleBytes);
const index = graphParse(`${graphBase}/index.json`);
const report = graphParse(`${graphBase}/report.json`);
requireTrue(index.bundleSha256 === manifest.bundleSha256 && index.version === manifest.version, 'Index mismatch');
const rightsBytes = read('data/content-rights-ledger.jsonl');
const [rightsHeader, ...rightsRows] = rightsBytes.toString('utf8').trim().split(/\r?\n/).map(JSON.parse);
requireTrue(rightsHeader.bundleSha256 === manifest.bundleSha256, 'Input ledger is for another vocabulary');
const rights = new Map(rightsRows.map((row) => [`${row.wordId}\0${row.senseId}`, row]));
const words = new Map(bundle.words.map((word) => [word.id, word]));
const nodes = new Map(index.nodes.map((node) => [node.id, node]));
requireTrue(words.size === bundle.words.length && nodes.size === index.nodes.length, 'Duplicate word ID');
requireTrue(words.size === nodes.size, 'Missing word node');

const asFieldHashes = (obj, fields) => Object.fromEntries(fields.map((field) => {
  requireTrue(Object.hasOwn(obj, field), `Missing field ${field}`);
  return [field, { oldValueSha256: null, newValueSha256: valueSha(obj[field]) }];
}));
const counts = { nodes: 0, senses: 0, matchedDefinitions: 0, synonymPairs: 0, spellingPairs: 0 };
const fd = openSync(`${output}.partial`, 'wx');
const put = (record) => writeSync(fd, `${JSON.stringify(record)}\n`);
try {
  put({ recordType: 'header', schema: 1, generatedAt: new Date().toISOString(),
    reviewStatus: 'unreviewed-machine-trace', scope: 'candidate-only-not-legal-clearance',
    hashEncoding: 'sha256(UTF-8(JSON.stringify(value)))', nullOldValue: 'new graph field; no prior universe field',
    manifestPath, manifestSha256: sha(graphRead('manifest.json')), version: manifest.version,
    bundleSha256: sha(bundleBytes), inputLedgerPath: 'data/content-rights-ledger.jsonl', inputLedgerSha256: sha(rightsBytes),
    wordnetArchiveSha256: report.inputs.wordnetArchiveSha256, wordnetIndexSha256: report.inputs.wordnetIndexSha256,
    wordnetLicense: 'https://wordnet.princeton.edu/license-and-commercial-use',
    model: report.model.source, modelSha256: report.inputs.modelSha256,
    vectorSha256: report.inputs.vectorSha256, coordinateSha256: report.inputs.coordinateSha256,
    trainingReportSha256: report.inputs.trainingReportSha256, layoutReportSha256: report.inputs.layoutReportSha256,
    generatorSha256: report.inputs.generatorSha256,
    sourceDisclaimer: 'Provenance metadata and hashes are not verification of training-data rights or legal approval.' });

  for (let i = 0; i < index.nodes.length; i++) {
    const node = index.nodes[i];
    const original = words.get(node.id);
    requireTrue(original && original.word === node.word, `Word mismatch: ${node.id}`);
    requireTrue(original.senses.length === node.senses.length, `Sense count mismatch: ${node.id}`);
    put({ recordType: 'node', assetId: `word:${node.id}`, wordId: node.id,
      path: `${base}/index.json#/nodes/${i}`, artifactSha256: files.get('index.json'),
      fields: asFieldHashes(node, ['semantic', 'spelling', 'complete', 'semanticPlacement', 'semanticTile', 'spellingTile', 'spellingSupported', 'synonymNeighborCount', 'spellingNeighborCount']),
      semanticSource: node.complete ? 'wordnet-only-encoder+matched-definition-and-tag-weight+recorded-layout'
        : node.semanticPlacement === 'wordnet-lemma-estimate' ? 'wordnet-same-spelling-lemma-estimate-no-sense-assertion'
          : 'deterministic-outer-ring-placeholder-no-semantic-assertion',
      spellingSource: 'word-character-ngram+recorded-layout-basis', reviewStatus: 'pending' });
    counts.nodes++;
    const originalSenses = new Map(original.senses.map((sense) => [sense.id, sense]));
    for (let j = 0; j < node.senses.length; j++) {
      const sense = node.senses[j];
      const source = originalSenses.get(sense.id);
      requireTrue(source && source.pos === sense.pos && (source.synsetId ?? null) === sense.synsetId,
        `Sense identity mismatch: ${node.id}/${sense.id}`);
      let definition = null;
      if (sense.verified) {
        const entry = rights.get(`${node.id}\0${sense.id}`);
        definition = entry?.fields?.find((field) => field.field === 'definition');
        requireTrue(definition && definition.risk === 'CLEARED' && definition.sha256 === valueSha(source.definition),
          `Verified input definition is not bound to its existing ledger: ${node.id}/${sense.id}`);
        counts.matchedDefinitions++;
      }
      put({ recordType: 'sense', assetId: `sense:${node.id}:${sense.id}`, wordId: node.id, senseId: sense.id,
        path: `${base}/index.json#/nodes/${i}/senses/${j}`, artifactSha256: files.get('index.json'),
        fields: asFieldHashes(sense, ['pos', 'synsetId', 'tagCount', 'frequency', 'verified', 'weight']),
        sourceId: sense.synsetId, countSource: sense.verified ? 'wordnet-index-sense-tag-count' : 'missing-estimated-not-observed',
        definitionInput: definition && { field: 'definition', sha256: definition.sha256, sourceId: definition.sourceId,
          existingLedgerRisk: definition.risk }, reviewStatus: 'pending' });
      counts.senses++;
    }
  }

  for (const kind of ['synonym', 'spelling']) {
    const edges = new Map();
    for (const [name, artifactSha256] of files) {
      if (!name.startsWith(`${kind}/`) || !name.endsWith('.json')) continue;
      const data = graphParse(`${graphBase}/${name}`);
      requireTrue(data.kind === kind && data.version === manifest.version, `Wrong shard: ${name}`);
      for (const [from, outgoing] of Object.entries(data.adjacency)) {
        requireTrue(nodes.has(from) && Array.isArray(outgoing), `Bad node in ${name}`);
        outgoing.forEach((edge, i) => {
          requireTrue(nodes.has(edge.to) && edge.to !== from, `Bad target in ${name}`);
          const key = JSON.stringify([from, edge.to, edge.sourceSense || null, edge.targetSense || null, edge.synset || null]);
          requireTrue(!edges.has(key), `Duplicate edge ${key}`);
          edges.set(key, { from, edge, path: `${base}/${name}#/adjacency/${ptr(from)}/${i}`, artifactSha256 });
        });
      }
    }
    for (const item of edges.values()) {
      const { from, edge } = item;
      const reverseKey = JSON.stringify([edge.to, from, edge.targetSense || null, edge.sourceSense || null, edge.synset || null]);
      const reverse = edges.get(reverseKey);
      requireTrue(reverse && (kind === 'synonym' ? edge.cosine === reverse.edge.cosine : edge.distance === reverse.edge.distance),
        `Missing or unequal reverse edge: ${from} / ${edge.to}`);
      if (from > edge.to) continue;
      if (kind === 'synonym') {
        const left = nodes.get(from).senses.find((sense) => sense.id === edge.sourceSense);
        const right = nodes.get(edge.to).senses.find((sense) => sense.id === edge.targetSense);
        requireTrue(left?.verified && right?.verified && left.synsetId === edge.synset && right.synsetId === edge.synset,
          `Synonym sense/source mismatch: ${from} / ${edge.to}`);
      }
      put({ recordType: kind, assetId: kind === 'synonym'
          ? `synonym:${from}:${edge.sourceSense}:${edge.to}:${edge.targetSense}` : `spelling:${from}:${edge.to}`,
        wordId: from, targetWordId: edge.to, senseId: edge.sourceSense ?? null, targetSenseId: edge.targetSense ?? null,
        path: item.path, artifactSha256: item.artifactSha256, reversePath: reverse.path, reverseArtifactSha256: reverse.artifactSha256,
        fields: asFieldHashes(edge, kind === 'synonym' ? ['to', 'sourceSense', 'targetSense', 'synset', 'cosine'] : ['to', 'distance']),
        source: kind === 'synonym' ? 'same-verified-wordnet-synset; cosine-from-recorded-model' : 'word-spelling-derived-edit-distance',
        sourceId: edge.synset ?? null, reviewStatus: 'pending' });
      counts[kind === 'synonym' ? 'synonymPairs' : 'spellingPairs']++;
    }
  }
  requireTrue(counts.nodes === report.quality.nodeCount && counts.matchedDefinitions === report.quality.semanticSenseMatched &&
    counts.synonymPairs === report.quality.synonymSensePairs && counts.spellingPairs === report.quality.spelling.retainedPairs,
    'Recorded item counts do not match the build report');
  put({ recordType: 'footer', counts, reviewStatus: 'unreviewed-machine-trace' });
  fsyncSync(fd);
  closeSync(fd);
  renameSync(`${output}.partial`, output);
  console.log(JSON.stringify({ output, counts, sha256: sha(readFileSync(output)), note: 'Not a legal or semantic approval.' }));
} catch (error) {
  closeSync(fd);
  throw error; // Preserve the clearly marked partial output for investigation.
}
