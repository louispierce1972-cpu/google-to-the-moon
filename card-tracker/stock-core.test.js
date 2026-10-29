// Unit tests for stock-core.js. Run: node stock-core.test.js
'use strict';
const assert = require('assert');
const S = require('./stock-core.js');

let passed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
const CODES = { ALBANIA: 'AL', ALGERIA: 'DZ', 'UNITED STATES': 'US', GERMANY: 'DE' };
const codeOf = name => CODES[String(name).toUpperCase()] || '';
const TEXT = [
    '436587\t2\tUNKNOWNLAND\tDEBIT\tVISA\tUNKNOWN\tSOME BANK',
    '403605\t8\tALBANIA\tDEBIT\tVISA\tCLASSIC\tRAIFFEISEN BANK SH.A.',
    '411419\t114\tALBANIA\tDEBIT\tVISA\tCLASSIC\tCREDINS BANK SH.A.',
    '543723\t2\tALBANIA\tCREDIT\tMASTERCARD\tSTANDARD\tBANKA KOMBETARE TREGTARE SH.A.',
    '417863\t1\tALGERIA\tDEBIT\tVISA\tUNKNOWN\tBANQUE DE DEVELOPPEMENT LOCAL - S.P.A.',
    '',
    'garbage line without tabs',
    '414720\t50\tUNITED STATES\tCREDIT\tVISA\tSIGNATURE\tCHASE',
].join('\r\n');

console.log('stock-core');

test('parseStock reads tab-separated rows and skips junk', () => {
    const r = S.parseStock(TEXT, { codeOf });
    assert.strictEqual(r.rows.length, 6);
    assert.strictEqual(r.skipped, 1);
    assert.deepStrictEqual(r.rows[1], {
        bin: '403605', qty: 8, country: 'ALBANIA', cc: 'AL', type: 'DEBIT', brand: 'VISA', level: 'CLASSIC', bank: 'RAIFFEISEN BANK SH.A.',
    });
    assert.strictEqual(r.rows[0].cc, '');
});

test('extractBins takes the first 6 digits of BINs and card numbers, unique, in order', () => {
    const input = '403605\n4114 1912 3456 7890\n5437231234567890|12|28|123\n1) 417863 x\n403605 again\n12345\nbin 99999';
    assert.deepStrictEqual(S.extractBins(input), ['403605', '411419', '543723', '417863']);
});

test('checkBins splits found and not found, keeps order', () => {
    const { rows } = S.parseStock(TEXT, { codeOf });
    const idx = S.buildIndex(rows);
    const r = S.checkBins(idx, ['411419', '000000', '414720']);
    assert.deepStrictEqual(r.found.map(f => f.bin), ['411419', '414720']);
    assert.strictEqual(r.found[0].rows[0].bank, 'CREDINS BANK SH.A.');
    assert.deepStrictEqual(r.notFound, ['000000']);
});

test('geoSummary groups by country with BIN count and total qty, sorted by qty', () => {
    const { rows } = S.parseStock(TEXT, { codeOf });
    const g = S.geoSummary(rows);
    assert.deepStrictEqual(g.map(x => [x.key, x.bins, x.qty]), [
        ['AL', 3, 124], ['US', 1, 50], ['UNKNOWNLAND', 1, 2], ['DZ', 1, 1],
    ]);
    assert.strictEqual(g[0].country, 'ALBANIA');
});

test('filterRows by country key and multi-word query (AND, case-insensitive)', () => {
    const { rows } = S.parseStock(TEXT, { codeOf });
    assert.deepStrictEqual(S.filterRows(rows, { country: 'AL' }).map(r => r.bin), ['403605', '411419', '543723']);
    assert.deepStrictEqual(S.filterRows(rows, { query: 'visa classic' }).map(r => r.bin), ['403605', '411419']);
    assert.deepStrictEqual(S.filterRows(rows, { query: '4114' }).map(r => r.bin), ['411419']);
    assert.deepStrictEqual(S.filterRows(rows, { query: 'chase', country: 'AL' }), []);
});

test('stats totals', () => {
    const { rows } = S.parseStock(TEXT, { codeOf });
    assert.deepStrictEqual(S.stats(rows), { bins: 6, qty: 177, countries: 4 });
});

test('notesText lists found rows and not found BINs', () => {
    const { rows } = S.parseStock(TEXT, { codeOf });
    const r = S.checkBins(S.buildIndex(rows), ['403605', '111111']);
    const t = S.notesText(r);
    assert.ok(t.includes('FOUND (1 of 2)'));
    assert.ok(t.includes('403605 · qty 8 · ALBANIA · DEBIT · VISA · CLASSIC · RAIFFEISEN BANK SH.A.'));
    assert.ok(t.includes('NOT FOUND (1)'));
    assert.ok(t.includes('111111'));
});

test('identical rows are merged (qty summed, entries counted)', () => {
    const r = S.parseStock('403605\t8\tALBANIA\tDEBIT\tVISA\tCLASSIC\tRAIFF\n111111\t1\t-\t-\t-\t-\t-\n403605\t17\tALBANIA\tDEBIT\tVISA\tCLASSIC\tRAIFF', { codeOf });
    assert.strictEqual(r.rows.length, 2);
    assert.strictEqual(r.rows[0].qty, 25);
    assert.strictEqual(r.rows[0].entries, 2);
    assert.strictEqual(r.merged, 1);
});

test('normalizeCountry handles ISO-style long names; unknown values group as UNKNOWN', () => {
    assert.strictEqual(S.normalizeCountry('KOREA, REPUBLIC OF'), 'KOREA');
    assert.strictEqual(S.normalizeCountry('TURKEY'), 'TR');
    assert.strictEqual(S.normalizeCountry("COTE D'IVOIRE"), 'CI');
    assert.strictEqual(S.normalizeCountry('VIRGIN ISLANDS, U.S.'), 'VI');
    assert.strictEqual(S.normalizeCountry('CONGO, THE DEMOCRATIC REPUBLIC OF THE'), 'CD');
    assert.strictEqual(S.normalizeCountry('ALBANIA'), 'ALBANIA');
    const { rows } = S.parseStock('1\n111111\t1\t-\tx\n222222\t2\tUNKNOWN\tx', { codeOf });
    assert.deepStrictEqual(S.geoSummary(rows).map(g => [g.key, g.bins, g.qty]), [['UNKNOWN', 2, 3]]);
});

console.log('\n' + passed + ' passed');
