// Unit tests for Minic pure helpers (minic-core.js). Run: node minic.test.js
'use strict';
const assert = require('assert');
const M = require('./minic-core.js');

let passed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
const pick = (r, keys) => r && Object.fromEntries(keys.map(k => [k, r[k]]));
const binLast = r => pick(r, ['bin', 'last4']);
let seq = 0;
const makeId = () => 'id' + (++seq);

console.log('minic-core — parseLine (legacy formats)');

test('BIN + last4 separated by space', () => {
    assert.deepStrictEqual(binLast(M.parseLine('453700 5021')), { bin: '453700', last4: '5021' });
});
test('full 16-digit PAN', () => {
    assert.deepStrictEqual(binLast(M.parseLine('5160750000004500')), { bin: '516075', last4: '4500' });
});
test('PAN in groups of 4', () => {
    const r = M.parseLine('4036 2312 3456 7725');
    assert.deepStrictEqual(binLast(r), { bin: '403623', last4: '7725' });
    assert.strictEqual(r.number, '4036 2312 3456 7725');
});
test('masked card with stars / bullets / x', () => {
    assert.deepStrictEqual(binLast(M.parseLine('4537 00** **** 5021')), { bin: '453700', last4: '5021' });
    assert.deepStrictEqual(binLast(M.parseLine('453700••••••5021')), { bin: '453700', last4: '5021' });
    assert.deepStrictEqual(binLast(M.parseLine('453700xxxxxx5021')), { bin: '453700', last4: '5021' });
});
test('pipe format card|mm|yy|cvv extracts expiry and cvv', () => {
    assert.deepStrictEqual(pick(M.parseLine('4036231234567725|12|28|123'), ['bin', 'last4', 'exp', 'cvv']),
        { bin: '403623', last4: '7725', exp: '12/28', cvv: '123' });
    assert.strictEqual(M.parseLine('4036231234567725|12|2028|123|John Smith').exp, '12/28');
});
test('space format with expiry and cvv', () => {
    assert.deepStrictEqual(pick(M.parseLine('4036 2312 3456 7725 12/28 123'), ['exp', 'cvv']), { exp: '12/28', cvv: '123' });
    assert.deepStrictEqual(pick(M.parseLine('4036231234567725 1228 123'), ['exp', 'cvv']), { exp: '12/28', cvv: '123' });
    assert.deepStrictEqual(pick(M.parseLine('403623 7725 123'), ['bin', 'last4', 'cvv']), { bin: '403623', last4: '7725', cvv: '123' });
});
test('text with digits before card is ignored', () => {
    const r = M.parseLine('Octo 15 4036231234567725 $9.51');
    assert.deepStrictEqual(binLast(r), { bin: '403623', last4: '7725' });
    assert.deepStrictEqual(r.amounts, ['9.51']);
});
test('amex 15 digits', () => {
    assert.deepStrictEqual(binLast(M.parseLine('3782 822463 10005')), { bin: '378282', last4: '0005' });
});
test('extracts $ amounts and plain decimal amounts', () => {
    assert.deepStrictEqual(M.parseLine('453700 5021 $9.51 $634.24').amounts, ['9.51', '634.24']);
    assert.deepStrictEqual(M.parseLine('453700 5021 9,51').amounts, ['9.51']);
});
test('BIN only (6 digits) gives empty last4', () => {
    assert.deepStrictEqual(binLast(M.parseLine('453700')), { bin: '453700', last4: '' });
});
test('rejects junk / too short', () => {
    assert.strictEqual(M.parseLine(''), null);
    assert.strictEqual(M.parseLine('VISA ••••5021'), null);
    assert.strictEqual(M.parseLine('Exp: 12/28'), null);
    assert.strictEqual(M.parseLine('just a note - nothing here'), null);
});
test('parseText skips empty lines', () => {
    assert.strictEqual(M.parseText('453700 5021\n\n516075 4500\n').length, 2);
});

console.log('minic-core — parseLine (quick paste "card exp cvv - note")');

test('partial numbers with dashes + note', () => {
    assert.deepStrictEqual(M.parseLine('54741520-8220 09/28 681 - sent minic, -$100 charged'), {
        number: '54741520-8220', bin: '547415', last4: '8220', exp: '09/28', cvv: '681', amounts: [], note: 'sent minic, -$100 charged',
    });
    const b = M.parseLine('5474-5912032 05/30 354 - minic not sent, only document rendering');
    assert.deepStrictEqual(pick(b, ['number', 'bin', 'last4', 'exp', 'cvv']), { number: '5474-5912032', bin: '', last4: '2032', exp: '05/30', cvv: '354' });
    const c = M.parseLine("547-0091 04/29 212 - Your card's issuer declined this request. [OR-CCSEH-26]");
    assert.deepStrictEqual(pick(c, ['number', 'last4', 'exp', 'cvv']), { number: '547-0091', last4: '0091', exp: '04/29', cvv: '212' });
    assert.ok(c.note.endsWith('[OR-CCSEH-26]'));
});
test('dot-separated format with exp / cvv keywords', () => {
    const r = M.parseLine('54741520-8220 · exp 09/28 · cvv 681');
    assert.deepStrictEqual(pick(r, ['number', 'exp', 'cvv', 'note']), { number: '54741520-8220', exp: '09/28', cvv: '681', note: '' });
});

console.log('minic-core — helpers');

test('parseAmount validates input', () => {
    assert.strictEqual(M.parseAmount('$9.51'), '9.51');
    assert.strictEqual(M.parseAmount('12,5'), '12.5');
    assert.strictEqual(M.parseAmount('abc'), null);
    assert.strictEqual(M.parseAmount('0'), null);
});
test('sumAmounts', () => {
    assert.strictEqual(M.sumAmounts(['9.51', '634.24']).toFixed(2), '643.75');
    assert.strictEqual(M.sumAmounts(undefined), 0);
});
test('cardParts', () => {
    assert.deepStrictEqual(M.cardParts('4036231234567725'), { digits: '4036231234567725', bin: '403623', last4: '7725' });
    assert.deepStrictEqual(M.cardParts(''), { digits: '', bin: '', last4: '' });
});
test('countStatuses counts cards and success rate', () => {
    const c = M.countStatuses([{ status: 'ok' }, { status: 'fail' }, { status: 'nocode' }, { status: 'wait' }]);
    assert.deepStrictEqual(c, { all: 4, wait: 1, ok: 1, fail: 1, nocode: 1, rate: 33 });
    assert.strictEqual(M.countStatuses([]).rate, null);
});

console.log('minic-core — migration');

test('legacy flat rows become profiles with one card', () => {
    const raw = [{ id: 'mn_a', profile: 'Octo 15', bin: '4537001', last4: '5021', status: 'ok', amounts: ['5'], note: 'n', date: 'd', tab: 'main' },
        { bin: '516075', tag: null, amount: '3', note: '', date: 'd', tab: 'x' }];
    assert.ok(M.needsMigration(raw));
    const out = M.migrate(raw, makeId);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].id, 'mn_a');
    assert.strictEqual(out[0].name, 'Octo 15');
    assert.strictEqual(out[0].cards.length, 1);
    assert.deepStrictEqual(pick(out[0].cards[0], ['number', 'status', 'amounts', 'note']), { number: '453700******5021', status: 'ok', amounts: ['5'], note: 'n' });
    assert.deepStrictEqual(M.cardParts(out[0].cards[0].number), { digits: '4537005021', bin: '453700', last4: '5021' });
    assert.deepStrictEqual(out[1].cards[0].amounts, ['3']);
    assert.strictEqual(out[1].tab, 'x');
    assert.ok(!M.needsMigration(out));
});
test('migrate normalizes bad statuses and unsafe ids', () => {
    const out = M.migrate([{ id: 'bad id"', name: 'P', cards: [{ id: 'c1', status: 'weird' }] }, null], makeId);
    assert.strictEqual(out.length, 1);
    assert.notStrictEqual(out[0].id, 'bad id"');
    assert.strictEqual(out[0].cards[0].status, 'wait');
    assert.deepStrictEqual(out[0].cards[0].amounts, []);
});

console.log('minic-core — mergeCards');

const prof = (id, name, cards, tab = 'main') => ({ id, name, tab, date: 'd', collapsed: false, cards });
const crd = (id, number, extra = {}) => ({ id, number, exp: '', cvv: '', type: '', amounts: [], status: 'wait', note: '', date: 'd', ...extra });

test('attaches new cards to an existing profile (case/space-insensitive name) without mutating', () => {
    const existing = [prof('p1', '[Transferred] Sales-UK-DC-T1 Part-46', [crd('c1', '54741520-8220')])];
    const frozen = JSON.stringify(existing);
    const parsed = M.parseText('5474-5912032 05/30 354 - no code\n547-0091 04/29 212 - declined');
    const r = M.mergeCards(existing, parsed, { tab: 'main', date: 't', profile: '  [transferred]  sales-uk-dc-t1 part-46 ' }, makeId);
    assert.strictEqual(JSON.stringify(existing), frozen);
    assert.strictEqual(r.attached, true);
    assert.strictEqual(r.profiles.length, 1);
    assert.strictEqual(r.profiles[0].cards.length, 3);
    assert.strictEqual(r.added, 2);
    assert.strictEqual(r.profiles[0].cards[2].note, 'declined');
});
test('creates a new profile when name is unknown; merges duplicate cards', () => {
    const r1 = M.mergeCards([], M.parseText('453700 5021 $1.00\n453700 5021\n453700 5021 $2.00 - note'), { tab: 'main', date: 't', profile: 'New' }, makeId);
    assert.strictEqual(r1.attached, false);
    assert.strictEqual(r1.profiles.length, 1);
    assert.strictEqual(r1.added, 1);
    assert.strictEqual(r1.skipped, 1);
    assert.strictEqual(r1.merged, 1);
    assert.deepStrictEqual(r1.profiles[0].cards[0].amounts, ['1.00', '2.00']);
    assert.strictEqual(r1.profiles[0].cards[0].note, 'note');
});
test('without a profile name each card is its own profile; duplicates in tab merge', () => {
    const existing = [prof('p1', 'A', [crd('c1', '453700******5021')])];
    const r = M.mergeCards(existing, M.parseText('453700 5021 $3.00\n516075 4500'), { tab: 'main', date: 't', profile: '' }, makeId);
    assert.strictEqual(r.profiles.length, 2);
    assert.strictEqual(r.added, 1);
    assert.strictEqual(r.merged, 1);
    assert.deepStrictEqual(r.profiles[0].cards[0].amounts, ['3.00']);
    assert.strictEqual(r.profiles[1].name, '');
    const other = M.mergeCards(existing, M.parseText('516075 4500'), { tab: 'other', date: 't', profile: 'A' }, makeId);
    assert.strictEqual(other.attached, false);
    assert.strictEqual(other.profiles.length, 2);
});

console.log('minic-core — search');

const data = [
    prof('p1', '[Transferred] Sales-UK-DC-T1 Part-46', [
        crd('c1', '54741520-8220', { status: 'ok', note: 'sent minic, -$100 charged', amounts: ['100'] }),
        crd('c2', '5474-5912032', { status: 'nocode', note: 'minic not sent, only document rendering' }),
        crd('c3', '547-0091', { status: 'fail', note: "Your card's issuer declined this request. [OR-CCSEH-26]" }),
    ]),
    prof('p2', 'Octo 15', [crd('c4', '4036231234567725', { status: 'wait' })]),
    prof('p3', 'Empty profile', []),
];
const ids = res => res.map(r => r.profile.id + ':' + r.cards.map(c => c.id).join(','));

test('fragment from the middle of a long name, ignoring case/spaces/dashes', () => {
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: 'Sales-UK-DC-T1 Part-46' })), ['p1:c1,c2,c3']);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: 'ukdc' })), ['p1:c1,c2,c3']);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: 'SFERRED] SAL' })), ['p1:c1,c2,c3']);
});
test('searches card numbers, last4, notes, status, amount; shows matching cards only', () => {
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: '7725' })), ['p2:c4']);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: '5912032' })), ['p1:c2']);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: 'or-ccseh' })), ['p1:c3']);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: 'no code' })), ['p1:c2']);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: '$100' })), ['p1:c1']);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: 'visa', infoFn: b => (b === '403623' ? { brand: 'VISA' } : {}) })), ['p2:c4']);
});
test('multiple words use AND logic', () => {
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: 'part-46 declined' })), ['p1:c3']);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: 'octo declined' })), []);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { query: 'rendering declined' })), ['p1:c1,c2,c3']);
});
test('status filter shows profiles with matching cards and only those cards', () => {
    assert.deepStrictEqual(ids(M.filterProfiles(data, { status: 'fail' })), ['p1:c3']);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { status: 'all' })), ['p1:c1,c2,c3', 'p2:c4', 'p3:']);
    assert.deepStrictEqual(ids(M.filterProfiles(data, { status: 'ok', query: 'octo' })), []);
});
test('highlight marks fragments in the original text and escapes HTML', () => {
    assert.strictEqual(M.highlight('Sales-UK-DC', M.queryWords('ukdc')), 'Sales-<mark>UK-DC</mark>');
    assert.strictEqual(M.highlight('<b>x</b>', []), '&lt;b&gt;x&lt;/b&gt;');
    assert.strictEqual(M.highlight("a's", M.queryWords("'")), 'a<mark>&#39;</mark>s');
    assert.strictEqual(M.highlight('', ['a']), '');
});

console.log('\n' + passed + ' passed');
