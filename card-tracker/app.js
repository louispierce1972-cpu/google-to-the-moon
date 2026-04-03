/* ═══════════════════════════════════════════
   CARD TRACKER — Application Logic
   ═══════════════════════════════════════════ */

// ──── STATE ────
const STATE = {
    user: null,
    currentView: 'cards',
    currentCountry: 'canada',
    countries: [
        { id: 'canada', name: 'Canada', flag: '🇨🇦' },
        { id: 'usa', name: 'United States', flag: '🇺🇸' }
    ],
    cards: [],
    docs: [],
    notes: '',
    notesTabs: [],
    notesActiveTab: '',
    trash: [],
    search: '',
    page: 1,
    perPage: 100,
    editingCardId: null,
    contextCardId: null,
    sortField: 'date',
    sortDir: 'desc',
    docSortField: 'date',
    docSortDir: 'desc',
    notesFontSize: 14,
    notesLastSaved: null,
    settings: {},
};


const CREDENTIALS = { username: 'admin', password: 'google2026' };

// ──── BIN CACHE (RustBin API) ────
let BIN_CACHE = {};

function loadBinCache() {
    try {
        const raw = localStorage.getItem('ct_bin_cache');
        if (raw) BIN_CACHE = JSON.parse(raw);
    } catch { BIN_CACHE = {}; }
}

function saveBinCache() {
    try {
        localStorage.setItem('ct_bin_cache', JSON.stringify(BIN_CACHE));
    } catch { /* quota exceeded — ignore */ }
}

function getBinInfo(bin) {
    return BIN_CACHE[bin] || null;
}

async function lookupBin(bin) {
    if (!bin || bin.length < 6) return null;
    const key = bin.slice(0, 6);
    // Return from cache
    if (BIN_CACHE[key]) return BIN_CACHE[key];
    
    const apiUrl = `https://rustbin.site/api/?bin=${key}`;
    
    // Strategy 1: Direct fetch (works when served from http server)
    try {
        const resp = await fetch(apiUrl);
        if (resp.status === 404) {
            BIN_CACHE[key] = { bin: key, brand: '', type: '', level: '', bank: '', country: '', error: true };
            saveBinCache();
            return BIN_CACHE[key];
        }
        if (resp.ok) {
            const data = await resp.json();
            return _cacheBinData(key, data);
        }
    } catch { /* CORS blocked — try proxies */ }
    
    // Strategy 2: allorigins.win proxy (wraps response)
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;
        const resp = await fetch(proxyUrl);
        if (resp.ok) {
            const wrapper = await resp.json();
            if (wrapper.contents) {
                const data = JSON.parse(wrapper.contents);
                return _cacheBinData(key, data);
            }
        }
    } catch { /* try next */ }
    
    // Strategy 3: corsproxy.io
    try {
        const resp = await fetch(`https://corsproxy.io/?${encodeURIComponent(apiUrl)}`);
        if (resp.ok) {
            const data = await resp.json();
            return _cacheBinData(key, data);
        }
    } catch { /* try next */ }

    // Strategy 4: api.codetabs.com
    try {
        const resp = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(apiUrl)}`);
        if (resp.ok) {
            const data = await resp.json();
            return _cacheBinData(key, data);
        }
    } catch { /* all proxies failed */ }
    
    return null;
}

function _cacheBinData(key, data) {
    BIN_CACHE[key] = {
        bin: data.bin || key,
        brand: data.brand || '',
        type: data.type || '',
        level: data.level || '',
        bank: data.bank || '',
        country: data.country || '',
        phone: data.phone || '',
        url: data.url || '',
    };
    saveBinCache();
    return BIN_CACHE[key];
}

function formatBinInfoText(info) {
    if (!info || info.error) return '';
    const parts = [];
    if (info.brand) parts.push(info.brand);
    if (info.type) parts.push(info.type);
    if (info.bank) parts.push(info.bank);
    return parts.join(' • ');
}

// ──── COUNTRY DATABASE (ISO 3166-1 alpha-2) ────
function isoToFlag(code) {
    return code.toUpperCase().replace(/./g, ch => String.fromCodePoint(0x1F1E6 - 65 + ch.charCodeAt(0)));
}

const COUNTRY_DB = {
    AB:'Abkhazia',AD:'Andorra',AE:'United Arab Emirates',AF:'Afghanistan',AG:'Antigua and Barbuda',
    AI:'Anguilla',AL:'Albania',AM:'Armenia',AO:'Angola',AQ:'Antarctica',AR:'Argentina',
    AS:'American Samoa',AT:'Austria',AU:'Australia',AW:'Aruba',AX:'Åland Islands',AZ:'Azerbaijan',
    BA:'Bosnia and Herzegovina',BB:'Barbados',BD:'Bangladesh',BE:'Belgium',BF:'Burkina Faso',
    BG:'Bulgaria',BH:'Bahrain',BI:'Burundi',BJ:'Benin',BL:'Saint Barthélemy',BM:'Bermuda',
    BN:'Brunei',BO:'Bolivia',BQ:'Bonaire',BR:'Brazil',BS:'Bahamas',BT:'Bhutan',BV:'Bouvet Island',
    BW:'Botswana',BY:'Belarus',BZ:'Belize',CA:'Canada',CC:'Cocos Islands',CD:'Congo DR',
    CF:'Central African Republic',CG:'Congo',CH:'Switzerland',CI:"Côte d'Ivoire",CK:'Cook Islands',
    CL:'Chile',CM:'Cameroon',CN:'China',CO:'Colombia',CR:'Costa Rica',CU:'Cuba',CV:'Cape Verde',
    CW:'Curaçao',CX:'Christmas Island',CY:'Cyprus',CZ:'Czech Republic',DE:'Germany',DJ:'Djibouti',
    DK:'Denmark',DM:'Dominica',DO:'Dominican Republic',DZ:'Algeria',EC:'Ecuador',EE:'Estonia',
    EG:'Egypt',EH:'Western Sahara',ER:'Eritrea',ES:'Spain',ET:'Ethiopia',FI:'Finland',FJ:'Fiji',
    FK:'Falkland Islands',FM:'Micronesia',FO:'Faroe Islands',FR:'France',GA:'Gabon',GB:'United Kingdom',
    GD:'Grenada',GE:'Georgia',GF:'French Guiana',GG:'Guernsey',GH:'Ghana',GI:'Gibraltar',
    GL:'Greenland',GM:'Gambia',GN:'Guinea',GP:'Guadeloupe',GQ:'Equatorial Guinea',GR:'Greece',
    GS:'South Georgia',GT:'Guatemala',GU:'Guam',GW:'Guinea-Bissau',GY:'Guyana',HK:'Hong Kong',
    HM:'Heard Island',HN:'Honduras',HR:'Croatia',HT:'Haiti',HU:'Hungary',ID:'Indonesia',
    IE:'Ireland',IL:'Israel',IM:'Isle of Man',IN:'India',IO:'British Indian Ocean Territory',
    IQ:'Iraq',IR:'Iran',IS:'Iceland',IT:'Italy',JE:'Jersey',JM:'Jamaica',JO:'Jordan',JP:'Japan',
    KE:'Kenya',KG:'Kyrgyzstan',KH:'Cambodia',KI:'Kiribati',KM:'Comoros',KN:'Saint Kitts and Nevis',
    KP:'North Korea',KR:'South Korea',KW:'Kuwait',KY:'Cayman Islands',KZ:'Kazakhstan',
    LA:'Laos',LB:'Lebanon',LC:'Saint Lucia',LI:'Liechtenstein',LK:'Sri Lanka',LR:'Liberia',
    LS:'Lesotho',LT:'Lithuania',LU:'Luxembourg',LV:'Latvia',LY:'Libya',MA:'Morocco',MC:'Monaco',
    MD:'Moldova',ME:'Montenegro',MF:'Saint Martin',MG:'Madagascar',MH:'Marshall Islands',
    MK:'North Macedonia',ML:'Mali',MM:'Myanmar',MN:'Mongolia',MO:'Macao',MP:'Northern Mariana Islands',
    MQ:'Martinique',MR:'Mauritania',MS:'Montserrat',MT:'Malta',MU:'Mauritius',MV:'Maldives',
    MW:'Malawi',MX:'Mexico',MY:'Malaysia',MZ:'Mozambique',NA:'Namibia',NC:'New Caledonia',
    NE:'Niger',NF:'Norfolk Island',NG:'Nigeria',NI:'Nicaragua',NL:'Netherlands',NO:'Norway',
    NP:'Nepal',NR:'Nauru',NU:'Niue',NZ:'New Zealand',OM:'Oman',OS:'South Ossetia',PA:'Panama',
    PE:'Peru',PF:'French Polynesia',PG:'Papua New Guinea',PH:'Philippines',PK:'Pakistan',
    PL:'Poland',PM:'Saint Pierre and Miquelon',PN:'Pitcairn',PR:'Puerto Rico',
    PS:'Palestine',PT:'Portugal',PW:'Palau',PY:'Paraguay',QA:'Qatar',RE:'Réunion',RO:'Romania',
    RS:'Serbia',RU:'Russia',RW:'Rwanda',SA:'Saudi Arabia',SB:'Solomon Islands',SC:'Seychelles',
    SD:'Sudan',SE:'Sweden',SG:'Singapore',SH:'Saint Helena',SI:'Slovenia',SJ:'Svalbard',
    SK:'Slovakia',SL:'Sierra Leone',SM:'San Marino',SN:'Senegal',SO:'Somalia',SR:'Suriname',
    SS:'South Sudan',ST:'São Tomé and Príncipe',SV:'El Salvador',SX:'Sint Maarten',
    SY:'Syria',SZ:'Eswatini',TC:'Turks and Caicos',TD:'Chad',TF:'French Southern Territories',
    TG:'Togo',TH:'Thailand',TJ:'Tajikistan',TK:'Tokelau',TL:'Timor-Leste',TM:'Turkmenistan',
    TN:'Tunisia',TO:'Tonga',TR:'Turkey',TT:'Trinidad and Tobago',TV:'Tuvalu',TW:'Taiwan',
    TZ:'Tanzania',UA:'Ukraine',UG:'Uganda',UM:'US Minor Outlying Islands',US:'United States',
    UY:'Uruguay',UZ:'Uzbekistan',VA:'Vatican City',VC:'Saint Vincent and the Grenadines',
    VE:'Venezuela',VG:'British Virgin Islands',VI:'US Virgin Islands',VN:'Vietnam',VU:'Vanuatu',
    WF:'Wallis and Futuna',WS:'Samoa',YE:'Yemen',YT:'Mayotte',ZA:'South Africa',ZM:'Zambia',
    ZW:'Zimbabwe'
};

// ──── HELPERS ────
function genId() {
    try { return crypto.randomUUID(); }
    catch { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
}

function getCardType(num) {
    const n = num.replace(/\s/g, '');
    if (/^4/.test(n)) return 'VISA';
    if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'MASTERCARD';
    if (/^3[47]/.test(n)) return 'AMEX';
    if (/^6/.test(n)) return 'DISCOVER';
    return '';
}

function getBin(num) { return num.replace(/\s/g, '').slice(0, 6); }

function maskCard(num) {
    const n = num.replace(/\s/g, '');
    if (n.length < 8) return n;
    return n.slice(0, 6) + ' •••• ' + n.slice(-4);
}

function formatCardInput(val) {
    const n = val.replace(/\D/g, '').slice(0, 16);
    return n.replace(/(.{4})/g, '$1 ').trim();
}

function todayStr() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
}

function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('toast-exit'); setTimeout(() => el.remove(), 300); }, 3000);
}

function save() {
    try {
        localStorage.setItem('ct_cards', JSON.stringify(STATE.cards));
        localStorage.setItem('ct_docs', JSON.stringify(STATE.docs));
        localStorage.setItem('ct_notes_tabs', JSON.stringify(STATE.notesTabs));
        localStorage.setItem('ct_notes_active', STATE.notesActiveTab);
        localStorage.setItem('ct_notes', STATE.notes);
        localStorage.setItem('ct_trash', JSON.stringify(STATE.trash));
        localStorage.setItem('ct_countries', JSON.stringify(STATE.countries));
        localStorage.setItem('ct_settings', JSON.stringify(STATE.settings || {}));
        saveBinCache();
    } catch (e) {
        console.error('Save error:', e);
        toast('Storage error — data may not persist', 'error');
    }
}

function load() {
    try {
        STATE.cards = JSON.parse(localStorage.getItem('ct_cards') || '[]');
        STATE.docs = JSON.parse(localStorage.getItem('ct_docs') || '[]');
        STATE.notes = localStorage.getItem('ct_notes') || '';
        STATE.trash = JSON.parse(localStorage.getItem('ct_trash') || '[]');
        const saved = localStorage.getItem('ct_countries');
        if (saved) STATE.countries = JSON.parse(saved);
        const settings = localStorage.getItem('ct_settings');
        if (settings) STATE.settings = JSON.parse(settings);
        // Load notesTabs
        const tabsRaw = localStorage.getItem('ct_notes_tabs');
        if (tabsRaw) {
            STATE.notesTabs = JSON.parse(tabsRaw);
            STATE.notesActiveTab = localStorage.getItem('ct_notes_active') || (STATE.notesTabs[0]?.id || '');
        }
    } catch (e) {
        console.error('Load error:', e);
    }
    loadBinCache();
    ensureDataIntegrity();
    migrateNotesToTabs();
}

function migrateNotesToTabs() {
    if (STATE.notesTabs.length === 0) {
        const firstTab = {
            id: 'tab-' + Date.now(),
            title: 'Main',
            content: STATE.notes || '',
            pinned: false,
            tag: null,
            created: Date.now(),
            scrollPos: 0
        };
        STATE.notesTabs = [firstTab];
        STATE.notesActiveTab = firstTab.id;
    }
}

// Ensure every record has a unique ID and required fields
function ensureDataIntegrity() {
    const seenIds = new Set();
    function fixId(item) {
        if (!item.id || seenIds.has(item.id)) item.id = genId();
        seenIds.add(item.id);
        return item;
    }
    STATE.cards = STATE.cards.map(fixId);
    STATE.docs = STATE.docs.map(fixId);
    STATE.trash = STATE.trash.map(fixId);

    // ── Migration: link existing cards ↔ docs ──
    // Ensure every doc has cardIds array
    STATE.docs.forEach(d => { if (!d.cardIds) d.cardIds = []; });
    // Link cards that have name+surname to matching docs
    STATE.cards.forEach(card => {
        if (card.docId) return; // already linked
        const fullName = `${card.name || ''} ${card.surname || ''}`.trim().toUpperCase();
        if (!fullName || fullName === 'UNKNOWN') return;
        const doc = STATE.docs.find(d => d.fullName === fullName && d.country === card.country);
        if (doc) {
            card.docId = doc.id;
            if (!doc.cardIds.includes(card.id)) doc.cardIds.push(card.id);
        }
    });
}

// ──── AUTO DOC CREATION (with card↔doc linking) ────
function ensureDoc(card) {
    const fullName = `${card.name} ${card.surname}`.trim().toUpperCase();
    if (!fullName || fullName === 'UNKNOWN') return;
    const existing = STATE.docs.find(d => d.fullName === fullName && d.country === card.country);
    if (existing) {
        existing.use = (existing.use || 0) + 1;
        if (!existing.cardIds) existing.cardIds = [];
        if (!existing.cardIds.includes(card.id)) existing.cardIds.push(card.id);
        card.docId = existing.id;
    } else {
        const docId = genId();
        STATE.docs.push({
            id: docId,
            fullName,
            name: card.name,
            surname: card.surname,
            country: card.country,
            type: '-',
            use: 1,
            cardIds: [card.id],
            verified: 0,
            suspended: 0,
            status: 'waiting',
            date: todayStr(),
            notes: ''
        });
        card.docId = docId;
    }
}

// ──── FAVORITES LOGIC ────
// Card goes to favorites when both cardAdd AND runAds are true
function isFavorite(card) { return card.cardAdd && card.runAds; }

// ──── ACTIVE NOW LOGIC ────
// Card is in Active Now when star is toggled on
function isActiveNow(card) { return !!card.starred; }

// ──── GEO FILTER (My Card / Global Docs) ────
let _geoFilter = 'all'; // 'all' or country id

// ──── MULTI-SELECT ────
let _selectedCards = new Set();

// ──── BIN COUNT ────
function binCount(bin, countryFilter) {
    return STATE.cards.filter(c => getBin(c.cardNumber) === bin && (!countryFilter || c.country === countryFilter)).length;
}

// ──── FILTERED CARDS ────
function sortCards(cards, field, dir) {
    const mult = dir === 'asc' ? 1 : -1;

    // Pre-build BIN count map from the full cards array for efficient sort
    let binCountMap = null;
    if (field === 'bin') {
        binCountMap = {};
        cards.forEach(c => {
            const b = getBin(c.cardNumber);
            binCountMap[b] = (binCountMap[b] || 0) + 1;
        });
    }

    return [...cards].sort((a, b) => {
        let va, vb;
        switch (field) {
            case 'name':
                va = `${a.name} ${a.surname}`.toLowerCase();
                vb = `${b.name} ${b.surname}`.toLowerCase();
                return mult * va.localeCompare(vb);
            case 'notes':
                va = (a.notes || '').toLowerCase(); vb = (b.notes || '').toLowerCase();
                return mult * va.localeCompare(vb);
            case 'bin': {
                const binA = getBin(a.cardNumber);
                const binB = getBin(b.cardNumber);
                const countA = binCountMap[binA] || 0;
                const countB = binCountMap[binB] || 0;
                // Primary: sort by count (numeric)
                if (countA !== countB) return mult * (countA - countB);
                // Tiebreaker: sort by BIN value (numeric)
                return mult * (parseInt(binA, 10) - parseInt(binB, 10));
            }
            case 'type':
                va = (a.docType || '').toLowerCase(); vb = (b.docType || '').toLowerCase();
                return mult * va.localeCompare(vb);
            case 'amount':
                va = parseFloat(a.amount) || 0; vb = parseFloat(b.amount) || 0;
                return mult * (va - vb);
            case 'status':
                va = (a.verified ? 4 : 0) + (a.runAds ? 2 : 0) + (a.cardAdd ? 1 : 0);
                vb = (b.verified ? 4 : 0) + (b.runAds ? 2 : 0) + (b.cardAdd ? 1 : 0);
                return mult * (va - vb);
            case 'mail':
                va = (a.mailVerify ? 2 : 0) + (a.mailSubmit ? 1 : 0);
                vb = (b.mailVerify ? 2 : 0) + (b.mailSubmit ? 1 : 0);
                return mult * (va - vb);
            case 'date':
                va = a.date || ''; vb = b.date || '';
                // DD.MM.YY → sortable
                const pa = va.split('.'); const pb = vb.split('.');
                const da = pa.length === 3 ? `${pa[2]}-${pa[1]}-${pa[0]}` : va;
                const db = pb.length === 3 ? `${pb[2]}-${pb[1]}-${pb[0]}` : vb;
                return mult * da.localeCompare(db);
            default:
                return 0;
        }
    });
}

function getFilteredCards() {
    let cards = [];
    switch (STATE.currentView) {
        case 'cards':
            cards = STATE.cards.filter(c => c.country === STATE.currentCountry);
            break;
        case 'my-card':
            cards = [...STATE.cards];
            if (_geoFilter !== 'all') cards = cards.filter(c => c.country === _geoFilter);
            break;
        case 'favorites':
            cards = STATE.cards.filter(c => isFavorite(c));
            break;
        case 'active-now':
            cards = STATE.cards.filter(c => isActiveNow(c));
            break;
        case 'ready-to-work':
            cards = STATE.cards.filter(c => c.readyToWork === true);
            break;
        case 'all-cards': {
            // Deduplicate by card number — show only unique cards
            const seen = new Set();
            cards = STATE.cards.filter(c => {
                const num = c.cardNumber.replace(/\s/g, '');
                if (seen.has(num)) return false;
                seen.add(num);
                return true;
            });
            break;
        }
        case 'trash':
            cards = [...STATE.trash];
            break;
        default:
            cards = STATE.cards.filter(c => c.country === STATE.currentCountry);
    }
    if (STATE.search.length >= 2) {
        const s = STATE.search.toLowerCase();
        cards = cards.filter(c =>
            (c.name + ' ' + c.surname).toLowerCase().includes(s) ||
            c.cardNumber.includes(s) ||
            getBin(c.cardNumber).includes(s) ||
            (c.notes || '').toLowerCase().includes(s) ||
            (c.mailVerify && 'v-cc'.includes(s)) ||
            (c.mailSubmit && 's-doc'.includes(s))
        );
    }
    // Apply sorting
    if (STATE.sortField) {
        cards = sortCards(cards, STATE.sortField, STATE.sortDir);
    }
    return cards;
}

function getFilteredDocs() {
    let docs;
    if (STATE.currentView === 'global-docs') {
        docs = [...STATE.docs];
        if (_geoFilter !== 'all') docs = docs.filter(d => d.country === _geoFilter);
    } else {
        docs = STATE.docs.filter(d => d.country === STATE.currentCountry);
    }
    if (STATE.search.length >= 2) {
        const s = STATE.search.toLowerCase();
        docs = docs.filter(d => d.fullName.toLowerCase().includes(s) || (d.notes || '').toLowerCase().includes(s));
    }
    // Apply doc sorting
    if (STATE.docSortField) {
        const mult = STATE.docSortDir === 'asc' ? 1 : -1;
        docs = [...docs].sort((a, b) => {
            if (STATE.docSortField === 'name') {
                return mult * (a.fullName || '').localeCompare(b.fullName || '');
            }
            if (STATE.docSortField === 'notes') {
                return mult * (a.notes || '').localeCompare(b.notes || '');
            }
            if (STATE.docSortField === 'type') {
                return mult * (a.type || '').localeCompare(b.type || '');
            }
            if (STATE.docSortField === 'geo') {
                return mult * (a.country || '').localeCompare(b.country || '');
            }
            if (STATE.docSortField === 'use') {
                return mult * ((a.use || 0) - (b.use || 0));
            }
            if (STATE.docSortField === 'vs') {
                return mult * ((a.verified || 0) + (a.suspended || 0) - ((b.verified || 0) + (b.suspended || 0)));
            }
            if (STATE.docSortField === 'date') {
                const pa = (a.date || '').split('.'); const pb = (b.date || '').split('.');
                const da = pa.length === 3 ? `${pa[2]}-${pa[1]}-${pa[0]}` : a.date || '';
                const db = pb.length === 3 ? `${pb[2]}-${pb[1]}-${pb[0]}` : b.date || '';
                return mult * da.localeCompare(db);
            }
            return 0;
        });
    }
    return docs;
}

// ──── STATS ────
function getCardStats(cards) {
    return {
        total: cards.length,
        verified: cards.filter(c => c.verified).length,
        suspended: cards.filter(c => c.suspended).length,
        cardAdd: cards.filter(c => c.cardAdd).length,
        runAds: cards.filter(c => c.runAds).length,
        active: cards.filter(c => c.starred).length,
    };
}

function getMyCardStats() {
    const all = STATE.cards;
    const bins = {};
    all.forEach(c => {
        const b = getBin(c.cardNumber);
        bins[b] = (bins[b] || 0) + 1;
    });
    const topBins = Object.keys(bins).length;
    return {
        totalCards: all.length,
        cardAdd: all.filter(c => c.cardAdd).length,
        runAds: all.filter(c => c.runAds).length,
        verify: all.filter(c => c.verified).length,
        topCards: all.filter(c => c.cardAdd && c.runAds).length,
        topBins,
    };
}

function getDocStats(docs) {
    const totalV = docs.reduce((sum, d) => sum + (d.verified || 0), 0);
    const totalS = docs.reduce((sum, d) => sum + (d.suspended || 0), 0);
    const waiting = docs.filter(d => (d.verified || 0) === 0 && (d.suspended || 0) === 0).length;
    return {
        total: docs.length,
        verified: totalV,
        failed: totalS,
        waiting: waiting,
    };
}

// ══════════════════════════════════════
//          COUNT COLOR HELPER
// ══════════════════════════════════════
function getCountColor(count) {
    if (count >= 20) return 'count-red';
    if (count >= 15) return 'count-orange';
    if (count >= 10) return 'count-yellow';
    if (count >= 5) return 'count-green';
    return '';
}

// ══════════════════════════════════════
//          RENDERING
// ══════════════════════════════════════

function renderSidebar() { renderTopNav(); }

function renderTopNav() {
    const sel = document.getElementById('tn-country');
    if (sel) {
        const prev = sel.value;
        sel.innerHTML = STATE.countries.map(c => {
            const cnt = STATE.cards.filter(card => card.country === c.id).length;
            return `<option value="${c.id}">${c.flag} ${c.name} (${cnt})</option>`;
        }).join('');
        sel.value = STATE.currentCountry || (STATE.countries[0]?.id || '');
        if (!prev) sel.value = STATE.currentCountry;
    }
    document.querySelectorAll('.tn-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === STATE.currentView);
    });
    const badge = document.getElementById('badge-trash');
    if (badge) badge.textContent = STATE.trash.length || '';
}

// Top nav tab clicks
document.querySelectorAll('.tn-tab').forEach(tab => {
    tab.addEventListener('click', () => navigate(tab.dataset.view));
});

// Country dropdown
document.getElementById('tn-country')?.addEventListener('change', function () {
    navigate('cards', this.value);
});

// Settings dropdown
document.getElementById('tn-settings-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('tn-settings-dropdown')?.classList.toggle('hidden');
});
document.addEventListener('click', () => {
    document.getElementById('tn-settings-dropdown')?.classList.add('hidden');
});

// ──── TOP BINS ────
let _topBinsMode = 'count'; // 'count' or 'amount'

function updateTopBinsGeo() {
    const sel = document.getElementById('top-bins-geo');
    if (!sel) return;
    const current = sel.value;
    const geos = new Set();
    STATE.cards.forEach(c => { if (c.country) geos.add(c.country); });

    let html = '<option value="all">ALL</option>';
    STATE.countries.forEach(c => {
        if (geos.has(c.id)) {
            const code = c.id === 'canada' ? 'CA' : c.id === 'usa' ? 'US' : c.id.slice(0, 2).toUpperCase();
            html += `<option value="${c.id}">${code}</option>`;
        }
    });
    sel.innerHTML = html;
    // Restore previous selection if still valid
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

function renderTopBins() {
    const container = document.getElementById('top-bins-list');
    if (!container) return;

    const geo = document.getElementById('top-bins-geo')?.value || 'all';
    let cards = STATE.cards;
    if (geo !== 'all') cards = cards.filter(c => c.country === geo);

    if (cards.length === 0) {
        container.innerHTML = '<div class="top-bins-empty">No data</div>';
        return;
    }

    // Group by BIN (first 6 digits)
    const bins = {};
    cards.forEach(c => {
        const num = (c.cardNumber || '').replace(/[\s\-]/g, '');
        if (num.length < 6) return;
        const bin = num.slice(0, 6);

        if (!bins[bin]) bins[bin] = { count: 0, amount: 0 };
        bins[bin].count++;
        const amt = parseFloat(c.amount);
        if (!isNaN(amt)) bins[bin].amount += amt;
    });

    // Sort by mode — TOP 10
    const sorted = Object.entries(bins)
        .sort((a, b) => b[1][_topBinsMode] - a[1][_topBinsMode])
        .slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="top-bins-empty">No BINs found</div>';
        return;
    }

    const maxVal = sorted[0][1][_topBinsMode] || 1;

    container.innerHTML = sorted.map(([bin, data]) => {
        const val = _topBinsMode === 'count' ? data.count : `$${data.amount.toLocaleString()}`;
        const pct = Math.round((data[_topBinsMode] / maxVal) * 100);
        // Look up bank name from BIN_CACHE
        const cached = BIN_CACHE[bin];
        const bankName = cached ? (cached.bank || cached.issuer || 'Unknown Bank') : 'Unknown Bank';
        const shortBank = bankName.length > 18 ? bankName.slice(0, 18) + '…' : bankName;
        return `<div class="top-bins-row">
            <div class="top-bins-bar" style="width:${pct}%"></div>
            <div class="top-bins-info">
                <span class="top-bins-bin">${bin}</span>
                <span class="top-bins-bank">${shortBank}</span>
            </div>
            <span class="top-bins-val">${val}</span>
        </div>`;
    }).join('');
}

// TOP BINS event handlers
document.getElementById('top-bins-geo')?.addEventListener('change', renderTopBins);

document.querySelectorAll('.top-bins-mode').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.top-bins-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _topBinsMode = btn.dataset.mode;
        renderTopBins();
    });
});

function renderStats() {
    const bar = document.getElementById('stats-bar');

    if (['notes','generator','builder'].includes(STATE.currentView)) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'grid';

    if (STATE.currentView === 'docs' || STATE.currentView === 'global-docs') {
        const docs = getFilteredDocs();
        const s = getDocStats(docs);
        bar.innerHTML = `
            <div class="stat-card total"><span class="stat-label">Total</span><span class="stat-value">${s.total}</span></div>
            <div class="stat-card verified"><span class="stat-label">Verified</span><span class="stat-value">${s.verified}</span></div>
            <div class="stat-card failed"><span class="stat-label">Failed</span><span class="stat-value">${s.failed}</span></div>
            <div class="stat-card waiting"><span class="stat-label">Waiting</span><span class="stat-value">${s.waiting}</span></div>
        `;
        return;
    }

    if (STATE.currentView === 'my-card') {
        const s = getMyCardStats();
        bar.innerHTML = `
            <div class="stat-card total"><span class="stat-label">Total Cards</span><span class="stat-value">${s.totalCards}</span></div>
            <div class="stat-card card-add"><span class="stat-label">Card Add</span><span class="stat-value">${s.cardAdd}</span></div>
            <div class="stat-card run-ads"><span class="stat-label">Run Ads</span><span class="stat-value">${s.runAds}</span></div>
            <div class="stat-card verified"><span class="stat-label">Verify</span><span class="stat-value">${s.verify}</span></div>
            <div class="stat-card top-cards"><span class="stat-label">Top Cards</span><span class="stat-value">${s.topCards}</span></div>
            <div class="stat-card top-bins"><span class="stat-label">Top BINs</span><span class="stat-value">${s.topBins}</span></div>
        `;
        return;
    }

    // Cards view (country / favorites / active / trash)
    const cards = getFilteredCards();
    const s = getCardStats(cards);
    bar.innerHTML = `
        <div class="stat-card total"><span class="stat-label">Total</span><span class="stat-value">${s.total}</span></div>
        <div class="stat-card verified"><span class="stat-label">Verified</span><span class="stat-value">${s.verified}</span></div>
        <div class="stat-card suspended"><span class="stat-label">Suspended</span><span class="stat-value">${s.suspended}</span></div>
        <div class="stat-card card-add"><span class="stat-label">Card Add</span><span class="stat-value">${s.cardAdd}</span></div>
        <div class="stat-card run-ads"><span class="stat-label">Run Ads</span><span class="stat-value">${s.runAds}</span></div>
        <div class="stat-card active-stat"><span class="stat-label">Active</span><span class="stat-value">${s.active}</span></div>
    `;
}

function renderContent() {
    const area = document.getElementById('content-area');
    const footer = document.getElementById('table-footer');

    if (STATE.currentView === 'notes') {
        renderNotes();
        footer.style.display = 'none';
        return;
    }

    if (STATE.currentView === 'new-cards') {
        renderParser();
        footer.style.display = 'none';
        return;
    }

    if (STATE.currentView === 'generator') {
        renderGenerator();
        footer.style.display = 'none';
        return;
    }

    if (STATE.currentView === 'builder') {
        renderBuilder();
        footer.style.display = 'none';
        return;
    }
    footer.style.display = 'flex';

    if (STATE.currentView === 'docs' || STATE.currentView === 'global-docs') {
        renderDocs();
        return;
    }

    // Render cards table
    const cards = getFilteredCards();
    const start = (STATE.page - 1) * STATE.perPage;
    const pageCards = cards.slice(start, start + STATE.perPage);
    const totalPages = Math.max(1, Math.ceil(cards.length / STATE.perPage));

    if (cards.length === 0) {
        area.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
                </div>
                <p class="empty-title">No cards found</p>
                <p class="empty-text">Click "+ ADD" to add your first card</p>
            </div>
        `;
        renderFooter(0, 1, 1);
        return;
    }

    const isTrash = STATE.currentView === 'trash';
    const showName = STATE.currentView !== 'my-card' || true;
    const countryForBin = ['cards'].includes(STATE.currentView) ? STATE.currentCountry : null;

    let rows = pageCards.map((c, i) => {
        const idx = start + i + 1;
        const bin = getBin(c.cardNumber);
        const bc = binCount(bin, countryForBin);
        const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';
        const binBadge = bc > 1 ? `<span class="name-count-badge ${getCountColor(bc)}">(${bc})</span>` : '';
        const binColorClass = getCountColor(bc);

        const getMailBadge = (card) => {
            if (card.mailNone) return '';
            if (card.mailVerify || card.mailSubmit) {
                let texts = [];
                if (card.mailVerify) texts.push('CC');
                if (card.mailSubmit) texts.push('DOC');
                return `<span class="mail-badge" title="Mail Status"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M4 7l6.2 4.6c1.1.8 2.5.8 3.6 0L20 7"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg>${texts.join(' / ')}</span>`;
            }
            return '';
        };

        return `
        <tr data-id="${c.id}" class="${_selectedCards.has(c.id) ? 'row-selected' : ''}">
            <td class="td-num"><label class="bulk-check"><input type="checkbox" class="row-select-cb" data-card-id="${c.id}" ${_selectedCards.has(c.id) ? 'checked' : ''} onchange="toggleCardSelect('${c.id}', this.checked)"></label></td>
            <td>
                <div class="card-cell">
                    <span class="card-name">
                        ${!isTrash ? `<button class="star-btn ${c.starred ? 'active' : ''}" onclick="toggleStar('${c.id}')" title="Active Now">★</button>` : ''}
                        <span class="flag">${flag}</span>
                        ${c.name.toUpperCase()} ${c.surname.toUpperCase()} ${binBadge}
                    </span>
                    <span class="card-number">${maskCard(c.cardNumber)}</span>
                    ${(() => { const info = getBinInfo(getBin(c.cardNumber)); const txt = formatBinInfoText(info); return txt ? `<span class="bin-info">${txt}</span>` : `<span class="bin-info" data-bin="${getBin(c.cardNumber)}"></span>`; })()}
                </div>
            </td>
            <td class="note-indicator"><span class="editable-note" onclick="openInlineNote('${c.id}', this)">${c.notes || '<span class="note-placeholder">+ note</span>'}</span></td>
            <td class="bin-cell">${bin}</td>
            <td><span class="doc-type-badge ${c.docType ? c.docType.toLowerCase() : 'none'}" onclick="cycleCardType('${c.id}')" title="Click to change">${c.docType || '—'}</span></td>
            <td class="amt-cell"><span class="editable-amt" onclick="openInlineAmount('${c.id}', this)">${c.amount ? Number(c.amount).toLocaleString() : '-'}</span></td>
            <td class="mail-cell">
                <div class="mail-tags">
                    <button class="status-btn btn-vcc ${c.mailVerify ? 'active' : ''}" onclick="toggleMailTag('${c.id}','mailVerify')" title="Card Check">CC</button>
                    <button class="status-btn btn-sdoc ${c.mailSubmit ? 'active' : ''}" onclick="toggleMailTag('${c.id}','mailSubmit')" title="Document">DOC</button>
                </div>
            </td>
            <td>
                ${isTrash ? `
                    <button class="btn-secondary btn-restore" onclick="restoreCard('${c.id}')">Restore</button>
                ` : `
                    <div class="status-btns">
                        <button class="status-btn btn-a ${c.cardAdd ? 'active' : ''}" onclick="toggleStatus('${c.id}','cardAdd')" title="Card Add">A</button>
                        <button class="status-btn btn-r ${c.runAds ? 'active' : ''}" onclick="toggleStatus('${c.id}','runAds')" title="Run Ads">R</button>
                        <button class="status-btn btn-v ${c.verified ? 'active' : ''}" onclick="toggleStatus('${c.id}','verified')" title="Verify">V</button>
                    </div>
                `}
            </td>
            <td class="date-cell">${c.date}</td>
            <td>
                ${isTrash ? `
                    <button class="more-btn" onclick="permanentDelete('${c.id}')" title="Delete forever">✕</button>
                ` : `
                    <button class="more-btn" onclick="openContextMenu(event, '${c.id}')">⋯</button>
                `}
            </td>
        </tr>`;
    }).join('');

    const sortIcon = (field) => {
        if (STATE.sortField !== field) return '↕';
        return STATE.sortDir === 'asc' ? '↑' : '↓';
    };

    area.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th><label class="bulk-check"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></label></th>
                    <th class="sortable" data-sort="name">Card ${sortIcon('name')}</th>
                    <th class="sortable" data-sort="notes">Notes ${sortIcon('notes')}</th>
                    <th class="sortable" data-sort="bin">BIN ${sortIcon('bin')}</th>
                    <th class="sortable" data-sort="type">Type ${sortIcon('type')}</th>
                    <th class="sortable" data-sort="amount">Amt ${sortIcon('amount')}</th>
                    <th class="sortable" data-sort="mail">Mail ${sortIcon('mail')}</th>
                    <th class="sortable" data-sort="status">Status ${sortIcon('status')}</th>
                    <th class="sortable" data-sort="date">Date ${sortIcon('date')}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    // Attach sort handlers
    area.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (STATE.sortField === field) {
                STATE.sortDir = STATE.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                STATE.sortField = field;
                STATE.sortDir = 'asc';
            }
            renderContent();
        });
    });

    renderFooter(cards.length, STATE.page, totalPages);

    // Async BIN lookup for uncached rows
    const uncachedEls = area.querySelectorAll('.bin-info[data-bin]');
    if (uncachedEls.length > 0) {
        const uniqueBins = [...new Set(Array.from(uncachedEls).map(el => el.dataset.bin))];
        uniqueBins.forEach((bin, i) => {
            // Stagger requests to respect API rate limit (25/min)
            setTimeout(() => {
                lookupBin(bin).then(info => {
                    if (!info) return;
                    const txt = formatBinInfoText(info);
                    document.querySelectorAll(`.bin-info[data-bin="${bin}"]`).forEach(el => {
                        if (txt) {
                            el.textContent = txt;
                            el.removeAttribute('data-bin');
                        }
                    });
                });
            }, i * 200); // 200ms delay between each unique BIN request
        });
    }
}

function renderDocs() {
    const area = document.getElementById('content-area');
    const docs = getFilteredDocs();

    if (docs.length === 0) {
        area.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
                </div>
                <p class="empty-title">No documents yet</p>
                <p class="empty-text">Documents are created automatically when you add cards</p>
            </div>
        `;
        renderFooter(0, 1, 1);
        return;
    }

    const country = STATE.countries.find(c => c.id === STATE.currentCountry);
    const flag = country?.flag || '';
    const geoCode = STATE.currentCountry === 'canada' ? 'CA' : STATE.currentCountry === 'usa' ? 'US' : STATE.currentCountry.slice(0, 2).toUpperCase();

    const getUseColor = (use) => {
        if (!use) return '';
        if (use <= 3) return 'color: var(--green)';
        if (use <= 6) return 'color: var(--amber)';
        return 'color: var(--red)';
    };

    let rows = docs.map((d, i) => `
        <tr>
            <td class="td-num">${i + 1}</td>
            <td>
                <div class="card-cell">
                    <span class="card-name">
                        <span class="flag">${flag}</span>
                        ${d.fullName}
                    </span>
                </div>
            </td>
            <td class="note-indicator"><span class="editable-note" onclick="openDocNote('${d.id}', this)">${d.notes || '<span class="note-placeholder">+ note</span>'}</span></td>
            <td class="doc-type"><span class="doc-type-badge clickable-type ${(d.type || '').toLowerCase()}" onclick="cycleDocType('${d.id}')" title="Click to change type">${d.type && d.type !== '-' ? d.type : '-'}</span></td>
            <td><span class="geo-badge">${geoCode}</span></td>
            <td class="use-cell" style="${getUseColor(d.use || 0)}">${d.use || 0}x</td>
            <td>
                <div class="status-btns vs-counters">
                    <span class="vs-counter" data-doc-id="${d.id}" data-vs="v" onclick="incrementDocV('${d.id}')" oncontextmenu="decrementDocV('${d.id}'); return false;">${d.verified || 0}</span>
                    <span class="vs-separator">|</span>
                    <span class="vs-counter" data-doc-id="${d.id}" data-vs="s" onclick="incrementDocS('${d.id}')" oncontextmenu="decrementDocS('${d.id}'); return false;">${d.suspended || 0}</span>
                </div>
            </td>
            <td class="date-cell">${d.date}</td>
            <td><button class="more-btn" onclick="openDocMenu(event, '${d.id}')">⋯</button></td>
        </tr>
    `).join('');

    const docSortIcon = (field) => {
        if (STATE.docSortField !== field) return '↕';
        return STATE.docSortDir === 'asc' ? '↑' : '↓';
    };

    area.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th class="sortable-doc" data-sort="name">Name ${docSortIcon('name')}</th>
                    <th class="sortable-doc" data-sort="notes">Notes ${docSortIcon('notes')}</th>
                    <th class="sortable-doc" data-sort="type">Type ${docSortIcon('type')}</th>
                    <th class="sortable-doc" data-sort="geo">Geo ${docSortIcon('geo')}</th>
                    <th class="sortable-doc" data-sort="use">Use ${docSortIcon('use')}</th>
                    <th class="sortable-doc" data-sort="vs">V / S ${docSortIcon('vs')}</th>
                    <th class="sortable-doc" data-sort="date">Date ${docSortIcon('date')}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    // Attach doc sort handlers
    area.querySelectorAll('.sortable-doc').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (STATE.docSortField === field) {
                STATE.docSortDir = STATE.docSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                STATE.docSortField = field;
                STATE.docSortDir = 'asc';
            }
            renderContent();
        });
    });

    renderFooter(docs.length, 1, 1);
}

function _getActiveNoteTab() {
    return STATE.notesTabs.find(t => t.id === STATE.notesActiveTab) || STATE.notesTabs[0];
}

function _saveActiveTab() {
    const textarea = document.getElementById('notes-textarea');
    if (!textarea) return;
    const tab = _getActiveNoteTab();
    if (tab) {
        tab.content = textarea.value;
        tab.scrollPos = textarea.scrollTop;
    }
    STATE.notes = textarea.value;
    STATE.notesLastSaved = Date.now();
    save();
}

function _saveAllTabs() {
    const textarea = document.getElementById('notes-textarea');
    if (textarea) {
        const tab = _getActiveNoteTab();
        if (tab) {
            tab.content = textarea.value;
            tab.scrollPos = textarea.scrollTop;
        }
        STATE.notes = textarea.value;
    }
    STATE.notesLastSaved = Date.now();
    save();
    toast('All tabs saved', 'success');
}

function renderNotes() {
    const area = document.getElementById('content-area');
    const activeTab = _getActiveNoteTab();
    if (!activeTab) return;

    const tabs = [...STATE.notesTabs];
    const content = activeTab.content || '';
    const lines = content.split('\n');
    const lineCount = lines.length || 1;
    const lineNums = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

    let tabsHTML = tabs.map(t => {
        const isActive = t.id === STATE.notesActiveTab;
        return `<button class="nt-tab ${isActive?'active':''}" data-tab="${t.id}">
            <span class="nt-tab-title" data-tab="${t.id}">${t.title}</span>
            ${tabs.length > 1 ? `<span class="nt-tab-close" data-tab="${t.id}">×</span>` : ''}
        </button>`;
    }).join('');
    tabsHTML += `<button class="nt-new-tab" id="nt-new-tab">+</button>`;

    area.innerHTML = `
        <div class="notes-container">
            <div class="nt-tab-bar">
                <div class="nt-tabs-scroll">${tabsHTML}</div>
                <div class="nt-toolbar-right">
                    <button class="nt-tool-btn" id="notes-checker-btn">CHECKER</button>
                    <button class="nt-tool-btn" id="notes-save-btn">SAVE</button>
                </div>
            </div>
            <div class="notes-editor-wrap">
                <pre class="notes-line-numbers" id="notes-line-nums">${lineNums}</pre>
                <textarea class="notes-editor" id="notes-textarea" style="font-size:${STATE.notesFontSize}px" placeholder="Write notes...">${content}</textarea>
            </div>
            <div class="notes-status-bar">
                <span class="notes-saved-info">${lineCount} lines</span>
            </div>
        </div>
    `;

    const textarea = document.getElementById('notes-textarea');
    let _notesSaveTimer = null;
    textarea.addEventListener('input', () => {
        const nums = (textarea.value || '').split('\n').length;
        document.getElementById('notes-line-nums').textContent = Array.from({ length: nums }, (_, i) => i + 1).join('\n');
        const si = document.querySelector('.notes-saved-info');
        if (si) si.textContent = 'Editing...';
        clearTimeout(_notesSaveTimer);
        _notesSaveTimer = setTimeout(() => {
            _saveActiveTab();
            if (si) si.textContent = nums + ' lines';
        }, 600);
    });
    textarea.addEventListener('scroll', () => {
        document.getElementById('notes-line-nums').scrollTop = textarea.scrollTop;
    });
    if (activeTab.scrollPos) {
        textarea.scrollTop = activeTab.scrollPos;
        document.getElementById('notes-line-nums').scrollTop = activeTab.scrollPos;
    }

    // Tab switching
    area.querySelectorAll('.nt-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('nt-tab-close')) return;
            _saveActiveTab();
            STATE.notesActiveTab = btn.dataset.tab;
            save();
            renderNotes();
        });
    });

    // Tab close
    area.querySelectorAll('.nt-tab-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabId = btn.dataset.tab;
            if (STATE.notesTabs.length <= 1) return;
            const tab = STATE.notesTabs.find(t => t.id === tabId);
            if (tab && tab.content && tab.content.trim()) {
                if (!confirm(`Close "${tab.title}"?`)) return;
            }
            STATE.notesTabs = STATE.notesTabs.filter(t => t.id !== tabId);
            if (STATE.notesActiveTab === tabId) {
                STATE.notesActiveTab = STATE.notesTabs[0]?.id || '';
            }
            save();
            renderNotes();
        });
    });

    // Tab rename (double-click)
    area.querySelectorAll('.nt-tab-title').forEach(span => {
        span.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const tabId = span.dataset.tab;
            const tab = STATE.notesTabs.find(t => t.id === tabId);
            if (!tab) return;
            const newName = prompt('Tab name:', tab.title);
            if (newName && newName.trim()) {
                tab.title = newName.trim();
                save();
                renderNotes();
            }
        });
    });

    // New tab
    document.getElementById('nt-new-tab')?.addEventListener('click', () => {
        _saveActiveTab();
        const newTab = {
            id: 'tab-' + Date.now(),
            title: 'Tab ' + (STATE.notesTabs.length + 1),
            content: '',
            pinned: false,
            tag: null,
            created: Date.now(),
            scrollPos: 0
        };
        STATE.notesTabs.push(newTab);
        STATE.notesActiveTab = newTab.id;
        save();
        renderNotes();
    });

    // Toolbar
    document.getElementById('notes-save-btn')?.addEventListener('click', _saveAllTabs);
    document.getElementById('notes-checker-btn')?.addEventListener('click', openChecker);
}

function renderFooter(count, page, totalPages) {
    document.getElementById('records-count').textContent = `${count} records · Page ${page} of ${totalPages}`;
    document.getElementById('page-info').textContent = `Page ${page} of ${totalPages}`;
    document.getElementById('prev-page').disabled = page <= 1;
    document.getElementById('next-page').disabled = page >= totalPages;
}

function renderPageTitle() {
    const flagEl = document.getElementById('page-flag');
    const titleEl = document.getElementById('page-title-text');
    if (!flagEl || !titleEl) { /* No page title elements — using top nav tabs */
        const showAdd = ['cards', 'my-card', 'ready-to-work', 'all-cards', 'docs', 'global-docs'].includes(STATE.currentView);
        const addBtn = document.getElementById('add-card-btn');
        if (addBtn) addBtn.style.display = showAdd ? 'flex' : 'none';
        renderGeoFilterBar();
        return;
    }

    const country = STATE.countries.find(c => c.id === STATE.currentCountry);

    switch (STATE.currentView) {
        case 'cards':
            flagEl.textContent = country?.flag || '';
            titleEl.textContent = `${country?.name || ''} — Workspace`;
            break;
        case 'docs':
            flagEl.textContent = country?.flag || '';
            titleEl.textContent = `${country?.name || ''} — Documents`;
            break;
        case 'my-card':
            flagEl.textContent = '💳';
            titleEl.textContent = 'My Card';
            break;
        case 'favorites':
            flagEl.textContent = '❤️';
            titleEl.textContent = 'Favorites';
            break;
        case 'active-now':
            flagEl.textContent = '⚡';
            titleEl.textContent = 'Active Now';
            break;
        case 'notes':
            flagEl.textContent = '📝';
            titleEl.textContent = 'Notes';
            break;
        case 'new-cards':
            flagEl.textContent = '🔍';
            titleEl.textContent = 'Parser';
            break;
        case 'generator':
            flagEl.textContent = '⚙️';
            titleEl.textContent = 'Generator';
            break;
        case 'builder':
            flagEl.textContent = '🏗️';
            titleEl.textContent = 'Builder';
            break;
        case 'ready-to-work':
            flagEl.textContent = '✅';
            titleEl.textContent = 'Ready to Work';
            break;
        case 'all-cards':
            flagEl.textContent = '📦';
            titleEl.textContent = 'All Cards';
            break;
        case 'global-docs':
            flagEl.textContent = '📄';
            titleEl.textContent = 'Documents — Global';
            break;
        case 'trash':
            flagEl.textContent = '🗑️';
            titleEl.textContent = 'Trash';
            break;
    }

    // Show/hide buttons
    const showAdd = ['cards', 'my-card', 'ready-to-work', 'all-cards'].includes(STATE.currentView);

    document.getElementById('add-card-btn').style.display = showAdd ? 'flex' : 'none';

    if (STATE.currentView === 'docs' || STATE.currentView === 'global-docs') {
        document.getElementById('add-card-btn').style.display = 'flex';
        document.getElementById('add-btn-text').textContent = 'ADD DOC';
    } else {
        document.getElementById('add-btn-text').textContent = 'ADD';
    }

    // GEO filter bar for My Card and Global Docs
    renderGeoFilterBar();
}

function renderGeoFilterBar() {
    let bar = document.getElementById('geo-filter-bar');
    if (!['my-card', 'global-docs'].includes(STATE.currentView)) {
        if (bar) bar.remove();
        return;
    }

    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'geo-filter-bar';
        bar.className = 'geo-filter-bar';
        const parent = document.querySelector('.top-bar-left') || document.getElementById('stats-bar');
        if (!parent) return;
        parent.appendChild(bar);
    }

    const geos = new Set();
    const source = STATE.currentView === 'global-docs' ? STATE.docs : STATE.cards;
    source.forEach(item => { if (item.country) geos.add(item.country); });

    let html = `<button class="geo-btn ${_geoFilter === 'all' ? 'active' : ''}" onclick="setGeoFilter('all')">ALL</button>`;
    STATE.countries.forEach(c => {
        if (geos.has(c.id)) {
            const code = c.id === 'canada' ? 'CA' : c.id === 'usa' ? 'US' : c.id.slice(0, 2).toUpperCase();
            html += `<button class="geo-btn ${_geoFilter === c.id ? 'active' : ''}" onclick="setGeoFilter('${c.id}')">${code}</button>`;
        }
    });
    bar.innerHTML = html;
}

window.setGeoFilter = function(geo) {
    _geoFilter = geo;
    STATE.page = 1;
    renderAll();
};

function renderAll() {
    renderSidebar();
    renderPageTitle();
    renderStats();
    renderContent();
}

// ──── NAVIGATION ────
function navigate(view, country) {
    // Auto-save active notes tab before leaving notes view
    if (STATE.currentView === 'notes') {
        const textarea = document.getElementById('notes-textarea');
        if (textarea) {
            const tab = STATE.notesTabs.find(t => t.id === STATE.notesActiveTab);
            if (tab) {
                tab.content = textarea.value;
                tab.scrollPos = textarea.scrollTop;
            }
            STATE.notes = textarea.value;
            STATE.notesLastSaved = Date.now();
            save();
        }
    }
    STATE.currentView = view;
    if (country) STATE.currentCountry = country;
    STATE.page = 1;
    STATE.search = '';
    document.getElementById('search-input').value = '';
    renderAll();
}

window.expandCountry = function (id) {
    // Just navigate to cards
    navigate('cards', id);
};

window.deleteCountry = function (id) {
    if (['canada', 'usa'].includes(id)) return; // Cannot delete default countries
    const country = STATE.countries.find(c => c.id === id);
    if (!country) return;
    if (!confirm(`Delete "${country.name}" and all its cards/docs?`)) return;
    STATE.cards = STATE.cards.filter(c => c.country !== id);
    STATE.docs = STATE.docs.filter(d => d.country !== id);
    STATE.countries = STATE.countries.filter(c => c.id !== id);
    save();
    if (STATE.currentCountry === id) navigate('cards', 'canada');
    else renderAll();
    toast(`Country "${country.name}" deleted`, 'info');
};



// ──── CARD ACTIONS ────
window.toggleStar = function (id) {
    const card = STATE.cards.find(c => c.id === id);
    if (card) {
        card.starred = !card.starred;
        save();

        // Targeted DOM update
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            const starBtn = row.querySelector('.star-btn');
            if (starBtn) starBtn.classList.toggle('active', card.starred);
        }

        updateStatsInPlace();
        updateSidebarBadges();
        toast(card.starred ? '⭐ Added to Active Now' : 'Removed from Active Now', 'success');
    }
};

// ──── MAIL TAG TOGGLE ────
window.toggleMailTag = function (id, field) {
    const card = STATE.cards.find(c => c.id === id);
    if (!card) return;
    card[field] = !card[field];
    // If enabling a mail status, disable mailNone
    if (card[field]) card.mailNone = false;
    // If both are off, keep as-is (user can set mailNone from edit modal)
    save();
    renderContent();
    const label = field === 'mailVerify' ? 'CC' : 'DOC';
    toast(card[field] ? `✉ ${label}: ON` : `${label}: OFF`, 'success');
};

// ──── TYPE TOGGLE (PP ↔ DL) ────
window.cycleCardType = function (id) {
    const card = STATE.cards.find(c => c.id === id);
    if (!card) return;
    const types = ['PP', 'DL', ''];
    const current = types.indexOf(card.docType || '');
    card.docType = types[(current + 1) % types.length];
    save();
    renderAll();
    toast(`Type: ${card.docType || 'None'}`, 'info');
};

window.cycleDocTypeInline = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    const types = ['PP', 'DL', '-'];
    const current = types.indexOf(doc.type || '-');
    doc.type = types[(current + 1) % types.length];
    save();
    renderAll();
    toast(`Type: ${doc.type}`, 'info');
};

window.toggleStatus = function (id, field) {
    const card = STATE.cards.find(c => c.id === id);
    if (card) {
        card[field] = !card[field];

        // V/R mutual exclusion: V and R cannot be active at the same time
        if (field === 'verified' && card.verified) {
            card.runAds = false;
        } else if (field === 'runAds' && card.runAds) {
            card.verified = false;
        }

        save();

        // Targeted DOM update: toggle button classes without re-render
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            const btnA = row.querySelector('.status-btn.btn-a');
            const btnR = row.querySelector('.status-btn.btn-r');
            const btnV = row.querySelector('.status-btn.btn-v');
            if (btnA) btnA.classList.toggle('active', card.cardAdd);
            if (btnR) btnR.classList.toggle('active', card.runAds);
            if (btnV) btnV.classList.toggle('active', card.verified);
        }

        // Update stat counters in-place
        updateStatsInPlace();
        updateSidebarBadges();

        const labels = { cardAdd: 'Card Add', runAds: 'Run Ads', verified: 'Verified' };
        toast(`${labels[field]}: ${card[field] ? 'ON' : 'OFF'}`, card[field] ? 'success' : 'info');
    }
};

window.restoreCard = function (id) {
    const idx = STATE.trash.findIndex(c => c.id === id);
    if (idx >= 0) {
        const card = STATE.trash.splice(idx, 1)[0];
        STATE.cards.push(card);
        save();
        renderAll();
        toast('Card restored', 'success');
    }
};

window.permanentDelete = function (id) {
    STATE.trash = STATE.trash.filter(c => c.id !== id);
    save();
    renderAll();
    toast('Permanently deleted', 'info');
};

// ──── MULTI-SELECT ACTIONS ────

function toggleCardSelect(id, checked) {
    if (checked) _selectedCards.add(id);
    else _selectedCards.delete(id);
    // Update row highlight
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) row.classList.toggle('row-selected', checked);
    // Update select-all checkbox state
    const allCb = document.getElementById('select-all-cb');
    if (allCb) {
        const allCbs = document.querySelectorAll('.row-select-cb');
        allCb.checked = allCbs.length > 0 && _selectedCards.size >= allCbs.length;
    }
    updateBulkBar();
}

function toggleSelectAll(checked) {
    document.querySelectorAll('.row-select-cb').forEach(cb => {
        const id = cb.dataset.cardId;
        cb.checked = checked;
        if (checked) _selectedCards.add(id);
        else _selectedCards.delete(id);
        const row = cb.closest('tr');
        if (row) row.classList.toggle('row-selected', checked);
    });
    updateBulkBar();
}

function updateBulkBar() {
    let bar = document.getElementById('bulk-action-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'bulk-action-bar';
        bar.className = 'bulk-action-bar hidden';
        bar.innerHTML = `
            <span class="bulk-count"></span>
            <button class="bulk-btn bulk-copy" onclick="bulkCopyCards()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
                Copy All
            </button>
            <button class="bulk-btn bulk-delete" onclick="bulkDeleteCards()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                Delete
            </button>
            <button class="bulk-btn bulk-clear" onclick="clearSelection()">✕</button>
        `;
        document.body.appendChild(bar);
    }
    const count = _selectedCards.size;
    if (count > 0) {
        bar.classList.remove('hidden');
        bar.querySelector('.bulk-count').textContent = `${count} selected`;
    } else {
        bar.classList.add('hidden');
    }
}

function formatCardForCopy(card) {
    const bin = getBin(card.cardNumber);
    const binInfo = getBinInfo(bin);
    const bank = binInfo?.bank || '';
    const cType = binInfo?.type || card.cardType || '';
    const mm = card.month || card.mm || '';
    const yy = card.year || card.yy || '';
    const cvv = card.cvv || '';
    const lines = [`${card.cardNumber} ${mm} ${yy} ${cvv}`];
    if (card.name || card.surname) lines.push(`${card.name || ''} ${card.surname || ''}`.trim());
    if (bank || cType) lines.push(`${bank} ${cType}`.trim());
    return lines.join('\n');
}

function bulkCopyCards() {
    const cards = STATE.cards.filter(c => _selectedCards.has(c.id));
    if (cards.length === 0) return;
    const text = cards.map(c => formatCardForCopy(c)).join('\n\n');
    navigator.clipboard?.writeText(text);
    toast(`${cards.length} cards copied`, 'success');
    clearSelection();
}

function bulkDeleteCards() {
    const ids = [..._selectedCards];
    const cards = STATE.cards.filter(c => ids.includes(c.id));
    if (cards.length === 0) return;
    STATE.trash.push(...cards);
    STATE.cards = STATE.cards.filter(c => !ids.includes(c.id));
    save();
    clearSelection();
    renderAll();
    toast(`${cards.length} cards moved to trash`, 'info');
}

function clearSelection() {
    _selectedCards.clear();
    document.querySelectorAll('.row-select-cb').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.row-selected').forEach(r => r.classList.remove('row-selected'));
    const allCb = document.getElementById('select-all-cb');
    if (allCb) allCb.checked = false;
    updateBulkBar();
}

// ──── CONTEXT MENU ────
const CARD_MENU_HTML = `
    <button class="ctx-item" data-action="copy">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
        Copy
    </button>
    <button class="ctx-item" data-action="edit">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
        Edit
    </button>
    <button class="ctx-item" data-action="clone">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z"/><path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z"/></svg>
        Clone
    </button>
    <div class="ctx-divider"></div>
    <button class="ctx-item danger" data-action="delete">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        Delete
    </button>
`;

function handleCardMenuAction(action) {
    const card = STATE.cards.find(c => c.id === STATE.contextCardId);
    if (!card) return;
    switch (action) {
        case 'copy': {
            const text = formatCardForCopy(card);
            navigator.clipboard?.writeText(text);
            toast('Copied to clipboard', 'success');
            break;
        }
        case 'edit':
            openEditModal(card);
            break;
        case 'clone': {
            const clone = { ...card, id: genId(), date: todayStr() };
            STATE.cards.push(clone);
            ensureDoc(clone);
            save();
            renderAll();
            toast('Card cloned', 'success');
            break;
        }
        case 'delete':
            STATE.cards = STATE.cards.filter(c => c.id !== card.id);
            STATE.trash.push({ ...card, deletedAt: todayStr() });
            save();
            renderAll();
            toast('Moved to trash', 'info');
            break;
    }
}

window.openContextMenu = function (e, id) {
    e.stopPropagation();
    STATE.contextCardId = id;
    const menu = document.getElementById('context-menu');
    menu.innerHTML = CARD_MENU_HTML;
    menu.classList.remove('hidden');
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    menu.querySelectorAll('.ctx-item').forEach(btn => {
        btn.addEventListener('click', () => {
            handleCardMenuAction(btn.dataset.action);
            menu.classList.add('hidden');
        }, { once: true });
    });
};

window.openDocMenu = function (e, id) {
    e.stopPropagation();
    STATE.contextDocId = id;
    const menu = document.getElementById('context-menu');
    // Show doc-specific menu
    menu.innerHTML = `
        <button class="ctx-item" data-action="edit-doc">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
            Edit Notes
        </button>
        <button class="ctx-item" data-action="change-doc-type">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
            Change Type
        </button>
        <div class="ctx-divider"></div>
        <button class="ctx-item danger" data-action="delete-doc">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            Delete
        </button>
    `;
    menu.classList.remove('hidden');
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // Attach doc menu handlers
    menu.querySelectorAll('.ctx-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const doc = STATE.docs.find(d => d.id === STATE.contextDocId);
            if (!doc) return;
            menu.classList.add('hidden');
            switch (action) {
                case 'edit-doc': {
                    showMiniModal('Edit Note', doc.fullName, doc.notes || '', 'Add note...', (val) => {
                        doc.notes = val.trim();
                        save();
                        renderAll();
                        toast('Doc note updated', 'success');
                    });
                    break;
                }
                case 'change-doc-type': {
                    showMiniModal('Change Type', doc.fullName, doc.type || '', 'DL / PP', (val) => {
                        doc.type = val.toUpperCase().trim() || '-';
                        save();
                        renderAll();
                        toast('Doc type updated', 'success');
                    });
                    break;
                }
                case 'delete-doc': {
                    showMiniModal('Delete Document', 'Type DELETE to confirm removal of ' + doc.fullName, '', 'DELETE', (val) => {
                        if (val.toUpperCase() === 'DELETE') {
                            STATE.docs = STATE.docs.filter(d => d.id !== doc.id);
                            save();
                            renderAll();
                            toast('Document deleted', 'info');
                        } else {
                            toast('Deletion cancelled', 'error');
                        }
                    });
                    break;
                }
            }
        }, { once: true });
    });
};

// Context menu close is now handled by the dropdown close handler below

// ──── MINI-MODAL UTILITY ────
// Replaces all prompt() calls with a themed dark modal
function showMiniModal(title, label, currentValue, placeholder, callback) {
    const overlay = document.getElementById('mini-modal-overlay');
    const input = document.getElementById('mini-modal-input');
    const titleEl = document.getElementById('mini-modal-title');
    const labelEl = document.getElementById('mini-modal-label');
    const saveBtn = document.getElementById('mini-modal-save');
    const cancelBtn = document.getElementById('mini-modal-cancel');
    const closeBtn = document.getElementById('mini-modal-close');

    titleEl.textContent = title;
    labelEl.textContent = label;
    input.value = currentValue || '';
    input.placeholder = placeholder || '';
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');

    // Focus input after animation
    setTimeout(() => input.focus(), 100);

    function cleanup() {
        overlay.classList.add('hidden');
        document.body.classList.remove('modal-open');
        saveBtn.removeEventListener('click', onSave);
        cancelBtn.removeEventListener('click', onCancel);
        closeBtn.removeEventListener('click', onCancel);
        input.removeEventListener('keydown', onKeydown);
        overlay.removeEventListener('click', onOverlayClick);
    }

    function onSave() {
        const val = input.value;
        cleanup();
        callback(val);
    }

    function onCancel() {
        cleanup();
    }

    function onKeydown(e) {
        if (e.key === 'Enter') { e.preventDefault(); onSave(); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }

    function onOverlayClick(e) {
        if (e.target === overlay) onCancel();
    }

    saveBtn.addEventListener('click', onSave);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', onOverlayClick);
}

// ──── NOTE & AMOUNT EDITING (inline) ────
window.openInlineNote = function (cardId, el) {
    const card = STATE.cards.find(c => c.id === cardId);
    if (!card) return;
    if (el.querySelector('input')) return;
    
    const originalHTML = el.innerHTML;
    
    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = card.notes || '';
    input.placeholder = 'Add note...';
    
    // Replace content
    el.innerHTML = '';
    el.appendChild(input);
    input.focus();
    
    let saved = false;
    const saveNote = () => {
        if (saved) return;
        saved = true;
        card.notes = input.value.trim();
        save();
        // Targeted DOM restore without re-render
        el.innerHTML = card.notes || '<span class="note-placeholder">+ note</span>';
    };
    
    const cancelNote = () => {
        if (saved) return;
        saved = true;
        el.innerHTML = originalHTML;
    };
    
    input.addEventListener('blur', saveNote);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveNote(); input.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelNote(); input.blur(); }
    });
};

window.openDocNote = function (docId, el) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    if (el.querySelector('input')) return;
    
    const originalHTML = el.innerHTML;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = doc.notes || '';
    input.placeholder = 'Add note...';
    
    el.innerHTML = '';
    el.appendChild(input);
    input.focus();
    
    let saved = false;
    const saveNote = () => {
        if (saved) return;
        saved = true;
        doc.notes = input.value.trim();
        save();
        el.innerHTML = doc.notes || '<span class="note-placeholder">+ note</span>';
    };
    
    const cancelNote = () => {
        if (saved) return;
        saved = true;
        el.innerHTML = originalHTML;
    };
    
    input.addEventListener('blur', saveNote);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveNote(); input.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelNote(); input.blur(); }
    });
};

window.openInlineAmount = function(cardId, el) {
    const card = STATE.cards.find(c => c.id === cardId);
    if (!card) return;
    if (el.querySelector('input')) return;

    const originalHTML = el.innerHTML;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = card.amount || '';
    input.placeholder = 'Amount';

    el.innerHTML = '';
    el.appendChild(input);
    input.focus();
    input.select();

    let saved = false;
    const saveAmount = () => {
        if (saved) return;
        saved = true;
        const val = input.value.trim();
        card.amount = val ? val : null;
        save();
        el.innerHTML = card.amount ? Number(card.amount).toLocaleString() : '-';
    };

    const cancelAmount = () => {
        if (saved) return;
        saved = true;
        el.innerHTML = originalHTML;
    };

    input.addEventListener('blur', saveAmount);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveAmount(); input.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelAmount(); input.blur(); }
    });
};


// ──── TARGETED UI UPDATES (no re-render) ────
function updateStatsInPlace() {
    const bar = document.getElementById('stats-bar');
    if (!bar) return;

    if (STATE.currentView === 'docs') {
        const docs = getFilteredDocs();
        const s = getDocStats(docs);
        const statCards = bar.querySelectorAll('.stat-card');
        if (statCards.length >= 4) {
            statCards[0].querySelector('.stat-value').textContent = s.total;
            statCards[1].querySelector('.stat-value').textContent = s.verified;
            statCards[2].querySelector('.stat-value').textContent = s.failed;
            statCards[3].querySelector('.stat-value').textContent = s.waiting;
        }
    } else if (STATE.currentView === 'my-card') {
        const s = getMyCardStats();
        const statCards = bar.querySelectorAll('.stat-card');
        if (statCards.length >= 6) {
            statCards[0].querySelector('.stat-value').textContent = s.totalCards;
            statCards[1].querySelector('.stat-value').textContent = s.cardAdd;
            statCards[2].querySelector('.stat-value').textContent = s.runAds;
            statCards[3].querySelector('.stat-value').textContent = s.verify;
            statCards[4].querySelector('.stat-value').textContent = s.topCards;
            statCards[5].querySelector('.stat-value').textContent = s.topBins;
        }
    } else if (['cards', 'favorites', 'active-now', 'trash'].includes(STATE.currentView)) {
        const cards = getFilteredCards();
        const s = getCardStats(cards);
        const statCards = bar.querySelectorAll('.stat-card');
        if (statCards.length >= 6) {
            statCards[0].querySelector('.stat-value').textContent = s.total;
            statCards[1].querySelector('.stat-value').textContent = s.verified;
            statCards[2].querySelector('.stat-value').textContent = s.suspended;
            statCards[3].querySelector('.stat-value').textContent = s.cardAdd;
            statCards[4].querySelector('.stat-value').textContent = s.runAds;
            statCards[5].querySelector('.stat-value').textContent = s.active;
        }
    }
}

function updateSidebarBadges() {
    const allCardsBadge = document.getElementById('badge-all-cards');
    const favBadge = document.getElementById('badge-favorites');
    const activeBadge = document.getElementById('badge-active');
    const trashBadge = document.getElementById('badge-trash');
    if (allCardsBadge) allCardsBadge.textContent = STATE.cards.length;
    if (favBadge) favBadge.textContent = STATE.cards.filter(c => isFavorite(c)).length;
    if (activeBadge) activeBadge.textContent = STATE.cards.filter(c => isActiveNow(c)).length;
    if (trashBadge) trashBadge.textContent = STATE.trash.length;

    // Update country card counts
    document.querySelectorAll('.country-item').forEach(item => {
        const countryId = item.dataset.country;
        if (countryId) {
            const countryCards = STATE.cards.filter(c => c.country === countryId);
            const countryDocs = STATE.docs.filter(d => d.country === countryId);
            const countEl = item.querySelector('.country-count');
            if (countEl) countEl.textContent = countryCards.length + countryDocs.length;
        }
    });

    // Update nav badges for cards/docs under each country
    document.querySelectorAll('.country-sub .nav-item').forEach(navItem => {
        const badge = navItem.querySelector('.nav-badge');
        if (!badge) return;
        const onclick = navItem.getAttribute('onclick') || '';
        const match = onclick.match(/navigate\('(\w+)',\s*'([^']+)'\)/);
        if (match) {
            const [, view, countryId] = match;
            if (view === 'cards') {
                badge.textContent = STATE.cards.filter(c => c.country === countryId).length;
            } else if (view === 'docs') {
                badge.textContent = STATE.docs.filter(d => d.country === countryId).length;
            }
        }
    });
}

// ──── DOC V/S COUNTERS ────
function updateDocStatsBar() {
    updateStatsInPlace();
}

window.incrementDocV = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.verified = (doc.verified || 0) + 1;
    save();
    const el = document.querySelector(`.vs-counter[data-doc-id="${docId}"][data-vs="v"]`);
    if (el) el.textContent = doc.verified;
    updateDocStatsBar();
};

window.incrementDocS = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.suspended = (doc.suspended || 0) + 1;
    save();
    const el = document.querySelector(`.vs-counter[data-doc-id="${docId}"][data-vs="s"]`);
    if (el) el.textContent = doc.suspended;
    updateDocStatsBar();
};

window.decrementDocV = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.verified = Math.max(0, (doc.verified || 0) - 1);
    save();
    const el = document.querySelector(`.vs-counter[data-doc-id="${docId}"][data-vs="v"]`);
    if (el) el.textContent = doc.verified;
    updateDocStatsBar();
};

window.decrementDocS = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.suspended = Math.max(0, (doc.suspended || 0) - 1);
    save();
    const el = document.querySelector(`.vs-counter[data-doc-id="${docId}"][data-vs="s"]`);
    if (el) el.textContent = doc.suspended;
    updateDocStatsBar();
};

// ──── DOC TYPE CYCLE ────
window.cycleDocType = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    const types = ['-', 'PP', 'DL'];
    const current = doc.type || '-';
    const idx = types.indexOf(current);
    doc.type = types[(idx + 1) % types.length];
    save();
    renderAll();
};

// ──── DOC MODAL ────
let _docParseTimer = null;

function openDocModal() {
    const overlay = document.getElementById('add-doc-overlay');
    overlay.classList.remove('hidden');

    // Populate country dropdown
    const countrySelect = document.getElementById('doc-list-country');
    countrySelect.innerHTML = STATE.countries.map(c =>
        `<option value="${c.id}" ${c.id === STATE.currentCountry ? 'selected' : ''}>${c.flag} ${c.name}</option>`
    ).join('');

    // Reset fields
    document.getElementById('doc-list-type').value = 'PP';
    document.getElementById('doc-list-status').value = 'waiting';
    document.getElementById('doc-list-quality').value = 'original';
    document.getElementById('doc-list-notes').value = '';
    document.getElementById('doc-list-textarea').value = '';
    document.getElementById('doc-list-parsed-count').textContent = '0 documents detected';
    document.getElementById('doc-list-parsed-count').classList.remove('has-cards');
    document.getElementById('doc-list-preview').innerHTML = '';
    document.getElementById('doc-save-btn-text').textContent = 'Add Documents';

    setTimeout(() => document.getElementById('doc-list-textarea').focus(), 100);
}

function closeDocModal() {
    document.getElementById('add-doc-overlay').classList.add('hidden');
}

// Doc modal close btn
document.getElementById('doc-modal-close').addEventListener('click', closeDocModal);
document.getElementById('doc-modal-cancel').addEventListener('click', closeDocModal);
document.getElementById('add-doc-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'add-doc-overlay') closeDocModal();
});

// Doc list textarea — live parsing with debounce
document.getElementById('doc-list-textarea').addEventListener('input', function () {
    clearTimeout(_docParseTimer);
    _docParseTimer = setTimeout(() => {
        const lines = this.value.split('\n').filter(l => l.trim());
        const count = lines.length;
        const countEl = document.getElementById('doc-list-parsed-count');
        countEl.textContent = `${count} document${count !== 1 ? 's' : ''} detected`;
        countEl.classList.toggle('has-cards', count > 0);
        document.getElementById('doc-save-btn-text').textContent = count > 0 ? `Add ${count} Documents` : 'Add Documents';

        // Preview first 5
        const previewEl = document.getElementById('doc-list-preview');
        if (count === 0) { previewEl.innerHTML = ''; return; }
        const preview = lines.slice(0, 5).map(l => {
            const name = l.trim().toUpperCase();
            return `<div class="list-preview-row">${name}</div>`;
        }).join('');
        const more = count > 5 ? `<div class="list-preview-more">...and ${count - 5} more</div>` : '';
        previewEl.innerHTML = preview + more;
    }, 300);
});

// Doc modal save — bulk import
document.getElementById('doc-modal-save').addEventListener('click', () => {
    const textarea = document.getElementById('doc-list-textarea');
    const lines = textarea.value.split('\n').filter(l => l.trim());

    if (lines.length === 0) {
        toast('Paste at least one name', 'error');
        return;
    }

    const country = document.getElementById('doc-list-country').value;
    const docType = document.getElementById('doc-list-type').value;
    const status = document.getElementById('doc-list-status').value;
    const quality = document.getElementById('doc-list-quality').value;
    const sharedNotes = document.getElementById('doc-list-notes').value.trim();

    // Map status to verified/suspended values
    let verified = 0, suspended = 0, statusStr = 'waiting';
    switch (status) {
        case 'verified': verified = 1; statusStr = 'verified'; break;
        case 'failed': suspended = 1; statusStr = 'failed'; break;
        case 'waiting': statusStr = 'waiting'; break;
        case 'none': statusStr = ''; break;
    }

    const dateStr = todayStr();
    let added = 0;

    lines.forEach(line => {
        const fullName = line.trim().toUpperCase();
        if (!fullName) return;

        // Check for duplicate by fullName + country
        if (STATE.docs.find(d => d.fullName === fullName && d.country === country)) return;

        const parts = fullName.split(/\s+/);
        const name = parts[0] || '';
        const surname = parts.slice(1).join(' ') || '';

        STATE.docs.push({
            id: genId(),
            fullName,
            name,
            surname,
            type: docType,
            quality,
            notes: sharedNotes,
            verified,
            suspended,
            status: statusStr,
            use: 1,
            country,
            date: dateStr,
        });
        added++;
    });

    if (added > 0) {
        save();
        renderAll();
        closeDocModal();
        toast(`${added} documents added`, 'success');
    } else {
        toast('All names already exist (duplicates)', 'info');
    }
});

// ──── SIDEBAR TOGGLE (Mobile) ────
document.getElementById('toggle-sidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// ──── ADD CARD MODAL ────
const modalOverlay = document.getElementById('modal-overlay');
const editOverlay = document.getElementById('edit-modal-overlay');

document.getElementById('add-card-btn').addEventListener('click', () => {
    if (STATE.currentView === 'docs') {
        openDocModal();
    } else {
        openAddModal();
    }
});

// Mail Checkboxes Mutually Exclusive Logic
document.getElementById('form-mail-none').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('form-mail-verify').checked = false;
        document.getElementById('form-mail-submit').checked = false;
    }
});
const uncheckMailNone = () => {
    document.getElementById('form-mail-none').checked = false;
};
document.getElementById('form-mail-verify').addEventListener('change', uncheckMailNone);
document.getElementById('form-mail-submit').addEventListener('change', uncheckMailNone);

function openAddModal() {
    resetForm();
    populateCountrySelects();
    modalOverlay.classList.remove('hidden');
}

function resetForm() {
    document.getElementById('form-name').value = '';
    document.getElementById('form-surname').value = '';
    document.getElementById('form-card').value = '';
    document.getElementById('form-month').value = '';
    document.getElementById('form-year').value = '';
    document.getElementById('form-cvv').value = '';
    document.getElementById('form-amount').value = '';
    document.getElementById('form-notes').value = '';
    document.getElementById('form-status-add').checked = false;
    document.getElementById('form-status-ads').checked = false;
    document.getElementById('form-status-verify').checked = false;
    document.getElementById('form-mail-verify').checked = false;
    document.getElementById('form-mail-submit').checked = false;
    document.getElementById('form-mail-none').checked = false;
    document.getElementById('card-type-badge').textContent = '';
    // Clear BIN info form element if present
    const binFormEl = document.getElementById('card-type-badge')?.parentElement?.querySelector('.bin-info-form');
    if (binFormEl) binFormEl.remove();
    document.getElementById('list-textarea').value = '';
    document.getElementById('list-parsed-count').textContent = '0 cards detected';
    // Reset to form tab (scoped to card modal only)
    const cardModal = document.getElementById('add-card-modal');
    cardModal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    cardModal.querySelector('.modal-tab[data-tab="form"]').classList.add('active');
    document.getElementById('form-tab').classList.add('active');
    document.getElementById('list-tab').classList.remove('active');
    document.getElementById('save-btn-text').textContent = 'Add Card';
}

function populateCountrySelects() {
    const formSel = document.getElementById('form-country');
    const listSel = document.getElementById('list-country');
    const opts = STATE.countries.map(c => `<option value="${c.id}" ${c.id === STATE.currentCountry ? 'selected' : ''}>${c.flag} ${c.name}</option>`).join('');
    formSel.innerHTML = opts;
    listSel.innerHTML = opts;

    // Populate doc select — static document types only
    const docSel = document.getElementById('form-doc');
    docSel.innerHTML = '<option value="">Select...</option><option value="PP">PP (Passport)</option><option value="DL">DL (Driver License)</option>';
}

// Modal tabs (scoped to card modal only)
const cardModalEl = document.getElementById('add-card-modal');
cardModalEl.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        cardModalEl.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        cardModalEl.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-tab').classList.add('active');

        const isForm = tab.dataset.tab === 'form';
        document.getElementById('save-btn-text').textContent = isForm ? 'Add Card' : 'Add Cards';
    });
});

// Card number formatting + BIN lookup
document.getElementById('form-card').addEventListener('input', function () {
    this.value = formatCardInput(this.value);
    const type = getCardType(this.value);
    document.getElementById('card-type-badge').textContent = type;
    // BIN lookup when 6+ digits typed
    const digits = this.value.replace(/\s/g, '');
    if (digits.length >= 6) {
        const bin = digits.slice(0, 6);
        const cached = getBinInfo(bin);
        if (cached) {
            showFormBinInfo(cached, 'card-type-badge');
        } else {
            lookupBin(bin).then(info => {
                if (info) showFormBinInfo(info, 'card-type-badge');
            });
        }
    }
});

function showFormBinInfo(info, badgeId) {
    const badge = document.getElementById(badgeId);
    if (!badge || !info || info.error) return;
    const parts = [];
    if (info.brand) parts.push(info.brand);
    if (info.type) parts.push(info.type);
    badge.textContent = parts.join(' • ');
    // Show bank name below
    let bankEl = badge.parentElement.querySelector('.bin-info-form');
    if (!bankEl) {
        bankEl = document.createElement('span');
        bankEl.className = 'bin-info-form';
        badge.parentElement.appendChild(bankEl);
    }
    const bankParts = [];
    if (info.bank) bankParts.push(info.bank);
    if (info.country) bankParts.push(info.country);
    bankEl.textContent = bankParts.join(' • ');
}

document.getElementById('edit-card')?.addEventListener('input', function () {
    this.value = formatCardInput(this.value);
    const type = getCardType(this.value);
    document.getElementById('edit-card-type-badge').textContent = type;
    const digits = this.value.replace(/\s/g, '');
    if (digits.length >= 6) {
        const bin = digits.slice(0, 6);
        const cached = getBinInfo(bin);
        if (cached) {
            showFormBinInfo(cached, 'edit-card-type-badge');
        } else {
            lookupBin(bin).then(info => {
                if (info) showFormBinInfo(info, 'edit-card-type-badge');
            });
        }
    }
});

// ──── SMART LIST PARSER ────
let _listParseTimer = null;
let _listParsedCards = [];

function smartParseCards(text) {
    const lines = text.split('\n');
    const cards = [];
    const seen = new Set();
    const noiseWords = new Set(['cvv','exp','cc','card','visa','mastercard','amex','discover','jcb','bin','the','and','or','of']);

    for (const rawLine of lines) {
        let line = rawLine.trim();
        if (!line) continue;

        // Normalize pipe/semicolon separators to spaces
        const normalized = line.replace(/[|;]/g, ' ');

        // ── Step 1: Extract card number ──
        let cardMatch = normalized.match(/\b(\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{3,4})\b/);
        if (!cardMatch) {
            cardMatch = normalized.match(/\b(\d{13,19})\b/);
        }
        if (!cardMatch) continue;

        const cardNum = cardMatch[1].replace(/[\s\-]/g, '');
        if (cardNum.length < 13 || cardNum.length > 19) continue;
        if (seen.has(cardNum)) continue;
        seen.add(cardNum);

        // Everything after card number
        let rest = normalized.replace(cardMatch[0], ' ').trim();

        // ── Step 2: Extract expiry + CVV ──
        let mm = '', yy = '', cvv = '';

        // Try format: MM/YY CVV  (slash/dot/dash separated)
        const expSlash = rest.match(/\b(0[1-9]|1[0-2])\s*[\/\.\-]\s*(\d{2})\b/);
        if (expSlash) {
            mm = expSlash[1];
            yy = expSlash[2];
            rest = rest.replace(expSlash[0], ' ').trim();
            // Next 3-4 digit number = CVV
            const cvvM = rest.match(/\b(\d{3,4})\b/);
            if (cvvM) {
                cvv = cvvM[1];
                rest = rest.replace(cvvM[0], ' ').trim();
            }
        } else {
            // Try format: MM YY CVV  (space-separated, sequential)
            const seqMatch = rest.match(/\b(0[1-9]|1[0-2])\s+(\d{2})\s+(\d{3,4})\b/);
            if (seqMatch) {
                mm = seqMatch[1];
                yy = seqMatch[2];
                cvv = seqMatch[3];
                rest = rest.replace(seqMatch[0], ' ').trim();
            } else {
                // Fallback: grab any 3-4 digit as CVV
                const nums = rest.match(/\b(\d{3,4})\b/g);
                if (nums) {
                    for (const n of nums) {
                        if (n !== cardNum.slice(-4)) {
                            cvv = n;
                            rest = rest.replace(new RegExp('\\b' + n + '\\b'), ' ');
                            break;
                        }
                    }
                }
            }
        }

        // ── Step 3: Extract names from remaining text ──
        let name = '', surname = '';
        const nameText = rest.replace(/\d+/g, ' ').replace(/[^a-zA-Zа-яА-ЯёЁ\s]/g, ' ').trim();
        const nameWords = nameText.split(/\s+/).filter(w => w.length >= 2 && !noiseWords.has(w.toLowerCase()));
        if (nameWords.length >= 1) {
            name = nameWords[0].charAt(0).toUpperCase() + nameWords[0].slice(1).toLowerCase();
        }
        if (nameWords.length >= 2) {
            surname = nameWords.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }

        cards.push({ cardNum, mm, yy, cvv, name, surname });
    }

    return cards;
}

function renderListPreview(cards) {
    const el = document.getElementById('list-preview');
    if (!el) return;
    if (cards.length === 0) {
        el.innerHTML = '';
        return;
    }

    const withName = cards.filter(c => c.name).length;

    const preview = cards.slice(0, 8).map(c => {
        const masked = c.cardNum.replace(/(\d{4})(\d+)(\d{4})/, '$1 •••• $3');
        const exp = c.mm && c.yy ? `${c.mm}/${c.yy}` : '——';
        const cvv = c.cvv || '———';
        const holder = c.name ? `<span class="list-holder">${c.name} ${c.surname || ''}</span>` : '';
        return `<div class="list-preview-row">${masked} <span class="list-sep">|</span> ${exp} <span class="list-sep">|</span> ${cvv} ${holder}</div>`;
    }).join('');

    const more = cards.length > 8 ? `<div class="list-preview-more">...and ${cards.length - 8} more</div>` : '';
    const stats = `<div class="list-stats-badge">✔️ ${cards.length} cards · ${withName} docs · ${withName} links</div>`;
    el.innerHTML = stats + preview + more;
}

document.getElementById('list-textarea').addEventListener('input', function () {
    clearTimeout(_listParseTimer);
    _listParseTimer = setTimeout(() => {
        _listParsedCards = smartParseCards(this.value);
        const count = _listParsedCards.length;
        const countEl = document.getElementById('list-parsed-count');
        countEl.textContent = `${count} card${count !== 1 ? 's' : ''} detected`;
        countEl.classList.toggle('has-cards', count > 0);
        document.getElementById('save-btn-text').textContent = count > 0 ? `Add ${count} Cards` : 'Add Cards';
        renderListPreview(_listParsedCards);
    }, 300);
});

// Save modal
document.getElementById('modal-save').addEventListener('click', () => {
    const isForm = document.querySelector('.modal-tab[data-tab="form"]').classList.contains('active');

    if (isForm) {
        const name = document.getElementById('form-name').value.trim();
        const surname = document.getElementById('form-surname').value.trim();
        const cardNum = document.getElementById('form-card').value.replace(/\s/g, '');
        const month = document.getElementById('form-month').value.trim();
        const year = document.getElementById('form-year').value.trim();
        const cvv = document.getElementById('form-cvv').value.trim();

        if (!name || !surname || cardNum.length < 13 || !month || !year || !cvv) {
            toast('Please fill all required fields', 'error');
            return;
        }

        const card = {
            id: genId(),
            name, surname,
            cardNumber: cardNum,
            month, year, cvv,
            cardType: getCardType(cardNum),
            docType: null,
            amount: document.getElementById('form-amount').value || 0,
            notes: document.getElementById('form-notes').value,
            country: document.getElementById('form-country').value,
            cardAdd: document.getElementById('form-status-add').checked,
            runAds: document.getElementById('form-status-ads').checked,
            verified: document.getElementById('form-status-verify').checked,
            mailVerify: document.getElementById('form-mail-verify').checked,
            mailSubmit: document.getElementById('form-mail-submit').checked,
            mailNone: document.getElementById('form-mail-none').checked,
            suspended: false,
            starred: false,
            date: todayStr(),
        };

        STATE.cards.unshift(card);
        ensureDoc(card);
        save();
        modalOverlay.classList.add('hidden');
        STATE.sortField = null;
        STATE.sortDir = 'desc';
        STATE.page = 1;
        renderAll();
        // Highlight new row
        const newRow = document.querySelector(`tr[data-id="${card.id}"]`);
        if (newRow) newRow.classList.add('row-new');
        toast('Card added successfully', 'success');
    } else {
        // Smart list mode
        if (_listParsedCards.length === 0) {
            toast('No valid cards found in text', 'error');
            return;
        }
        const country = document.getElementById('list-country').value;
        const statusAdd = document.getElementById('list-status-add').checked;
        const statusAds = document.getElementById('list-status-ads').checked;
        const statusVerify = document.getElementById('list-status-verify').checked;

        let added = 0;
        const existingNumbers = new Set(STATE.cards.map(c => c.cardNumber.replace(/\s/g, '')));

        _listParsedCards.forEach(p => {
            if (existingNumbers.has(p.cardNum)) return; // skip duplicates

            const card = {
                id: genId(),
                name: p.name || '', surname: p.surname || '',
                cardNumber: p.cardNum,
                month: p.mm, year: p.yy, cvv: p.cvv,
                cardType: getCardType(p.cardNum),
                amount: 0, notes: '', country,
                cardAdd: statusAdd,
                runAds: statusAds,
                verified: statusVerify,
                suspended: false, starred: false,
                date: todayStr(),
            };
            STATE.cards.unshift(card);
            ensureDoc(card);
            existingNumbers.add(p.cardNum);
            added++;
        });

        if (added > 0) {
            save();
            modalOverlay.classList.add('hidden');
            STATE.sortField = null;
            STATE.sortDir = 'desc';
            STATE.page = 1;
            renderAll();
            // Highlight new rows
            document.querySelectorAll('.data-table tbody tr').forEach((tr, i) => {
                if (i < added) tr.classList.add('row-new');
            });
            toast(`${added} cards added`, 'success');
        } else {
            toast('All cards already exist (duplicates)', 'info');
        }

        // Reset
        _listParsedCards = [];
        document.getElementById('list-textarea').value = '';
        document.getElementById('list-parsed-count').textContent = '0 cards detected';
        document.getElementById('list-preview').innerHTML = '';
    }
});

// Close modals
document.getElementById('modal-close').addEventListener('click', () => modalOverlay.classList.add('hidden'));
document.getElementById('modal-cancel').addEventListener('click', () => modalOverlay.classList.add('hidden'));
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.add('hidden'); });

// ──── EDIT MODAL ────

// Edit Form Mail Exclusivity
document.getElementById('edit-mail-none').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('edit-mail-verify').checked = false;
        document.getElementById('edit-mail-submit').checked = false;
    }
});
const uncheckEditMailNone = () => {
    document.getElementById('edit-mail-none').checked = false;
};
document.getElementById('edit-mail-verify').addEventListener('change', uncheckEditMailNone);
document.getElementById('edit-mail-submit').addEventListener('change', uncheckEditMailNone);

function openEditModal(card) {
    document.getElementById('edit-id').value = card.id;
    document.getElementById('edit-name').value = card.name;
    document.getElementById('edit-surname').value = card.surname;
    document.getElementById('edit-card').value = formatCardInput(card.cardNumber);
    document.getElementById('edit-card-type-badge').textContent = getCardType(card.cardNumber);
    document.getElementById('edit-month').value = card.month;
    document.getElementById('edit-year').value = card.year;
    document.getElementById('edit-cvv').value = card.cvv;
    document.getElementById('edit-amount').value = card.amount;
    document.getElementById('edit-notes').value = card.notes || '';
    document.getElementById('edit-mail-verify').checked = card.mailVerify || false;
    document.getElementById('edit-mail-submit').checked = card.mailSubmit || false;
    document.getElementById('edit-mail-none').checked = card.mailNone || false;
    // Populate country dropdown
    const editCountrySel = document.getElementById('edit-country');
    editCountrySel.innerHTML = STATE.countries.map(c =>
        `<option value="${c.id}" ${c.id === card.country ? 'selected' : ''}>${c.flag} ${c.name}</option>`
    ).join('');
    // Clear old BIN info form element in edit modal
    const editBinEl = document.getElementById('edit-card-type-badge')?.parentElement?.querySelector('.bin-info-form');
    if (editBinEl) editBinEl.remove();
    // Show BIN info for existing card
    const digits = card.cardNumber.replace(/\s/g, '');
    if (digits.length >= 6) {
        const bin = digits.slice(0, 6);
        const cached = getBinInfo(bin);
        if (cached) {
            showFormBinInfo(cached, 'edit-card-type-badge');
        } else {
            lookupBin(bin).then(info => {
                if (info) showFormBinInfo(info, 'edit-card-type-badge');
            });
        }
    }
    editOverlay.classList.remove('hidden');
}

document.getElementById('edit-save').addEventListener('click', () => {
    const id = document.getElementById('edit-id').value;
    const card = STATE.cards.find(c => c.id === id);
    if (card) {
        const oldCountry = card.country;
        card.name = document.getElementById('edit-name').value.trim();
        card.surname = document.getElementById('edit-surname').value.trim();
        card.cardNumber = document.getElementById('edit-card').value.replace(/\s/g, '');
        card.cardType = getCardType(card.cardNumber);
        card.month = document.getElementById('edit-month').value;
        card.year = document.getElementById('edit-year').value;
        card.cvv = document.getElementById('edit-cvv').value;
        card.amount = document.getElementById('edit-amount').value;
        card.notes = document.getElementById('edit-notes').value;
        card.country = document.getElementById('edit-country').value;
        card.mailVerify = document.getElementById('edit-mail-verify').checked;
        card.mailSubmit = document.getElementById('edit-mail-submit').checked;
        card.mailNone = document.getElementById('edit-mail-none').checked;

        // If country changed, re-link doc in new country
        if (card.country !== oldCountry) {
            // Remove card from old doc's cardIds
            if (card.docId) {
                const oldDoc = STATE.docs.find(d => d.id === card.docId);
                if (oldDoc && oldDoc.cardIds) {
                    oldDoc.cardIds = oldDoc.cardIds.filter(cid => cid !== card.id);
                    oldDoc.use = Math.max(0, (oldDoc.use || 1) - 1);
                }
                card.docId = null;
            }
            // Re-link to doc in new country
            ensureDoc(card);
        }

        save();
        editOverlay.classList.add('hidden');
        renderAll();
        const moved = card.country !== oldCountry;
        toast(moved ? `Card moved to ${card.country} & updated` : 'Card updated', 'success');
    }
});

document.getElementById('edit-modal-close').addEventListener('click', () => editOverlay.classList.add('hidden'));
document.getElementById('edit-cancel').addEventListener('click', () => editOverlay.classList.add('hidden'));
editOverlay.addEventListener('click', (e) => { if (e.target === editOverlay) editOverlay.classList.add('hidden'); });

// ──── GLOBAL SEARCH ────
const globalSearchResults = document.getElementById('global-search-results');
let searchTimeout = null;

function performGlobalSearch(query) {
    if (!query || query.length < 2) {
        globalSearchResults.classList.add('hidden');
        // Still filter current view for backward compat
        STATE.search = query;
        STATE.page = 1;
        renderStats();
        renderContent();
        return;
    }

    const s = query.toLowerCase();
    STATE.search = query;
    STATE.page = 1;

    // Search ALL cards across all countries
    const matchedCards = STATE.cards.filter(c =>
        (c.name + ' ' + c.surname).toLowerCase().includes(s) ||
        c.cardNumber.replace(/\s/g, '').includes(s.replace(/\s/g, '')) ||
        getBin(c.cardNumber).includes(s) ||
        (c.notes || '').toLowerCase().includes(s)
    );

    // Search ALL docs across all countries
    const matchedDocs = STATE.docs.filter(d =>
        (d.fullName || '').toLowerCase().includes(s) ||
        (d.notes || '').toLowerCase().includes(s) ||
        (d.type || '').toLowerCase().includes(s)
    );

    // Search trash
    const matchedTrash = STATE.trash.filter(c =>
        (c.name + ' ' + c.surname).toLowerCase().includes(s) ||
        c.cardNumber.replace(/\s/g, '').includes(s.replace(/\s/g, '')) ||
        (c.notes || '').toLowerCase().includes(s)
    );

    if (matchedCards.length === 0 && matchedDocs.length === 0 && matchedTrash.length === 0) {
        globalSearchResults.innerHTML = '<div class="search-no-results">No results found for "' + query + '"</div>';
        globalSearchResults.classList.remove('hidden');
        renderStats();
        renderContent();
        return;
    }

    let html = '';

    // Group cards by country
    if (matchedCards.length > 0) {
        html += '<div class="search-group-title">💳 Cards (' + matchedCards.length + ')</div>';
        const shown = matchedCards.slice(0, 15);
        shown.forEach(c => {
            const country = STATE.countries.find(co => co.id === c.country);
            const flag = country?.flag || '🏳';
            const countryName = country?.name || c.country;
            html += `
                <button class="search-result-item" onclick="globalSearchNavigate('cards', '${c.country}', '${s}')">
                    <span class="search-result-flag">${flag}</span>
                    <div class="search-result-info">
                        <span class="search-result-name">${c.name} ${c.surname}</span>
                        <span class="search-result-detail">${maskCard(c.cardNumber)}${c.notes ? ' · ' + c.notes : ''}</span>
                    </div>
                    <span class="search-result-location cards">${countryName}</span>
                </button>
            `;
        });
        if (matchedCards.length > 15) {
            html += '<div class="search-no-results" style="padding:6px 14px;font-size:11px;">+ ' + (matchedCards.length - 15) + ' more cards</div>';
        }
    }

    // Docs
    if (matchedDocs.length > 0) {
        if (matchedCards.length > 0) html += '<div class="search-divider"></div>';
        html += '<div class="search-group-title">📄 Documents (' + matchedDocs.length + ')</div>';
        const shown = matchedDocs.slice(0, 10);
        shown.forEach(d => {
            const country = STATE.countries.find(co => co.id === d.country);
            const flag = country?.flag || '🏳';
            const countryName = country?.name || d.country;
            html += `
                <button class="search-result-item" onclick="globalSearchNavigate('docs', '${d.country}', '${s}')">
                    <span class="search-result-flag">${flag}</span>
                    <div class="search-result-info">
                        <span class="search-result-name">${d.fullName}</span>
                        <span class="search-result-detail">${d.type || '-'} · V:${d.verified || 0} S:${d.suspended || 0}${d.notes ? ' · ' + d.notes : ''}</span>
                    </div>
                    <span class="search-result-location docs">Docs · ${countryName}</span>
                </button>
            `;
        });
        if (matchedDocs.length > 10) {
            html += '<div class="search-no-results" style="padding:6px 14px;font-size:11px;">+ ' + (matchedDocs.length - 10) + ' more docs</div>';
        }
    }

    // Trash
    if (matchedTrash.length > 0) {
        if (matchedCards.length > 0 || matchedDocs.length > 0) html += '<div class="search-divider"></div>';
        html += '<div class="search-group-title">🗑️ Trash (' + matchedTrash.length + ')</div>';
        const shown = matchedTrash.slice(0, 5);
        shown.forEach(c => {
            const country = STATE.countries.find(co => co.id === c.country);
            const flag = country?.flag || '🏳';
            html += `
                <button class="search-result-item" onclick="globalSearchNavigate('trash', null, '${s}')">
                    <span class="search-result-flag">${flag}</span>
                    <div class="search-result-info">
                        <span class="search-result-name">${c.name} ${c.surname}</span>
                        <span class="search-result-detail">${maskCard(c.cardNumber)}</span>
                    </div>
                    <span class="search-result-location trash">Trash</span>
                </button>
            `;
        });
    }

    globalSearchResults.innerHTML = html;
    globalSearchResults.classList.remove('hidden');

    // Also render current view with search filter
    renderStats();
    renderContent();
}

window.globalSearchNavigate = function (view, country, searchTerm) {
    // Navigate to the correct view/country, clear search to show all
    STATE.currentView = view;
    if (country) STATE.currentCountry = country;
    STATE.page = 1;
    STATE.search = '';
    globalSearchResults.classList.add('hidden');
    document.getElementById('search-input').value = '';
    renderAll();

    // Scroll to matching record and highlight it
    setTimeout(() => {
        const term = (searchTerm || '').toLowerCase();
        if (!term) return;
        const rows = document.querySelectorAll('.table-row');
        for (const row of rows) {
            if (row.textContent.toLowerCase().includes(term)) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('search-highlight');
                setTimeout(() => row.classList.remove('search-highlight'), 2500);
                break;
            }
        }
    }, 150);
};

document.getElementById('search-input').addEventListener('input', function () {
    clearTimeout(searchTimeout);
    const query = this.value.trim();
    searchTimeout = setTimeout(() => performGlobalSearch(query), 150);
});

// Enter → navigate to first search result
document.getElementById('search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const firstResult = globalSearchResults.querySelector('.search-result-item');
        if (firstResult) firstResult.click();
    }
});

// Close search results when clicking outside
document.addEventListener('click', function (e) {
    const searchBox = document.getElementById('global-search-box');
    if (!searchBox.contains(e.target)) {
        globalSearchResults.classList.add('hidden');
    }
});

// Re-show results on focus if there's a query
document.getElementById('search-input').addEventListener('focus', function () {
    if (this.value.trim().length >= 2) {
        performGlobalSearch(this.value.trim());
    }
});

// ──── PAGINATION ────
document.getElementById('prev-page').addEventListener('click', () => {
    if (STATE.page > 1) { STATE.page--; renderContent(); }
});
document.getElementById('next-page').addEventListener('click', () => {
    const cards = getFilteredCards();
    const totalPages = Math.ceil(cards.length / STATE.perPage);
    if (STATE.page < totalPages) { STATE.page++; renderContent(); }
});

// ──── NOTES ────
window.saveNotes = function () {
    STATE.notes = document.getElementById('notes-textarea')?.value || '';
    save();
    toast('Notes saved', 'success');
};

window.exportNotes = function () {
    const blob = new Blob([STATE.notes], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'card-tracker-notes.txt';
    a.click();
    toast('Notes exported', 'success');
};

window.importNotes = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                STATE.notes = ev.target.result;
                save();
                renderContent();
                toast('Notes imported', 'success');
            };
            reader.readAsText(file);
        }
    };
    input.click();
};

// ──── IMPORT / EXPORT ────
// Pending backup data for the import modal
let pendingBackup = null;
const backupOverlay = document.getElementById('backup-import-overlay');

function mapGeoToCountry(geo) {
    if (!geo) return 'canada';
    const g = geo.toUpperCase().trim();
    if (g === 'USA' || g === 'UNITED STATES' || g === 'US') return 'usa';
    return 'canada';
}

function formatDateFromISO(iso) {
    if (!iso) return todayStr();
    try {
        const d = new Date(iso);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
    } catch { return todayStr(); }
}

function convertOldCard(c) {
    return {
        id: c.id || genId(),
        name: (c.name || '').trim(),
        surname: (c.surname || '').trim(),
        cardNumber: (c.card_number || c.cardNumber || '').replace(/\s/g, ''),
        month: c.card_exp_month || c.month || '',
        year: c.card_exp_year || c.year || '',
        cvv: c.card_cvv || c.cvv || '',
        cardType: getCardType((c.card_number || c.cardNumber || '').replace(/\s/g, '')),
        docType: c.doc_type || c.docType || null,
        amount: c.amount || 0,
        notes: c.comment || c.notes || '',
        country: mapGeoToCountry(c.geo || c.country),
        cardAdd: !!(c.card_add ?? c.cardAdd),
        runAds: !!(c.run_ads ?? c.runAds),
        verified: !!(c.verify_card ?? c.verified),
        suspended: false,
        starred: !!(c.is_active ?? c.starred),
        date: formatDateFromISO(c.created_at || c.date),
        verifStatus: c.verif_status || 'waiting',
    };
}

function convertOldDoc(d) {
    return {
        id: d.id || genId(),
        fullName: `${(d.name || '').trim()} ${(d.surname || '').trim()}`.trim().toUpperCase(),
        name: (d.name || '').trim(),
        surname: (d.surname || '').trim(),
        country: mapGeoToCountry(d.geo || d.country),
        type: d.doc_type || d.type || '-',
        use: d.use_count || d.use || 1,
        verified: 0,
        suspended: 0,
        status: d.status || 'waiting',
        date: formatDateFromISO(d.created_at || d.date),
        notes: d.comment || d.notes || '',
    };
}

function openBackupFileDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                pendingBackup = data;
                showBackupImportModal(data, file.name);
            } catch {
                toast('Invalid JSON file', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function showBackupImportModal(data, filename) {
    const isV2 = data.version === '2.0';
    // v2: separate cards/docs/trash arrays; v1: cards include deleted, mydocuments
    const cards = data.cards || [];
    const activeCards = isV2 ? cards : cards.filter(c => !(c.is_deleted ?? false));
    const docs = isV2 ? (data.docs || []) : (data.mydocuments || data.docs || []);
    const activeDocs = isV2 ? docs : docs.filter(d => !(d.is_deleted ?? false));
    const trashCount = isV2 ? (data.trash || []).length : cards.filter(c => c.is_deleted).length;
    const hasNotes = !!(data.notes && (data.notes.content || typeof data.notes === 'string'));
    const exportDate = data.exported_at || data.exportedAt || data.backupAt || '';
    const version = data.version || '—';

    let dateStr = '';
    if (exportDate) {
        try {
            const d = new Date(exportDate);
            dateStr = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US');
        } catch { dateStr = exportDate; }
    }

    document.getElementById('backup-meta').innerHTML = `Exported: ${dateStr || 'Unknown'}  | Version: ${version}`;
    document.getElementById('backup-stats').innerHTML = `
        <div class="backup-stat-card cards"><div class="stat-num">${activeCards.length}</div><div class="stat-name">CARDS</div></div>
        <div class="backup-stat-card docs"><div class="stat-num">${activeDocs.length}</div><div class="stat-name">DOCUMENTS</div></div>
        <div class="backup-stat-card mycards"><div class="stat-num">${trashCount}</div><div class="stat-name">TRASH</div></div>
        <div class="backup-stat-card notes"><div class="stat-num">${hasNotes ? 1 : 0}</div><div class="stat-name">NOTES</div></div>
    `;
    backupOverlay.classList.remove('hidden');
}

// Pre-scanned import data for step-2 resolution
let _importScan = null;

function executeBackupImport(mode) {
    if (!pendingBackup) return;
    const data = pendingBackup;

    if (mode === 'replace') {
        // REPLACE ALL — clear everything, import all
        STATE.cards = [];
        STATE.docs = [];
        STATE.trash = [];
        STATE.notes = '';
        STATE.notesTabs = [];
        importAllRecords(data);
        migrateNotesToTabs();
        finishImport();
        return;
    }

    // MERGE mode — pre-scan for duplicates
    const scan = preScanImport(data);
    _importScan = scan;

    if (scan.dupCards.length === 0 && scan.dupDocs.length === 0) {
        // No duplicates — import directly
        importNewOnly(scan);
        finishImport();
        return;
    }

    // Show step-2 duplicate resolution
    document.getElementById('backup-step1').classList.add('hidden');
    document.getElementById('backup-step2').classList.remove('hidden');

    const totalDups = scan.dupCards.length + scan.dupDocs.length;
    document.getElementById('dup-summary').innerHTML = `
        <div class="dup-icon">⚠️</div>
        <div class="dup-text">
            <strong>${totalDups} duplicate${totalDups !== 1 ? 's' : ''} found</strong>
            <span class="dup-detail">
                ${scan.dupCards.length ? scan.dupCards.length + ' card' + (scan.dupCards.length !== 1 ? 's' : '') : ''}
                ${scan.dupCards.length && scan.dupDocs.length ? ' + ' : ''}
                ${scan.dupDocs.length ? scan.dupDocs.length + ' doc' + (scan.dupDocs.length !== 1 ? 's' : '') : ''}
                already exist • ${scan.newCards.length + scan.newDocs.length} new records will be added
            </span>
        </div>
    `;
}

function preScanImport(data) {
    const isV2 = data.version === '2.0';
    const rawCards = data.cards || [];
    const rawDocs = isV2 ? (data.docs || []) : (data.mydocuments || data.docs || []);

    const newCards = [];
    const dupCards = []; // { incoming, existing }
    const newDocs = [];
    const dupDocs = [];

    rawCards.forEach(c => {
        const isDeleted = !isV2 && (c.is_deleted === 1 || c.is_deleted === true);
        if (isDeleted) return;
        const converted = isV2 ? { ...c, id: c.id || genId() } : convertOldCard(c);
        const existing = STATE.cards.find(e => e.cardNumber === converted.cardNumber);
        if (existing) {
            dupCards.push({ incoming: converted, existing });
        } else {
            newCards.push(converted);
        }
    });

    rawDocs.forEach(d => {
        const isDeleted = !isV2 && (d.is_deleted === 1 || d.is_deleted === true);
        if (isDeleted) return;
        const converted = isV2 ? { ...d, id: d.id || genId() } : convertOldDoc(d);
        const existing = STATE.docs.find(e => e.fullName === converted.fullName && e.country === converted.country);
        if (existing) {
            dupDocs.push({ incoming: converted, existing });
        } else {
            newDocs.push(converted);
        }
    });

    return { data, isV2, newCards, dupCards, newDocs, dupDocs };
}

function importNewOnly(scan) {
    scan.newCards.forEach(c => { c.id = genId(); STATE.cards.push(c); });
    scan.newDocs.forEach(d => { d.id = genId(); STATE.docs.push(d); });
    importExtras(scan.data);
    const msg = `Added: ${scan.newCards.length} cards, ${scan.newDocs.length} docs` +
        (scan.dupCards.length + scan.dupDocs.length > 0 ? ` (${scan.dupCards.length + scan.dupDocs.length} duplicates skipped)` : '');
    toast(msg, 'success');
}

function importWithReplace(scan) {
    // Add new records
    scan.newCards.forEach(c => { c.id = genId(); STATE.cards.push(c); });
    scan.newDocs.forEach(d => { d.id = genId(); STATE.docs.push(d); });

    // Replace existing with imported data
    let replaced = 0;
    scan.dupCards.forEach(({ incoming, existing }) => {
        Object.assign(existing, incoming, { id: existing.id });
        replaced++;
    });
    scan.dupDocs.forEach(({ incoming, existing }) => {
        Object.assign(existing, incoming, { id: existing.id });
        replaced++;
    });

    importExtras(scan.data);
    toast(`Added: ${scan.newCards.length + scan.newDocs.length} new, replaced: ${replaced} existing`, 'success');
}

function importWithDuplicates(scan) {
    // Add new records
    scan.newCards.forEach(c => { c.id = genId(); STATE.cards.push(c); });
    scan.newDocs.forEach(d => { d.id = genId(); STATE.docs.push(d); });

    // Also add duplicates as new records with new IDs
    let dupAdded = 0;
    scan.dupCards.forEach(({ incoming }) => {
        incoming.id = genId();
        incoming.isDuplicate = true;
        STATE.cards.push(incoming);
        dupAdded++;
    });
    scan.dupDocs.forEach(({ incoming }) => {
        incoming.id = genId();
        incoming.isDuplicate = true;
        STATE.docs.push(incoming);
        dupAdded++;
    });

    importExtras(scan.data);
    toast(`Added: ${scan.newCards.length + scan.newDocs.length} new + ${dupAdded} duplicates`, 'success');
}

function importAllRecords(data) {
    const isV2 = data.version === '2.0';
    const rawCards = data.cards || [];
    rawCards.forEach(c => {
        const isDeleted = !isV2 && (c.is_deleted === 1 || c.is_deleted === true);
        const converted = isV2 ? { ...c, id: c.id || genId() } : convertOldCard(c);
        if (isDeleted) {
            STATE.trash.push(converted);
        } else {
            STATE.cards.push(converted);
        }
    });

    if (isV2 && data.trash && Array.isArray(data.trash)) {
        data.trash.forEach(c => {
            STATE.trash.push({ ...c, id: c.id || genId() });
        });
    }

    const rawDocs = isV2 ? (data.docs || []) : (data.mydocuments || data.docs || []);
    rawDocs.forEach(d => {
        const isDeleted = !isV2 && (d.is_deleted === 1 || d.is_deleted === true);
        if (isDeleted) return;
        STATE.docs.push(isV2 ? { ...d, id: d.id || genId() } : convertOldDoc(d));
    });

    importExtras(data);
    toast(`Imported: ${STATE.cards.length} cards, ${STATE.docs.length} docs`, 'success');
}

function importExtras(data) {
    // Countries
    if (data.countries && Array.isArray(data.countries)) {
        data.countries.forEach(c => {
            if (!STATE.countries.find(e => e.id === c.id)) STATE.countries.push(c);
        });
    }
    // Notes — import notesTabs if available, otherwise convert legacy notes string
    if (data.notesTabs && Array.isArray(data.notesTabs) && data.notesTabs.length > 0) {
        data.notesTabs.forEach(tab => {
            const newTab = {
                ...tab,
                id: 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
            };
            STATE.notesTabs.push(newTab);
        });
        STATE.notesActiveTab = STATE.notesTabs[0]?.id || '';
        STATE.notes = STATE.notesTabs[0]?.content || '';
    } else if (data.notes) {
        const noteContent = typeof data.notes === 'string' ? data.notes : (data.notes.content || '');
        if (noteContent) {
            STATE.notes = STATE.notes ? STATE.notes + '\n\n--- Imported ---\n' + noteContent : noteContent;
            // Also add as a tab if notesTabs is empty
            if (STATE.notesTabs.length === 0) {
                const importedTab = {
                    id: 'tab-imported-' + Date.now(),
                    title: 'Imported',
                    content: noteContent,
                    created: Date.now(),
                    scrollPos: 0
                };
                STATE.notesTabs.push(importedTab);
                STATE.notesActiveTab = importedTab.id;
            } else {
                // Append to first tab
                const firstTab = STATE.notesTabs[0];
                firstTab.content = (firstTab.content || '') + '\n\n--- Imported ---\n' + noteContent;
            }
        }
    }
    // BIN cache
    if (data.binCache && typeof data.binCache === 'object') {
        Object.assign(BIN_CACHE, data.binCache);
    }
}

function finishImport() {
    ensureDataIntegrity();
    save();
    backupOverlay.classList.add('hidden');
    pendingBackup = null;
    _importScan = null;
    // Reset step visibility
    document.getElementById('backup-step1').classList.remove('hidden');
    document.getElementById('backup-step2').classList.add('hidden');
    renderAll();
}

function closeBackupModal() {
    backupOverlay.classList.add('hidden');
    pendingBackup = null;
    _importScan = null;
    document.getElementById('backup-step1').classList.remove('hidden');
    document.getElementById('backup-step2').classList.add('hidden');
}

// Import button (sidebar)
document.getElementById('restore-backup-btn').addEventListener('click', openBackupFileDialog);

// Backup import modal buttons — Step 1
document.getElementById('backup-replace').addEventListener('click', () => executeBackupImport('replace'));
document.getElementById('backup-merge').addEventListener('click', () => executeBackupImport('merge'));

// Step 2 — duplicate resolution
document.getElementById('dup-skip').addEventListener('click', () => {
    if (!_importScan) return;
    importNewOnly(_importScan);
    finishImport();
});
document.getElementById('dup-replace').addEventListener('click', () => {
    if (!_importScan) return;
    importWithReplace(_importScan);
    finishImport();
});
document.getElementById('dup-add').addEventListener('click', () => {
    if (!_importScan) return;
    importWithDuplicates(_importScan);
    finishImport();
});

// Close handlers
document.getElementById('backup-import-close').addEventListener('click', closeBackupModal);
document.getElementById('backup-import-cancel').addEventListener('click', closeBackupModal);
backupOverlay.addEventListener('click', (e) => { if (e.target === backupOverlay) closeBackupModal(); });

document.getElementById('backup-btn').addEventListener('click', () => {
    const data = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        exported_at: new Date().toISOString(),
        totalCards: STATE.cards.length,
        totalDocs: STATE.docs.length,
        totalTrash: STATE.trash.length,
        cards: STATE.cards,
        docs: STATE.docs,
        trash: STATE.trash,
        notesTabs: STATE.notesTabs,
        notes: { id: 'main', content: STATE.notesTabs[0]?.content || STATE.notes },
        countries: STATE.countries,
        settings: STATE.settings || {},
        binCache: BIN_CACHE,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `card-tracker-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Backup created: ${STATE.cards.length} cards, ${STATE.docs.length} docs`, 'success');
});




// ──── ADD COUNTRY (custom modal) ────
const addCountryOverlay = document.getElementById('add-country-overlay');
const countryCodeInput = document.getElementById('new-country-code');
const countryPreview = document.getElementById('country-preview');
const countryPreviewFlag = document.getElementById('country-preview-flag');
const countryPreviewName = document.getElementById('country-preview-name');

document.getElementById('add-country-btn').addEventListener('click', () => {
    countryCodeInput.value = '';
    countryPreview.classList.add('hidden');
    addCountryOverlay.classList.remove('hidden');
    setTimeout(() => countryCodeInput.focus(), 100);
});

function closeAddCountry() {
    addCountryOverlay.classList.add('hidden');
}

// Live preview when typing ISO code
countryCodeInput.addEventListener('input', () => {
    const code = countryCodeInput.value.trim().toUpperCase();
    if (code.length === 2 && COUNTRY_DB[code]) {
        countryPreviewFlag.textContent = isoToFlag(code);
        countryPreviewName.textContent = COUNTRY_DB[code];
        countryPreview.classList.remove('hidden');
    } else {
        countryPreview.classList.add('hidden');
    }
});

document.getElementById('add-country-close').addEventListener('click', closeAddCountry);
document.getElementById('add-country-cancel').addEventListener('click', closeAddCountry);
addCountryOverlay.addEventListener('click', (e) => { if (e.target === addCountryOverlay) closeAddCountry(); });

document.getElementById('add-country-confirm').addEventListener('click', () => {
    const code = countryCodeInput.value.trim().toUpperCase();
    if (!code || code.length !== 2) { toast('Enter a 2-letter country code', 'error'); return; }
    if (!COUNTRY_DB[code]) { toast('Unknown country code', 'error'); return; }
    const id = code.toLowerCase();
    if (STATE.countries.find(c => c.id === id)) {
        toast('Country already exists', 'error');
        return;
    }
    const flag = isoToFlag(code);
    const name = COUNTRY_DB[code];
    STATE.countries.push({ id, name, flag });
    save();
    closeAddCountry();
    renderAll();
    toast(`${flag} ${name} added`, 'success');
});

countryCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('add-country-confirm').click();
});

// ──── TRASH VIEW ────


// ──── LOGOUT ────
document.getElementById('logout-btn').addEventListener('click', () => {
    STATE.user = null;
    localStorage.removeItem('ct_session');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
});

// ──── LOGIN ────
function doLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if (!user || !pass) return;

    if (user === CREDENTIALS.username && pass === CREDENTIALS.password) {
        STATE.user = user;
        localStorage.setItem('ct_session', JSON.stringify({ user, ts: Date.now() }));
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        load();
        navigate('cards', 'canada');
        toast('Welcome back, Admin!', 'success');
    } else {
        document.getElementById('login-error').textContent = 'Invalid username or password';
        setTimeout(() => document.getElementById('login-error').textContent = '', 3000);
    }
}

// Handle form submit (Enter key)
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    doLogin();
});

// Handle button click directly (fallback for when form submit doesn't fire)
document.querySelector('.btn-login').addEventListener('click', (e) => {
    e.preventDefault();
    doLogin();
});

// ──── AUTO-LOGIN (session persistence) ────
(function autoLogin() {
    try {
        const session = JSON.parse(localStorage.getItem('ct_session'));
        if (session && session.user) {
            STATE.user = session.user;
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            load();
            navigate('cards', 'canada');
        }
    } catch(e) { /* no valid session */ }
})();

// ──── KEYBOARD SHORTCUTS ────
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        modalOverlay.classList.add('hidden');
        editOverlay.classList.add('hidden');
        document.getElementById('context-menu').classList.add('hidden');
        backupOverlay.classList.add('hidden');
        pendingBackup = null;
        document.getElementById('checker-overlay').classList.add('hidden');
        document.getElementById('add-country-overlay').classList.add('hidden');
        document.getElementById('delete-project-overlay').classList.add('hidden');
        document.getElementById('global-search-results').classList.add('hidden');
        document.body.style.overflow = '';
    }
});

// ──── INIT ────
load();

// ──── NOTES FUNCTIONS ────
function saveNotesAction() {
    const textarea = document.getElementById('notes-textarea');
    if (textarea) STATE.notes = textarea.value;
    STATE.notesLastSaved = Date.now();
    save();
    const info = document.querySelector('.notes-saved-info');
    if (info) info.textContent = 'Saved ' + new Date().toLocaleTimeString();
    toast('Notes saved', 'success');
}

function exportNotesAction() {
    const text = STATE.notes || '';
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `notes-${todayStr()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Notes exported', 'success');
}

function importNotesAction() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            STATE.notes = ev.target.result;
            save();
            renderNotes();
            toast('Notes imported', 'success');
        };
        reader.readAsText(file);
    };
    input.click();
}

function changeNotesFontSize(delta) {
    STATE.notesFontSize = Math.max(10, Math.min(24, STATE.notesFontSize + delta));
    const textarea = document.getElementById('notes-textarea');
    if (textarea) textarea.style.fontSize = STATE.notesFontSize + 'px';
    const display = document.getElementById('notes-font-size-display');
    if (display) display.textContent = STATE.notesFontSize;
}

// ──── CHECKER ────
// Checker implementation is in the IIFE below (line ~4300+)
// openChecker is exposed via window.openChecker from that IIFE

// ──── DROPDOWN MENUS ────
function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
}

document.addEventListener('click', () => {
    closeAllDropdowns();
    document.getElementById('context-menu').classList.add('hidden');
});

// ──── DELETE PROJECT (custom modal) ────
const deleteProjectOverlay = document.getElementById('delete-project-overlay');
const deleteConfirmInput = document.getElementById('delete-confirm-input');
const deleteConfirmBtn = document.getElementById('delete-project-confirm');

document.getElementById('delete-project-btn').addEventListener('click', () => {
    deleteConfirmInput.value = '';
    deleteConfirmBtn.disabled = true;
    deleteProjectOverlay.classList.remove('hidden');
    setTimeout(() => deleteConfirmInput.focus(), 100);
});

function closeDeleteProject() {
    deleteProjectOverlay.classList.add('hidden');
}

document.getElementById('delete-project-close').addEventListener('click', closeDeleteProject);
document.getElementById('delete-project-cancel').addEventListener('click', closeDeleteProject);
deleteProjectOverlay.addEventListener('click', (e) => { if (e.target === deleteProjectOverlay) closeDeleteProject(); });

deleteConfirmInput.addEventListener('input', () => {
    deleteConfirmBtn.disabled = deleteConfirmInput.value.trim() !== 'DELETE';
});

deleteConfirmBtn.addEventListener('click', () => {
    if (deleteConfirmInput.value.trim() !== 'DELETE') return;
    STATE.cards = [];
    STATE.docs = [];
    STATE.notes = '';
    STATE.trash = [];
    save();
    closeDeleteProject();
    renderAll();
    toast('Project deleted', 'info');
});

// ══════════════════════════════════════════════════
// ──── PARSER MODULE ────
// ══════════════════════════════════════════════════

let PARSER_STATE = {
    rawMessages: [],
    file: null,
    collected: [],
    binGroups: [],
    selected: new Set(),
    binFilter: null,
    sortBy: 'index'
};

// ──── HELPERS ────

function getProjectBinCounts() {
    const counts = {};
    STATE.cards.forEach(c => {
        const num = (c.cardNumber || '').replace(/[\s\-]/g, '');
        if (num.length >= 6) {
            const b = num.slice(0, 6);
            counts[b] = (counts[b] || 0) + 1;
        }
    });
    return counts;
}

function formatCardBin(cc) {
    if (cc.length < 10) return cc;
    const bin6 = cc.slice(0, 6);
    const last4 = cc.slice(-4);
    return `${bin6} •••• ${last4}`;
}

function detectGeo(billing, country) {
    if (country && country.length >= 2) return country.toUpperCase();
    if (!billing) return '';
    const parts = billing.split(',').map(p => p.trim());
    // Look for 2-letter country codes
    const knownCodes = ['CA','US','AU','AE','UK','GB','IL','DE','FR','NL','SE','NO','DK','FI','NZ','SG','JP','KR','IN','BR','MX','ZA','IE','IT','ES','CH','AT','BE','PT'];
    for (const p of parts) {
        const upper = p.toUpperCase().trim();
        if (knownCodes.includes(upper)) return upper;
    }
    return '';
}

function flattenText(textArray) {
    if (typeof textArray === 'string') return textArray;
    if (!Array.isArray(textArray)) return '';
    return textArray.map(item => typeof item === 'string' ? item : (item && item.text ? String(item.text) : '')).join('');
}

function extractCardsFromMessages(messages) {
    const pattern = /💳\s*CC:\s*([\d ]+).*?📅\s*Validity:\s*(\d{2})\s*\/\s*(\d{2,4}).*?🔐\s*CVV:\s*(\d{3,4})/gs;
    const holderP = /👶\s*Holder:\s*(.+)/i;
    const bankP = /🏦\s*Bank:\s*(.+)/i;
    const typeP = /📊\s*Card Type:\s*(.+)/i;
    const billingP = /🏷\s*Billing:\s*(.+)/i;

    const cards = [];
    for (const msg of messages) {
        const fullText = flattenText(msg.text);
        if (!fullText) continue;
        const msgDate = msg.date || '';

        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(fullText)) !== null) {
            const ccRaw = m[1].replace(/\s/g, '');
            let mm = m[2];
            let yy = m[3];
            const cvv = m[4];
            if (yy.length === 4) yy = yy.slice(2);

            const holderM = fullText.match(holderP);
            const bankM = fullText.match(bankP);
            const typeM = fullText.match(typeP);
            const billingM = fullText.match(billingP);

            const holder = holderM ? holderM[1].trim() : '';
            const nameParts = holder.split(/\s+/);
            const name = nameParts[0] || '';
            const surname = nameParts.slice(1).join(' ') || '';

            const bank = bankM ? bankM[1].trim() : '';
            const cardType = typeM ? typeM[1].trim() : '';
            const billing = billingM ? billingM[1].trim() : '';
            const country = billing.split(',')[0]?.trim() || '';

            cards.push({
                cc: ccRaw,
                mm, yy, cvv,
                name, surname,
                bank, cardType,
                country, billing,
                msgDate,
                validity: `${mm}/${yy}`,
                bin: ccRaw.substring(0, 6)
            });
        }
    }
    return cards;
}

// ──── RENDER GENERATOR ────

// ═══════════════════════════════════════════
//        DOCUMENT GENERATOR (ID Forge Clone)
// ═══════════════════════════════════════════

const GEN_DOCS = [
    { id:'ca-dl', country:'US', cat:'DRIVER LICENSE', name:'California', icon:'🚗', active:true },
    { id:'us-pp', country:'US', cat:'PASSPORT', name:'US Passport', icon:'📘', active:false },
    { id:'on-dl', country:'CA', cat:'DRIVER LICENSE', name:'Ontario', icon:'🚗', active:true },
    { id:'bc-dl', country:'CA', cat:'DRIVER LICENSE', name:'British Columbia', icon:'🚗', active:true },
    { id:'ca-pp', country:'CA', cat:'PASSPORT', name:'Canadian Passport', icon:'📘', active:true },
    { id:'rogers', country:'CA', cat:'UTILITY BILLS', name:'Rogers Bill', icon:'📄', active:true },
    { id:'au-nsw', country:'AU', cat:'DRIVER LICENSE', name:'New South Wales', icon:'🚗', active:false },
    { id:'au-vic', country:'AU', cat:'DRIVER LICENSE', name:'Victoria', icon:'🚗', active:false },
    { id:'au-pp', country:'AU', cat:'PASSPORT', name:'Australian Passport', icon:'📘', active:false },
    { id:'de-dl', country:'DE', cat:'DRIVER LICENSE', name:'Germany DL', icon:'🚗', active:false },
];

const GEN_COUNTRIES = [
    { code:'US', name:'United States', flag:'🇺🇸' },
    { code:'CA', name:'Canada', flag:'🇨🇦' },
    { code:'AU', name:'Australia', flag:'🇦🇺' },
    { code:'DE', name:'Germany', flag:'🇩🇪' },
];

let _genState = { docId: 'ca-dl', sex: 'M', result: null };

/* ── Helpers ── */
const _rInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const _rPick = arr => arr[_rInt(0,arr.length-1)];
const _pad2 = n => String(n).padStart(2,'0');
const _rDigits = n => Array.from({length:n},()=>_rInt(0,9)).join('');
const _rLetter = () => String.fromCharCode(65+_rInt(0,25));
const _rLetters = n => Array.from({length:n},()=>_rLetter()).join('');

const _MALE_FIRST = ['JAMES','JOHN','ROBERT','MICHAEL','WILLIAM','DAVID','RICHARD','JOSEPH','THOMAS','CHARLES','DANIEL','MATTHEW','ANTHONY','MARK','STEVEN','PAUL','ANDREW','JOSHUA','KENNETH','KEVIN'];
const _FEMALE_FIRST = ['MARY','PATRICIA','JENNIFER','LINDA','BARBARA','ELIZABETH','SUSAN','JESSICA','SARAH','KAREN','LISA','NANCY','BETTY','MARGARET','SANDRA','ASHLEY','DOROTHY','KIMBERLY','EMILY','DONNA'];
const _LAST_NAMES = ['SMITH','JOHNSON','WILLIAMS','BROWN','JONES','GARCIA','MILLER','DAVIS','RODRIGUEZ','MARTINEZ','HERNANDEZ','LOPEZ','GONZALEZ','WILSON','ANDERSON','THOMAS','TAYLOR','MOORE','JACKSON','MARTIN','LEE','PEREZ','THOMPSON','WHITE','HARRIS','SANCHEZ','CLARK','RAMIREZ','LEWIS','ROBINSON'];
const _HAIR = ['BRN','BLK','BLN','RED','GRY','WHT','SDY','AUB'];
const _EYES = ['BRN','BLU','GRN','HZL','GRY','BLK'];
const _CA_CITIES = [{c:'LOS ANGELES',z:'900'},{c:'SAN FRANCISCO',z:'941'},{c:'SAN DIEGO',z:'921'},{c:'SAN JOSE',z:'951'},{c:'SACRAMENTO',z:'958'},{c:'FRESNO',z:'937'},{c:'LONG BEACH',z:'908'},{c:'OAKLAND',z:'946'},{c:'BAKERSFIELD',z:'933'},{c:'ANAHEIM',z:'928'}];
const _CA_STREETS = ['MAIN ST','OAK AVE','ELM ST','MAPLE DR','CEDAR LN','PINE RD','WALNUT ST','BROADWAY','SUNSET BLVD','PACIFIC AVE','MISSION ST','MARKET ST','VALENCIA ST','FOLSOM ST','GEARY BLVD'];
const _ON_CITIES = [{c:'TORONTO',p:'M'},{c:'OTTAWA',p:'K'},{c:'MISSISSAUGA',p:'L'},{c:'BRAMPTON',p:'L'},{c:'HAMILTON',p:'L'},{c:'LONDON',p:'N'},{c:'MARKHAM',p:'L'},{c:'VAUGHAN',p:'L'},{c:'KITCHENER',p:'N'},{c:'WINDSOR',p:'N'}];
const _BC_CITIES = [{c:'VANCOUVER',p:'V'},{c:'SURREY',p:'V'},{c:'BURNABY',p:'V'},{c:'RICHMOND',p:'V'},{c:'KELOWNA',p:'V'},{c:'VICTORIA',p:'V'},{c:'NANAIMO',p:'V'},{c:'KAMLOOPS',p:'V'}];
const _MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _MONTHS_FR = ['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];
const _MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function _genDOB(sex) {
    const age = _rInt(30,50);
    const y = new Date().getFullYear() - age;
    const m = _rInt(1,12), d = _rInt(1,28);
    return { y, m, d };
}
function _genName(sex) {
    const fn = sex==='F' ? _rPick(_FEMALE_FIRST) : _rPick(_MALE_FIRST);
    const ln = _rPick(_LAST_NAMES);
    return { fn, ln };
}
function _parseTemplate(text) {
    const t = {};
    if (!text) return t;
    const lines = text.split('\n');
    for (const line of lines) {
        const l = line.replace(/^[^\w]*/, '').trim();
        if (/^holder:/i.test(l)) t.holder = l.replace(/^holder:\s*/i,'').trim();
        if (/^billing:/i.test(l)) t.billing = l.replace(/^billing:\s*/i,'').trim();
        if (/^zip:/i.test(l)) t.zip = l.replace(/^zip:\s*/i,'').trim();
    }
    return t;
}

/* ═══ CALIFORNIA DL ═══ */
function generateCaliforniaDL(sex, tpl) {
    const {fn, ln} = tpl.holder ? (() => { const p = tpl.holder.split(/\s+/); return {fn:p[0]?.toUpperCase()||'JOHN', ln:p.slice(1).join(' ').toUpperCase()||'DOE'}; })() : _genName(sex);
    const dob = _genDOB(sex);
    const expY = new Date().getFullYear() + _rInt(2,5);
    const issY = new Date().getFullYear() - _rInt(0,3);
    const dlNum = _rLetter() + _rDigits(7);
    const city = _rPick(_CA_CITIES);
    const addr = `${_rInt(100,9999)} ${_rPick(_CA_STREETS)}`;
    const hgt = sex==='F' ? `${_rPick(['5'])}' - ${_pad2(_rInt(0,8))}"` : `${_rPick(['5','6'])}' - ${_pad2(_rInt(0,11))}"`;
    const wgt = sex==='F' ? `${_rInt(110,160)} lb` : `${_rInt(150,220)} lb`;
    const serial = `${_pad2(dob.m)}${_pad2(dob.d)}${String(dob.y).slice(2)}`;

    return {
        title: 'California Driver License',
        sections: [{
            name: 'FRONT', copyLabel: 'Copy Front',
            fields: [
                { label:'DL', value: dlNum },
                { label:'EXP', value: `${_pad2(dob.m)}/${_pad2(dob.d)}/${expY}` },
                { label:'LN', value: ln },
                { label:'FN', value: fn },
                { label:'CLASS', value: 'C' },
                { label:'DOB', value: `${_pad2(dob.m)}/${_pad2(dob.d)}/${dob.y}` },
                { label:'DOB (NO SLASH)', value: `${_pad2(dob.m)}${_pad2(dob.d)}${dob.y}` },
                { label:'SERIAL (VERT)', value: serial },
                { label:'SEX', value: sex },
                { label:'HAIR', value: _rPick(_HAIR) },
                { label:'EYES', value: _rPick(_EYES) },
                { label:'HGT', value: hgt },
                { label:'WGT', value: wgt },
                { label:'ADDRESS', value: `${addr}, ${city.c}, CA ${city.z}${_rDigits(2)}` },
                { label:'ISS', value: `${_pad2(_rInt(1,12))}/${_pad2(_rInt(1,28))}/${issY}` },
                { label:'DD', value: `${_pad2(dob.m)}/${_pad2(dob.d)}/${dob.y}${_rDigits(4)}${_rLetters(2)}/${_rLetters(2)}/${_rDigits(4)}` },
            ]
        },{
            name: 'BACK', copyLabel: 'Copy Back',
            fields: [
                { label:'SERIAL', value: serial },
                { label:'REV', value: `Rev ${_pad2(_rInt(1,12))}/${_pad2(_rInt(1,28))}/${new Date().getFullYear()-_rInt(1,3)}` },
                { label:'INVENTORY', value: `${_rDigits(5)}${_rLetters(2)}${dlNum}${_rDigits(5)}` },
            ]
        }]
    };
}

/* ═══ ONTARIO DL ═══ */
function generateOntarioDL(sex, tpl) {
    const {fn, ln} = tpl.holder ? (() => { const p = tpl.holder.split(/\s+/); return {fn:p[0]?.toUpperCase()||'JOHN', ln:p.slice(1).join(' ').toUpperCase()||'DOE'}; })() : _genName(sex);
    const dob = _genDOB(sex);
    const city = _rPick(_ON_CITIES);
    const dlNum = `${ln[0]}${_rDigits(4)}-${_rDigits(5)}-${_rDigits(5)}`;
    const issDate = `${new Date().getFullYear()-_rInt(0,2)}/${_pad2(_rInt(1,12))}/${_pad2(_rInt(1,28))}`;
    const expDate = `${new Date().getFullYear()+_rInt(2,5)}/${_pad2(dob.m)}/${_pad2(dob.d)}`;
    const postal = `${city.p}${_rInt(1,9)}${_rLetter()} ${_rInt(1,9)}${_rLetter()}${_rInt(1,9)}`;

    return {
        title: 'Ontario Driver\'s Licence',
        sections: [{
            name: 'NAME / NOM', copyLabel: 'Copy All',
            fields: [
                { label:'1. FIRST NAME', value: fn },
                { label:'2. LAST NAME', value: ln },
                { label:'MIDDLE NAME', value: _rPick(_MALE_FIRST.concat(_FEMALE_FIRST)).slice(0,1) + '.' },
            ]
        },{
            name: 'ADDRESS / ADRESSE',
            fields: [
                { label:'ADDRESS', value: `${_rInt(100,9999)} ${_rPick(_CA_STREETS)}` },
                { label:'CITY', value: city.c },
                { label:'PROVINCE', value: 'ON' },
                { label:'POSTAL CODE', value: postal },
            ]
        },{
            name: 'DOCUMENT / NUMÉRO',
            fields: [
                { label:'4D. DL NUMBER', value: dlNum },
                { label:'4A. ISS / DÉL', value: issDate },
                { label:'4B. EXP', value: expDate },
                { label:'5. DD / REF', value: `DB${_rDigits(7)}` },
                { label:'12. REST / COND', value: `*${_rDigits(7)}*` },
            ]
        },{
            name: 'PERSONAL',
            fields: [
                { label:'15. SEX', value: sex },
                { label:'9. CLASS', value: 'G' },
                { label:'16. HEIGHT', value: `${_rInt(155,195)} cm` },
                { label:'3. DOB', value: `${dob.y}/${_pad2(dob.m)}/${_pad2(dob.d)}` },
            ]
        }]
    };
}

/* ═══ BC DL ═══ */
function generateBCDL(sex, tpl) {
    const {fn, ln} = tpl.holder ? (() => { const p = tpl.holder.split(/\s+/); return {fn:p[0]?.toUpperCase()||'JOHN', ln:p.slice(1).join(' ').toUpperCase()||'DOE'}; })() : _genName(sex);
    const dob = _genDOB(sex);
    const city = _rPick(_BC_CITIES);
    const dlNum = _rDigits(7);
    const postal = `${city.p}${_rInt(1,9)}${_rLetter()} ${_rInt(1,9)}${_rLetter()}${_rInt(1,9)}`;

    return {
        title: 'British Columbia Driver\'s Licence',
        sections: [{
            name: 'FRONT',
            fields: [
                { label:'FULL NAME', value: `${ln}, ${fn}` },
                { label:'ADDRESS', value: `${_rInt(100,9999)} ${_rPick(_CA_STREETS)}` },
                { label:'CITY', value: `${city.c}, BC` },
                { label:'POSTAL CODE', value: postal },
                { label:'DL NUMBER', value: dlNum },
                { label:'ISS', value: `${new Date().getFullYear()-_rInt(0,3)}-${_rPick(_MONTHS_SHORT)}-${_pad2(_rInt(1,28))}` },
                { label:'EXP', value: `${new Date().getFullYear()+_rInt(2,5)}-${_rPick(_MONTHS_SHORT)}-${_pad2(dob.d)}` },
                { label:'DOB', value: `${dob.y}-${_rPick(_MONTHS_SHORT)}-${_pad2(dob.d)}` },
                { label:'SEX', value: sex },
                { label:'HAIR', value: _rPick(_HAIR) },
                { label:'EYES', value: _rPick(_EYES) },
                { label:'HEIGHT', value: `${_rInt(155,195)} cm` },
                { label:'WEIGHT', value: `${(_rInt(550,950)/10).toFixed(1)} kg` },
            ]
        },{
            name: 'BACK SIDE',
            fields: [
                { label:'RESTRICTIONS', value: sex==='F' ? 'MUST DISPLAY "N" SIGN' : '47 0 BAC; MUST DISPLAY "N" SIGN' },
                { label:'HEALTH NUMBER', value: `${_rDigits(4)} ${_rDigits(3)} ${_rDigits(3)}` },
                { label:'BARCODE', value: `${_rLetter()}${_rDigits(7)}` },
            ]
        }]
    };
}

/* ═══ CANADIAN PASSPORT ═══ */
function generateCanadianPassport(sex, tpl) {
    const {fn, ln} = tpl.holder ? (() => { const p = tpl.holder.split(/\s+/); return {fn:p[0]?.toUpperCase()||'JOHN', ln:p.slice(1).join(' ').toUpperCase()||'DOE'}; })() : _genName(sex);
    const dob = _genDOB(sex);
    const ppNum = _rLetters(2) + _rDigits(6);
    const expY = new Date().getFullYear() + _rInt(5,10);
    const issY = expY - 10;
    const mrzSurname = ln.replace(/[^A-Z]/g,'');
    const mrzGiven = fn.replace(/[^A-Z]/g,'');
    const line1 = `P<CAN${mrzSurname}<<${mrzGiven}${'<'.repeat(Math.max(0, 44 - 5 - mrzSurname.length - 2 - mrzGiven.length))}`.slice(0,44);
    const dobStr = `${String(dob.y).slice(2)}${_pad2(dob.m)}${_pad2(dob.d)}`;
    const expStr = `${String(expY).slice(2)}${_pad2(dob.m)}${_pad2(dob.d)}`;
    const cd = n => String(n % 10);
    const line2 = `${ppNum}<${cd(_rInt(0,9))}CAN${dobStr}${cd(_rInt(0,9))}${sex}${expStr}${cd(_rInt(0,9))}${'<'.repeat(14)}${cd(_rInt(0,9))}`.slice(0,44);

    const provinces = ['ONTARIO','BRITISH COLUMBIA','QUEBEC','ALBERTA','NOVA SCOTIA'];

    return {
        title: 'Canadian Passport',
        sections: [{
            name: 'DOCUMENT INFO',
            fields: [
                { label:'TYPE', value: 'P' },
                { label:'COUNTRY', value: 'CAN' },
                { label:'PASSPORT NO.', value: ppNum },
                { label:'SURNAME', value: ln },
                { label:'GIVEN NAMES', value: fn },
                { label:'NATIONALITY', value: 'CANADIAN / CANADIENNE' },
                { label:'DOB', value: `${_pad2(dob.d)} ${_MONTHS_EN[dob.m-1].toUpperCase()} /${_MONTHS_FR[dob.m-1]} ${String(dob.y).slice(2)}` },
                { label:'SEX', value: sex },
                { label:'PLACE OF BIRTH', value: _rPick(provinces) },
                { label:'DATE OF ISSUE', value: `${_pad2(_rInt(1,28))} ${_MONTHS_EN[_rInt(0,11)].toUpperCase()} ${String(issY).slice(2)}` },
                { label:'DATE OF EXPIRY', value: `${_pad2(_rInt(1,28))} ${_MONTHS_EN[_rInt(0,11)].toUpperCase()} ${String(expY).slice(2)}` },
                { label:'AUTHORITY', value: _rPick(provinces) },
            ]
        },{
            name: 'PERFO / SERIAL',
            fields: [
                { label:'SERIAL 1', value: ppNum },
                { label:'SERIAL 2', value: `${_rLetters(3)}${_rDigits(5)}` },
            ]
        },{
            name: 'MRZ (MACHINE READABLE ZONE)',
            fields: [
                { label:'LINE 1', value: line1 },
                { label:'LINE 2', value: line2 },
            ]
        }]
    };
}

/* ═══ ROGERS BILL ═══ */
function generateRogersBill(sex, tpl) {
    const holder = tpl.holder || `${_rPick(_MALE_FIRST)} ${_rPick(_LAST_NAMES)}`;
    const billing = tpl.billing || 'CA, ON, Toronto, 5 Bay Street';
    const zip = tpl.zip || `M${_rInt(1,9)}${_rLetter()} ${_rInt(1,9)}${_rLetter()}${_rInt(1,9)}`;
    const total = (_rInt(8000,25000)/100).toFixed(2);
    const pastDue = (_rInt(0,3000)/100).toFixed(2);
    const saved = (_rInt(200,1500)/100).toFixed(2);
    const payDate = new Date(Date.now() + _rInt(10,30)*86400000);
    const billDate = new Date(Date.now() - _rInt(1,5)*86400000);

    return {
        title: 'Rogers Bill',
        sections: [{
            name: 'GREETING',
            fields: [
                { label:'HELLO', value: holder },
            ]
        },{
            name: 'TOTAL DUE',
            fields: [
                { label:'$ TOTAL DUE', value: `$${total}` },
                { label:'PAST DUE BALANCE', value: `$${pastDue}` },
                { label:'PAY $ BY DATE', value: `$${total}` },
                { label:'REQUIRED PAYMENT DATE', value: `${_pad2(payDate.getDate())} ${_MONTHS_EN[payDate.getMonth()]}, ${payDate.getFullYear()}` },
                { label:'YOU SAVED $', value: `$${saved}` },
            ]
        },{
            name: 'SUMMARY',
            fields: [
                { label:'BALANCE FORWARD', value: `$${pastDue}` },
                { label:'BUNDLED SERVICES', value: `$${(_rInt(5000,15000)/100).toFixed(2)}` },
                { label:'TOTAL (INCL HST)', value: `$${total}` },
            ]
        },{
            name: 'BOTTOM SECTION',
            fields: [
                { label:'POSTAL LINE', value: `##POSTAL${zip.replace(/\s/g,'')} ${_rDigits(23)};C;QCC;${_rDigits(9)};${_rDigits(3)}` },
                { label:'ACCOUNT NUMBER', value: _rDigits(9) },
                { label:'BILL DATE', value: `${_MONTHS_EN[billDate.getMonth()].toUpperCase()} ${_pad2(billDate.getDate())}, ${billDate.getFullYear()}` },
                { label:'BARCODE', value: _rDigits(30) },
            ]
        }]
    };
}

/* ═══ DISPATCH ═══ */
function generateDocument(docId, sex, templateText) {
    const tpl = _parseTemplate(templateText);
    switch(docId) {
        case 'ca-dl': return generateCaliforniaDL(sex, tpl);
        case 'on-dl': return generateOntarioDL(sex, tpl);
        case 'bc-dl': return generateBCDL(sex, tpl);
        case 'ca-pp': return generateCanadianPassport(sex, tpl);
        case 'rogers': return generateRogersBill(sex, tpl);
        default: return null;
    }
}

/* ═══ RENDER ═══ */
function renderGenerator() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.style.display = 'none';

    // Build sidebar tree
    let sidebarHTML = '';
    GEN_COUNTRIES.forEach(country => {
        const docs = GEN_DOCS.filter(d => d.country === country.code);
        if (!docs.length) return;
        const cats = [...new Set(docs.map(d => d.cat))];
        let childrenHTML = '';
        cats.forEach(cat => {
            const catIcon = cat==='DRIVER LICENSE' ? '🚗' : cat==='PASSPORT' ? '📘' : '⚡';
            childrenHTML += `<div class="gen-cat">${catIcon} ${cat}</div>`;
            docs.filter(d => d.cat===cat).forEach(d => {
                const active = d.id === _genState.docId;
                const badge = d.active ? '<span class="gen-badge-active">✓</span>' : '<span class="gen-badge-locked">🔒</span>';
                childrenHTML += `<button class="gen-doc-item ${active?'active':''} ${d.active?'':'locked'}" data-doc="${d.id}" ${d.active?'':'disabled'}>${d.name} ${badge}</button>`;
            });
        });
        sidebarHTML += `
            <div class="gen-country-group">
                <div class="gen-country-header"><span class="gen-country-flag">${country.flag}</span> ${country.name}</div>
                ${childrenHTML}
            </div>`;
    });

    const doc = GEN_DOCS.find(d => d.id === _genState.docId);
    const showSexToggle = doc && doc.cat === 'DRIVER LICENSE' || doc?.id === 'ca-pp';
    const showTemplate = doc?.cat !== 'UTILITY BILLS';

    // Config panel
    let configHTML = `<h2 class="gen-title">${doc?.icon||''} ${doc?.name || 'Select'} ${doc?.active ? '<span class="gen-active-badge">Active</span>' : ''}</h2><hr class="gen-hr">`;

    if (showSexToggle) {
        configHTML += `
            <div class="gen-sex-row">
                <span class="gen-label">Sex:</span>
                <button class="gen-sex-btn ${_genState.sex==='M'?'active':''}" data-sex="M">👤 Male (30-50)</button>
                <button class="gen-sex-btn ${_genState.sex==='F'?'active':''}" data-sex="F">👤 Female (30-50)</button>
            </div>`;
    }

    if (showTemplate) {
        configHTML += `
            <div class="gen-template-box">
                <div class="gen-template-header">
                    <span>◎ TEMPLATE (OPTIONAL):</span>
                </div>
                <textarea class="gen-template-input" id="gen-template" placeholder="👶 Holder: John Doe\n🏷 Billing: US, CA, Los Angeles, 123 Main St\n📦 ZIP: 90001"></textarea>
            </div>`;
    } else {
        configHTML += `
            <div class="gen-template-box">
                <div class="gen-template-header">
                    <span>👤 HOLDER + ADDRESS (OPTIONAL):</span>
                    <button class="gen-copy-tpl-btn" id="gen-copy-tpl">📋 Copy Template</button>
                </div>
                <textarea class="gen-template-input" id="gen-template" placeholder="👶 Holder: Nicole Ellen Ross\n🏷 Billing: CA, ON, Toronto, 5 Bay Street\n📦 ZIP: M2K 6C2"></textarea>
            </div>`;
    }

    configHTML += `<button class="gen-generate-btn" id="gen-generate-btn">🔄 Generate</button>`;

    // Output
    let outputHTML = '';
    if (_genState.result) {
        _genState.result.sections.forEach((sec, si) => {
            outputHTML += `<div class="gen-section">
                <div class="gen-section-header">
                    <span class="gen-section-title">${sec.name}</span>
                    <button class="gen-copy-section-btn" data-si="${si}">${sec.copyLabel || 'Copy'}</button>
                </div>`;
            sec.fields.forEach((f, fi) => {
                outputHTML += `
                    <div class="gen-field-row">
                        <span class="gen-field-label">${f.label}</span>
                        <span class="gen-field-value">${f.value}</span>
                        <div class="gen-field-actions">
                            <button class="gen-regen-btn" data-si="${si}" data-fi="${fi}" title="Regenerate">🔄</button>
                            <button class="gen-copy-btn" data-val="${f.value.replace(/"/g,'&quot;')}" title="Copy">📋</button>
                        </div>
                    </div>`;
            });
            outputHTML += '</div>';
        });
        outputHTML += `<button class="gen-copy-all-btn" id="gen-copy-all">📋 Copy All</button>`;
    }

    area.innerHTML = `
        <div class="gen-container">
            <div class="gen-sidebar">${sidebarHTML}</div>
            <div class="gen-main">
                <div class="gen-config">${configHTML}</div>
                <div class="gen-output">${outputHTML}</div>
            </div>
        </div>`;

    // ── Event bindings ──
    area.querySelectorAll('.gen-doc-item').forEach(btn => {
        btn.addEventListener('click', () => {
            _genState.docId = btn.dataset.doc;
            _genState.result = null;
            renderGenerator();
        });
    });
    area.querySelectorAll('.gen-sex-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _genState.sex = btn.dataset.sex;
            renderGenerator();
        });
    });
    document.getElementById('gen-generate-btn')?.addEventListener('click', () => {
        const tplText = document.getElementById('gen-template')?.value || '';
        _genState.result = generateDocument(_genState.docId, _genState.sex, tplText);
        renderGenerator();
    });
    document.getElementById('gen-copy-tpl')?.addEventListener('click', () => {
        const tpl = `👶 Holder: John Doe\n🏷 Billing: CA, ON, Toronto, 5 Bay Street\n📦 ZIP: M2K 6C2`;
        navigator.clipboard?.writeText(tpl);
        toast('Template copied', 'success');
    });
    area.querySelectorAll('.gen-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard?.writeText(btn.dataset.val);
            toast('Copied', 'success');
        });
    });
    area.querySelectorAll('.gen-copy-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const si = parseInt(btn.dataset.si);
            const sec = _genState.result?.sections[si];
            if (sec) {
                const text = sec.fields.map(f => `${f.label}: ${f.value}`).join('\n');
                navigator.clipboard?.writeText(text);
                toast(`${sec.name} copied`, 'success');
            }
        });
    });
    document.getElementById('gen-copy-all')?.addEventListener('click', () => {
        if (_genState.result) {
            const text = _genState.result.sections.map(s => `── ${s.name} ──\n` + s.fields.map(f => `${f.label}: ${f.value}`).join('\n')).join('\n\n');
            navigator.clipboard?.writeText(text);
            toast('All copied', 'success');
        }
    });
    area.querySelectorAll('.gen-regen-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tplText = document.getElementById('gen-template')?.value || '';
            _genState.result = generateDocument(_genState.docId, _genState.sex, tplText);
            renderGenerator();
        });
    });
}

// ──── RENDER BUILDER ────

function renderBuilder() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.innerHTML = '';

    area.innerHTML = `
    <div class="tool-stub-container">
        <div class="tool-stub-icon">🏗️</div>
        <h2 class="tool-stub-title">Builder</h2>
        <p class="tool-stub-desc">Tag combination builder — Agoda + BIN + Amount + Comment</p>
        <div class="tool-stub-features">
            <div class="tool-stub-feature">
                <span class="tool-stub-dot" style="background:#818CF8"></span>
                <span>Build tag combinations</span>
            </div>
            <div class="tool-stub-feature">
                <span class="tool-stub-dot" style="background:#22C55E"></span>
                <span>Save presets</span>
            </div>
            <div class="tool-stub-feature">
                <span class="tool-stub-dot" style="background:#F59E0B"></span>
                <span>Export ready combinations</span>
            </div>
        </div>
    </div>`;
}

// ──── RENDER PARSER ────

function renderParser() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.innerHTML = '';

    area.innerHTML = `
    <div class="parser-container">
        <!-- UPLOAD ZONE -->
        <div class="parser-upload-zone" id="parser-drop-zone">
            <input type="file" id="parser-file-input" accept=".json" hidden>
            <div class="parser-upload-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M12 16V4m0 0L8 8m4-4l4 4"/><path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2"/></svg>
                <span class="parser-upload-title">${PARSER_STATE.file ? '📁 ' + PARSER_STATE.file : 'Drop result.json or click to upload'}</span>
                <span class="parser-upload-hint">Telegram JSON export · 100% local · no internet</span>
            </div>
        </div>

        <!-- FILTERS -->
        <div class="parser-filters">
            <div class="parser-filter-row">
                <div class="parser-filter-group parser-filter-bins">
                    <label>BINs <span class="parser-filter-hint">(comma separated)</span></label>
                    <textarea id="parser-bins" rows="2" placeholder="450003, 424242, 532610..."></textarea>
                </div>
                <div class="parser-filter-group">
                    <label>Country</label>
                    <input type="text" id="parser-country" placeholder="CA, US, GB...">
                </div>
                <div class="parser-filter-group">
                    <label>Bank</label>
                    <input type="text" id="parser-bank" placeholder="Bank name...">
                </div>
            </div>
        </div>

        <!-- OPTIONS -->
        <div class="parser-options">
            <label class="parser-checkbox"><input type="checkbox" id="parser-dedup" checked> Remove duplicates</label>
        </div>

        <!-- ACTIONS -->
        <div class="parser-actions">
            <button class="btn-primary parser-parse-btn" id="parser-parse-btn" disabled>🔍 PARSE</button>
            <button class="btn-primary parser-collect-btn" id="parser-collect-btn" disabled>📦 COLLECT ALL</button>
            <button class="btn-outline parser-clear-btn" id="parser-clear-btn">🗑 CLEAR</button>
            <span class="parser-status" id="parser-status"></span>
        </div>

        <!-- RESULTS -->
        <div class="parser-results" id="parser-results"></div>
    </div>`;

    // Upload handlers
    const dropZone = document.getElementById('parser-drop-zone');
    const fileInput = document.getElementById('parser-file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); loadParserFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadParserFile(fileInput.files[0]); });

    document.getElementById('parser-parse-btn').addEventListener('click', runParse);
    document.getElementById('parser-collect-btn').addEventListener('click', collectAll);
    document.getElementById('parser-clear-btn').addEventListener('click', clearParser);


    if (PARSER_STATE.collected.length > 0) renderParserResults();
}

function loadParserFile(file) {
    if (!file) return;
    PARSER_STATE.file = file.name;
    document.querySelector('.parser-upload-title').textContent = '📁 ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
    document.getElementById('parser-parse-btn').disabled = false;
    document.getElementById('parser-collect-btn').disabled = false;

    const status = document.getElementById('parser-status');
    status.textContent = '⏳ Reading...';

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const messages = Array.isArray(data) ? data : (data.messages || []);
            PARSER_STATE.rawMessages = messages;
            status.textContent = `✅ ${messages.length.toLocaleString()} messages loaded`;
            toast(`File loaded: ${messages.length.toLocaleString()} messages`, 'success');
        } catch (err) {
            status.textContent = '❌ Invalid JSON';
            toast('Error: invalid JSON file', 'error');
        }
    };
    reader.onerror = () => { status.textContent = '❌ Read error'; };
    reader.readAsText(file);
}

// ──── PARSE (with filters) ────

function runParse() {
    if (!PARSER_STATE.rawMessages.length) return;
    const status = document.getElementById('parser-status');
    status.textContent = '⏳ Parsing...';

    const dedup = document.getElementById('parser-dedup').checked;

    // Read filters
    const binRaw = document.getElementById('parser-bins').value.trim();
    const binFilters = binRaw ? binRaw.split(/[\s,;|]+/).map(b => b.replace(/\D/g, '').slice(0, 6)).filter(b => b.length >= 4) : [];
    const countryFilter = document.getElementById('parser-country').value.trim().toUpperCase();
    const bankFilter = document.getElementById('parser-bank').value.trim().toLowerCase();

    let allCards = extractCardsFromMessages(PARSER_STATE.rawMessages);

    // Always detect GEO
    allCards = allCards.map(c => ({ ...c, detectedGeo: detectGeo(c.billing, c.country) }));

    // Apply filters
    if (binFilters.length > 0) {
        allCards = allCards.filter(c => binFilters.some(bf => c.bin.startsWith(bf)));
    }
    if (countryFilter) {
        const codes = countryFilter.split(/[\s,;]+/).filter(Boolean);
        allCards = allCards.filter(c => {
            const geo = (c.detectedGeo || c.country || '').toUpperCase();
            return codes.some(code => geo.includes(code));
        });
    }
    if (bankFilter) {
        allCards = allCards.filter(c => (c.bank || '').toLowerCase().includes(bankFilter));
    }


    if (dedup) {
        const seen = new Set();
        allCards = allCards.filter(c => { if (seen.has(c.cc)) return false; seen.add(c.cc); return true; });
    }

    PARSER_STATE.binFilter = binFilters.length > 0 ? new Set(binFilters) : null;
    finishParsing(allCards, status);
}

// ──── COLLECT ALL (no filters) ────

function collectAll() {
    if (!PARSER_STATE.rawMessages.length) return;
    const status = document.getElementById('parser-status');
    status.textContent = '⏳ Collecting...';

    const dedup = document.getElementById('parser-dedup').checked;

    let allCards = extractCardsFromMessages(PARSER_STATE.rawMessages);
    // Always detect GEO
    allCards = allCards.map(c => ({ ...c, detectedGeo: detectGeo(c.billing, c.country) }));
    if (dedup) {
        const seen = new Set();
        allCards = allCards.filter(c => { if (seen.has(c.cc)) return false; seen.add(c.cc); return true; });
    }

    PARSER_STATE.binFilter = null;
    finishParsing(allCards, status);
}

function finishParsing(allCards, status) {
    const binMap = {};
    allCards.forEach(c => { if (!binMap[c.bin]) binMap[c.bin] = []; binMap[c.bin].push(c); });

    const binGroups = Object.entries(binMap)
        .map(([bin, cards]) => ({ bin, count: cards.length, cards }))
        .sort((a, b) => b.count - a.count);

    PARSER_STATE.collected = allCards;
    PARSER_STATE.binGroups = binGroups;
    PARSER_STATE.selected = new Set(allCards.map((_, i) => i));

    status.textContent = `✅ ${allCards.length} cards · ${binGroups.length} BINs`;
    toast(`Found: ${allCards.length} cards, ${binGroups.length} unique BINs`, 'success');
    renderParserResults();
}

// ──── RENDER RESULTS ────

function renderParserResults(geoFilter) {
    const el = document.getElementById('parser-results');
    if (!el) return;

    let list = PARSER_STATE.collected;
    if (list.length === 0) {
        el.innerHTML = '<div class="empty-state"><p>No cards found</p></div>';
        return;
    }

    // ──── GEO data ────
    const geoMap = {};
    list.forEach(c => {
        const geo = (c.detectedGeo || c.country || '').toUpperCase();
        if (geo) geoMap[geo] = (geoMap[geo] || 0) + 1;
    });
    const geoList = Object.entries(geoMap).sort((a, b) => b[1] - a[1]);

    const countryFlags = {
        US:'🇺🇸',CA:'🇨🇦',GB:'🇬🇧',DE:'🇩🇪',FR:'🇫🇷',AE:'🇦🇪',AU:'🇦🇺',IT:'🇮🇹',ES:'🇪🇸',
        NL:'🇳🇱',BR:'🇧🇷',MX:'🇲🇽',JP:'🇯🇵',KR:'🇰🇷',IN:'🇮🇳',RU:'🇷🇺',UA:'🇺🇦',PL:'🇵🇱',
        SE:'🇸🇪',NO:'🇳🇴',DK:'🇩🇰',FI:'🇫🇮',CH:'🇨🇭',AT:'🇦🇹',BE:'🇧🇪',IE:'🇮🇪',PT:'🇵🇹',
        CZ:'🇨🇿',IL:'🇮🇱',SG:'🇸🇬',HK:'🇭🇰',NZ:'🇳🇿',SA:'🇸🇦',ZA:'🇿🇦',TR:'🇹🇷',TH:'🇹🇭',
        PH:'🇵🇭',MY:'🇲🇾',ID:'🇮🇩',VN:'🇻🇳',AR:'🇦🇷',CL:'🇨🇱',CO:'🇨🇴',PE:'🇵🇪',EG:'🇪🇬'
    };
    const countryNames = {
        US:'United States',CA:'Canada',GB:'United Kingdom',DE:'Germany',FR:'France',AE:'UAE',
        AU:'Australia',IT:'Italy',ES:'Spain',NL:'Netherlands',BR:'Brazil',MX:'Mexico',
        JP:'Japan',KR:'South Korea',IN:'India',RU:'Russia',UA:'Ukraine',PL:'Poland',
        SE:'Sweden',NO:'Norway',DK:'Denmark',FI:'Finland',CH:'Switzerland',AT:'Austria',
        BE:'Belgium',IE:'Ireland',PT:'Portugal',CZ:'Czech Republic',IL:'Israel',SG:'Singapore',
        HK:'Hong Kong',NZ:'New Zealand',SA:'Saudi Arabia',ZA:'South Africa',TR:'Turkey',
        TH:'Thailand',PH:'Philippines',MY:'Malaysia',ID:'Indonesia',VN:'Vietnam',
        AR:'Argentina',CL:'Chile',CO:'Colombia',PE:'Peru',EG:'Egypt'
    };

    // Apply GEO filter to displayed list
    const activeGeo = geoFilter || '';
    let displayList = list;
    if (activeGeo) {
        displayList = list.filter(c => (c.detectedGeo || c.country || '').toUpperCase() === activeGeo);
    }

    // ──── GEO dropdown ────
    const geoDropdownHtml = `
        <div class="parser-geo-filter">
            <label>GEO Filter</label>
            <select id="parser-geo-select">
                <option value="">ALL (${list.length})</option>
                ${geoList.map(([code, cnt]) => {
                    const fl = countryFlags[code] || '🏳️';
                    const nm = countryNames[code] || code;
                    return `<option value="${code}" ${code === activeGeo ? 'selected' : ''}>${fl} ${nm} (${cnt})</option>`;
                }).join('')}
            </select>
        </div>`;

    // ──── BIN Analytics ────
    const binAnalytics = {};
    displayList.forEach(c => {
        if (!binAnalytics[c.bin]) binAnalytics[c.bin] = { count: 0, bank: c.bank || '' };
        binAnalytics[c.bin].count++;
        if (!binAnalytics[c.bin].bank && c.bank) binAnalytics[c.bin].bank = c.bank;
    });
    const sortedBins = Object.entries(binAnalytics)
        .map(([bin, d]) => ({ bin, count: d.count, bank: d.bank }))
        .sort((a, b) => b.count - a.count);

    const binAnalyticsHtml = sortedBins.slice(0, 50).map(b => {
        const bankShort = b.bank.length > 20 ? b.bank.slice(0, 20) + '…' : (b.bank || '—');
        return `<div class="parser-bin-row"><span class="parser-bin-val">${b.bin}</span><span class="parser-bin-bank">${bankShort}</span><span class="parser-bin-cnt">${b.count}</span></div>`;
    }).join('');

    // ──── TABLE ROWS ────
    const existingNumbers = new Set(STATE.cards.map(c => c.cardNumber.replace(/\s/g, '')));
    const parserBinCounts = {};
    displayList.forEach(c => { parserBinCounts[c.bin] = (parserBinCounts[c.bin] || 0) + 1; });

    // Sort support
    const sortBy = PARSER_STATE.sortBy || 'index';
    let sortedDisplay = [...displayList];
    if (sortBy === 'bin-desc') {
        sortedDisplay.sort((a, b) => (parserBinCounts[b.bin] || 0) - (parserBinCounts[a.bin] || 0));
    } else if (sortBy === 'bin-asc') {
        sortedDisplay.sort((a, b) => (parserBinCounts[a.bin] || 0) - (parserBinCounts[b.bin] || 0));
    }

    const rows = sortedDisplay.map((c, i) => {
        const origIdx = displayList.indexOf(c);
        const isDup = existingNumbers.has(c.cc);
        const geo = c.detectedGeo || c.country || '';
        const bankShort = (c.bank || '').length > 16 ? (c.bank || '').slice(0, 16) + '…' : (c.bank || '—');
        const dupMark = isDup ? '<span class="parser-dup-tag">DUP</span> ' : '';
        const binCnt = parserBinCounts[c.bin] || 0;

        return `<tr class="${isDup ? 'parser-row-dup' : ''}">
            <td class="pc-chk"><input type="checkbox" ${PARSER_STATE.selected.has(origIdx) ? 'checked' : ''} data-idx="${origIdx}" class="parser-check"></td>
            <td class="pc-num">${i + 1}</td>
            <td class="pc-holder">${dupMark}${c.name.toUpperCase()} ${c.surname.toUpperCase()}</td>
            <td class="pc-card">${formatCardBin(c.cc)}</td>
            <td class="pc-exp">${c.validity}</td>
            <td class="pc-bin">${c.bin} <span class="parser-bin-cnt-inline">(${binCnt})</span></td>
            <td class="pc-bank" title="${c.bank || ''}">${bankShort}</td>
            <td class="pc-geo">${geo}</td>
        </tr>`;
    }).join('');

    const binSortIcon = sortBy === 'bin-desc' ? '↓' : sortBy === 'bin-asc' ? '↑' : '↕';

    el.innerHTML = `
        <!-- GEO + TOOLBAR -->
        <div class="parser-toolbar">
            ${geoDropdownHtml}
            <label class="parser-checkbox"><input type="checkbox" id="parser-select-all" ${PARSER_STATE.selected.size === displayList.length ? 'checked' : ''}> Select All (${PARSER_STATE.selected.size})</label>
            <div class="parser-add-section">
                <button class="parser-notes-btn" id="parser-add-notes-btn">📝 ADD TO NOTES (${PARSER_STATE.selected.size})</button>
            </div>
        </div>

        <!-- BIN ANALYTICS -->
        <div class="parser-bin-analytics">
            <div class="parser-bin-analytics-header">📊 BIN Analytics (${sortedBins.length} unique)</div>
            <div class="parser-bin-analytics-list">${binAnalyticsHtml}</div>
        </div>

        <!-- TABLE -->
        <div class="parser-table-wrap">
        <table class="data-table parser-table">
            <colgroup>
                <col style="width:28px"><col style="width:32px">
                <col style="width:17%"><col style="width:14%"><col style="width:45px">
                <col style="width:11%"><col style="width:18%"><col style="width:36px">
            </colgroup>
            <thead><tr>
                <th></th><th>#</th><th>HOLDER</th><th>CARD</th><th>EXP</th>
                <th class="parser-sort-th" id="parser-sort-bin" title="Sort by BIN count">BIN ${binSortIcon}</th>
                <th>BANK</th><th>GEO</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        </div>`;

    // ──── Events ────
    el.querySelectorAll('.parser-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const idx = parseInt(cb.dataset.idx);
            if (cb.checked) PARSER_STATE.selected.add(idx); else PARSER_STATE.selected.delete(idx);
            updateParserButtons();
        });
    });

    const selectAll = document.getElementById('parser-select-all');
    if (selectAll) {
        selectAll.addEventListener('change', () => {
            PARSER_STATE.selected = selectAll.checked ? new Set(displayList.map((_, i) => i)) : new Set();
            el.querySelectorAll('.parser-check').forEach(cb => { cb.checked = selectAll.checked; });
            updateParserButtons();
        });
    }

    document.getElementById('parser-add-notes-btn')?.addEventListener('click', addCollectedToNotes);

    // GEO filter change
    document.getElementById('parser-geo-select')?.addEventListener('change', (e) => {
        renderParserResults(e.target.value);
    });

    // BIN sort toggle
    document.getElementById('parser-sort-bin')?.addEventListener('click', () => {
        if (PARSER_STATE.sortBy === 'bin-desc') PARSER_STATE.sortBy = 'bin-asc';
        else PARSER_STATE.sortBy = 'bin-desc';
        renderParserResults(activeGeo);
    });
}

function updateParserButtons() {
    const notesBtn = document.getElementById('parser-add-notes-btn');
    if (notesBtn) notesBtn.textContent = `📝 ADD TO NOTES (${PARSER_STATE.selected.size})`;
}

function addCollectedToNotes() {
    const list = PARSER_STATE.collected;
    if (PARSER_STATE.selected.size === 0) { toast('No cards selected', 'warning'); return; }

    // Show format selection modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:420px">
            <h3 style="margin:0 0 12px;font-size:15px;color:var(--c-text-primary)">📝 Choose Export Format</h3>
            <div class="format-options">
                <button class="format-option-btn" data-format="full">
                    <span class="format-icon">📋</span>
                    <span class="format-label">Full Info</span>
                    <span class="format-desc">💳 CC, 📅 Validity, 🔐 CVV, 👶 Holder, 🏦 Bank, 📊 Type</span>
                </button>
                <button class="format-option-btn" data-format="checker">
                    <span class="format-icon">🔍</span>
                    <span class="format-label">Checker Format</span>
                    <span class="format-desc">4242424242424242 03 27 111</span>
                </button>
                <button class="format-option-btn" data-format="raw">
                    <span class="format-icon">📄</span>
                    <span class="format-label">Raw Data</span>
                    <span class="format-desc">Name | CC | Exp | BIN | Bank | GEO</span>
                </button>
            </div>
            <button class="btn-outline" id="format-cancel" style="width:100%;margin-top:8px;padding:6px">Cancel</button>
        </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#format-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('.format-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const format = btn.dataset.format;
            modal.remove();
            executeAddToNotes(format);
        });
    });
}

function executeAddToNotes(format) {
    const list = PARSER_STATE.collected;
    const lines = [];

    PARSER_STATE.selected.forEach(idx => {
        const c = list[idx];
        if (!c) return;

        const ccClean = (c.cc || '').replace(/\s/g, '');
        const mm = (c.mm || '').padStart(2, '0');
        const yy = c.yy || '';
        const cvv = c.cvv || '000';

        if (format === 'full') {
            lines.push(`💳 CC: ${ccClean}`);
            lines.push(`📅 Validity: ${c.validity}`);
            lines.push(`🔐 CVV: ${cvv}`);
            lines.push(`👶 Holder: ${c.name} ${c.surname}`);
            lines.push(`🏦 Bank: ${c.bank || '-'}`);
            lines.push(`📊 Card Type: ${c.cardType || c.detectedGeo || '-'}`);
            lines.push('');
        } else if (format === 'checker') {
            lines.push(`${ccClean} ${mm} ${yy} ${cvv}`);
        } else {
            lines.push(`${c.name} ${c.surname} | ${c.cc} | ${c.validity} | BIN:${c.bin} | ${c.bank || '-'} | ${c.detectedGeo || '-'}`);
        }
    });

    if (lines.length > 0) {
        const formatLabel = format === 'full' ? 'Full Info' : format === 'checker' ? 'Checker' : 'Raw';
        const header = `\n--- Parser Import [${formatLabel}] (${new Date().toLocaleDateString()}) ---`;
        const block = header + '\n' + lines.join('\n');
        // Write to active notes tab
        const activeTab = _getActiveNoteTab();
        if (activeTab) {
            activeTab.content = (activeTab.content || '') + block + '\n';
        }
        STATE.notes = (STATE.notes || '') + block + '\n';
        STATE.notesLastSaved = Date.now();
        save();
        toast(`${lines.length} cards added to Notes → "${activeTab?.title || 'Main'}" (${formatLabel})`, 'success');
    }
}

function clearParser() {
    PARSER_STATE.rawMessages = [];
    PARSER_STATE.collected = [];
    PARSER_STATE.binGroups = [];
    PARSER_STATE.selected = new Set();
    PARSER_STATE.file = '';
    PARSER_STATE.binFilter = null;
    PARSER_STATE.sortBy = 'index';
    renderParser();
    toast('Parser cleared', 'info');
}

function populateDateDropdowns() {
    const curYear = new Date().getFullYear();
    const minYear = 2026;
    const maxYear = curYear + 5;
    ['df', 'dt'].forEach(prefix => {
        const ySel = document.getElementById(`parser-${prefix}-year`);
        const mSel = document.getElementById(`parser-${prefix}-month`);
        if (!ySel || !mSel) return;
        for (let y = minYear; y <= maxYear; y++) {
            ySel.innerHTML += `<option value="${y}">${y}</option>`;
        }
        for (let m = 1; m <= 12; m++) {
            mSel.innerHTML += `<option value="${String(m).padStart(2,'0')}">${String(m).padStart(2,'0')}</option>`;
        }
    });
}

function getExpFromDropdowns(prefix) {
    const y = document.getElementById(`parser-${prefix}-year`)?.value;
    const m = document.getElementById(`parser-${prefix}-month`)?.value;
    if (!y) return 0;
    return parseInt(y) * 100 + parseInt(m || '01');
}

// ──── ADD TO READY TO WORK ────

function addCollectedToCards() {
    const targetCountry = document.getElementById('parser-target-country')?.value || STATE.currentCountry;
    const autoReplace = document.getElementById('parser-auto-replace')?.checked || false;
    const detectGeoFlag = true;
    const list = PARSER_STATE.collected;
    let added = 0, replaced = 0;
    const addedIndices = new Set();

    const existingNumbers = new Map();
    STATE.cards.forEach(c => { existingNumbers.set(c.cardNumber.replace(/\s/g, ''), c); });

    PARSER_STATE.selected.forEach(idx => {
        const c = list[idx];
        if (!c) return;
        const existing = existingNumbers.get(c.cc);

        if (existing) {
            if (autoReplace) {
                existing.cardNumber = c.cc;
                if (c.cvv) existing.cvv = c.cvv;
                if (c.name) existing.name = c.name;
                if (c.surname) existing.surname = c.surname;
                replaced++;
            }
            addedIndices.add(idx);
            return;
        }

        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getFullYear()).slice(2)}`;
        const geo = detectGeoFlag ? (c.detectedGeo || targetCountry) : targetCountry;

        STATE.cards.push({
            id: crypto.randomUUID(),
            name: c.name || 'UNKNOWN',
            surname: c.surname || '',
            cardNumber: c.cc,
            month: c.mm || '',
            year: c.yy || '',
            cvv: c.cvv || '',
            country: geo,
            cardType: c.cardType || getCardType(c.cc),
            docType: '',
            amount: '',
            notes: '',
            date: dateStr,
            cardAdd: false,
            runAds: false,
            verified: false,
            starred: false,
            mailVerify: false,
            mailSubmit: false,
            mailNone: false,
            readyToWork: true
        });
        existingNumbers.set(c.cc, STATE.cards[STATE.cards.length - 1]);
        ensureDoc(STATE.cards[STATE.cards.length - 1]);
        addedIndices.add(idx);
        added++;
    });

    if (added > 0 || replaced > 0) {
        // Remove processed cards from parser results
        PARSER_STATE.collected = PARSER_STATE.collected.filter((_, i) => !addedIndices.has(i));
        // Rebuild bin groups
        const binMap = {};
        PARSER_STATE.collected.forEach(c => { if (!binMap[c.bin]) binMap[c.bin] = []; binMap[c.bin].push(c); });
        PARSER_STATE.binGroups = Object.entries(binMap)
            .map(([bin, cards]) => ({ bin, count: cards.length, cards }))
            .sort((a, b) => b.count - a.count);
        PARSER_STATE.selected = new Set(PARSER_STATE.collected.map((_, i) => i));

        save();
        renderSidebar();
        let msg = `✅ ${added} cards → Ready to Work`;
        if (replaced > 0) msg += `, ${replaced} updated`;
        toast(msg, 'success');
        renderParserResults();
    } else {
        toast('No new cards to add (all duplicates)', 'info');
    }
}
// ──── VIEW DENSITY SYSTEM ────
(function initDensity() {
    const app = document.querySelector('.app');
    const saved = localStorage.getItem('ct_density') || 'default';
    applyDensity(saved);

    document.getElementById('density-switcher').addEventListener('click', (e) => {
        const btn = e.target.closest('.density-btn');
        if (!btn) return;
        const density = btn.dataset.density;
        applyDensity(density);
        localStorage.setItem('ct_density', density);
    });

    function applyDensity(density) {
        app.classList.remove('density-compact', 'density-comfortable');
        if (density === 'compact') app.classList.add('density-compact');
        if (density === 'comfortable') app.classList.add('density-comfortable');

        document.querySelectorAll('.density-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.density === density);
        });
    }

    /* ═══════════════════════════════════════════
       NOTES HELPER FUNCTIONS
       ═══════════════════════════════════════════ */
    function saveNotesAction() {
        const textarea = document.getElementById('notes-textarea');
        if (!textarea) return;
        STATE.notes = textarea.value;
        STATE.notesLastSaved = new Date().toISOString();
        save();
        toast('Notes saved', 'success');
        const savedInfo = document.querySelector('.notes-saved-info');
        if (savedInfo) savedInfo.textContent = 'Saved ' + new Date().toLocaleTimeString();
    }

    function changeNotesFontSize(delta) {
        STATE.notesFontSize = Math.max(10, Math.min(24, (STATE.notesFontSize || 14) + delta));
        const textarea = document.getElementById('notes-textarea');
        if (textarea) textarea.style.fontSize = STATE.notesFontSize + 'px';
        const display = document.getElementById('notes-font-size-display');
        if (display) display.textContent = STATE.notesFontSize;
        save();
    }

    function importNotesAction() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.csv,.text';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const textarea = document.getElementById('notes-textarea');
                if (textarea) {
                    textarea.value += (textarea.value ? '\n' : '') + ev.target.result;
                    textarea.dispatchEvent(new Event('input'));
                }
                toast('Imported: ' + file.name, 'success');
            };
            reader.readAsText(file);
        });
        input.click();
    }

    function exportNotesAction() {
        const textarea = document.getElementById('notes-textarea');
        if (!textarea || !textarea.value.trim()) {
            toast('Notes are empty', 'error');
            return;
        }
        const blob = new Blob([textarea.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes_' + new Date().toISOString().slice(0, 10) + '.txt';
        a.click();
        URL.revokeObjectURL(url);
        toast('Notes exported', 'success');
    }

    /* ═══════════════════════════════════════════
       FORMAT SELECTION (ADD TO NOTES from Parser)
       ═══════════════════════════════════════════ */
    function addCollectedToNotes(cards) {
        if (!cards || !cards.length) {
            toast('No cards to add', 'error');
            return;
        }
        // Show format selection modal
        const overlay = document.getElementById('format-modal-overlay');
        overlay.classList.remove('hidden');

        const closeModal = () => overlay.classList.add('hidden');
        document.getElementById('format-modal-close').onclick = closeModal;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); }, { once: true });

        overlay.querySelectorAll('.format-option-btn').forEach(btn => {
            btn.onclick = () => {
                const format = btn.dataset.format;
                let lines = [];

                cards.forEach(c => {
                    const num = (c.number || c.cardNumber || '').replace(/\s/g, '');
                    const expM = (c.expMonth || c.exp_month || '').toString().padStart(2, '0');
                    const expY = (c.expYear || c.exp_year || '').toString().slice(-2);
                    const cvv = c.cvv || c.cvc || '';
                    const holder = c.holder || c.name || '';
                    const bank = c.bank || '';
                    const type = c.type || c.cardType || '';

                    if (format === 'full') {
                        lines.push(`💳 CC: ${num}`);
                        lines.push(`📅 Validity: ${expM}/${expY}`);
                        lines.push(`🔐 CVV: ${cvv}`);
                        lines.push(`👶 Holder: ${holder}`);
                        lines.push(`🏦 Bank: ${bank}`);
                        lines.push(`📊 Card Type: ${type}`);
                        lines.push('');
                    } else if (format === 'checker') {
                        lines.push(`${num} ${expM} ${expY} ${cvv}`);
                    } else if (format === 'raw') {
                        lines.push(`${num}|${expM}|${expY}|${cvv}`);
                    }
                });

                // Append to active notes tab
                const activeTab = _getActiveNoteTab();
                if (activeTab) {
                    activeTab.content = (activeTab.content || '') + (activeTab.content ? '\n' : '') + lines.join('\n');
                }
                STATE.notes = (STATE.notes || '') + (STATE.notes ? '\n' : '') + lines.join('\n');
                STATE.notesLastSaved = Date.now();
                save();
                closeModal();
                toast(`Added ${cards.length} cards to Notes (${format})`, 'success');
            };
        });
    }

    /* ═══════════════════════════════════════════
       VIPER CHECKER API INTEGRATION
       ═══════════════════════════════════════════ */
    const PROXY_BASE = 'http://localhost:3777';

    async function viperRequest(path, method = 'GET', body = null) {
        const token = document.getElementById('checker-token')?.value || localStorage.getItem('viper_token') || '';
        if (!token) throw new Error('No API token set');
        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        };
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(PROXY_BASE + path, opts);
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.Error || `HTTP ${res.status}`);
        }
        return data;
    }

    // Normalize any card line to CCN|MM|YY|CVV format
    function normalizeCardLine(line) {
        const cleaned = line.trim();
        if (!cleaned) return null;
        // Match: 13-19 digit card, then month (1-12), then year (2 or 4 digit), then CVV (3-4 digit)
        // Separators can be any non-alphanumeric char(s)
        const m = cleaned.match(/(\d[\d\s\-]{11,22}\d)\D+(0?[1-9]|1[012])\D+(\d{2}|\d{4})\D+(\d{3,4})/);
        if (!m) return null;
        const ccn = m[1].replace(/[\s\-]/g, '');
        if (ccn.length < 13 || ccn.length > 19) return null;
        const mm = m[2].padStart(2, '0');
        let yy = m[3];
        if (yy.length === 4) yy = yy.slice(2); // 2029 → 29
        const cvv = m[4];
        return `${ccn}|${mm}|${yy}|${cvv}`;
    }

    function openChecker() {
        const overlay = document.getElementById('checker-overlay');
        overlay.classList.remove('hidden');

        // Restore saved token
        const savedToken = localStorage.getItem('viper_token') || '';
        const tokenInput = document.getElementById('checker-token');
        if (savedToken && tokenInput) tokenInput.value = savedToken;

        // Auto-load selected cards (or all current workspace cards)
        const inputArea = document.getElementById('checker-input');
        if (inputArea && !inputArea.value.trim()) {
            const cards = getFilteredCards();
            const checkerLines = cards
                .filter(c => c.cardNumber && (c.month || c.mm) && c.cvv)
                .map(c => {
                    const mm = (c.month || c.mm || '').padStart(2, '0');
                    const yy = c.year || c.yy || '';
                    return `${c.cardNumber}|${mm}|${yy}|${c.cvv}`;
                });
            if (checkerLines.length) {
                inputArea.value = checkerLines.join('\n');
                updateCheckerInputCount();
            }
        }

        // Bind events
        document.getElementById('checker-close').onclick = closeChecker;
        overlay.onclick = (e) => { if (e.target === overlay) closeChecker(); };
        document.getElementById('checker-balance-btn').onclick = fetchBalance;
        document.getElementById('checker-load-methods').onclick = loadCheckMethods;
        document.getElementById('checker-check-btn').onclick = checkCards;
        document.getElementById('checker-copy-results').onclick = copyResults;
        if (inputArea) inputArea.oninput = updateCheckerInputCount;

        // Save token on change
        if (tokenInput) tokenInput.oninput = () => {
            localStorage.setItem('viper_token', tokenInput.value);
        };
    }

    function closeChecker() {
        document.getElementById('checker-overlay').classList.add('hidden');
    }

    function updateCheckerInputCount() {
        const input = document.getElementById('checker-input');
        const count = document.getElementById('checker-input-count');
        if (!input || !count) return;
        const lines = input.value.trim().split('\n').filter(l => l.trim());
        const valid = lines.filter(l => normalizeCardLine(l)).length;
        count.textContent = valid + '/' + lines.length + ' valid';
        count.style.color = valid === lines.length ? '#22C55E' : '#F59E0B';
    }

    async function fetchBalance() {
        const display = document.getElementById('checker-balance-display');
        try {
            display.textContent = '...';
            display.style.color = '#A1A1AA';
            const data = await viperRequest('/profile/balance', 'POST');
            display.textContent = '💰 ' + data.balance + ' checks';
            display.style.color = '#22C55E';
        } catch (e) {
            display.textContent = '❌ ' + e.message;
            display.style.color = '#EF4444';
        }
    }

    async function loadCheckMethods() {
        const select = document.getElementById('checker-method');
        try {
            const data = await viperRequest('/check/available', 'GET');
            select.innerHTML = '';
            (data.result || []).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.code;
                opt.textContent = m.code + ' — ' + m.description;
                select.appendChild(opt);
            });
            toast('Loaded ' + (data.result || []).length + ' methods', 'success');
        } catch (e) {
            toast('Failed to load methods: ' + e.message, 'error');
        }
    }

    async function checkCards() {
        const input = document.getElementById('checker-input');
        const output = document.getElementById('checker-output');
        const status = document.getElementById('checker-status');
        const checkBtn = document.getElementById('checker-check-btn');

        const rawLines = (input?.value || '').trim().split('\n').filter(l => l.trim());
        if (!rawLines.length) {
            toast('No cards to check', 'error');
            return;
        }

        // Normalize ALL lines to CCN|MM|YY|CVV
        const normalized = [];
        const invalid = [];
        rawLines.forEach(line => {
            const n = normalizeCardLine(line);
            if (n) normalized.push(n);
            else invalid.push(line.trim());
        });

        if (!normalized.length) {
            toast('No valid cards found. Format: CCN MM YY CVV', 'error');
            return;
        }

        const method = document.getElementById('checker-method')?.value || 'AUTH';

        // Update UI
        status.textContent = 'CHECKING...';
        status.className = 'checker-status-badge checking';
        checkBtn.disabled = true;
        output.textContent = `Sending ${normalized.length} cards to Viper API...`;
        if (invalid.length) {
            output.textContent += `\n⚠️ ${invalid.length} line(s) skipped (invalid format)`;
        }

        try {
            // Send check v2
            const checkData = await viperRequest('/check/v2', 'POST', {
                data: normalized,
                check_type: method
            });

            const purchaseId = checkData.purchase_id;

            // Show invalid items immediately (cards that API rejected)
            let results = [];
            if (checkData.invalid_items && checkData.invalid_items.length) {
                results = [...checkData.invalid_items];
                output.textContent = formatCheckerResults(results) + '\n\n⏳ Polling for remaining results...';
            } else if (purchaseId) {
                output.textContent = '⏳ Waiting for results (purchase: ' + purchaseId + ')...';
            }

            if (!purchaseId) {
                // No purchase ID — results should be immediate (v1 fallback or error)
                status.textContent = 'DONE';
                status.className = 'checker-status-badge done';
                checkBtn.disabled = false;
                if (results.length) output.textContent = formatCheckerResults(results);
                return;
            }

            // Poll for results
            let attempts = 0;
            const maxAttempts = 60; // 5 min max
            const pollInterval = 5000; // 5 sec

            const poll = async () => {
                attempts++;
                try {
                    const pollData = await viperRequest('/check/poll/' + purchaseId, 'GET');

                    // Replace results (not accumulate) — poll returns full result set
                    if (pollData.result && pollData.result.length) {
                        results = [...(checkData.invalid_items || []), ...pollData.result];
                    }

                    if (pollData.status === 'confirmed' || attempts >= maxAttempts) {
                        // Done
                        status.textContent = 'DONE';
                        status.className = 'checker-status-badge done';
                        checkBtn.disabled = false;
                        output.textContent = formatCheckerResults(results);
                        if (attempts >= maxAttempts && pollData.status !== 'confirmed') {
                            output.textContent += '\n\n⚠️ Timed out waiting for some results';
                        }
                        return;
                    }

                    // Still pending
                    output.textContent = formatCheckerResults(results) + '\n\n⏳ Polling... (' + attempts + '/' + maxAttempts + ')';
                    setTimeout(poll, pollInterval);
                } catch (e) {
                    status.textContent = 'ERROR';
                    status.className = 'checker-status-badge error';
                    checkBtn.disabled = false;
                    output.textContent += '\n\n❌ Poll error: ' + e.message;
                }
            };

            setTimeout(poll, pollInterval);

        } catch (e) {
            status.textContent = 'ERROR';
            status.className = 'checker-status-badge error';
            checkBtn.disabled = false;
            output.textContent = '❌ Error: ' + e.message;
        }
    }

    function formatCheckerResults(results) {
        if (!results.length) return 'No results yet...';

        const alive = results.filter(r => (r.status || '').toUpperCase() === 'ALIVE').length;
        const dead = results.filter(r => (r.status || '').toUpperCase() === 'DEAD').length;
        const other = results.length - alive - dead;

        let header = `═══ Results: ${results.length} total | ✅ ${alive} ALIVE | 💀 ${dead} DEAD`;
        if (other) header += ` | ⚠️ ${other} other`;
        header += ' ═══\n\n';

        return header + results.map(r => {
            const isAlive = (r.status || '').toUpperCase() === 'ALIVE';
            const isDead = (r.status || '').toUpperCase() === 'DEAD';
            const icon = isAlive ? '✅' : isDead ? '💀' : '⚠️';
            const statusText = (r.status || 'UNKNOWN').toUpperCase();

            let line = `${icon} ${r.card} — ${statusText}`;
            const details = [];
            if (r.details) details.push(r.details);
            if (r.brand) details.push(r.brand);
            if (r.type) details.push(r.type);
            if (r.level) details.push(r.level);
            if (r.country) details.push(r.country);

            if (details.length) {
                line += ' [' + details.join(' • ') + ']';
            }
            return line;
        }).join('\n');
    }

    function copyResults() {
        const output = document.getElementById('checker-output');
        if (!output) return;
        navigator.clipboard.writeText(output.textContent).then(() => {
            toast('Results copied', 'success');
        }).catch(() => {
            const range = document.createRange();
            range.selectNodeContents(output);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('copy');
            sel.removeAllRanges();
            toast('Results copied', 'success');
        });
    }

    // Expose openChecker globally for parser
    window.openChecker = openChecker;

})();
