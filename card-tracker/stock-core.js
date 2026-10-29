/* ═══════════════════════════════════════════
 * STOCK CORE — pure helpers for the "Find Cards" screen (no DOM).
 * Stock file: tab-separated lines
 *   BIN \t QTY \t COUNTRY \t TYPE \t BRAND \t LEVEL \t BANK
 * Unit-tested in stock-core.test.js.
 * ═══════════════════════════════════════════ */
(function (root) {
    'use strict';

    const CARD_OR_BIN = /\d{4}(?:[ -]\d{4}){2,3}(?:\d{1,3})?|\d{6,19}/g;

    /** ISO 3166 "long" names that generic name matching misses (prefix match, upper-case). */
    const COUNTRY_ALIASES = [
        ['TURKEY', 'TR'], ['KOSOVO', 'XK'], ['COTE D', 'CI'], ['PALESTIN', 'PS'], ['BRUNEI', 'BN'],
        ['CONGO, THE DEMOCRATIC', 'CD'], ['CONGO, DEMOCRATIC', 'CD'], ['VIRGIN ISLANDS, U', 'VI'], ['VIRGIN ISLANDS, BRITISH', 'VG'],
        ['SAINT VINCENT', 'VC'], ['SAINT KITTS', 'KN'], ['SAINT LUCIA', 'LC'], ['LAO', 'LA'], ['LIBYA', 'LY'],
        ['SYRIA', 'SY'], ['CABO VERDE', 'CV'], ['BONAIRE', 'BQ'], ['HOLY SEE', 'VA'], ['SINT MAARTEN', 'SX'],
    ];
    const UNKNOWN_VALUES = new Set(['', '-', 'UNKNOWN', 'N/A', 'NA', 'NONE', '?']);

    /** Alias ISO-2 code if known, otherwise the name before ", ..." / "(...)" for generic matching. */
    function normalizeCountry(name) {
        const up = String(name || '').trim().toUpperCase();
        const hit = COUNTRY_ALIASES.find(([prefix]) => up.startsWith(prefix));
        if (hit) return hit[1];
        return up.split(/,|\(/)[0].trim();
    }

    const isAliasCode = (raw, n) => n.length === 2 && String(raw || '').trim().length > 2;
    const mergeKey = r => [r.bin, r.country, r.type, r.brand, r.level, r.bank].join('|');

    /**
     * Parses the stock text. opts.codeOf(countryName) → ISO-2 ('' if unknown).
     * Identical rows (same BIN + country + type + brand + level + bank) are merged: qty summed.
     */
    function parseStock(text, opts = {}) {
        const codeOf = typeof opts.codeOf === 'function' ? opts.codeOf : () => '';
        const ccCache = new Map();
        const cc = name => {
            if (!ccCache.has(name)) {
                const n = normalizeCountry(name);
                const code = UNKNOWN_VALUES.has(n) ? '' : (isAliasCode(name, n) ? n : (codeOf(name) || codeOf(n) || ''));
                ccCache.set(name, code);
            }
            return ccCache.get(name);
        };
        const byKey = new Map();
        let skipped = 0;
        let merged = 0;
        String(text || '').split(/\r?\n/).forEach(line => {
            if (!line.trim()) return;
            const f = line.split('\t').map(s => s.trim());
            const bin = (f[0] || '').replace(/\D/g, '');
            if (f.length < 3 || bin.length < 6 || bin !== (f[0] || '').trim()) { skipped++; return; }
            const country = f[2] || '';
            const row = {
                bin, qty: parseInt(f[1], 10) || 0, country, cc: cc(country),
                type: f[3] || '', brand: f[4] || '', level: f[5] || '', bank: f.slice(6).join(' ').trim(),
            };
            const key = mergeKey(row);
            const prev = byKey.get(key);
            if (prev) { merged++; byKey.set(key, { ...prev, qty: prev.qty + row.qty, entries: prev.entries + 1 }); }
            else byKey.set(key, { ...row, entries: 1 });
        });
        const rows = [...byKey.values()].map(({ entries, ...r }) => (entries > 1 ? { ...r, entries } : r));
        return { rows, skipped, merged };
    }

    /** Unique 6-digit BINs from any pasted text (BINs or full card numbers), in input order. */
    function extractBins(text) {
        const out = [];
        const seen = new Set();
        (String(text || '').match(CARD_OR_BIN) || []).forEach(m => {
            const bin = m.replace(/\D/g, '').slice(0, 6);
            if (bin.length === 6 && !seen.has(bin)) { seen.add(bin); out.push(bin); }
        });
        return out;
    }

    /** Map: 6-digit BIN → rows (a BIN can appear more than once). */
    function buildIndex(rows) {
        const map = new Map();
        rows.forEach(r => {
            const key = r.bin.slice(0, 6);
            map.set(key, [...(map.get(key) || []), r]);
        });
        return map;
    }

    function checkBins(index, bins) {
        const found = [];
        const notFound = [];
        bins.forEach(bin => {
            const rows = index.get(bin);
            if (rows) found.push({ bin, rows });
            else notFound.push(bin);
        });
        return { found, notFound, total: bins.length };
    }

    const geoKey = r => r.cc || (UNKNOWN_VALUES.has(String(r.country || '').trim().toUpperCase()) ? 'UNKNOWN' : r.country.toUpperCase());

    /** [{ key, cc, country, bins, qty }] sorted by total qty (desc). */
    function geoSummary(rows) {
        const map = new Map();
        rows.forEach(r => {
            const key = geoKey(r);
            const prev = map.get(key) || { key, cc: r.cc, country: r.country, bins: 0, qty: 0 };
            map.set(key, { ...prev, bins: prev.bins + 1, qty: prev.qty + r.qty });
        });
        return [...map.values()].sort((a, b) => b.qty - a.qty || b.bins - a.bins || a.key.localeCompare(b.key));
    }

    const words = q => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = r => `${r.bin} ${r.country} ${r.cc} ${r.type} ${r.brand} ${r.level} ${r.bank}`.toLowerCase();

    /** Filter by geo key (opts.country) and multi-word query (AND, case-insensitive). */
    function filterRows(rows, { country = '', query = '' } = {}) {
        const ws = words(query);
        return rows.filter(r => (!country || geoKey(r) === country) && (!ws.length || ws.every(w => haystack(r).includes(w))));
    }

    function stats(rows) {
        return {
            bins: rows.length,
            qty: rows.reduce((s, r) => s + r.qty, 0),
            countries: new Set(rows.map(geoKey)).size,
        };
    }

    const rowLine = r => [r.bin, 'qty ' + r.qty, r.country, r.type, r.brand, r.level, r.bank].filter(Boolean).join(' · ');

    /** Plain text for Notes. */
    function notesText(result) {
        const lines = [`FOUND (${result.found.length} of ${result.total})`];
        result.found.forEach(f => f.rows.forEach(r => lines.push(rowLine(r))));
        lines.push('', `NOT FOUND (${result.notFound.length})`);
        result.notFound.forEach(b => lines.push(b));
        return lines.join('\n');
    }

    const api = { parseStock, normalizeCountry, extractBins, buildIndex, checkBins, geoKey, geoSummary, filterRows, stats, rowLine, notesText };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.StockCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
