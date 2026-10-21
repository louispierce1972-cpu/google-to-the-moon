// Unit tests for Minic pure helpers. Run: node minic.test.js
'use strict';
const assert = require('assert');
const M = require('./minic.js');

let passed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
const card = (bin, last4, amounts = []) => ({ bin, last4, amounts });

console.log('minic.js — parseLine');

test('BIN + last4 separated by space', () => {
    assert.deepStrictEqual(M.parseLine('453700 5021'), card('453700', '5021'));
});
test('full 16-digit PAN', () => {
    assert.deepStrictEqual(M.parseLine('5160750000004500'), card('516075', '4500'));
});
test('PAN in groups of 4', () => {
    assert.deepStrictEqual(M.parseLine('4036 2312 3456 7725'), card('403623', '7725'));
});
test('masked card with stars / bullets / x', () => {
    assert.deepStrictEqual(M.parseLine('4537 00** **** 5021'), card('453700', '5021'));
    assert.deepStrictEqual(M.parseLine('453700••••••5021'), card('453700', '5021'));
    assert.deepStrictEqual(M.parseLine('453700xxxxxx5021'), card('453700', '5021'));
});
test('pipe format card|mm|yy|cvv ignores expiry and cvv', () => {
    assert.deepStrictEqual(M.parseLine('4036231234567725|12|28|123'), card('403623', '7725'));
    assert.deepStrictEqual(M.parseLine('4036231234567725|12|2028|123|John Smith'), card('403623', '7725'));
});
test('space format with expiry and cvv', () => {
    assert.deepStrictEqual(M.parseLine('4036 2312 3456 7725 12/28 123'), card('403623', '7725'));
    assert.deepStrictEqual(M.parseLine('4036231234567725 1228 123'), card('403623', '7725'));
    assert.deepStrictEqual(M.parseLine('403623 7725 123'), card('403623', '7725'));
});
test('text with digits before card is ignored', () => {
    assert.deepStrictEqual(M.parseLine('Octo 15 4036231234567725 $9.51'), card('403623', '7725', ['9.51']));
});
test('amex 15 digits', () => {
    assert.deepStrictEqual(M.parseLine('3782 822463 10005'), card('378282', '0005'));
});
test('extracts $ amounts and plain decimal amounts', () => {
    assert.deepStrictEqual(M.parseLine('453700 5021 $9.51 $634.24'), card('453700', '5021', ['9.51', '634.24']));
    assert.deepStrictEqual(M.parseLine('453700 5021 9,51'), card('453700', '5021', ['9.51']));
});
test('BIN only (6 digits) gives empty last4', () => {
    assert.deepStrictEqual(M.parseLine('453700'), card('453700', ''));
});
test('rejects junk / too short', () => {
    assert.strictEqual(M.parseLine(''), null);
    assert.strictEqual(M.parseLine('VISA ••••5021'), null);
    assert.strictEqual(M.parseLine('Exp: 12/28'), null);
});
test('parseText skips empty lines', () => {
    assert.strictEqual(M.parseText('453700 5021\n\n516075 4500\n').length, 2);
});

console.log('minic.js — helpers');

test('parseAmount validates input', () => {
    assert.strictEqual(M.parseAmount('$9.51'), '9.51');
    assert.strictEqual(M.parseAmount('12,5'), '12.5');
    assert.strictEqual(M.parseAmount('abc'), null);
    assert.strictEqual(M.parseAmount('0'), null);
});
test('sumAmounts', () => {
    assert.strictEqual(M.sumAmounts(['9.51', '634.24']).toFixed(2), '643.75');
});
test('normalize migrates legacy entries', () => {
    const n = M.normalize({ bin: '4537001', tag: 'x', amount: '5', status: 'pending' }, () => 'id1');
    assert.deepStrictEqual(n, { id: 'id1', profile: '', bin: '453700', last4: '', type: '', status: 'wait', amounts: ['5'], note: '', date: '', tab: 'main' });
});
test('mergeCards adds new with profile, appends amounts to duplicates, does not mutate', () => {
    const existing = [{ id: 'a', profile: '', bin: '453700', last4: '5021', type: '', status: 'ok', amounts: ['9.51'], note: '', date: 'd', tab: 'main' }];
    const frozen = JSON.stringify(existing);
    let n = 0;
    const r = M.mergeCards(existing, [
        card('453700', '5021', ['1.00']),
        card('453700', '5021'),
        card('516075', '4500'),
    ], { tab: 'main', date: 'today', profile: 'Octo-15' }, () => 'new' + (++n));
    assert.strictEqual(JSON.stringify(existing), frozen);
    assert.strictEqual(r.added, 1);
    assert.strictEqual(r.merged, 1);
    assert.strictEqual(r.skipped, 1);
    assert.deepStrictEqual(r.cards[0].amounts, ['9.51', '1.00']);
    assert.strictEqual(r.cards[0].profile, 'Octo-15');
    assert.strictEqual(r.cards[1].status, 'wait');
    assert.strictEqual(r.cards[1].profile, 'Octo-15');
});
test('mergeCards skips exact duplicates without new info', () => {
    const existing = [{ id: 'a', profile: 'P1', bin: '453700', last4: '5021', type: '', status: 'ok', amounts: [], note: '', date: '', tab: 'main' }];
    const r = M.mergeCards(existing, [card('453700', '5021')], { tab: 'main', date: 't', profile: '' }, () => 'b');
    assert.strictEqual(r.skipped, 1);
    assert.strictEqual(r.cards[0].profile, 'P1');
});
test('mergeCards treats other tabs as different cards', () => {
    const existing = [{ id: 'a', profile: '', bin: '453700', last4: '5021', type: '', status: 'ok', amounts: [], note: '', date: '', tab: 'other' }];
    const r = M.mergeCards(existing, [card('453700', '5021')], { tab: 'main', date: 't', profile: '' }, () => 'b');
    assert.strictEqual(r.added, 1);
});

console.log('\n' + passed + ' passed');
