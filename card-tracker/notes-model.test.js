// Unit tests for notes-model.js. Run: node notes-model.test.js
'use strict';
const assert = require('assert');
const N = require('./notes-model.js');

let passed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
const ISO = new Set(['FR', 'DE', 'US', 'GB', 'IT']);
const T0 = Date.UTC(2026, 9, 26, 12); // 26 Oct 2026
const SINCE = Date.UTC(2026, 9, 27);
const opts = { now: SINCE, since: SINCE, isoSet: ISO };
const cards = n => Array.from({ length: n }, (_, i) => '40362312345677' + String(10 + i) + ' 12 28 123').join('\n');

console.log('notes-model — text helpers');

test('plainText converts contenteditable HTML to lines', () => {
    assert.strictEqual(N.plainText('a<div>b</div><div><br></div><div>c&nbsp;d</div>'), 'a\nb\n\nc d');
    assert.strictEqual(N.plainText('x<br>y<br>'), 'x\ny');
    assert.strictEqual(N.plainText(null), '');
});
test('countCards finds plain, grouped and masked numbers', () => {
    assert.strictEqual(N.countCards('4036231234567725 12 28\n4036 2312 3456 7725\n453700******5021\n12345'), 3);
});
test('topCountries from flags, ISO codes and BIN lookup', () => {
    assert.deepStrictEqual(N.topCountries('FR x\nFR y\nDE z\nOK', '', { isoSet: ISO }), ['FR', 'DE']);
    assert.deepStrictEqual(N.topCountries('🇩🇪 🇩🇪 🇫🇷', '', { isoSet: ISO }), ['DE', 'FR']);
    assert.deepStrictEqual(N.topCountries('4036231234567725', '', { isoSet: ISO, countryOf: b => (b === '403623' ? 'us' : '') }), ['US']);
});
test('formatDate', () => {
    assert.strictEqual(N.formatDate(T0), '26 Oct');
    assert.strictEqual(N.formatDate('bad'), '');
});

console.log('notes-model — migration');

test('detectFolder by badge, id prefix and title', () => {
    assert.strictEqual(N.detectFolder({ exportSource: 'Parser BIN' }), 'parser');
    assert.strictEqual(N.detectFolder({ exportSource: 'Valid Cards' }), 'checker');
    assert.strictEqual(N.detectFolder({ exportSource: 'Trash Check' }), 'checker');
    assert.strictEqual(N.detectFolder({ id: 'tab-parser-1' }), 'parser');
    assert.strictEqual(N.detectFolder({ title: 'CC Glue 10:00' }), 'checker');
    assert.strictEqual(N.detectFolder({ exportSource: 'Minic' }), 'minic');
    assert.strictEqual(N.detectFolder({ exportSource: 'Documents' }), 'manual');
    assert.strictEqual(N.detectFolder({ title: 'Tab 185' }), 'manual');
    assert.strictEqual(N.detectFolder({ folder: 'minic', exportSource: 'Parser' }), 'minic');
});
test('old "Tab N" gets an auto name; old meaningful title is kept as customName; content untouched', () => {
    const content = 'FR line<br>' + cards(3).replace(/\n/g, '<br>');
    const a = N.migrateTab({ id: 'tab-1', title: 'Tab 185', content, created: T0, exportSource: 'Parser' }, opts);
    assert.strictEqual(a.autoName, 'Parser · 26 Oct · 3 cards · FR');
    assert.strictEqual(a.customName, null);
    assert.strictEqual(a.title, a.autoName);
    assert.strictEqual(a.content, content);
    assert.strictEqual(a.folder, 'parser');
    assert.strictEqual(a.status, 'active');
    assert.strictEqual(a.createdAt, T0);
    assert.strictEqual(a.modifiedAt, T0);
    assert.strictEqual(a.originTitle, 'Tab 185');
    const b = N.migrateTab({ id: 'tab-2', title: 'CREDIT AGRICOLE FR', content: '', created: T0 }, opts);
    assert.strictEqual(b.customName, 'CREDIT AGRICOLE FR');
    assert.strictEqual(b.title, 'CREDIT AGRICOLE FR');
    assert.strictEqual(b.autoName, 'Note · 26 Oct · FR');
});
test('fresh tabs (created after the migration) show the auto name', () => {
    const t = N.migrateTab({ id: 'tab-parser-9', title: 'BIN 403623 (2)', content: cards(2), created: SINCE + 1000, exportSource: 'Parser BIN' }, opts);
    assert.strictEqual(t.customName, null);
    assert.ok(t.title.startsWith('Parser · 27 Oct · 2 cards'));
    assert.strictEqual(t.originTitle, 'BIN 403623 (2)');
});
test('migration is idempotent and never drops tabs', () => {
    const tabs = [{ id: 'tab-1', title: 'Tab 1', content: 'x', created: T0 }, null, { id: 'tab-2', title: 'Mine', content: '', created: T0 }];
    const r1 = N.migrateAll(tabs, opts);
    assert.strictEqual(r1.changed, 2);
    assert.strictEqual(r1.tabs.length, 2);
    assert.ok(!N.needsMigration(r1.tabs));
    const r2 = N.migrateAll(r1.tabs, { ...opts, now: SINCE + 9e9 });
    assert.strictEqual(r2.changed, 0);
    assert.deepStrictEqual(r2.tabs, r1.tabs);
});
test('existing customName (manual rename) is never overwritten', () => {
    const t = N.migrateTab({ id: 'x', title: 'whatever', customName: 'My name', content: cards(1), created: SINCE + 5 }, opts);
    assert.strictEqual(t.title, 'My name');
    const r = N.rename(t, '  ');
    assert.strictEqual(r.customName, null);
    assert.strictEqual(r.title, t.autoName);
    assert.strictEqual(N.rename(t, 'New').title, 'New');
});

console.log('notes-model — grouping');

const mk = (id, extra) => N.migrateTab({ id, title: 'Tab', content: id, created: T0, ...extra }, opts);
test('groupTabs: pinned on top, archive separate, active before used, newest first', () => {
    const tabs = [
        mk('a', { exportSource: 'Parser', modifiedAt: 1 }),
        mk('b', { exportSource: 'Parser', modifiedAt: 3, status: 'used' }),
        mk('c', { exportSource: 'Parser', modifiedAt: 2 }),
        mk('d', { pinned: true }),
        mk('e', { status: 'archived', pinned: true }),
    ];
    const g = N.groupTabs(tabs);
    assert.deepStrictEqual(g.parser.map(t => t.id), ['c', 'a', 'b']);
    assert.deepStrictEqual(g.pinned.map(t => t.id), ['d']);
    assert.deepStrictEqual(g.archive.map(t => t.id), ['e']);
    assert.deepStrictEqual(N.counts(tabs), { total: 5, active: 3 });
});
test('patchTabs is immutable', () => {
    const tabs = [mk('a'), mk('b')];
    const frozen = JSON.stringify(tabs);
    const next = N.patchTabs(tabs, ['b'], { status: 'used' });
    assert.strictEqual(JSON.stringify(tabs), frozen);
    assert.strictEqual(next[1].status, 'used');
    assert.strictEqual(next[0], tabs[0]);
});

console.log('notes-model — search');

const corpus = [
    N.migrateTab({ id: 's1', title: 'Profile list', content: 'Sales-UK-DC-T1 Part-46<br>4036 2312 3456 7725 12/28', created: T0, modifiedAt: 5 }, opts),
    N.migrateTab({ id: 's2', title: 'Tab 3', content: 'nothing here', created: T0, modifiedAt: 9, status: 'archived' }, opts),
    N.migrateTab({ id: 's3', title: 'Bank notes', content: 'Credit Agricole declined', created: T0, modifiedAt: 7 }, opts),
];
test('matches content ignoring case/spaces/dashes, with snippet + highlight', () => {
    const r = N.search(corpus, 'uk dc t1');
    assert.deepStrictEqual(r.map(x => x.tab.id), ['s1']);
    assert.strictEqual(r[0].lineIndex, 0);
    assert.ok(r[0].snippetHtml.includes('<mark>'));
    const card = N.search(corpus, '4036231234567725');
    assert.strictEqual(card[0].lineIndex, 1);
    assert.strictEqual(card[0].fragment, '4036 2312 3456 7725');
    assert.strictEqual(N.search(corpus, '7725')[0].tab.id, 's1');
});
test('AND logic across name + content, archive toggle', () => {
    assert.deepStrictEqual(N.search(corpus, 'bank declined').map(x => x.tab.id), ['s3']);
    assert.deepStrictEqual(N.search(corpus, 'bank uk'), []);
    assert.deepStrictEqual(N.search(corpus, 'nothing').map(x => x.tab.id), ['s2']);
    assert.deepStrictEqual(N.search(corpus, 'nothing', { includeArchive: false }), []);
    assert.deepStrictEqual(N.search(corpus, '   '), []);
    assert.strictEqual(N.search(corpus, 'profile')[0].inName, true);
});
test('highlight escapes HTML and returns the first fragment', () => {
    const h = N.highlight('<b>Sales-UK</b>', N.queryWords('salesuk'));
    assert.strictEqual(h.html, '&lt;b&gt;<mark>Sales-UK</mark>&lt;/b&gt;');
    assert.strictEqual(h.first, 'Sales-UK');
});

console.log('notes-model — cleanup & merge');

const DAY = 864e5;
test('stale / empty tabs skip pinned and archived', () => {
    const tabs = [
        mk('old', { modifiedAt: SINCE - 20 * DAY }),
        mk('oldPinned', { modifiedAt: SINCE - 20 * DAY, pinned: true }),
        mk('fresh', { modifiedAt: SINCE - DAY }),
        { ...mk('empty'), content: '<div><br></div>' },
        { ...mk('arch', { status: 'archived' }), content: '' },
    ];
    assert.deepStrictEqual(N.staleTabs(tabs, 14, SINCE).map(t => t.id), ['old']);
    assert.deepStrictEqual(N.emptyTabs(tabs).map(t => t.id), ['empty']);
});
test('duplicateGroups finds identical and near-identical tabs, newest first', () => {
    const lines = Array.from({ length: 20 }, (_, i) => 'line ' + i).join('\n');
    const tabs = [
        { ...mk('d1'), content: 'Same  Text', modifiedAt: 1 },
        { ...mk('d2'), content: 'same text', modifiedAt: 2 },
        { ...mk('n1'), content: lines, modifiedAt: 3 },
        { ...mk('n2'), content: lines + '\nline extra', modifiedAt: 4 },
        { ...mk('u'), content: 'unique' },
    ];
    const g = N.duplicateGroups(tabs).map(x => x.map(t => t.id));
    assert.deepStrictEqual(g, [['d2', 'd1'], ['n2', 'n1']]);
});
test('mergeTabs creates one tab with separators and archives originals', () => {
    const tabs = [
        N.migrateTab({ id: 'm1', title: 'First', content: 'a\nb', created: T0 }, opts),
        N.migrateTab({ id: 'm2', title: 'Second', content: 'c<br>d', created: T0 + 3600e3 }, opts),
        mk('other'),
    ];
    const r = N.mergeTabs(tabs, ['m2', 'm1'], { now: SINCE + 10, makeId: () => 'merged1', isoSet: ISO });
    assert.strictEqual(r.tabs.length, 4);
    assert.strictEqual(r.merged.id, 'merged1');
    assert.ok(r.merged.content.indexOf('First') < r.merged.content.indexOf('Second'));
    assert.ok(r.merged.content.includes('a<br>b'));
    assert.ok(r.merged.content.includes('──────── First · 26 Oct ────────'));
    assert.deepStrictEqual(r.tabs.filter(t => t.status === 'archived').map(t => t.id).sort(), ['m1', 'm2']);
    assert.strictEqual(N.mergeTabs(tabs, ['m1'], {}).merged, null);
});

test('touchChanged bumps modifiedAt and refreshes autoName only when content changed', () => {
    const base = N.migrateTab({ id: 'x1', title: 'Tab 5', exportSource: 'Parser', content: cards(1), created: T0 }, opts);
    const first = N.touchChanged([base], { ...opts, now: SINCE + 5 });
    assert.strictEqual(first.changed, 1);                       // signature recorded, no bump yet
    assert.strictEqual(first.tabs[0].modifiedAt, base.modifiedAt);
    const same = N.touchChanged(first.tabs, { ...opts, now: SINCE + 9 });
    assert.strictEqual(same.changed, 0);
    assert.strictEqual(same.tabs[0], first.tabs[0]);            // untouched → same object
    const edited = [{ ...first.tabs[0], content: cards(3) }];
    const r = N.touchChanged(edited, { ...opts, now: SINCE + 20 });
    assert.strictEqual(r.tabs[0].modifiedAt, SINCE + 20);
    assert.ok(r.tabs[0].autoName.includes('3 cards'));
    assert.ok(r.tabs[0].title.includes('3 cards'));
    const named = [{ ...r.tabs[0], customName: 'Mine', title: 'Mine', content: cards(4) }];
    const r2 = N.touchChanged(named, { ...opts, now: SINCE + 30 });
    assert.strictEqual(r2.tabs[0].title, 'Mine');               // manual name never overwritten
    assert.strictEqual(r2.tabs[0].customName, 'Mine');
});

console.log('\n' + passed + ' passed');
