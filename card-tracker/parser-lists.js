/* ═══════════════════════════════════════════════════════════════════
   PARSER LISTS — Include / Exclude list popups for BINs, Country, Bank.
   Each field shows two compact buttons (green INCLUDE, red EXCLUDE).
   A click opens a small popup where a list is pasted (one value per
   line). Values are stored in hidden textareas that keep the original
   ids (parser-bins, parser-bins-ex, …) so saving, conflict checks and
   runParse keep reading them the same way.
   Uses globals at call time: pfBins, pfCountries, pfBanks, toast.
   ═══════════════════════════════════════════════════════════════════ */

const PL_FIELDS = {
    bin: {
        title: 'BINs', unit: 'BINs',
        parse: raw => [...new Set(pfBins(raw))],
        hint: '4–6 digit prefixes. Duplicates are removed automatically.',
        sample: '450003\n424242\n532610\n...'
    },
    country: {
        title: 'COUNTRY', unit: 'countries',
        parse: raw => [...new Set(pfCountries(raw))],
        hint: 'ISO country codes (US, GB, CA…). Duplicates are removed automatically.',
        sample: 'US\nGB\nCA\n...'
    },
    bank: {
        title: 'BANK', unit: 'banks',
        parse: raw => {
            const seen = new Set();
            return String(raw || '').split(/[\n,;|]+/).map(s => s.trim()).filter(s => {
                const k = s.toLowerCase();
                if (!s || seen.has(k)) return false;
                seen.add(k);
                return true;
            });
        },
        hint: 'Partial match: "Royal" matches every bank with "Royal" in its name.',
        sample: 'Chase\nRevolut\nRoyal Bank\n...'
    }
};

/** Hidden storage textarea id for a field + mode. */
const PL_IDS = {
    bin: { in: 'parser-bins', ex: 'parser-bins-ex' },
    country: { in: 'parser-country', ex: 'parser-country-ex' },
    bank: { in: 'parser-bank', ex: 'parser-exclude-banks' }
};

function plEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function plValues(kind, mode) {
    const el = document.getElementById(PL_IDS[kind][mode]);
    return PL_FIELDS[kind].parse(el ? el.value : '');
}

/** Markup of one field: label + INCLUDE / EXCLUDE buttons + hidden storage. */
function plFieldHtml(kind, values) {
    const f = PL_FIELDS[kind];
    const btn = mode => `<button type="button" class="pl-btn pl-${mode}" id="pl-${kind}-${mode}" data-pl-kind="${kind}" data-pl-mode="${mode}"
            title="${mode === 'in' ? 'Keep only these' : 'Remove these'} — click to paste a list">
            <span class="pl-btn-sign">${mode === 'in' ? '+' : '−'}</span>${mode === 'in' ? 'INCLUDE' : 'EXCLUDE'}
            <span class="pl-count" id="pl-${kind}-${mode}-count"></span></button>`;
    const store = mode => `<textarea id="${PL_IDS[kind][mode]}" class="pl-store" hidden>${plEsc(values[mode] || '')}</textarea>`;
    return `<div class="pf-field">
        <div class="pf-field-head">${f.title}</div>
        <div class="pl-pair">${btn('in')}${btn('ex')}</div>
        ${store('in')}${store('ex')}
        <div class="pf-conflict" id="pf-conflict-${kind}" style="display:none"></div>
    </div>`;
}

/** Updates counters on all six buttons. */
function plRefreshCounts() {
    Object.keys(PL_IDS).forEach(kind => ['in', 'ex'].forEach(mode => {
        const n = plValues(kind, mode).length;
        const badge = document.getElementById(`pl-${kind}-${mode}-count`);
        const btn = document.getElementById(`pl-${kind}-${mode}`);
        if (badge) badge.textContent = n ? String(n) : '';
        if (btn) btn.classList.toggle('pl-has', n > 0);
    }));
}

function plWrite(kind, mode, list) {
    const el = document.getElementById(PL_IDS[kind][mode]);
    if (!el) return;
    el.value = list.join('\n');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    plRefreshCounts();
}

/** Opens the small paste popup for one list. */
function plOpenPopup(kind, mode) {
    document.getElementById('pl-overlay')?.remove();
    const f = PL_FIELDS[kind];
    const current = plValues(kind, mode);
    const isIn = mode === 'in';
    const overlay = document.createElement('div');
    overlay.id = 'pl-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal pl-modal pl-modal-${mode}">
            <div class="modal-header">
                <div>
                    <h3><span class="pl-dot pl-dot-${mode}"></span>${isIn ? 'INCLUDE' : 'EXCLUDE'} ${f.title}</h3>
                    <p class="modal-subtitle">${isIn ? 'Only cards matching this list are kept.' : 'Cards matching this list are removed.'} One value per line.</p>
                </div>
                <button class="modal-close" id="pl-close" aria-label="Close">✕</button>
            </div>
            <div class="modal-body">
                <textarea id="pl-textarea" class="list-textarea" rows="12" placeholder="${plEsc(f.sample)}">${plEsc(current.join('\n'))}</textarea>
                <div class="pl-info"><span id="pl-count" class="list-count-badge">${current.length} ${f.unit}</span><span>${plEsc(f.hint)}</span></div>
            </div>
            <div class="modal-footer pl-footer">
                <button class="btn-cancel" id="pl-cancel">Cancel</button>
                <button class="pz-btn pz-btn-dim" id="pl-clear">🗑 CLEAR</button>
                <span class="pl-spacer"></span>
                <button class="pz-btn pz-btn-primary" id="pl-apply">✅ APPLY</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const ta = overlay.querySelector('#pl-textarea');
    const count = overlay.querySelector('#pl-count');
    const close = () => overlay.remove();
    ta.addEventListener('input', () => { count.textContent = `${f.parse(ta.value).length} ${f.unit}`; });
    overlay.querySelector('#pl-close').addEventListener('click', close);
    overlay.querySelector('#pl-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#pl-clear').addEventListener('click', () => { ta.value = ''; count.textContent = `0 ${f.unit}`; });
    overlay.querySelector('#pl-apply').addEventListener('click', () => {
        const list = f.parse(ta.value);
        plWrite(kind, mode, list);
        close();
        toast(`${isIn ? 'Include' : 'Exclude'} ${f.title}: ${list.length} ${f.unit}`, list.length ? 'success' : 'info');
    });
    ta.focus();
}

/** Wires the six buttons (called from pfBindFilterUi). */
function plBind() {
    document.querySelectorAll('[data-pl-kind]').forEach(btn => {
        btn.addEventListener('click', () => plOpenPopup(btn.dataset.plKind, btn.dataset.plMode));
    });
    plRefreshCounts();
}
