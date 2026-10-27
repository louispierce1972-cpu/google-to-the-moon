/* ═══════════════════════════════════════════
 * MINIC CORE — pure helpers (no DOM). Unit-tested in minic.test.js.
 * Model (stored in STATE.minicBins):
 *   Profile { id, name, tab, date, collapsed, cards: Card[] }
 *   Card    { id, number, exp, cvv, type, amounts[], status, note, date }
 * ═══════════════════════════════════════════ */
(function (root) {
    'use strict';

    const STATUSES = [
        { id: 'wait', label: 'WAIT', hint: 'Waiting for the mini-charge', color: '#a5b4fc' },
        { id: 'ok', label: 'OK', hint: 'Mini-charge arrived, transaction passed', color: '#22c55e' },
        { id: 'fail', label: 'FAIL', hint: 'Mini-charge arrived, transaction failed', color: '#f43f5e' },
        { id: 'nocode', label: 'NO CODE', hint: 'Mini-charge did not arrive', color: '#f59e0b' },
    ];
    const STATUS_IDS = STATUSES.map(s => s.id);
    const statusLabel = id => (STATUSES.find(s => s.id === id) || STATUSES[0]).label;

    const LIMITS = { name: 200, note: 1000, number: 40, exp: 7, cvv: 4, type: 40 };
    const SAFE_ID = /^[\w-]{1,64}$/;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const str = (v, max) => String(v == null ? '' : v).slice(0, max);

    // ── Amounts ──

    function parseAmount(v) {
        const m = String(v || '').replace(',', '.').match(/\d+(?:\.\d{1,2})?/);
        if (!m || !(parseFloat(m[0]) > 0)) return null;
        return m[0];
    }

    function sumAmounts(list) {
        return (list || []).reduce((s, a) => s + (parseFloat(a) || 0), 0);
    }

    // ── Card number parts ──

    /** Derives BIN (first 6) / last4 / digits from a free-form card number like "54741520-8220". */
    function cardParts(number) {
        const n = String(number || '');
        const digits = n.replace(/\D/g, '');
        const head = n.split(/[-*]/)[0].replace(/\s+/g, '');
        const lead = (head.match(/^\d+/) || [''])[0];
        const runs = n.split(/\D+/).filter(Boolean);
        let last4 = '';
        if (runs.length > 1) {
            const last = runs[runs.length - 1];
            if (last.length >= 4) last4 = last.slice(-4);
        } else if (digits.length >= 12) {
            last4 = digits.slice(-4);
        }
        return { digits, bin: lead.length >= 6 ? lead.slice(0, 6) : '', last4 };
    }

    /** Same card in different spellings (full PAN, "BIN last4", masked) → same key. */
    function cardKey(number) {
        const p = cardParts(number);
        return p.bin && p.last4 ? p.bin + '|' + p.last4 : p.digits;
    }

    // ── Line parser: "card exp cvv - note" (plus legacy formats) ──

    const MASK_CHARS = /[•·xX#]/g;
    const isCardTok = t => /^[\d*][\d*-]*$/.test(t) && /\d/.test(t);
    const isGroupTok = t => /^[\d*]{3,6}$/.test(t);
    const isMaskOnly = t => /^\*+$/.test(t);
    const validMonth = mm => +mm >= 1 && +mm <= 12;

    function splitNote(line) {
        const m = line.match(/\s[-–—]\s/);
        return m ? [line.slice(0, m.index), line.slice(m.index + m[0].length).trim()] : [line, ''];
    }

    /** Returns [numberTokens, nextIndex] starting at token i. */
    function takeNumber(tokens, i) {
        const first = tokens[i];
        if (isGroupTok(first)) {
            let joined = '';
            for (let j = i; j < tokens.length && isGroupTok(tokens[j]); j++) {
                joined += tokens[j];
                if (joined.length > 19) break;
                if (joined.length === 15 || joined.length === 16) return [tokens.slice(i, j + 1), j + 1];
            }
        }
        if (/^\d{6}$/.test(first)) {
            let j = i + 1;
            while (tokens[j] && isMaskOnly(tokens[j])) j++;
            if (tokens[j] && /^\d{4}$/.test(tokens[j])) return [tokens.slice(i, j + 1), j + 1];
        }
        return [[first], i + 1];
    }

    function takeExpCvv(tokens, i, exp) {
        let j = i;
        const t = k => tokens[k] || '';
        if (!exp && /^\d{2}$/.test(t(j)) && validMonth(t(j)) && /^(\d{2}|\d{4})$/.test(t(j + 1))) {
            exp = t(j) + '/' + t(j + 1).slice(-2); j += 2;
        } else if (!exp && /^\d{4}$/.test(t(j)) && validMonth(t(j).slice(0, 2)) && /^\d{3,4}$/.test(t(j + 1))) {
            exp = t(j).slice(0, 2) + '/' + t(j).slice(2); j += 1;
        }
        const cvv = /^\d{3,4}$/.test(t(j)) ? t(j) : '';
        return { exp, cvv };
    }

    function parseLine(line) {
        const [left, note] = splitNote(String(line || ''));
        const amounts = [];
        let exp = '';
        const take = a => { amounts.push(a.replace(',', '.')); return ' '; };
        const clean = left
            .replace(/\b(exp(?:iry|ires)?|cvv2?|cvc2?)\b\s*[:.]?/gi, ' ')
            .replace(/\$\s*(\d+(?:[.,]\d{1,2})?)/g, (m, a) => take(a))
            .replace(/\b(0[1-9]|1[0-2])\s*\/\s*(\d{4}|\d{2})\b/g, (m, mm, yy) => { if (!exp) exp = mm + '/' + yy.slice(-2); return ' '; })
            .replace(/[|;\t]/g, ' ')
            .replace(/(^|\s)[·•→](?=\s|$)/g, ' ')
            .replace(/(^|\s)(\d{1,5}[.,]\d{2})(?=\s|$)/g, (m, p, a) => take(a));
        const tokens = clean.split(/\s+/).filter(Boolean).map(t => t.replace(MASK_CHARS, '*'));
        const start = tokens.findIndex(t => isCardTok(t) && t.replace(/[^\d*]/g, '').length >= 4);
        if (start < 0) return null;
        const [numToks, next] = takeNumber(tokens, start);
        const number = numToks.join(' ');
        const parts = cardParts(number);
        if (parts.digits.length < 6) return null;
        const ec = takeExpCvv(tokens, next, exp);
        return { number, bin: parts.bin, last4: parts.last4, exp: ec.exp, cvv: ec.cvv, amounts, note: note.slice(0, LIMITS.note) };
    }

    function parseText(text) {
        return String(text || '').split(/\r?\n/).map(parseLine).filter(Boolean);
    }

    // ── Model: normalize + legacy migration ──

    function normalizeCard(c, makeId) {
        return {
            id: SAFE_ID.test(c.id || '') ? c.id : makeId(),
            number: str(c.number, LIMITS.number),
            exp: str(c.exp, LIMITS.exp),
            cvv: str(c.cvv, LIMITS.cvv).replace(/\D/g, ''),
            type: str(c.type, LIMITS.type),
            amounts: Array.isArray(c.amounts) ? c.amounts.map(String) : (c.amount ? [String(c.amount)] : []),
            status: STATUS_IDS.includes(c.status) ? c.status : 'wait',
            note: str(c.note, LIMITS.note),
            date: str(c.date, 20),
        };
    }

    function normalizeProfile(p, makeId) {
        return {
            id: SAFE_ID.test(p.id || '') ? p.id : makeId(),
            name: str(p.name, LIMITS.name),
            tab: str(p.tab || 'main', 64),
            date: str(p.date, 20),
            collapsed: !!p.collapsed,
            cards: (Array.isArray(p.cards) ? p.cards : []).filter(Boolean).map(c => normalizeCard(c, makeId)),
        };
    }

    /** Old flat row { profile, bin, last4, ... } → profile with one card. */
    function profileFromLegacy(b, makeId) {
        const bin = String(b.bin || '').slice(0, 6);
        const number = b.last4 ? bin + '******' + b.last4 : bin;
        return normalizeProfile({
            id: b.id, name: b.profile || '', tab: b.tab, date: b.date,
            cards: [{ ...b, id: makeId(), number }],
        }, makeId);
    }

    function needsMigration(raw) {
        return (raw || []).some(p => !p || !Array.isArray(p.cards) || !SAFE_ID.test(p.id || '') || typeof p.name !== 'string'
            || p.cards.some(c => !c || !SAFE_ID.test(c.id || '') || !Array.isArray(c.amounts)));
    }

    function migrate(raw, makeId) {
        return (raw || []).filter(Boolean).map(p => (Array.isArray(p.cards) ? normalizeProfile(p, makeId) : profileFromLegacy(p, makeId)));
    }

    // ── Merge pasted cards into profiles (immutable) ──

    const sameName = (a, b) => String(a || '').trim().replace(/\s+/g, ' ').toLowerCase() === String(b || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const findProfileByName = (profiles, name, tab) => profiles.find(p => p.tab === tab && name && sameName(p.name, name));

    function newCard(p, date, makeId) {
        return normalizeCard({ id: makeId(), number: p.number, exp: p.exp, cvv: p.cvv, amounts: p.amounts, note: p.note, status: 'wait', date }, makeId);
    }

    /** Returns updated card or null when nothing new was added. */
    function mergeCard(cur, p) {
        const patch = {};
        if (p.amounts && p.amounts.length) patch.amounts = [...cur.amounts, ...p.amounts];
        ['exp', 'cvv', 'note'].forEach(k => { if (p[k] && !cur[k]) patch[k] = p[k]; });
        return Object.keys(patch).length ? { ...cur, ...patch } : null;
    }

    function mergeCards(profiles, parsed, opts, makeId) {
        const { tab, date } = opts;
        const name = str(String(opts.profile || '').trim(), LIMITS.name);
        let list = profiles.slice();
        let added = 0, merged = 0, skipped = 0;
        const existingTarget = findProfileByName(list, name, tab);
        let targetId = existingTarget ? existingTarget.id : null;

        const replace = (pid, fn) => { list = list.map(pr => (pr.id === pid ? fn(pr) : pr)); };
        const tryMerge = (pr, p) => {
            const key = cardKey(p.number);
            const cur = key && pr.cards.find(c => cardKey(c.number) === key);
            if (!cur) return false;
            const upd = mergeCard(cur, p);
            if (!upd) { skipped++; return true; }
            replace(pr.id, x => ({ ...x, cards: x.cards.map(c => (c.id === cur.id ? upd : c)) }));
            merged++;
            return true;
        };

        parsed.forEach(p => {
            if (name) {
                if (!targetId) {
                    targetId = makeId();
                    list = [...list, normalizeProfile({ id: targetId, name, tab, date, cards: [] }, makeId)];
                }
                const target = list.find(pr => pr.id === targetId);
                if (tryMerge(target, p)) return;
                replace(targetId, x => ({ ...x, cards: [...x.cards, newCard(p, date, makeId)] }));
                added++;
                return;
            }
            const owner = list.find(pr => pr.tab === tab && cardKey(p.number) && pr.cards.some(c => cardKey(c.number) === cardKey(p.number)));
            if (owner && tryMerge(owner, p)) return;
            list = [...list, normalizeProfile({ id: makeId(), name: '', tab, date, cards: [newCard(p, date, makeId)] }, makeId)];
            added++;
        });
        return { profiles: list, added, merged, skipped, attached: !!existingTarget };
    }

    // ── Search ──

    const normText = s => String(s == null ? '' : s).toLowerCase().replace(/[\s\-–—]+/g, '');
    const queryWords = q => String(q || '').split(/\s+/).map(normText).filter(Boolean);

    function cardHay(c, info) {
        const parts = cardParts(c.number);
        const amts = (c.amounts || []).map(a => a + ' $' + a).join(' ');
        return normText([c.number, parts.digits, parts.bin, parts.last4, c.exp, c.type, info.bank, info.brand, info.type,
            statusLabel(c.status), amts, c.date, c.note].join(' '));
    }

    /**
     * Status + text filter. Returns [{ profile, cards }] with only the visible cards.
     * infoFn(bin) → { bank, brand, type } (BIN lookup cache).
     */
    function filterProfiles(profiles, { status = 'all', query = '', infoFn = () => ({}) } = {}) {
        const words = queryWords(query);
        const out = [];
        profiles.forEach(profile => {
            const pool = status === 'all' ? profile.cards : profile.cards.filter(c => c.status === status);
            if (status !== 'all' && !pool.length) return;
            if (!words.length) { out.push({ profile, cards: pool }); return; }
            const nameHay = normText(profile.name) + '|' + normText(profile.date);
            const hays = pool.map(c => cardHay(c, infoFn(cardParts(c.number).bin) || {}));
            const full = nameHay + '|' + hays.join('|');
            if (!words.every(w => full.includes(w))) return;
            const visible = pool.filter((c, i) => words.every(w => (nameHay + '|' + hays[i]).includes(w)));
            out.push({ profile, cards: visible.length ? visible : pool });
        });
        return out;
    }

    /** Escaped HTML of `text` with every match of the (normalized) words wrapped in <mark>. */
    function highlight(text, words) {
        const src = String(text == null ? '' : text);
        if (!words || !words.length || !src) return esc(src);
        let norm = '';
        const map = [];
        for (let i = 0; i < src.length; i++) {
            const ch = src[i].toLowerCase();
            if (/[\s\-–—]/.test(ch)) continue;
            norm += ch; map.push(i);
        }
        const hits = new Array(src.length).fill(false);
        words.forEach(w => {
            if (!w) return;
            for (let at = norm.indexOf(w); at >= 0; at = norm.indexOf(w, at + 1)) {
                for (let k = map[at]; k <= map[at + w.length - 1]; k++) hits[k] = true;
            }
        });
        let html = '', open = false;
        for (let i = 0; i < src.length; i++) {
            if (hits[i] && !open) { html += '<mark>'; open = true; }
            if (!hits[i] && open) { html += '</mark>'; open = false; }
            html += esc(src[i]);
        }
        return open ? html + '</mark>' : html;
    }

    // ── Stats ──

    function countStatuses(cards) {
        const counts = { all: cards.length };
        STATUS_IDS.forEach(id => { counts[id] = cards.filter(c => c.status === id).length; });
        const done = counts.ok + counts.fail + counts.nocode;
        counts.rate = done ? Math.round((counts.ok / done) * 100) : null;
        return counts;
    }

    const api = {
        STATUSES, STATUS_IDS, LIMITS, esc, statusLabel,
        parseAmount, sumAmounts, cardParts, cardKey, parseLine, parseText,
        normalizeCard, normalizeProfile, needsMigration, migrate, sameName, findProfileByName,
        mergeCards, normText, queryWords, filterProfiles, highlight, countStatuses,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.MinicCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
