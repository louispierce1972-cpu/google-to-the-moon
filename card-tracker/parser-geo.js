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


const GEO_REGION_BY_CODE = Object.freeze(Object.entries(GEO_REGION_LISTS).reduce((acc, [region, list]) => {
    list.split(' ').forEach(code => { acc[code] = region; });
    return acc;
}, {}));

const GEO_TIER_BY_CODE = Object.freeze([[GEO_TIER_2, 2], [GEO_TIER_1, 1]].reduce((acc, [list, tier]) => {
    list.split(' ').forEach(code => { acc[code] = tier; });
    return acc;
}, {}));

/** ISO 3166-1 alpha-3 → alpha-2 (checker logs use both, e.g. [PSE], [LIE], [KHM]). */
const GEO_ALPHA3_LIST = 'AFG:AF ALA:AX ALB:AL DZA:DZ ASM:AS AND:AD AGO:AO AIA:AI ATG:AG ARG:AR ARM:AM ABW:AW AUS:AU AUT:AT AZE:AZ BHS:BS BHR:BH BGD:BD BRB:BB BLR:BY BEL:BE BLZ:BZ BEN:BJ BMU:BM BTN:BT BOL:BO BES:BQ BIH:BA BWA:BW BRA:BR VGB:VG BRN:BN BGR:BG BFA:BF BDI:BI KHM:KH CMR:CM CAN:CA CPV:CV CYM:KY CAF:CF TCD:TD CHL:CL CHN:CN COL:CO COM:KM COG:CG COD:CD COK:CK CRI:CR CIV:CI HRV:HR CUB:CU CUW:CW CYP:CY CZE:CZ DNK:DK DJI:DJ DMA:DM DOM:DO ECU:EC EGY:EG SLV:SV GNQ:GQ ERI:ER EST:EE ETH:ET FRO:FO FJI:FJ FIN:FI FRA:FR GUF:GF PYF:PF GAB:GA GMB:GM GEO:GE DEU:DE GHA:GH GIB:GI GRC:GR GRL:GL GRD:GD GLP:GP GUM:GU GTM:GT GGY:GG GIN:GN GNB:GW GUY:GY HTI:HT HND:HN HKG:HK HUN:HU ISL:IS IND:IN IDN:ID IRN:IR IRQ:IQ IRL:IE IMN:IM ISR:IL ITA:IT JAM:JM JPN:JP JEY:JE JOR:JO KAZ:KZ KEN:KE KIR:KI XKX:XK KWT:KW KGZ:KG LAO:LA LVA:LV LBN:LB LSO:LS LBR:LR LBY:LY LIE:LI LTU:LT LUX:LU MAC:MO MKD:MK MDG:MG MWI:MW MYS:MY MDV:MV MLI:ML MLT:MT MHL:MH MTQ:MQ MRT:MR MUS:MU MYT:YT MEX:MX FSM:FM MDA:MD MCO:MC MNG:MN MNE:ME MSR:MS MAR:MA MOZ:MZ MMR:MM NAM:NA NRU:NR NPL:NP NLD:NL NCL:NC NZL:NZ NIC:NI NER:NE NGA:NG NIU:NU PRK:KP MNP:MP NOR:NO OMN:OM PAK:PK PLW:PW PSE:PS PAN:PA PNG:PG PRY:PY PER:PE PHL:PH POL:PL PRT:PT PRI:PR QAT:QA REU:RE ROU:RO RUS:RU RWA:RW BLM:BL SHN:SH KNA:KN LCA:LC MAF:MF SPM:PM VCT:VC WSM:WS SMR:SM STP:ST SAU:SA SEN:SN SRB:RS SYC:SC SLE:SL SGP:SG SXM:SX SVK:SK SVN:SI SLB:SB SOM:SO ZAF:ZA KOR:KR SSD:SS ESP:ES LKA:LK SDN:SD SUR:SR SWZ:SZ SWE:SE CHE:CH SYR:SY TWN:TW TJK:TJ TZA:TZ THA:TH TLS:TL TGO:TG TON:TO TTO:TT TUN:TN TUR:TR TKM:TM TCA:TC TUV:TV UGA:UG UKR:UA ARE:AE GBR:GB USA:US VIR:VI URY:UY UZB:UZ VUT:VU VAT:VA VEN:VE VNM:VN WLF:WF ESH:EH YEM:YE ZMB:ZM ZWE:ZW';

const GEO_ALPHA3 = Object.freeze(GEO_ALPHA3_LIST.split(' ').reduce((acc, pair) => {
    const [a3, a2] = pair.split(':');
    acc[a3] = a2;
    return acc;
}, {}));

/** Every assigned ISO-2 code known to the tool. */
const GEO_ISO2 = new Set(Object.values(GEO_ALPHA3));

const GEO_ALIASES = { UK: 'GB', EL: 'GR', UAE: 'AE', KSA: 'SA' };

/** Normalised ISO-2 code ('' if it is not a country code). Accepts ISO-2, ISO-3 and a few aliases. */
function geoCode(raw) {
    const code = String(raw || '').trim().toUpperCase();
    if (GEO_ALIASES[code]) return GEO_ALIASES[code];
    if (code.length === 3 && GEO_ALPHA3[code]) return GEO_ALPHA3[code];
    return code.length === 2 && GEO_ISO2.has(code) ? code : '';
}

/** Display label + Russian tooltip for a region (the key stays the same for filtering). */
const GEO_REGION_INFO = {
    'North America': { label: 'North America', tip: 'Северная Америка (США, Канада)' },
    Europe: { label: 'Europe', tip: 'Европа (западная и восточная, без СНГ)' },
    'Latin America': { label: 'Latin America', tip: 'Латинская Америка (Мексика, Бразилия, Центральная и Южная Америка, Карибы)' },
    CIS: { label: 'CIS (ex-USSR)', tip: 'CIS — СНГ, бывший СССР: Россия, Украина, Беларусь, Казахстан, Узбекистан, Закавказье, Центральная Азия (без балтийских стран)' },
    Asia: { label: 'Asia', tip: 'Азия (Китай, Япония, Индия, Юго-Восточная Азия и т.д.)' },
    MENA: { label: 'MENA (Middle East & North Africa)', tip: 'MENA — Ближний Восток и Северная Африка: ОАЭ, Саудовская Аравия, Израиль, Турция, Египет, Марокко, Тунис и др.' },
    Africa: { label: 'Africa', tip: 'Африка южнее Сахары (север континента входит в MENA)' },
    Oceania: { label: 'Oceania', tip: 'Океания (Австралия, Новая Зеландия, острова Тихого океана)' },
    Other: { label: 'Other (unknown country)', tip: 'Неизвестная страна: не удалось определить ни по BIN, ни по банку, ни по billing' }
};

function geoRegionInfo(name) {
    return GEO_REGION_INFO[name] || { label: name, tip: name };
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
    module.exports = { GEO_ISO2, GEO_ALPHA3, GEO_REGION_BY_CODE, geoRegionInfo, geoCode, geoRegion, geoTier, geoFlag, geoName, filterScope, buildGeoTree, GEO_REGION_ORDER };
}
