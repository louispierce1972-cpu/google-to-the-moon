/* ═══════════════════════════════════════════════════════════════════
   PARSER GEO DETECT — country detection for parsed cards.
   Order: explicit Country Code → bank [XX]/[XXX] marker → billing country
   → country name/ISO → bank-name keywords. geoInferMissing() then fills the
   rest from other cards of the same BIN / bank (and an optional BIN lookup).
   Pure functions; depends on parser-geo.js (geoCode, GEO_ISO2).
   ═══════════════════════════════════════════════════════════════════ */

const _GD = (typeof module !== 'undefined' && module.exports && typeof require === 'function')
    ? require('./parser-geo.js')
    : { geoCode, GEO_ISO2 };

/** Country codes accepted from any billing field (old behaviour for non-first billing tokens). */
const GEO_LEGACY_BILLING_CODES = new Set('CA US AU AE UK GB IL DE FR NL SE NO DK FI NZ SG JP KR IN BR MX ZA IE IT ES CH AT BE PT RU CN HK TW TH PH MY ID VN PK SA QA KW EG NG KE CL CO PE AR RO BG HR CZ PL HU LT LV EE GR CY TR'.split(' '));

/** Words that are also common non-country names: never match them as a country inside a bank name. */
const GEO_NAME_BLOCKLIST = new Set(['georgia', 'jordan', 'guinea', 'niger', 'chad', 'jersey', 'dominica', 'samoa', 'congo', 'virgin islands', 'guernsey']);

function geoNormText(raw) {
    return String(raw == null ? '' : raw)
        .replace(/&#0*39;|&#x27;|&apos;/gi, "'")
        .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function geoDecodeEntities(raw) {
    return String(raw == null ? '' : raw)
        .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');
}

/** Splits "BANK NAME [PSE]" into the clean bank name and its ISO-2 code ('' if no marker). */
function geoParseBank(raw) {
    const text = geoDecodeEntities(raw).replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, '').trim();
    let code = '';
    const bank = text.replace(/\s*\[([A-Za-z]{2,3})\]/g, (m, token) => {
        const c = _GD.geoCode(token);
        if (!c) return m;
        code = code || c;
        return '';
    }).trim();
    return { bank, code };
}

/* ── country names → ISO-2 ── */

const GEO_NAME_EXTRA = {
    'usa': 'US', 'u.s.a': 'US', 'united states of america': 'US', 'america': 'US', 'uk': 'GB', 'great britain': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB',
    'russian federation': 'RU', 'korea': 'KR', 'south korea': 'KR', 'republic of korea': 'KR', 'viet nam': 'VN', 'czech republic': 'CZ', 'turkiye': 'TR',
    'ivory coast': 'CI', 'moldova': 'MD', 'republic of moldova': 'MD', 'macedonia': 'MK', 'north macedonia': 'MK', 'palestine': 'PS', 'hong kong': 'HK', 'macau': 'MO', 'macao': 'MO',
    'syria': 'SY', 'iran': 'IR', 'laos': 'LA', 'burma': 'MM', 'cape verde': 'CV', 'swaziland': 'SZ', 'east timor': 'TL', 'vatican': 'VA', 'bosnia': 'BA', 'uae': 'AE',
    'cayman': 'KY', 'brunei': 'BN', 'tanzania': 'TZ', 'bolivia': 'BO', 'venezuela': 'VE', 'taiwan': 'TW', 'netherlands': 'NL', 'holland': 'NL'
};

const GEO_NAME_TO_CODE = (() => {
    const map = new Map();
    let names = null;
    try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { names = null; }
    if (names) {
        _GD.GEO_ISO2.forEach(code => {
            let full = '';
            try { full = names.of(code) || ''; } catch (e) { full = ''; }
            const base = geoNormText(full).split(/ \(| - /)[0].replace(/ sar china$/, '').replace(/&/g, 'and').trim();
            if (base.length >= 4 && base !== code.toLowerCase()) map.set(base, code);
        });
    }
    Object.entries(GEO_NAME_EXTRA).forEach(([name, code]) => map.set(name, code));
    return map;
})();

const GEO_NAME_REGEXES = [...GEO_NAME_TO_CODE.entries()]
    .filter(([name]) => name.length >= 5 && !GEO_NAME_BLOCKLIST.has(name))
    .sort((a, b) => b[0].length - a[0].length)
    .map(([name, code]) => ({ re: new RegExp(`(^|[^a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`), code }));

/** "Kazakhstan" / "KAZ" / "KZ" / "Russian Federation" → ISO-2 ('' if not a country). */
function geoFromCountryText(raw) {
    const text = String(raw == null ? '' : raw).trim();
    if (!text) return '';
    const direct = _GD.geoCode(text);
    if (direct) return direct;
    return GEO_NAME_TO_CODE.get(geoNormText(text).replace(/&/g, 'and').replace(/\s+/g, ' ').trim()) || '';
}

/* ── bank name keywords (stems; matched at a word start) ── */

const GEO_BANK_KEYWORDS = {
    KZ: 'kaspi halyk jusan bereke eurasian-bank centercredit center-credit kazakh \u043a\u0430\u0437\u0430\u0445\u0441\u0442\u0430\u043d \u043a\u0430\u0441\u043f\u0438 \u0445\u0430\u043b\u044b\u043a',
    AZ: 'rabita pasha-bank azerbaijan azeri \u0430\u0437\u0435\u0440\u0431\u0430\u0439\u0434\u0436\u0430\u043d',
    UA: 'privatbank \u043f\u0440\u0438\u0432\u0430\u0442 oschad \u043e\u0449\u0430\u0434 monobank pumb ukrsib ukrgasbank ukrsots sense-bank ukrain \u0443\u043a\u0440\u0430\u0457\u043d \u0443\u043a\u0440\u0430\u0438\u043d raiffeisen-bank-aval',
    UZ: 'uzbek o\'zbek ozbek \u0443\u0437\u0431\u0435\u043a hamkor asaka infinbank uzum aloqabank ipoteka-bank',
    RU: 'sberbank \u0441\u0431\u0435\u0440\u0431\u0430\u043d\u043a \u0441\u0431\u0435\u0440 tinkoff \u0442\u0438\u043d\u044c\u043a\u043e\u0444\u0444 gazprombank \u0433\u0430\u0437\u043f\u0440\u043e\u043c sovcombank rossiy \u0440\u043e\u0441\u0441\u0438\u0439 \u0440\u043e\u0441\u0441\u0438\u044f vtb-bank',
    BY: 'belarus \u0431\u0435\u043b\u0430\u0440\u0443\u0441 belinvest priorbank belagroprom belarusbank',
    GE: 'tbc-bank bank-of-georgia liberty-bank',
    AM: 'ameriabank ardshinbank acba armenia',
    MD: 'moldova moldindconbank agroindbank',
    KG: 'kyrgyz',
    TJ: 'tajik',
    TM: 'turkmen',
    MN: 'mongol golomt',
    SK: 'slovensk slovak vseobecna tatra-banka 365.bank',
    CZ: 'ceska czech komercni moneta-money',
    PL: 'polska polski pko-bank pekao',
    RS: 'srbija serbia beograd novi-sad',
    SI: 'ljubljana slovenia nova-ljubljanska delavska-hranilnica',
    HR: 'hrvatska zagreb croatia',
    BA: 'sarajevo bosn herzegovin',
    MK: 'makedonij macedonia skopje',
    ME: 'crnogorska podgorica montenegro',
    MA: 'maroc moroccan morocco attijariwafa banque-centrale-populaire al-barid credit-du-maroc saham-bank cih-bank cfg-bank bmce',
    TN: 'tunis amen-bank biat',
    DZ: 'alger',
    EG: 'egypt banque-misr',
    CR: 'costa-rica bac-san-jose popular-y-de-desarrollo',
    GB: 'barclays lloyds natwest halifax santander-uk hsbc-uk monzo nationwide-building bank-of-scotland royal-bank-of-scotland tesco-bank virgin-money metro-bank starling-bank first-direct scotland united-kingdom britain',
    US: 'bank-of-america american-express wells-fargo chase jpmorgan-chase capital-one citizens-bank pnc u.s.-bank us-bank navy-federal usaa synchrony',
    CA: 'royal-bank-of-canada toronto-dominion td-canada bmo cibc desjardins tangerine canadian national-bank-of-canada laurentian simplii koho wealthsimple',
    AU: 'commonwealth-bank westpac anz national-australia-bank australian macquarie bendigo',
    NZ: 'kiwibank asb-bank bank-of-new-zealand',
    IE: 'bank-of-ireland permanent-tsb ulster-bank aib',
    DE: 'sparkasse deutsche-bank commerzbank postbank',
    JP: 'mitsubishi-ufj mizuho sumitomo-mitsui rakuten-card',
    IN: 'state-bank-of-india hdfc icici kotak punjab-national',
    MX: 'banorte banamex banco-azteca mexic',
    BR: 'itau bradesco nubank banco-do-brasil caixa-economica brasil',
    TR: 'turkiye turkish garanti isbank is-bankasi akbank yapi-kredi ziraat denizbank vakifbank halkbank',
    AE: 'emirates abu-dhabi dubai mashreq',
    SA: 'saudi al-rajhi riyad-bank',
    IL: 'leumi hapoalim israel'
};

const GEO_BANK_RULES = Object.entries(GEO_BANK_KEYWORDS).flatMap(([code, list]) =>
    list.split(' ').map(word => {
        const stem = geoNormText(word.replace(/-/g, ' ')).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tail = stem.length <= 4 ? '($|[^a-z0-9])' : '';
        return { re: new RegExp(`(^|[^a-z0-9\u0430-\u044f])${stem}${tail}`), code };
    }));

/** Country guess from the bank name ('' if nothing recognisable). */
function geoFromBankName(bank) {
    const text = geoNormText(bank);
    if (!text || /^unknown/.test(text)) return '';
    const rule = GEO_BANK_RULES.find(r => r.re.test(text));
    if (rule) return rule.code;
    const byName = GEO_NAME_REGEXES.find(r => r.re.test(text));
    return byName ? byName.code : '';
}

/**
 * Country of one parsed card ('' if it cannot be determined).
 * input: { billing, country, countryCode, bankCountryCode, bank }
 */
function geoResolve(input) {
    const { billing = '', country = '', countryCode = '', bankCountryCode = '', bank = '' } = input || {};

    const explicit = _GD.geoCode(countryCode) || _GD.geoCode(bankCountryCode);
    if (explicit) return explicit;

    const parts = String(billing || '').split(',').map(p => p.trim()).filter(Boolean);
    const fromBilling = parts.length ? _GD.geoCode(parts[0]) : '';
    if (fromBilling) return fromBilling;

    const fromCountry = geoFromCountryText(country);
    if (fromCountry) return fromCountry;

    const legacy = parts.map(p => _GD.geoCode(p)).find(c => c && GEO_LEGACY_BILLING_CODES.has(c));
    if (legacy) return legacy;

    return geoFromBankName(bank);
}

/* ── inference from the rest of the base ── */

const GEO_INFER_BIN_SHARE = 0.6;
const GEO_INFER_BANK_SHARE = 0.9;
const GEO_INFER_BANK_MIN_VOTES = 3;

function geoBankKey(bank) {
    const key = geoNormText(bank).trim();
    return !key || /^unknown/.test(key) ? '' : key;
}

function geoVote(map, key, code) {
    if (!key) return;
    const votes = map.get(key) || new Map();
    votes.set(code, (votes.get(code) || 0) + 1);
    map.set(key, votes);
}

function geoTopVote(votes) {
    if (!votes) return { code: '', share: 0, total: 0 };
    let total = 0;
    let best = ['', 0];
    votes.forEach((n, code) => { total += n; if (n > best[1]) best = [code, n]; });
    return { code: best[0], share: total ? best[1] / total : 0, total };
}

/**
 * Fills cards that still have no country: same-BIN majority → same-bank majority →
 * optional binLookup(bin) (e.g. cached BIN API data). Returns new objects for changed
 * cards and never mutates the input.
 */
function geoInferMissing(cards, binLookup) {
    const binVotes = new Map();
    const bankVotes = new Map();
    cards.forEach(c => {
        const code = _GD.geoCode(c.detectedGeo);
        if (!code) return;
        geoVote(binVotes, c.bin, code);
        geoVote(bankVotes, geoBankKey(c.bank), code);
    });

    return cards.map(c => {
        if (_GD.geoCode(c.detectedGeo)) return c;

        const byBin = geoTopVote(binVotes.get(c.bin));
        if (byBin.code && byBin.share >= GEO_INFER_BIN_SHARE) return { ...c, detectedGeo: byBin.code, geoSource: 'bin' };

        const byBank = geoTopVote(bankVotes.get(geoBankKey(c.bank)));
        if (byBank.code && byBank.total >= GEO_INFER_BANK_MIN_VOTES && byBank.share >= GEO_INFER_BANK_SHARE) {
            return { ...c, detectedGeo: byBank.code, geoSource: 'bank' };
        }

        const looked = typeof binLookup === 'function' ? geoFromCountryText(binLookup(c.bin)) : '';
        return looked ? { ...c, detectedGeo: looked, geoSource: 'binapi' } : c;
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { geoParseBank, geoResolve, geoInferMissing, geoFromBankName, geoFromCountryText, geoDecodeEntities };
}
