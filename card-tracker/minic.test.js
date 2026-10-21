// Unit tests for Minic pure helpers. Run: node minic.test.js
'use strict';
const assert = require('assert');
const M = require('./minic.js');

let passed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('minic.js');

test('parses BIN + last4 separated by space', () => {
    assert.deepStrictEqual(M.parseLine('453700 5021'), { bin: '453700', last4: '5021', amounts: [] });
});
test('parses full 16-digit PAN', () => {
    assert.deepStrictEqual(M.parseLine('5160750000004500'), { bin: '516075', last4: '4500', amounts: [] });
});
test('parses masked card with stars / bullets', () => {
    assert.deepStrictEqual(M.parseLine('4537 00** **** 5021'), { bin: '453700', last4: '5021', amounts: [] });
    assert.deepStrictEqual(M.parseLine('453700••••••5021'), { bin: '453700', last4: '5021', amounts: [] });
});
test('extracts $ amounts and plain decimal amounts', () => {
    assert.deepStrictEqual(M.parseLine('453700 5021 $9.51 $634.24'), { bin: '453700', last4: '5021', amounts: ['9.51', '634.24'] });
    assert.deepStrictEqual(M.parseLine('453700 5021 9,51'), { bin: '453700', last4: '5021', amounts: ['9.51'] });
});
test('ignores expiry MM/YY', () => {
    assert.deepStrictEqual(M.parseLine('4537005021 01/28'), { bin: '453700', last4: '5021', amounts: [] });
});
test('BIN only (6 digits) gives empty last4', () => {
    assert.deepStrictEqual(M.parseLine('453700'), { bin: '453700', last4: '', amounts: [] });
});
test('rejects junk / too short', () => {
    assert.strictEqual(M.parseLine(''), null);
    assert.strictEqual(M.parseLine('VISA ••••5021'), null);
});
test('parseText skips empty lines', () => {
    assert.strictEqual(M.parseText('453700 5021\n\n516075 4500\n').length, 2);
});
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
    assert.deepStrictEqual(n, { id: 'id1', bin: '453700', last4: '', type: '', status: 'wait', amounts: ['5'], note: '', date: '', tab: 'main' });
});
test('mergeCards adds new, appends amounts to duplicates, does not mutate', () => {
    const existing = [{ id: 'a', bin: '453700', last4: '5021', type: '', status: 'ok', amounts: ['9.51'], note: '', date: 'd', tab: 'main' }];
    const frozen = JSON.stringify(existing);
    let n = 0;
    const r = M.mergeCards(existing, [
        { bin: '453700', last4: '5021', amounts: ['1.00'] },
        { bin: '453700', last4: '5021', amounts: [] },
        { bin: '516075', last4: '4500', amounts: [] },
    ], 'main', 'today', () => 'new' + (++n));
    assert.strictEqual(JSON.stringify(existing), frozen);
    assert.strictEqual(r.added, 1);
    assert.strictEqual(r.merged, 1);
    assert.strictEqual(r.skipped, 1);
    assert.deepStrictEqual(r.cards[0].amounts, ['9.51', '1.00']);
    assert.strictEqual(r.cards[1].status, 'wait');
});
test('mergeCards treats other tabs as different cards', () => {
    const existing = [{ id: 'a', bin: '453700', last4: '5021', type: '', status: 'ok', amounts: [], note: '', date: '', tab: 'other' }];
    const r = M.mergeCards(existing, [{ bin: '453700', last4: '5021', amounts: [] }], 'main', 't', () => 'b');
    assert.strictEqual(r.added, 1);
});

console.log('\n' + passed + ' passed');
