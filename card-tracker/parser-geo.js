/* ═══════════════════════════════════════════════════════════════════
   PARSER GEO — region / tier classification for parse results.
   Region → Country → BIN tree, tier badges and tier filter.
   Pure functions only (no DOM); exported for node tests.
   Tier lists are a sensible default — edit GEO_TIER_1 / GEO_TIER_2.
   ═══════════════════════════════════════════════════════════════════ */

const GEO_REGION_ORDER = ['North America', 'Europe', 'Latin America', 'CIS', 'Asia', 'MENA', 'Africa', 'Oceania', 'Other'];

const GEO_REGION_ICON = {
    'North America': '🌎', Europe: '🏰', 'Latin America': '🌴', CIS: '❄️', Asia: '🏯',
    MENA: '🕌', Africa: '🌍', Oceania: '🏝️', Other: '❔'
};

const GEO_REGION_LISTS = {
    'North America': 'US CA PM BM GL',
    Europe: 'GB IE FR DE IT ES PT NL BE LU CH AT DK SE NO FI IS PL CZ SK HU RO BG GR HR SI RS BA ME MK AL XK EE LV LT MT CY MC LI AD SM VA GI IM JE GG FO AX',
    'Latin America': 'MX BR AR CL CO PE VE EC BO PY UY GT HN SV NI CR PA CU DO HT PR JM TT BS BB BZ GY SR AW CW KY VG VI AG DM GD KN LC VC GF GP MQ TC AI MS BL MF SX BQ',
    CIS: 'RU UA BY KZ UZ KG TJ TM AZ AM GE MD',
    Asia: 'CN JP KR KP TW HK MO MN IN PK BD LK NP BT MV AF SG MY TH VN PH ID KH LA MM BN TL',
    MENA: 'AE SA QA KW BH OM YE IQ IR JO LB SY IL PS TR EG LY TN DZ MA SD EH',
    Africa: 'NG ZA KE GH ET TZ UG RW BI CD CG CM CF TD GA GQ AO ZM ZW MW MZ MG MU SC KM NA BW LS SZ SN GM GN GW SL LR CI ML BF NE TG BJ MR CV ST SS ER DJ SO RE YT SH',
    Oceania: 'AU NZ FJ PG NC PF WS TO VU SB KI FM MH PW NR TV GU MP AS CK NU WF'
};

/** Tier 1: US, CA, UK, Western Europe, AU, NZ. */
const GEO_TIER_1 = 'US CA GB IE FR DE IT ES PT NL BE LU CH AT DK SE NO FI IS MC LI AD SM VA GI IM JE GG FO AX AU NZ';
/** Tier 2: Eastern / Southern Europe, Latin America, stable Asia, rich Gulf. Everything else is Tier 3. */
const GEO_TIER_2 = [
    'PL CZ SK HU RO BG GR HR SI RS BA ME MK AL XK EE LV LT MT CY',
    GEO_REGION_LISTS['Latin America'],
    'JP KR SG HK TW MO MY TH CN BN',
    'AE QA KW SA BH OM IL'
].join(' ');

const GEO_ALIASES = { UK: 'GB', EL: 'GR' };

const GEO_REGION_BY_CODE = Object.freeze(Object.entries(GEO_REGION_LISTS).reduce((acc, [region, list]) => {
    list.split(' ').forEach(code => { acc[code] = region; });
    return acc;
}, {}));

const GEO_TIER_BY_CODE = Object.freeze([[GEO_TIER_2, 2], [GEO_TIER_1, 1]].reduce((acc, [list, tier]) => {
    list.split(' ').forEach(code => { acc[code] = tier; });
    return acc;
}, {}));

/** Normalised ISO-2 code ('' if unknown). */
function geoCode(raw) {
    const code = String(raw || '').trim().toUpperCase();
    return GEO_ALIASES[code] || code;
}

function geoRegion(raw) {
    return GEO_REGION_BY_CODE[geoCode(raw)] || 'Other';
}

function geoTier(raw) {
    return GEO_TIER_BY_CODE[geoCode(raw)] || 3;
}

/** Emoji flag from an ISO-2 code; white flag when unknown. */
function geoFlag(raw) {
    const code = geoCode(raw);
    if (!/^[A-Z]{2}$/.test(code)) return '\u{1F3F3}';
    return String.fromCodePoint(...[...code].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
}

const GEO_NAMES = (() => {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { return null; }
})();

function geoName(raw) {
    const code = geoCode(raw);
    if (!code) return 'Unknown';
    try { return (GEO_NAMES && GEO_NAMES.of(code)) || code; } catch (e) { return code; }
}

function geoPassesTiers(card, tiers) {
    return !tiers || tiers.size === 0 || tiers.has(geoTier(card.detectedGeo));
}

/** Cards in the current view: tier filter + region + country + BIN. Never mutates input. */
function filterScope(cards, view) {
    const { tiers, region, country, bin } = view || {};
    return cards.filter(c => {
        if (!geoPassesTiers(c, tiers)) return false;
        if (region && geoRegion(c.detectedGeo) !== region) return false;
        if (country && geoCode(c.detectedGeo) !== country) return false;
        if (bin && c.bin !== bin) return false;
        return true;
    });
}

function geoBinsOf(cards) {
    const map = new Map();
    cards.forEach(c => {
        const prev = map.get(c.bin) || { bin: c.bin, count: 0, bank: '' };
        map.set(c.bin, { ...prev, count: prev.count + 1, bank: prev.bank || c.bank || '' });
    });
    return [...map.values()].sort((a, b) => b.count - a.count || a.bin.localeCompare(b.bin));
}

function geoGroup(cards, keyFn) {
    const map = new Map();
    cards.forEach(c => {
        const key = keyFn(c);
        map.set(key, [...(map.get(key) || []), c]);
    });
    return map;
}

/**
 * Region → Country → BIN tree.
 * tierCounts ignore the tier filter (so the tier chips always show totals).
 */
function buildGeoTree(cards, tiers) {
    const tierCounts = { 1: 0, 2: 0, 3: 0 };
    cards.forEach(c => { tierCounts[geoTier(c.detectedGeo)]++; });

    const visible = cards.filter(c => geoPassesTiers(c, tiers));
    const byRegion = geoGroup(visible, c => geoRegion(c.detectedGeo));

    const regions = GEO_REGION_ORDER
        .filter(name => byRegion.has(name))
        .map(name => {
            const list = byRegion.get(name);
            const countries = [...geoGroup(list, c => geoCode(c.detectedGeo)).entries()]
                .map(([code, cs]) => ({
                    code, name: geoName(code), flag: geoFlag(code), tier: geoTier(code),
                    count: cs.length, bins: geoBinsOf(cs)
                }))
                .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
            return { name, icon: GEO_REGION_ICON[name] || '', count: list.length, countries };
        });

    return { total: visible.length, tierCounts, regions };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { geoCode, geoRegion, geoTier, geoFlag, geoName, filterScope, buildGeoTree, GEO_REGION_ORDER };
}
