/* ═══════════════════════════════════════════
 * NOTES MODEL — pure helpers (no DOM). Unit-tested in notes-model.test.js.
 *
 * Every Notes tab keeps its original fields (id, title, content, pinned, created,
 * exportSource, pinnedLines, ...) and gets these extra fields (model v1):
 *   folder      'parser' | 'checker' | 'minic' | 'manual'   (origin folder)
 *   status      'active' | 'used' | 'archived'               (archived → shown in Archive)
 *   pinned      boolean
 *   customName  string | null   (manual name — always wins, never overwritten)
 *   autoName    string          (source · date · N cards · top countries)
 *   originTitle string          (title the tab had before the model was applied)
 *   createdAt / modifiedAt      epoch ms
 *   _nv         1               (model version → migration is idempotent)
 * `title` is kept in sync with the display name so legacy code keeps working.
 * Phase 2 (structured card records) can add `records: []` per tab without touching this.
 * ═══════════════════════════════════════════ */
(function (root) {
    'use strict';

    const MODEL_VERSION = 1;
    const FOLDERS = [
        { id: 'parser', label: 'Parser' },
        { id: 'checker', label: 'Checker' },
        { id: 'minic', label: 'Minic' },
        { id: 'manual', label: 'Manual' },
    ];
    const FOLDER_IDS = FOLDERS.map(f => f.id);
    const ARCHIVE = 'archive';
    const STATUSES = ['active', 'used', 'archived'];
    const DAY = 864e5;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const folderLabel = id => (id === ARCHIVE ? 'Archive' : (FOLDERS.find(f => f.id === id) || FOLDERS[3]).label);

    // ── Text helpers ──

    const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

    /** Editor HTML (or plain text) → plain text with \n line breaks. */
    function plainText(content) {
        return String(content || '')
            .replace(/<(div|p)[^>]*>\s*<br\s*\/?>\s*<\/\1>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<(div|p|li|h\d)[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&(nbsp|amp|lt|gt|quot|#39);/gi, m => ENTITIES[m.toLowerCase()] || m)
            .replace(/^\n/, '')
            .replace(/\n+$/, '');
    }

    function formatDate(ts) {
        const d = new Date(ts);
        return isNaN(d) ? '' : d.getDate() + ' ' + MONTHS[d.getMonth()];
    }

    const CARD_RE = /(?<!\d)(?:\d{13,19}|\d{4}(?:[ -]\d{4}){3}(?:\d{1,3})?|\d{6}[•*x]{4,9}\d{4})(?!\d)/gi;

    function findCards(text) { return String(text || '').match(CARD_RE) || []; }
    const countCards = text => findCards(text).length;

    function flagToIso(flag) {
        const cps = [...flag].map(ch => ch.codePointAt(0) - 0x1F1E6 + 65);
        return String.fromCharCode(...cps);
    }

    /** Two-letter words that look like ISO codes but are usually plain English in notes. */
    const WORD_STOP = new Set(['NO', 'IN', 'IS', 'AM', 'TO', 'BY', 'ME', 'MY', 'OR', 'AT', 'BE', 'DO', 'GO', 'HE', 'IF', 'OF', 'ON', 'SO', 'UP', 'AS', 'AN', 'ID', 'OK', 'TV', 'PM']);

    /**
     * Top countries (max 2, by frequency) from flags, ISO codes in text/title and BIN lookups.
     * opts.isoSet: Set of valid ISO2 codes; opts.countryOf(bin6) → ISO2 | ''.
     */
    function topCountries(text, title, opts = {}) {
        const isoSet = opts.isoSet || new Set();
        const tally = new Map();
        const add = cc => { if (cc && isoSet.has(cc)) tally.set(cc, (tally.get(cc) || 0) + 1); };
        const src = String(title || '') + '\n' + String(text || '');
        (src.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu) || []).forEach(f => add(flagToIso(f)));
        (src.match(/(?<![A-Za-z])[A-Z]{2}(?![A-Za-z])/g) || []).forEach(cc => { if (!WORD_STOP.has(cc)) add(cc); });
        if (typeof opts.countryOf === 'function') {
            findCards(text).forEach(c => add(String(opts.countryOf(c.replace(/\D/g, '').slice(0, 6)) || '').toUpperCase()));
        }
        return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]);
    }

    // ── Folder / names ──

    function detectFolder(tab) {
        if (FOLDER_IDS.includes(tab.folder)) return tab.folder;
        const src = String(tab.exportSource || '');
        const id = String(tab.id || '');
        const title = String(tab.title || '');
        if (/parser/i.test(src) || /^tab-parser-/.test(id)) return 'parser';
        if (/minic/i.test(src) || /^tab-(mn|minic)-/.test(id)) return 'minic';
        if (/valid|trash|checker|glue/i.test(src) || /^tab-(cml|valid|trash|ck)-/.test(id) || /^(cc )?glue\b/i.test(title)) return 'checker';
        return 'manual';
    }

    function sourceLabel(tab, folder) {
        if (folder !== 'manual') return folderLabel(folder);
        return tab.exportSource ? String(tab.exportSource) : 'Note';
    }

    function buildAutoName(tab, folder, createdAt, opts) {
        const text = plainText(tab.content);
        const n = countCards(text);
        const cc = topCountries(text, tab.originTitle || tab.title, opts);
        return [sourceLabel(tab, folder), formatDate(createdAt), n ? n + (n === 1 ? ' card' : ' cards') : '', cc.join('/')]
            .filter(Boolean).join(' · ');
    }

    const isGenericTitle = t => !String(t || '').trim() || /^\s*(tab|new tab|untitled|note)\s*#?\s*\d*\s*$/i.test(String(t));
    const idTimestamp = id => { const m = String(id || '').match(/(\d{12,14})$/); return m ? +m[1] : 0; };
    const displayName = tab => (tab.customName || tab.autoName || tab.title || 'Untitled');

    /**
     * Applies model v1 to one tab. Idempotent: tabs with _nv are returned unchanged.
     * opts.since: tabs created on/after this moment are "fresh" (auto name is shown);
     * older tabs keep a meaningful title as customName, only "Tab N"-style titles get the auto name.
     */
    function migrateTab(tab, opts = {}) {
        if (!tab || tab._nv === MODEL_VERSION) return tab;
        const now = opts.now || Date.now();
        const createdAt = +tab.createdAt || +tab.created || idTimestamp(tab.id) || Date.parse(tab.exportedAt) || now;
        const modifiedAt = +tab.modifiedAt || Date.parse(tab.exportedAt) || createdAt;
        const folder = detectFolder(tab);
        const fresh = opts.since ? createdAt >= opts.since : false;
        const originTitle = tab.originTitle != null ? tab.originTitle : String(tab.title || '');
        const customName = tab.customName !== undefined ? tab.customName
            : (fresh || isGenericTitle(tab.title) ? null : String(tab.title));
        const base = { ...tab, originTitle };
        const autoName = tab.autoName || buildAutoName(base, folder, createdAt, opts);
        return {
            ...base,
            folder,
            status: STATUSES.includes(tab.status) ? tab.status : 'active',
            pinned: !!tab.pinned,
            customName,
            autoName,
            createdAt,
            modifiedAt,
            title: customName || autoName,
            _nv: MODEL_VERSION,
        };
    }

    function migrateAll(tabs, opts) {
        let changed = 0;
        const out = (tabs || []).filter(Boolean).map(t => {
            const m = migrateTab(t, opts);
            if (m !== t) changed++;
            return m;
        });
        return { tabs: out, changed };
    }

    const needsMigration = tabs => (tabs || []).some(t => t && t._nv !== MODEL_VERSION);

    // ── Grouping & sorting ──

    const byRecency = (a, b) => (a.status === 'used') - (b.status === 'used') || (b.modifiedAt || 0) - (a.modifiedAt || 0);

    function groupTabs(tabs) {
        const groups = { pinned: [], archive: [] };
        FOLDER_IDS.forEach(f => { groups[f] = []; });
        tabs.forEach(t => {
            if (t.status === 'archived') groups.archive.push(t);
            else if (t.pinned) groups.pinned.push(t);
            else groups[FOLDER_IDS.includes(t.folder) ? t.folder : 'manual'].push(t);
        });
        Object.keys(groups).forEach(k => groups[k].sort(byRecency));
        return groups;
    }

    function counts(tabs) {
        return { total: tabs.length, active: tabs.filter(t => (t.status || 'active') === 'active').length };
    }

    // ── Immutable updates ──

    const patchTabs = (tabs, ids, patch) => {
        const set = new Set(ids);
        return tabs.map(t => (set.has(t.id) ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t));
    };

    function rename(tab, name) {
        const customName = String(name || '').trim() || null;
        return { ...tab, customName, title: customName || tab.autoName || tab.title };
    }

    // ── Search ──

    const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[\s\-–—]+/g, '');
    const queryWords = q => String(q || '').split(/\s+/).map(norm).filter(Boolean);

    function matchRanges(src, words) {
        let n = '';
        const map = [];
        for (let i = 0; i < src.length; i++) {
            if (/[\s\-–—]/.test(src[i])) continue;
            n += src[i].toLowerCase(); map.push(i);
        }
        const hits = new Array(src.length).fill(false);
        let first = null;
        (words || []).forEach(w => {
            for (let at = n.indexOf(w); w && at >= 0; at = n.indexOf(w, at + 1)) {
                const s = map[at], e = map[at + w.length - 1];
                if (!first || s < first[0]) first = [s, e];
                for (let k = s; k <= e; k++) hits[k] = true;
            }
        });
        return { hits, first };
    }

    /** Escaped HTML of `text` with normalized-word matches wrapped in <mark>. Returns { html, first } */
    function highlight(text, words) {
        const src = String(text == null ? '' : text);
        if (!words || !words.length || !src) return { html: esc(src), first: '' };
        const { hits, first } = matchRanges(src, words);
        let html = '', open = false;
        for (let i = 0; i < src.length; i++) {
            if (hits[i] && !open) { html += '<mark>'; open = true; }
            if (!hits[i] && open) { html += '</mark>'; open = false; }
            html += esc(src[i]);
        }
        return { html: open ? html + '</mark>' : html, first: first ? src.slice(first[0], first[1] + 1) : '' };
    }

    function clipAround(line, words, max = 140) {
        if (line.length <= max) return line;
        const { first } = matchRanges(line, words);
        const start = Math.max(0, (first ? first[0] : 0) - 40);
        return (start ? '…' : '') + line.slice(start, start + max) + (start + max < line.length ? '…' : '');
    }

    /**
     * Full-text search over names + content. AND over words; ignores case, spaces and dashes.
     * Returns [{ tab, lineIndex, snippet, fragment, inName }] (newest first).
     */
    function search(tabs, query, { includeArchive = true } = {}) {
        const words = queryWords(query);
        if (!words.length) return [];
        const out = [];
        tabs.forEach(tab => {
            if (!includeArchive && tab.status === 'archived') return;
            const name = displayName(tab) + ' ' + (tab.originTitle || '');
            const lines = plainText(tab.content).split('\n');
            const hay = norm(name) + '|' + lines.map(norm).join('|');
            if (!words.every(w => hay.includes(w))) return;
            const nl = lines.map(norm);
            let lineIndex = nl.findIndex(l => words.every(w => l.includes(w)));
            if (lineIndex < 0) lineIndex = nl.findIndex(l => words.some(w => l.includes(w)));
            const line = lineIndex >= 0 ? lines[lineIndex].trim() : '';
            const snippet = line ? clipAround(line, words) : '';
            const hl = highlight(snippet, words);
            out.push({ tab, lineIndex, snippet, snippetHtml: hl.html, fragment: highlight(line, words).first, inName: lineIndex < 0 });
        });
        return out.sort((a, b) => (b.tab.modifiedAt || 0) - (a.tab.modifiedAt || 0));
    }

    // ── Cleanup suggestions (never delete automatically) ──

    const isCandidate = t => t.status !== 'archived' && !t.pinned;
    const normContent = t => plainText(t.content).toLowerCase().replace(/\s+/g, ' ').trim();

    function staleTabs(tabs, days, now = Date.now()) {
        const limit = now - Math.max(1, +days || 14) * DAY;
        return tabs.filter(t => isCandidate(t) && (t.modifiedAt || t.createdAt || 0) < limit);
    }

    function emptyTabs(tabs) {
        return tabs.filter(t => isCandidate(t) && !normContent(t) && !/<img/i.test(String(t.content || '')));
    }

    function lineSet(t) {
        return new Set(plainText(t.content).split('\n').map(l => l.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean));
    }

    function similarity(a, b) {
        if (!a.size && !b.size) return 1;
        let inter = 0;
        a.forEach(x => { if (b.has(x)) inter++; });
        return inter / (a.size + b.size - inter);
    }

    /**
     * Groups of identical / near-identical tabs (line-set Jaccard ≥ threshold).
     * Each group is sorted newest first: group[0] is the one to keep.
     */
    function duplicateGroups(tabs, threshold = 0.9) {
        const pool = tabs.filter(t => isCandidate(t) && normContent(t));
        const sets = pool.map(lineSet);
        const keys = pool.map(normContent);
        const parent = pool.map((_, i) => i);
        const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
        for (let i = 0; i < pool.length; i++) {
            for (let j = i + 1; j < pool.length; j++) {
                const same = keys[i] === keys[j]
                    || (sets[i].size >= 3 && sets[j].size >= 3 && similarity(sets[i], sets[j]) >= threshold);
                if (same) parent[find(j)] = find(i);
            }
        }
        const groups = new Map();
        pool.forEach((t, i) => {
            const r = find(i);
            if (!groups.has(r)) groups.set(r, []);
            groups.get(r).push(t);
        });
        return [...groups.values()].filter(g => g.length > 1)
            .map(g => g.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0)));
    }

    // ── Merge ──

    const toHtml = c => (/<[a-z][\s\S]*>/i.test(String(c || '')) ? String(c) : String(c || '').replace(/\n/g, '<br>'));

    /**
     * Returns { tabs, merged } — a NEW tab with all contents joined by separator lines
     * (name + date of each source); the sources are moved to Archive (never deleted).
     */
    function mergeTabs(tabs, ids, { now = Date.now(), makeId, isoSet, countryOf } = {}) {
        const sources = ids.map(id => tabs.find(t => t.id === id)).filter(Boolean);
        if (sources.length < 2) return { tabs, merged: null };
        const ordered = sources.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const content = ordered.map(t =>
            `──────── ${esc(displayName(t))} · ${formatDate(t.createdAt)} ────────<br>${toHtml(t.content)}`).join('<br><br>');
        const folders = [...new Set(sources.map(t => t.folder))];
        const folder = folders.length === 1 ? folders[0] : 'manual';
        const draft = {
            id: makeId ? makeId() : 'tab-merged-' + now, content, folder,
            originTitle: `Merged (${sources.length} tabs)`, exportSource: folder === 'manual' ? 'Merged' : undefined,
            pinned: false, tag: null, created: now, scrollPos: 0, pinnedLines: [],
        };
        const merged = migrateTab(draft, { now, since: now, isoSet, countryOf });
        const archived = patchTabs(tabs, sources.map(t => t.id), { status: 'archived', pinned: false });
        return { tabs: [merged, ...archived], merged };
    }

    // ── Change detection ──

    /** Cheap content signature: length + FNV-1a hash. */
    function signature(content) {
        const s = String(content || '');
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
        return s.length + ':' + (h >>> 0).toString(36);
    }

    /**
     * Detects tabs whose content changed since the last check (any writer: editor, Parser, Checker...).
     * First sight → records `_sig` only. Changed → bumps modifiedAt and refreshes autoName
     * (customName is never touched). Unchanged tabs are returned as the same objects.
     */
    function touchChanged(tabs, opts = {}) {
        const now = opts.now || Date.now();
        let changed = 0;
        const out = tabs.map(t => {
            const sig = signature(t.content);
            if (t._sig === sig) return t;
            changed++;
            if (t._sig === undefined) return { ...t, _sig: sig };
            const autoName = buildAutoName(t, t.folder, t.createdAt, opts);
            return { ...t, _sig: sig, modifiedAt: now, autoName, title: t.customName || autoName };
        });
        return { tabs: out, changed };
    }

    const api = {
        MODEL_VERSION, FOLDERS, FOLDER_IDS, ARCHIVE, STATUSES, esc, folderLabel,
        plainText, formatDate, countCards, findCards, topCountries, detectFolder, buildAutoName,
        isGenericTitle, displayName, migrateTab, migrateAll, needsMigration,
        groupTabs, counts, patchTabs, rename, norm, queryWords, highlight, search,
        staleTabs, emptyTabs, duplicateGroups, similarity, mergeTabs, signature, touchChanged,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NotesModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
