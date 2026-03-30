/* ═══════════════════════════════════════════
   CARD TRACKER — Application Logic
   ═══════════════════════════════════════════ */

// ──── STATE ────
const STATE = {
    user: null,
    currentView: 'cards',       // cards, docs, my-card, favorites, active-now, notes, trash
    currentCountry: 'canada',
    countries: [
        { id: 'canada', name: 'Canada', flag: '🇨🇦' },
        { id: 'usa', name: 'United States', flag: '🇺🇸' }
    ],
    cards: [],
    docs: [],
    notes: '',
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
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

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
    return n.slice(0, 4) + ' •••• ' + n.slice(-4);
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
    localStorage.setItem('ct_cards', JSON.stringify(STATE.cards));
    localStorage.setItem('ct_docs', JSON.stringify(STATE.docs));
    localStorage.setItem('ct_notes', STATE.notes);
    localStorage.setItem('ct_trash', JSON.stringify(STATE.trash));
    localStorage.setItem('ct_countries', JSON.stringify(STATE.countries));
    saveBinCache();
}

function load() {
    try {
        STATE.cards = JSON.parse(localStorage.getItem('ct_cards') || '[]');
        STATE.docs = JSON.parse(localStorage.getItem('ct_docs') || '[]');
        STATE.notes = localStorage.getItem('ct_notes') || '';
        STATE.trash = JSON.parse(localStorage.getItem('ct_trash') || '[]');
        const saved = localStorage.getItem('ct_countries');
        if (saved) STATE.countries = JSON.parse(saved);
    } catch { /* ignore corrupt data */ }
    loadBinCache();
}

// ──── AUTO DOC CREATION ────
function ensureDoc(card) {
    const fullName = `${card.name} ${card.surname}`.trim().toUpperCase();
    if (!fullName) return;
    const existing = STATE.docs.find(d => d.fullName === fullName && d.country === card.country);
    if (existing) {
        existing.use = (existing.use || 0) + 1;
    } else {
        STATE.docs.push({
            id: genId(),
            fullName,
            name: card.name,
            surname: card.surname,
            country: card.country,
            type: '-',
            use: 1,
            verified: 0,
            suspended: 0,
            status: 'waiting',
            date: todayStr(),
            notes: ''
        });
    }
}

// ──── FAVORITES LOGIC ────
// Card goes to favorites when both cardAdd AND runAds are true
function isFavorite(card) { return card.cardAdd && card.runAds; }

// ──── ACTIVE NOW LOGIC ────
// Card is in Active Now when star is toggled on
function isActiveNow(card) { return !!card.starred; }

// ──── BIN COUNT ────
function binCount(bin, countryFilter) {
    return STATE.cards.filter(c => getBin(c.cardNumber) === bin && (!countryFilter || c.country === countryFilter)).length;
}

// ──── FILTERED CARDS ────
function sortCards(cards, field, dir) {
    const mult = dir === 'asc' ? 1 : -1;
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
            case 'bin':
                va = getBin(a.cardNumber); vb = getBin(b.cardNumber);
                return mult * va.localeCompare(vb);
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
            break;
        case 'favorites':
            cards = STATE.cards.filter(c => isFavorite(c));
            break;
        case 'active-now':
            cards = STATE.cards.filter(c => isActiveNow(c));
            break;
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
    let docs = STATE.docs.filter(d => d.country === STATE.currentCountry);
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

function renderSidebar() {
    const list = document.getElementById('countries-list');
    list.innerHTML = '';

    STATE.countries.forEach(country => {
        const countryCards = STATE.cards.filter(c => c.country === country.id);
        const countryDocs = STATE.docs.filter(d => d.country === country.id);
        const isExpanded = true;

        const isDefault = ['canada', 'usa'].includes(country.id);

        const html = `
            <div class="country-group">
                <button class="country-item" data-country="${country.id}" onclick="expandCountry('${country.id}')">
                    <span class="country-flag">${country.flag}</span>
                    <span>${country.name}</span>
                    <span class="country-count">${countryCards.length + countryDocs.length}</span>
                    ${!isDefault ? `<span class="country-delete" onclick="event.stopPropagation(); deleteCountry('${country.id}')" title="Delete country">×</span>` : ''}
                </button>
                <div class="country-sub" style="max-height: ${isExpanded ? '200px' : '0'}">
                    <button class="nav-item ${STATE.currentView === 'cards' && STATE.currentCountry === country.id ? 'active' : ''}"
                            onclick="navigate('cards', '${country.id}')">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
                        <span>Cards</span>
                        <span class="nav-badge">${countryCards.length}</span>
                    </button>
                    <button class="nav-item ${STATE.currentView === 'docs' && STATE.currentCountry === country.id ? 'active' : ''}"
                            onclick="navigate('docs', '${country.id}')">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
                        <span>Docs</span>
                        <span class="nav-badge">${countryDocs.length}</span>
                    </button>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });

    // Update collection badges
    document.getElementById('badge-my-card').textContent = STATE.cards.length;
    document.getElementById('badge-favorites').textContent = STATE.cards.filter(c => isFavorite(c)).length;
    document.getElementById('badge-active').textContent = STATE.cards.filter(c => isActiveNow(c)).length;
    document.getElementById('badge-trash').textContent = STATE.trash.length;

    // Highlight active collection
    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === STATE.currentView);
    });

    // Update TOP BINS
    updateTopBinsGeo();
    renderTopBins();
}

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

    // Sort by mode
    const sorted = Object.entries(bins)
        .sort((a, b) => b[1][_topBinsMode] - a[1][_topBinsMode])
        .slice(0, 5);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="top-bins-empty">No BINs found</div>';
        return;
    }

    const maxVal = sorted[0][1][_topBinsMode] || 1;

    container.innerHTML = sorted.map(([bin, data]) => {
        const val = _topBinsMode === 'count' ? data.count : `$${data.amount.toLocaleString()}`;
        const pct = Math.round((data[_topBinsMode] / maxVal) * 100);
        return `<div class="top-bins-row">
            <div class="top-bins-bar" style="width:${pct}%"></div>
            <span class="top-bins-bin">${bin}</span>
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

    if (STATE.currentView === 'notes') {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'grid';

    if (STATE.currentView === 'docs') {
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
    footer.style.display = 'flex';

    if (STATE.currentView === 'docs') {
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
        const fullName = (c.name + ' ' + c.surname).toUpperCase();
        const nameCount = cards.filter(x => (x.name + ' ' + x.surname).toUpperCase() === fullName).length;
        const nameBadge = nameCount > 1 ? `<span class="name-count-badge ${getCountColor(nameCount)}">(${nameCount})</span>` : '';
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
        <tr data-id="${c.id}">
            <td class="td-num">${idx}</td>
            <td>
                <div class="card-cell">
                    <span class="card-name">
                        ${!isTrash ? `<button class="star-btn ${c.starred ? 'active' : ''}" onclick="toggleStar('${c.id}')" title="Active Now">★</button>` : ''}
                        <span class="flag">${flag}</span>
                        ${c.name.toUpperCase()} ${c.surname.toUpperCase()} ${nameBadge}
                    </span>
                    <span class="card-number">${maskCard(c.cardNumber)}</span>
                    ${(() => { const info = getBinInfo(getBin(c.cardNumber)); const txt = formatBinInfoText(info); return txt ? `<span class="bin-info">${txt}</span>` : `<span class="bin-info" data-bin="${getBin(c.cardNumber)}"></span>`; })()}
                </div>
            </td>
            <td class="note-indicator"><span class="editable-note" onclick="openInlineNote('${c.id}', this)">${c.notes || '<span class="note-placeholder">+ note</span>'}</span></td>
            <td class="bin-cell">${bin} <span class="bin-count ${binColorClass}">(${bc})</span></td>
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
                    <th>#</th>
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

function renderNotes() {
    const area = document.getElementById('content-area');
    const lines = (STATE.notes || '').split('\n');
    const lineCount = lines.length || 1;
    const lineNums = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
    const savedTime = STATE.notesLastSaved ? new Date(STATE.notesLastSaved).toLocaleTimeString() : '—';

    area.innerHTML = `
        <div class="notes-container">
            <div class="notes-toolbar">
                <div class="notes-toolbar-left">
                    <span class="notes-saved-info">Saved ${savedTime}</span>
                    <span class="notes-divider">|</span>
                    <span class="notes-line-count">${lineCount} lines</span>
                </div>
                <div class="notes-toolbar-right">
                    <button class="notes-tool-btn" id="notes-checker-btn" title="Card Checker">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
                        CHECKER
                    </button>
                    <button class="notes-tool-btn" id="notes-save-btn" title="Save">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
                        SAVE
                    </button>
                    <div class="notes-font-controls">
                        <button class="notes-font-btn" id="notes-font-minus" title="Decrease font">−</button>
                        <span class="notes-font-size" id="notes-font-size-display">${STATE.notesFontSize}</span>
                        <button class="notes-font-btn" id="notes-font-plus" title="Increase font">+</button>
                    </div>
                    <button class="notes-tool-btn" id="notes-import-btn" title="Import">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                        IMPORT
                    </button>
                    <button class="notes-tool-btn" id="notes-export-btn" title="Export">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
                        EXPORT
                    </button>
                </div>
            </div>
            <div class="notes-editor-wrap">
                <pre class="notes-line-numbers" id="notes-line-nums">${lineNums}</pre>
                <textarea class="notes-editor" id="notes-textarea" style="font-size:${STATE.notesFontSize}px" placeholder="Write your notes here...">${STATE.notes || ''}</textarea>
            </div>
            <div class="notes-status-bar">
                Click on line number to mark/unmark • Use +/- to change font size • Markers are saved and exported
            </div>
        </div>
    `;

    // Attach notes event listeners
    const textarea = document.getElementById('notes-textarea');
    textarea.addEventListener('input', () => {
        const nums = (textarea.value || '').split('\n').length;
        document.getElementById('notes-line-nums').textContent = Array.from({ length: nums }, (_, i) => i + 1).join('\n');
        document.getElementById('notes-line-count') && (document.querySelector('.notes-line-count').textContent = nums + ' lines');
    });
    textarea.addEventListener('scroll', () => {
        document.getElementById('notes-line-nums').scrollTop = textarea.scrollTop;
    });

    document.getElementById('notes-save-btn').addEventListener('click', saveNotesAction);
    document.getElementById('notes-checker-btn').addEventListener('click', openChecker);
    document.getElementById('notes-import-btn').addEventListener('click', importNotesAction);
    document.getElementById('notes-export-btn').addEventListener('click', exportNotesAction);
    document.getElementById('notes-font-minus').addEventListener('click', () => changeNotesFontSize(-1));
    document.getElementById('notes-font-plus').addEventListener('click', () => changeNotesFontSize(1));
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

    const country = STATE.countries.find(c => c.id === STATE.currentCountry);

    switch (STATE.currentView) {
        case 'cards':
            flagEl.textContent = country?.flag || '';
            titleEl.textContent = `${country?.name || ''} — Cards`;
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
            flagEl.textContent = '🆕';
            titleEl.textContent = 'New Cards — Parser';
            break;
        case 'trash':
            flagEl.textContent = '🗑️';
            titleEl.textContent = 'Trash';
            break;
    }

    // Show/hide buttons
    const showAdd = ['cards', 'my-card'].includes(STATE.currentView);

    document.getElementById('add-card-btn').style.display = showAdd ? 'flex' : 'none';

    if (STATE.currentView === 'docs') {
        document.getElementById('add-card-btn').style.display = 'flex';
        document.getElementById('add-btn-text').textContent = 'ADD DOC';
    } else {
        document.getElementById('add-btn-text').textContent = 'ADD';
    }
}

function renderAll() {
    renderSidebar();
    renderPageTitle();
    renderStats();
    renderContent();
}

// ──── NAVIGATION ────
function navigate(view, country) {
    // Auto-save notes before leaving notes view
    if (STATE.currentView === 'notes') {
        const textarea = document.getElementById('notes-textarea');
        if (textarea) {
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

// Collection nav
document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
});

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
        save();

        // Targeted DOM update: toggle button class without re-render
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            const fieldMap = { cardAdd: 'btn-a', runAds: 'btn-r', verified: 'btn-v' };
            const btn = row.querySelector(`.status-btn.${fieldMap[field]}`);
            if (btn) btn.classList.toggle('active', card[field]);
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
            const text = `${card.name} ${card.surname}|${card.cardNumber}|${card.month}|${card.year}|${card.cvv}|${card.amount}|${card.notes}`;
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
    const myCardBadge = document.getElementById('badge-my-card');
    const favBadge = document.getElementById('badge-favorites');
    const activeBadge = document.getElementById('badge-active');
    const trashBadge = document.getElementById('badge-trash');
    if (myCardBadge) myCardBadge.textContent = STATE.cards.length;
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
    // Update only the specific counter in DOM
    const el = document.querySelector(`.vs-counter[data-doc-id="${docId}"][data-vs="v"]`);
    if (el) el.textContent = doc.verified;
    updateDocStatsBar();
};

window.incrementDocS = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.suspended = (doc.suspended || 0) + 1;
    save();
    // Update only the specific counter in DOM
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
function openDocModal() {
    const overlay = document.getElementById('add-doc-overlay');
    overlay.classList.remove('hidden');
    // Reset form
    document.getElementById('doc-form-name').value = '';
    document.getElementById('doc-form-surname').value = '';
    document.getElementById('doc-form-type').value = '';
    document.getElementById('doc-form-status').value = 'original';
    document.getElementById('doc-form-notes').value = '';
    // Reset to form tab
    document.querySelectorAll('[data-doc-tab]').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-doc-tab="doc-form"]').classList.add('active');
    document.getElementById('doc-form-tab').classList.add('active');
    document.getElementById('doc-form-tab').style.display = '';
    document.getElementById('doc-list-tab').classList.remove('active');
    document.getElementById('doc-list-tab').style.display = 'none';
    // Focus name
    setTimeout(() => document.getElementById('doc-form-name').focus(), 100);
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

// Doc modal tabs
document.querySelectorAll('[data-doc-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('[data-doc-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-doc-tab');
        document.getElementById('doc-form-tab').classList.toggle('active', target === 'doc-form');
        document.getElementById('doc-form-tab').style.display = target === 'doc-form' ? '' : 'none';
        document.getElementById('doc-list-tab').classList.toggle('active', target === 'doc-list');
        document.getElementById('doc-list-tab').style.display = target === 'doc-list' ? '' : 'none';
    });
});

// Doc modal save
document.getElementById('doc-modal-save').addEventListener('click', () => {
    const activeTab = document.querySelector('[data-doc-tab].active');
    const tabName = activeTab ? activeTab.getAttribute('data-doc-tab') : 'doc-form';
    
    if (tabName === 'doc-form') {
        // Single doc form
        const name = document.getElementById('doc-form-name').value.trim().toUpperCase();
        const surname = document.getElementById('doc-form-surname').value.trim().toUpperCase();
        if (!name) {
            toast('Name is required', 'error');
            return;
        }
        const fullName = surname ? `${name} ${surname}` : name;
        const type = document.getElementById('doc-form-type').value || '-';
        const quality = document.getElementById('doc-form-status').value || 'original';
        const notes = document.getElementById('doc-form-notes').value.trim();
        
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`;
        
        const newDoc = {
            id: 'doc_' + Date.now(),
            fullName: fullName,
            type: type,
            quality: quality,
            notes: notes,
            verified: 0,
            suspended: 0,
            use: 1,
            country: STATE.currentCountry,
            date: dateStr,
        };
        STATE.docs.push(newDoc);
        save();
        renderAll();
        closeDocModal();
        toast('Document added: ' + fullName, 'success');
    } else {
        // List tab - bulk import
        const textarea = document.getElementById('doc-list-textarea');
        const lines = textarea.value.trim().split('\n').filter(l => l.trim());
        if (lines.length === 0) {
            toast('No documents to import', 'error');
            return;
        }
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`;
        
        let count = 0;
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length === 0) return;
            const name = parts[0].toUpperCase();
            const surname = parts.length > 1 && !['PP', 'DL', 'V', 'S', 'W'].includes(parts[1].toUpperCase()) ? parts[1].toUpperCase() : '';
            const fullName = surname ? `${name} ${surname}` : name;
            
            let type = '-';
            let quality = 'original';
            let verified = 0;
            let suspended = 0;
            parts.forEach(p => {
                const up = p.toUpperCase();
                if (up === 'PP' || up === 'DL') type = up;
                if (up === 'V') verified = 1;
                if (up === 'S') suspended = 1;
            });
            
            STATE.docs.push({
                id: 'doc_' + Date.now() + '_' + count,
                fullName: fullName,
                type: type,
                quality: quality,
                notes: '',
                verified: verified,
                suspended: suspended,
                use: 1,
                country: STATE.currentCountry,
                date: dateStr,
            });
            count++;
        });
        save();
        renderAll();
        closeDocModal();
        toast(`${count} documents imported`, 'success');
        textarea.value = '';
    }
});

// ──── SIDEBAR TOGGLE (Mobile) ────
document.getElementById('toggle-sidebar').addEventListener('click', () => {
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
    // BIN lookup
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

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Extract card number: try structured formats first, then raw digits
        // Format: 4 groups of 4 (with spaces/dashes)
        let cardMatch = line.match(/\b(\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{3,4})\b/);
        if (!cardMatch) {
            // Continuous 13-19 digits
            cardMatch = line.match(/\b(\d{13,19})\b/);
        }
        if (!cardMatch) continue;

        const cardNum = cardMatch[1].replace(/[\s\-]/g, '');
        if (cardNum.length < 13 || cardNum.length > 19) continue;
        if (seen.has(cardNum)) continue;
        seen.add(cardNum);

        // Remove the card number from line for further parsing
        const rest = line.replace(cardMatch[0], ' ');

        // Extract expiry: MM/YY or MM|YY or MM YY (where MM is 01-12, YY is 2 digits)
        let mm = '', yy = '';
        const expMatch = rest.match(/\b(0[1-9]|1[0-2])\s*[\/|\\.\-]\s*(\d{2})\b/);
        if (expMatch) {
            mm = expMatch[1];
            yy = expMatch[2];
        }

        // Extract CVV: 3-4 digits (not part of card number, not the expiry)
        let cvv = '';
        const restAfterExp = expMatch ? rest.replace(expMatch[0], ' ') : rest;
        // Look for standalone 3-4 digit numbers
        const cvvCandidates = restAfterExp.match(/\b(\d{3,4})\b/g);
        if (cvvCandidates) {
            // Pick the first 3-4 digit number that isn't part of the card or year
            for (const c of cvvCandidates) {
                if (c !== mm && c !== yy && c !== cardNum.slice(-4)) {
                    cvv = c;
                    break;
                }
            }
        }

        cards.push({ cardNum, mm, yy, cvv });
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

    const preview = cards.slice(0, 5).map(c => {
        const masked = c.cardNum.replace(/(\d{4})(\d+)(\d{4})/, '$1 •••• $3');
        const exp = c.mm && c.yy ? `${c.mm}/${c.yy}` : '——';
        const cvv = c.cvv || '———';
        return `<div class="list-preview-row">${masked} <span class="list-sep">|</span> ${exp} <span class="list-sep">|</span> ${cvv}</div>`;
    }).join('');

    const more = cards.length > 5 ? `<div class="list-preview-more">...and ${cards.length - 5} more</div>` : '';
    el.innerHTML = preview + more;
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
                name: '', surname: '',
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
    // edit-doc-type removed
    document.getElementById('edit-amount').value = card.amount;
    document.getElementById('edit-notes').value = card.notes || '';
    document.getElementById('edit-mail-verify').checked = card.mailVerify || false;
    document.getElementById('edit-mail-submit').checked = card.mailSubmit || false;
    document.getElementById('edit-mail-none').checked = card.mailNone || false;
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
        card.name = document.getElementById('edit-name').value.trim();
        card.surname = document.getElementById('edit-surname').value.trim();
        card.cardNumber = document.getElementById('edit-card').value.replace(/\s/g, '');
        card.cardType = getCardType(card.cardNumber);
        // docType editing removed
        card.month = document.getElementById('edit-month').value;
        card.year = document.getElementById('edit-year').value;
        card.cvv = document.getElementById('edit-cvv').value;
        card.amount = document.getElementById('edit-amount').value;
        card.notes = document.getElementById('edit-notes').value;
        card.mailVerify = document.getElementById('edit-mail-verify').checked;
        card.mailSubmit = document.getElementById('edit-mail-submit').checked;
        card.mailNone = document.getElementById('edit-mail-none').checked;
        save();
        editOverlay.classList.add('hidden');
        renderAll();
        toast('Card updated', 'success');
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
    // Navigate to the correct view/country, preserve search
    STATE.currentView = view;
    if (country) STATE.currentCountry = country;
    STATE.page = 1;
    STATE.search = searchTerm || '';
    globalSearchResults.classList.add('hidden');
    renderAll();
    // Keep search text in the input
    document.getElementById('search-input').value = STATE.search;
};

document.getElementById('search-input').addEventListener('input', function () {
    clearTimeout(searchTimeout);
    const query = this.value.trim();
    searchTimeout = setTimeout(() => performGlobalSearch(query), 150);
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
    const isOldFormat = !!data.version;
    const cards = data.cards || [];
    const activeCards = cards.filter(c => !(c.is_deleted ?? false));
    const mycards = data.mycards || [];
    const docs = data.mydocuments || data.docs || [];
    const activeDocs = docs.filter(d => !(d.is_deleted ?? false));
    const hasNotes = !!(data.notes && (data.notes.content || typeof data.notes === 'string'));
    const exportDate = data.exported_at || data.backupAt || data.exportedAt || '';
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
        <div class="backup-stat-card cards"><div class="stat-num">${activeCards.length}</div><div class="stat-name">CARDS (CANADA/USA)</div></div>
        <div class="backup-stat-card mycards"><div class="stat-num">${mycards.length}</div><div class="stat-name">MY CARDS</div></div>
        <div class="backup-stat-card docs"><div class="stat-num">${activeDocs.length}</div><div class="stat-name">MY DOCUMENTS</div></div>
        <div class="backup-stat-card notes"><div class="stat-num">${hasNotes ? 1 : 0}</div><div class="stat-name">NOTES</div></div>
    `;
    backupOverlay.classList.remove('hidden');
}

function executeBackupImport(mode) {
    if (!pendingBackup) return;
    const data = pendingBackup;

    if (mode === 'replace') {
        STATE.cards = [];
        STATE.docs = [];
        STATE.trash = [];
        STATE.notes = '';
    }

    // Import cards
    const rawCards = data.cards || [];
    let addedCards = 0;
    rawCards.forEach(c => {
        const isDeleted = c.is_deleted === 1 || c.is_deleted === true;
        const converted = convertOldCard(c);
        if (isDeleted) {
            if (mode === 'replace' || !STATE.trash.find(t => t.cardNumber === converted.cardNumber)) {
                STATE.trash.push(converted);
            }
        } else {
            if (mode === 'replace' || !STATE.cards.find(e => e.cardNumber === converted.cardNumber)) {
                STATE.cards.push(converted);
                addedCards++;
            }
        }
    });

    // Import docs
    const rawDocs = data.mydocuments || data.docs || [];
    let addedDocs = 0;
    rawDocs.forEach(d => {
        const isDeleted = d.is_deleted === 1 || d.is_deleted === true;
        if (isDeleted) return;
        const converted = convertOldDoc(d);
        if (mode === 'replace' || !STATE.docs.find(e => e.fullName === converted.fullName && e.country === converted.country)) {
            STATE.docs.push(converted);
            addedDocs++;
        }
    });

    // Import notes
    if (data.notes) {
        const noteContent = typeof data.notes === 'string' ? data.notes : (data.notes.content || '');
        if (mode === 'replace') {
            STATE.notes = noteContent;
        } else if (noteContent) {
            STATE.notes = STATE.notes ? STATE.notes + '\n\n--- Imported ---\n' + noteContent : noteContent;
        }
    }

    // Import BIN cache
    if (data.binCache && typeof data.binCache === 'object') {
        Object.assign(BIN_CACHE, data.binCache);
    }

    save();
    backupOverlay.classList.add('hidden');
    pendingBackup = null;
    renderAll();
    toast(`Imported: ${addedCards} cards, ${addedDocs} docs`, 'success');
}

// Import button (sidebar)
document.getElementById('restore-backup-btn').addEventListener('click', openBackupFileDialog);

// Backup import modal buttons
document.getElementById('backup-replace').addEventListener('click', () => executeBackupImport('replace'));
document.getElementById('backup-merge').addEventListener('click', () => executeBackupImport('merge'));
document.getElementById('backup-import-close').addEventListener('click', () => { backupOverlay.classList.add('hidden'); pendingBackup = null; });
document.getElementById('backup-import-cancel').addEventListener('click', () => { backupOverlay.classList.add('hidden'); pendingBackup = null; });
backupOverlay.addEventListener('click', (e) => { if (e.target === backupOverlay) { backupOverlay.classList.add('hidden'); pendingBackup = null; } });

document.getElementById('backup-btn').addEventListener('click', () => {
    const data = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        cards: STATE.cards.concat(STATE.trash),
        mycards: STATE.cards.map(c => ({ ...c, added_to_google: c.cardAdd, ads_running: c.runAds })),
        mydocuments: STATE.docs,
        notes: { id: 'main', content: STATE.notes },
        binCache: BIN_CACHE,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `card-tracker-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup created', 'success');
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
const checkerOverlay = document.getElementById('checker-overlay');

function openChecker() {
    checkerOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('checker-input').value = '';
    document.getElementById('checker-output').textContent = 'Results will appear here...';
    document.getElementById('checker-input').focus();
}

function closeChecker() {
    checkerOverlay.classList.add('hidden');
    document.body.style.overflow = '';
}

function convertCards() {
    const input = document.getElementById('checker-input').value;
    if (!input.trim()) {
        document.getElementById('checker-output').textContent = 'Paste card data first...';
        return;
    }

    const results = [];
    const lines = input.split('\n');

    // Collect all numbers, looking for card patterns
    let currentCard = { num: '', mm: '', yy: '', cvv: '' };

    for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned) continue;

        // Try to extract all digits from any format
        // Pattern: full card number (13-19 digits)
        const cardMatch = cleaned.match(/(\d[\d\s]{11,22}\d)/);
        if (cardMatch) {
            if (currentCard.num) {
                // Push previous card if complete
                if (currentCard.num.length >= 13) {
                    results.push(`${currentCard.num} ${currentCard.mm} ${currentCard.yy} ${currentCard.cvv}`.trim());
                }
                currentCard = { num: '', mm: '', yy: '', cvv: '' };
            }
            currentCard.num = cardMatch[1].replace(/\s/g, '');

            // Check if same line has MM/YY and CVV
            const rest = cleaned.replace(cardMatch[0], '');
            const expMatch = rest.match(/(\d{2})[/\s-](\d{2,4})/);
            if (expMatch) {
                currentCard.mm = expMatch[1];
                currentCard.yy = expMatch[2].slice(-2);
            }
            const cvvMatch = rest.match(/(?:CVV|cvv|CVC|cvc)[:\s]*(\d{3,4})/) || rest.match(/(\d{3,4})\s*$/);
            if (cvvMatch) currentCard.cvv = cvvMatch[1];
            continue;
        }

        // Try validity/expiry pattern
        const validityMatch = cleaned.match(/(?:Validity|Exp(?:iry)?|EXP|Valid)[:\s]*(\d{2})[/\s-](\d{2,4})/i);
        if (validityMatch) {
            currentCard.mm = validityMatch[1];
            currentCard.yy = validityMatch[2].slice(-2);
            continue;
        }

        // Try CVV pattern
        const cvvLine = cleaned.match(/(?:CVV|CVC|Security)[:\s]*(\d{3,4})/i);
        if (cvvLine) {
            currentCard.cvv = cvvLine[1];
            continue;
        }

        // Try standalone expiry (MM/YY on its own line)
        const standalonExp = cleaned.match(/^(\d{2})[/](\d{2,4})$/);
        if (standalonExp) {
            currentCard.mm = standalonExp[1];
            currentCard.yy = standalonExp[2].slice(-2);
            continue;
        }

        // Try standalone 3-digit number (CVV)
        const standaloneCvv = cleaned.match(/^(\d{3,4})$/);
        if (standaloneCvv && currentCard.num) {
            currentCard.cvv = standaloneCvv[1];
            continue;
        }

        // Try all-in-one format: 4221740051682165 02 30 290
        const allInOne = cleaned.match(/(\d{13,19})\s+(\d{2})\s+(\d{2,4})\s+(\d{3,4})/);
        if (allInOne) {
            results.push(`${allInOne[1]} ${allInOne[2]} ${allInOne[3].slice(-2)} ${allInOne[4]}`);
            continue;
        }
    }

    // Push last card
    if (currentCard.num && currentCard.num.length >= 13) {
        results.push(`${currentCard.num} ${currentCard.mm} ${currentCard.yy} ${currentCard.cvv}`.trim());
    }

    document.getElementById('checker-output').textContent = results.length
        ? results.join('\n')
        : 'No card data found. Check your input format.';
}

document.getElementById('checker-convert').addEventListener('click', convertCards);
document.getElementById('checker-copy').addEventListener('click', () => {
    const text = document.getElementById('checker-output').textContent;
    navigator.clipboard.writeText(text).then(() => toast('Copied!', 'success'));
});
document.getElementById('checker-close').addEventListener('click', closeChecker);
document.getElementById('checker-cancel').addEventListener('click', closeChecker);
checkerOverlay.addEventListener('click', (e) => { if (e.target === checkerOverlay) closeChecker(); });

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
// ──── NEW CARDS — LOG PARSER MODULE ────
// ══════════════════════════════════════════════════

let PARSER_STATE = { results: [], filtered: [], selected: new Set(), file: null };

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
        <div class="parser-filters" id="parser-filters">
            <div class="parser-filter-row">
                <div class="parser-filter-group">
                    <label>BINs <span class="parser-hint">(comma or newline separated)</span></label>
                    <textarea id="parser-bins" rows="3" placeholder="450220, 526809, 552489..."></textarea>
                </div>
                <div class="parser-filter-group">
                    <label>Country <span class="parser-hint">(from Billing, e.g. IL, US)</span></label>
                    <input type="text" id="parser-country" placeholder="IL">
                </div>
                <div class="parser-filter-group">
                    <label>Bank <span class="parser-hint">(partial match)</span></label>
                    <input type="text" id="parser-bank" placeholder="ISRAEL CREDIT...">
                </div>
            </div>
            <div class="parser-filter-row">
                <div class="parser-filter-group">
                    <label>Min Validity <span class="parser-hint">(MM/YY)</span></label>
                    <input type="text" id="parser-min-validity" placeholder="05/26" value="${String(new Date().getMonth()+1).padStart(2,'0')}/${String(new Date().getFullYear()).slice(2)}">
                </div>
                <div class="parser-filter-group">
                    <label>Date From</label>
                    <input type="date" id="parser-date-from">
                </div>
                <div class="parser-filter-group">
                    <label>Date To</label>
                    <input type="date" id="parser-date-to">
                </div>
                <div class="parser-filter-group" style="align-self:flex-end">
                    <label class="parser-checkbox"><input type="checkbox" id="parser-dedup" checked> Remove duplicates</label>
                </div>
            </div>
            <div class="parser-actions">
                <button class="btn-primary parser-parse-btn" id="parser-parse-btn" disabled>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
                    PARSE
                </button>
                <span class="parser-status" id="parser-status"></span>
            </div>
        </div>

        <!-- STATS BAR -->
        <div class="parser-stats hidden" id="parser-stats"></div>

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

    document.getElementById('parser-parse-btn').addEventListener('click', runParser);

    // If we already have results, re-render them
    if (PARSER_STATE.filtered.length > 0) renderParserResults();
}

function loadParserFile(file) {
    if (!file) return;
    PARSER_STATE.file = file.name;
    document.querySelector('.parser-upload-title').textContent = '📁 ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
    document.getElementById('parser-parse-btn').disabled = false;

    const status = document.getElementById('parser-status');
    status.textContent = '⏳ Reading file...';

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const messages = Array.isArray(data) ? data : (data.messages || []);
            PARSER_STATE.rawMessages = messages;
            status.textContent = `✅ Loaded: ${messages.length.toLocaleString()} messages`;
            toast(`File loaded: ${messages.length.toLocaleString()} messages`, 'success');
        } catch (err) {
            status.textContent = '❌ Invalid JSON';
            toast('Error: invalid JSON file', 'error');
        }
    };
    reader.onerror = () => { status.textContent = '❌ Read error'; };
    reader.readAsText(file);
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
    const emailP = /✉️\s*Email:\s*(.+)/i;
    const phoneP = /📞\s*Phone:\s*(.+)/i;

    const cards = [];

    for (const msg of messages) {
        const fullText = flattenText(msg.text);
        if (!fullText) continue;

        const msgDate = msg.date || '';

        // Reset lastIndex for global regex
        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(fullText)) !== null) {
            const ccRaw = m[1].replace(/\s/g, '');
            let mm = m[2];
            let yy = m[3];
            const cvv = m[4];
            if (yy.length === 4) yy = yy.slice(2);

            // Extract other fields from fullText
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

function runParser() {
    if (!PARSER_STATE.rawMessages) return;

    const status = document.getElementById('parser-status');
    status.textContent = '⏳ Parsing...';

    // Read filters
    const binsRaw = document.getElementById('parser-bins').value.trim();
    const binSet = new Set(binsRaw ? binsRaw.split(/[\s,\n]+/).filter(b => b.length >= 4) : []);
    const countryFilter = document.getElementById('parser-country').value.trim().toUpperCase();
    const bankFilter = document.getElementById('parser-bank').value.trim().toLowerCase();
    const minValidity = document.getElementById('parser-min-validity').value.trim();
    const dateFrom = document.getElementById('parser-date-from').value;
    const dateTo = document.getElementById('parser-date-to').value;
    const dedup = document.getElementById('parser-dedup').checked;

    // Parse min validity
    let minMM = 0, minYY = 0;
    if (minValidity) {
        const vp = minValidity.split('/');
        if (vp.length === 2) { minMM = parseInt(vp[0]); minYY = parseInt(vp[1]); }
    }

    // Extract all cards
    const allCards = extractCardsFromMessages(PARSER_STATE.rawMessages);

    let filtered = allCards;
    let stats = { total: allCards.length, binMatch: 0, expired: 0, countryMatch: 0, bankMatch: 0 };

    // Filter: BIN
    if (binSet.size > 0) {
        filtered = filtered.filter(c => binSet.has(c.bin));
        stats.binMatch = filtered.length;
    }

    // Filter: Country
    if (countryFilter) {
        filtered = filtered.filter(c => c.country.toUpperCase() === countryFilter);
        stats.countryMatch = filtered.length;
    }

    // Filter: Bank
    if (bankFilter) {
        filtered = filtered.filter(c => c.bank.toLowerCase().includes(bankFilter));
        stats.bankMatch = filtered.length;
    }

    // Filter: Date range
    if (dateFrom) {
        filtered = filtered.filter(c => c.msgDate >= dateFrom);
    }
    if (dateTo) {
        filtered = filtered.filter(c => c.msgDate <= dateTo + 'T23:59:59');
    }

    // Filter: Validity (not expired)
    if (minMM && minYY) {
        const before = filtered.length;
        filtered = filtered.filter(c => {
            const cmm = parseInt(c.mm);
            const cyy = parseInt(c.yy);
            if (cyy > minYY) return true;
            if (cyy === minYY && cmm >= minMM) return true;
            return false;
        });
        stats.expired = before - filtered.length;
    }

    // Dedup by card number
    if (dedup) {
        const seen = new Set();
        filtered = filtered.filter(c => {
            if (seen.has(c.cc)) return false;
            seen.add(c.cc);
            return true;
        });
    }

    PARSER_STATE.results = allCards;
    PARSER_STATE.filtered = filtered;
    PARSER_STATE.selected = new Set(filtered.map((_, i) => i));

    status.textContent = `✅ Done`;

    // Render stats
    const statsEl = document.getElementById('parser-stats');
    statsEl.classList.remove('hidden');
    statsEl.innerHTML = `
        <div class="stat-card total"><span class="stat-label">Total in Log</span><span class="stat-value">${stats.total.toLocaleString()}</span></div>
        ${binSet.size > 0 ? `<div class="stat-card card-add"><span class="stat-label">BIN Match</span><span class="stat-value">${stats.binMatch}</span></div>` : ''}
        <div class="stat-card suspended"><span class="stat-label">Expired</span><span class="stat-value">${stats.expired}</span></div>
        <div class="stat-card verified"><span class="stat-label">Valid Unique</span><span class="stat-value">${filtered.length}</span></div>
    `;

    renderParserResults();
    toast(`Parsed: ${filtered.length} valid cards from ${stats.total.toLocaleString()} total`, 'success');
}

function renderParserResults() {
    const el = document.getElementById('parser-results');
    if (!el) return;
    const list = PARSER_STATE.filtered;

    if (list.length === 0) {
        el.innerHTML = '<div class="empty-state"><p>No cards found matching filters</p></div>';
        return;
    }

    // BIN stats
    const binStats = {};
    list.forEach(c => { binStats[c.bin] = (binStats[c.bin] || 0) + 1; });
    const topBins = Object.entries(binStats).sort((a,b) => b[1]-a[1]).slice(0, 15);

    const rows = list.map((c, i) => `
        <tr class="${PARSER_STATE.selected.has(i) ? 'selected' : ''}">
            <td><input type="checkbox" ${PARSER_STATE.selected.has(i) ? 'checked' : ''} data-idx="${i}" class="parser-check"></td>
            <td>${i+1}</td>
            <td><span class="card-name">${c.name.toUpperCase()} ${c.surname.toUpperCase()}</span></td>
            <td class="card-number">${c.cc.replace(/(\d{4})/g, '$1 ').trim()}</td>
            <td>${c.validity}</td>
            <td>${c.bin}</td>
            <td>${c.bank || '—'}</td>
            <td>${c.cardType || '—'}</td>
            <td class="date-cell">${c.msgDate ? c.msgDate.split('T')[0] : ''}</td>
        </tr>`).join('');

    el.innerHTML = `
        <div class="parser-bin-stats">
            <span class="parser-bin-title">📋 Found by BIN:</span>
            ${topBins.map(([bin, cnt]) => `<span class="parser-bin-chip">${bin} <b>${cnt}</b></span>`).join('')}
        </div>
        <div class="parser-toolbar">
            <label class="parser-checkbox"><input type="checkbox" id="parser-select-all" checked> Select All (${list.length})</label>
            <div class="parser-add-section">
                <select id="parser-target-country">
                    ${STATE.countries.map(co => `<option value="${co.id}" ${co.id === STATE.currentCountry ? 'selected' : ''}>${co.flag} ${co.name}</option>`).join('')}
                </select>
                <button class="btn-primary parser-add-btn" id="parser-add-btn">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>
                    ADD TO CARDS (${PARSER_STATE.selected.size})
                </button>
            </div>
        </div>
        <table class="data-table parser-table">
            <thead><tr>
                <th></th><th>#</th><th>Holder</th><th>Card Number</th><th>Exp</th><th>BIN</th><th>Bank</th><th>Card Type</th><th>Date</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;

    // Checkbox handlers
    el.querySelectorAll('.parser-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const idx = parseInt(cb.dataset.idx);
            if (cb.checked) PARSER_STATE.selected.add(idx);
            else PARSER_STATE.selected.delete(idx);
            const addBtn = document.getElementById('parser-add-btn');
            if (addBtn) addBtn.textContent = `ADD TO CARDS (${PARSER_STATE.selected.size})`;
        });
    });

    const selectAll = document.getElementById('parser-select-all');
    if (selectAll) {
        selectAll.addEventListener('change', () => {
            const checked = selectAll.checked;
            PARSER_STATE.selected = checked ? new Set(list.map((_, i) => i)) : new Set();
            el.querySelectorAll('.parser-check').forEach(cb => { cb.checked = checked; });
            const addBtn = document.getElementById('parser-add-btn');
            if (addBtn) addBtn.textContent = `ADD TO CARDS (${PARSER_STATE.selected.size})`;
        });
    }

    document.getElementById('parser-add-btn').addEventListener('click', addParsedToCards);
}

function addParsedToCards() {
    const targetCountry = document.getElementById('parser-target-country').value;
    const list = PARSER_STATE.filtered;
    let added = 0;

    const existingNumbers = new Set(STATE.cards.map(c => c.cardNumber.replace(/\s/g, '')));

    PARSER_STATE.selected.forEach(idx => {
        const c = list[idx];
        if (!c) return;

        // Skip if card already exists in tracker
        if (existingNumbers.has(c.cc)) return;

        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getFullYear()).slice(2)}`;

        STATE.cards.push({
            id: crypto.randomUUID(),
            name: c.name || 'UNKNOWN',
            surname: c.surname || '',
            cardNumber: c.cc,
            country: targetCountry,
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
            mailNone: false
        });
        added++;
    });

    if (added > 0) {
        save();
        renderSidebar();
        updateSidebarBadges();
        toast(`✅ Added ${added} new cards to ${STATE.countries.find(co => co.id === targetCountry)?.name || targetCountry}`, 'success');
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
})();
