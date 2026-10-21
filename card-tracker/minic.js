/* ═══════════════════════════════════════════
 * MINIC — Google mini-charge card tracker
 * One row per card: BIN (6) + last 4, card type, charges, status, note.
 * Data lives in STATE.minicBins (persisted by app.js save()).
 * ═══════════════════════════════════════════ */
(function () {
    'use strict';

    const STATUSES = [
        { id: 'wait', label: 'WAIT', hint: 'Ждём — миник ещё не пришёл', color: '#94a3b8' },
        { id: 'ok', label: 'OK', hint: 'Миник пришёл, транзакция прошла', color: '#22c55e' },
        { id: 'fail', label: 'FAIL', hint: 'Миник пришёл, но транзакция не прошла', color: '#ef4444' },
        { id: 'nocode', label: 'NO CODE', hint: 'Миник не пришёл', color: '#f59e0b' },
    ];
    const STATUS_IDS = STATUSES.map(s => s.id);
    const NOTE_PRESETS = ['ждать 1 день', 'повторить завтра', '3DS', 'бан BIN', 'лимит'];

    // ── Pure helpers (unit-tested in minic.test.js) ──

    function parseAmount(v) {
        const m = String(v || '').replace(',', '.').match(/\d+(?:\.\d{1,2})?/);
        if (!m || !(parseFloat(m[0]) > 0)) return null;
        return m[0];
    }

    function parseLine(line) {
        const amounts = [];
        const take = a => { amounts.push(a.replace(',', '.')); return ' '; };
        let rest = String(line || '')
            .replace(/\b\d{2}\/\d{2,4}\b/g, ' ')                               // expiry MM/YY
            .replace(/\$\s*(\d+(?:[.,]\d{1,2})?)/g, (m, a) => take(a))         // $9.51
            .replace(/(^|\s)(\d{1,5}[.,]\d{2})(?=\s|$)/g, (m, p, a) => take(a)); // 9.51
        const digits = rest.replace(/\D/g, '');
        if (digits.length < 6) return null;
        return { bin: digits.slice(0, 6), last4: digits.length >= 10 ? digits.slice(-4) : '', amounts };
    }

    function parseText(text) {
        return String(text || '').split(/\r?\n/).map(parseLine).filter(Boolean);
    }

    function sumAmounts(list) {
        return (list || []).reduce((s, a) => s + (parseFloat(a) || 0), 0);
    }

    function normalize(b, makeId) {
        return {
            id: b.id || makeId(),
            bin: String(b.bin || '').slice(0, 6),
            last4: b.last4 || '',
            type: b.type || '',
            status: STATUS_IDS.includes(b.status) ? b.status : 'wait',
            amounts: Array.isArray(b.amounts) ? b.amounts : (b.amount ? [String(b.amount)] : []),
            note: b.note || '',
            date: b.date || '',
            tab: b.tab || 'main',
        };
    }

    const cardKey = (bin, last4, tab) => bin + '|' + last4 + '|' + tab;

    /** Returns a NEW array; duplicates (same BIN+last4 in tab) get extra amounts appended. */
    function mergeCards(existing, parsed, tab, date, makeId) {
        const index = new Map(existing.map((b, i) => [cardKey(b.bin, b.last4, b.tab), i]));
        const cards = existing.slice();
        let added = 0, merged = 0, skipped = 0;
        parsed.forEach(p => {
            const key = cardKey(p.bin, p.last4, tab);
            if (index.has(key)) {
                if (!p.amounts.length) { skipped++; return; }
                const i = index.get(key);
                cards[i] = { ...cards[i], amounts: [...cards[i].amounts, ...p.amounts] };
                merged++;
                return;
            }
            cards.push({ id: makeId(), bin: p.bin, last4: p.last4, type: '', status: 'wait', amounts: p.amounts, note: '', date, tab });
            index.set(key, cards.length - 1);
            added++;
        });
        return { cards, added, merged, skipped };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { parseLine, parseText, parseAmount, sumAmounts, normalize, mergeCards, STATUSES };
        return;
    }

    // ── Browser-only part ──

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const newId = () => 'mn_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const binInfo = bin => (typeof BIN_CACHE !== 'undefined' && BIN_CACHE[bin]) || {};

    function getCards() {
        const raw = STATE.minicBins || [];
        if (raw.some(b => !b || !b.id || !Array.isArray(b.amounts))) {
            STATE.minicBins = raw.filter(Boolean).map(b => normalize(b, newId));
            save();
        }
        return STATE.minicBins;
    }
    function setCards(next) { STATE.minicBins = next; save(); render(); }
    function updateCard(id, patch) { setCards(getCards().map(b => (b.id === id ? { ...b, ...patch } : b))); }
    const findCard = id => getCards().find(b => b.id === id);
    const getTabs = () => (STATE.minicTabs && STATE.minicTabs.length ? STATE.minicTabs : [{ id: 'main', name: 'Main' }]);

    function cardType(b) {
        if (b.type) return { main: b.type.toUpperCase(), sub: '' };
        const info = binInfo(b.bin);
        const brand = info.brand || (typeof _brandByDigit === 'function' ? _brandByDigit(b.bin) : '');
        return { main: [brand, info.type].filter(Boolean).join(' ').toUpperCase(), sub: (info.level || '').toUpperCase() };
    }

    // ── BIN lookups (async, re-render once data arrives) ──
    const requested = new Set();
    let renderTimer = null;
    function scheduleRender() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(() => {
            if (STATE.currentView !== 'minic-bins') return;
            const ae = document.activeElement;
            if (ae && /INPUT|TEXTAREA/.test(ae.tagName) && ae.closest('#content-area')) { scheduleRender(); return; }
            render();
        }, 400);
    }
    function lookupMissing(cards) {
        if (typeof lookupBin !== 'function') return;
        cards.forEach(b => {
            if (!b.bin || BIN_CACHE[b.bin] || requested.has(b.bin)) return;
            requested.add(b.bin);
            lookupBin(b.bin).catch(() => null).finally(scheduleRender);
        });
    }

    // ── Render pieces ──

    function tabsHtml(tabs, activeTab, all) {
        return tabs.map(t => {
            const cnt = all.filter(b => b.tab === t.id).length;
            const close = t.id !== 'main' ? ` <span class="mc-tab-close" onclick="event.stopPropagation();_mcCloseTab('${t.id}')">✕</span>` : '';
            return `<div class="mc-tab ${t.id === activeTab ? 'mc-tab-active' : ''}" onclick="_mcSwitchTab('${t.id}')"><span class="mc-tab-name">${esc(t.name)}</span> <span class="mc-tab-cnt">${cnt}</span>${close}</div>`;
        }).join('') + '<div class="mc-tab mc-tab-add" title="Новый сервис / вкладка" onclick="_mcAddTab()">+</div>';
    }

    function statsHtml(cards, filter) {
        const count = id => cards.filter(b => b.status === id).length;
        const done = count('ok') + count('fail') + count('nocode');
        const rate = done ? Math.round((count('ok') / done) * 100) : null;
        const pill = (id, label, n, color) =>
            `<span class="mn-pill ${filter === id ? 'on' : ''}" style="--c:${color}" onclick="_mcFilter('${id}')">${label} <b>${n}</b></span>`;
        return '<div class="mn-stats">'
            + pill('all', 'ALL', cards.length, '#a0a4b8')
            + STATUSES.map(s => pill(s.id, s.label, count(s.id), s.color)).join('')
            + (rate === null ? '' : `<span class="mn-rate" title="OK / (OK + FAIL + NO CODE)">Успех <b>${rate}%</b></span>`)
            + '</div>';
    }

    function toolbarHtml(activeTab) {
        const move = activeTab !== 'main' ? '<button class="bv-ib" onclick="_mcMoveToMain()">📥 Move to Main</button>' : '';
        return `<div class="bv-bar"><button class="bv-ib mn-add-btn" onclick="_mnToggleAdd()">+ Add cards</button>${move}</div>
        <div id="mn-add-panel" class="bv-ip" style="display:none">
            <textarea id="mn-add-text" class="bv-ita" rows="5" placeholder="По одной карте в строке: первые 6 + последние 4, суммы — по желанию&#10;453700 5021&#10;4537 00** **** 5021 $9.51&#10;5160750000004500 9.51 634.24"></textarea>
            <div class="bv-ia">
                <span id="mn-add-count" class="bv-ic">0 cards</span>
                <button class="bv-ig" onclick="_mnDoAdd()">ADD</button>
                <button class="bv-icl" onclick="_mnToggleAdd(false)">Cancel</button>
            </div>
        </div>`;
    }

    function rowHtml(b, idx, pos) {
        const t = cardType(b);
        const info = binInfo(b.bin);
        const brandIcon = typeof _brandIconGlobal === 'function' && t.main ? _brandIconGlobal(t.main, b.bin + '0000000000') : '';
        const last4 = b.last4 ? esc(b.last4) : `<span class="mn-miss" onclick="_mnEdit('${b.id}')" title="Добавить последние 4">····</span>`;
        const chips = b.amounts.map((a, k) => `<span class="mn-chip">$${esc(a)}<i onclick="_mnDelAmt('${b.id}',${k})" title="Удалить сумму">×</i></span>`).join('');
        const total = b.amounts.length > 1 ? `<span class="mn-total">= $${sumAmounts(b.amounts).toFixed(2)}</span>` : '';
        const btns = STATUSES.map(s =>
            `<button class="mn-sb ${b.status === s.id ? 'on' : ''}" style="--c:${s.color}" title="${s.hint}" onclick="_mnSetStatus('${b.id}','${s.id}')">${s.label}</button>`).join('');
        return `<tr class="mn-row mn-st-${b.status}" oncontextmenu="event.preventDefault();_mnCtx(event,'${b.id}')">
            <td class="mc-chk" onclick="event.stopPropagation()"><label class="bulk-check"><input type="checkbox" class="row-select-cb" data-card-id="mc-${idx}" onchange="toggleCardSelect(this.dataset.cardId,this.checked)"></label></td>
            <td class="mn-idx">${pos}</td>
            <td class="mn-card" title="Клик — скопировать" onclick="_mnCopy('${b.id}')"><span class="mn-bin">${esc(b.bin)}</span><span class="mn-dots">••••••</span><span class="mn-last">${last4}</span></td>
            <td class="mn-type" title="${esc(info.bank || '')}">${brandIcon}<span>${esc(t.main) || '—'}</span>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</td>
            <td class="mn-amts">${chips}${total}<input class="mn-amt-in" data-amt-for="${b.id}" placeholder="+ $" title="Сумма списания, Enter — добавить" onkeydown="if(event.key==='Enter')_mnAddAmt('${b.id}',this.value)"></td>
            <td class="mn-status">${btns}</td>
            <td class="mn-note"><input class="bv-ni" list="mn-note-presets" value="${esc(b.note)}" placeholder="—" onchange="_mnNote('${b.id}',this.value)"></td>
            <td class="mn-date">${esc(b.date) || '—'}</td>
        </tr>`;
    }

    function tableHtml(rows) {
        const body = rows.length
            ? rows.map(({ b, i, pos }) => rowHtml(b, i, pos)).join('')
            : '<tr><td colspan="8" class="mn-empty">Нет карт — нажми «+ Add cards» и вставь список</td></tr>';
        return `<table class="data-table bv-t mn-table"><thead><tr>
            <th style="width:24px"><label class="bulk-check"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></label></th>
            <th style="width:30px">#</th><th>CARD</th><th>TYPE</th><th>CHARGES</th><th>STATUS</th><th>NOTE</th><th>DATE</th>
        </tr></thead><tbody>${body}</tbody></table>
        <datalist id="mn-note-presets">${NOTE_PRESETS.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
    }

    function ensureOverlays() {
        [['bv-edit-modal', 'bv-edit-overlay'], ['bv-ctx-menu', 'bv-ctx']].forEach(([id, cls]) => {
            if (document.getElementById(id)) return;
            const el = document.createElement('div');
            el.id = id; el.className = cls; el.style.display = 'none';
            document.body.appendChild(el);
            if (id === 'bv-ctx-menu') document.addEventListener('click', () => { el.style.display = 'none'; });
        });
    }

    function render() {
        const area = document.getElementById('content-area');
        if (!area) return;
        const all = getCards();
        const tabs = getTabs();
        const activeTab = tabs.some(t => t.id === STATE.minicActiveTab) ? STATE.minicActiveTab : 'main';
        const filter = STATUS_IDS.includes(STATE.minicTagFilter) ? STATE.minicTagFilter : 'all';
        const inTab = all.map((b, i) => ({ b, i })).filter(x => x.b.tab === activeTab)
            .map((x, n) => ({ ...x, pos: n + 1 })).reverse(); // newest first
        const shown = filter === 'all' ? inTab : inTab.filter(x => x.b.status === filter);

        area.innerHTML = `<div class="mc-tab-bar">${tabsHtml(tabs, activeTab, all)}</div>`
            + statsHtml(inTab.map(x => x.b), filter) + toolbarHtml(activeTab) + tableHtml(shown);

        ensureOverlays();
        const ta = document.getElementById('mn-add-text');
        ta.addEventListener('input', () => { document.getElementById('mn-add-count').textContent = parseText(ta.value).length + ' cards'; });
        if (typeof renderFooter === 'function') renderFooter(shown.length, 1, 1);
        lookupMissing(inTab.map(x => x.b));
    }

    // ── Actions ──

    window.renderMinicBins = render;

    window._mnToggleAdd = function (show) {
        const p = document.getElementById('mn-add-panel');
        if (!p) return;
        const open = typeof show === 'boolean' ? show : p.style.display === 'none';
        p.style.display = open ? 'block' : 'none';
        if (open) document.getElementById('mn-add-text').focus();
    };

    window._mnDoAdd = function () {
        const parsed = parseText(document.getElementById('mn-add-text').value);
        if (!parsed.length) { toast('Не найдено карт. Формат: 453700 5021', 'error'); return; }
        const tab = getTabs().some(t => t.id === STATE.minicActiveTab) ? STATE.minicActiveTab : 'main';
        const r = mergeCards(getCards(), parsed, tab, todayStr(), newId);
        setCards(r.cards);
        const extra = [r.merged && r.merged + ' обновлено', r.skipped && r.skipped + ' дубл.'].filter(Boolean).join(', ');
        toast(r.added + ' карт добавлено' + (extra ? ' (' + extra + ')' : ''), 'success');
    };

    window._mnSetStatus = (id, status) => {
        const b = findCard(id);
        if (b && STATUS_IDS.includes(status)) updateCard(id, { status: b.status === status ? 'wait' : status });
    };

    window._mnAddAmt = function (id, value) {
        const amt = parseAmount(value);
        if (!amt) { toast('Неверная сумма', 'error'); return; }
        const b = findCard(id);
        if (!b) return;
        updateCard(id, { amounts: [...b.amounts, amt] });
        const inp = document.querySelector(`[data-amt-for="${id}"]`);
        if (inp) inp.focus();
    };

    window._mnDelAmt = (id, k) => {
        const b = findCard(id);
        if (b) updateCard(id, { amounts: b.amounts.filter((_, i) => i !== k) });
    };

    window._mnNote = (id, value) => {
        STATE.minicBins = getCards().map(b => (b.id === id ? { ...b, note: String(value).slice(0, 200) } : b));
        save();
    };

    window._mnCopy = function (id) {
        const b = findCard(id);
        if (!b) return;
        const text = b.bin + (b.last4 ? '******' + b.last4 : '');
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        toast('Скопировано: ' + text, 'success');
    };

    window._mnCtx = function (e, id) {
        const ctx = document.getElementById('bv-ctx-menu');
        ctx.innerHTML = `<div class="bv-ctx-item" onclick="_mnEdit('${id}')">&#9998; Edit</div>`
            + `<div class="bv-ctx-item bv-ctx-danger" onclick="_mnDelete('${id}')">&#x2715; Delete</div>`;
        ctx.style.display = 'block';
        ctx.style.left = Math.min(e.clientX, window.innerWidth - 160) + 'px';
        ctx.style.top = Math.min(e.clientY, window.innerHeight - 80) + 'px';
    };

    window._mnEdit = function (id) {
        document.getElementById('bv-ctx-menu').style.display = 'none';
        const b = findCard(id);
        if (!b) return;
        const modal = document.getElementById('bv-edit-modal');
        modal.innerHTML = `<div class="bv-edit-box">
            <div class="bv-edit-title">Edit card</div>
            <label class="bv-edit-lbl">First 6 (BIN)</label>
            <input id="mn-e-bin" class="bv-edit-inp bv-edit-sm" maxlength="6" inputmode="numeric" value="${esc(b.bin)}">
            <label class="bv-edit-lbl">Last 4</label>
            <input id="mn-e-last" class="bv-edit-inp bv-edit-sm" maxlength="4" inputmode="numeric" value="${esc(b.last4)}">
            <label class="bv-edit-lbl">Type (пусто = авто по BIN)</label>
            <input id="mn-e-type" class="bv-edit-inp" maxlength="40" placeholder="${esc(cardType({ ...b, type: '' }).main)}" value="${esc(b.type)}">
            <div class="bv-edit-btns">
                <button class="bv-edit-save" onclick="_mnSaveEdit('${id}')">Save</button>
                <button class="bv-edit-cancel" onclick="document.getElementById('bv-edit-modal').style.display='none'">Cancel</button>
            </div></div>`;
        modal.style.display = 'flex';
        document.getElementById(b.last4 ? 'mn-e-bin' : 'mn-e-last').focus();
    };

    window._mnSaveEdit = function (id) {
        const bin = document.getElementById('mn-e-bin').value.trim();
        const last4 = document.getElementById('mn-e-last').value.trim();
        const type = document.getElementById('mn-e-type').value.trim().slice(0, 40);
        if (!/^\d{6}$/.test(bin)) { toast('BIN — ровно 6 цифр', 'error'); return; }
        if (last4 && !/^\d{4}$/.test(last4)) { toast('Last 4 — ровно 4 цифры', 'error'); return; }
        document.getElementById('bv-edit-modal').style.display = 'none';
        updateCard(id, { bin, last4, type });
        toast('Карта обновлена', 'success');
    };

    window._mnDelete = function (id) {
        document.getElementById('bv-ctx-menu').style.display = 'none';
        _bvShowConfirm('Удалить карту?', () => { setCards(getCards().filter(b => b.id !== id)); toast('Удалено', 'success'); });
    };

    // ── Tabs (services) & filter — names kept for compatibility with app.js ──

    window._mcFilter = f => { STATE.minicTagFilter = f; render(); };
    window._mcSwitchTab = id => { STATE.minicActiveTab = id; STATE.minicTagFilter = 'all'; render(); };

    window._mcAddTab = function () {
        ensureOverlays();
        const modal = document.getElementById('bv-edit-modal');
        modal.innerHTML = `<div class="bv-edit-box">
            <div class="bv-edit-title">New tab</div>
            <label class="bv-edit-lbl">Название (сервис)</label>
            <input id="mc-new-tab-name" class="bv-edit-inp" placeholder="Melio, Navan..." maxlength="20" onkeydown="if(event.key==='Enter')_mcSaveNewTab()">
            <div class="bv-edit-btns">
                <button class="bv-edit-save" onclick="_mcSaveNewTab()">Create</button>
                <button class="bv-edit-cancel" onclick="document.getElementById('bv-edit-modal').style.display='none'">Cancel</button>
            </div></div>`;
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('mc-new-tab-name').focus(), 50);
    };

    window._mcSaveNewTab = function () {
        const name = document.getElementById('mc-new-tab-name').value.trim();
        if (!name) { toast('Введите название', 'error'); return; }
        const id = 'mctab_' + Date.now();
        STATE.minicTabs = [...getTabs(), { id, name }];
        STATE.minicActiveTab = id;
        document.getElementById('bv-edit-modal').style.display = 'none';
        save(); render();
    };

    window._mcCloseTab = function (tabId) {
        if (tabId === 'main') return;
        const n = getCards().filter(b => b.tab === tabId).length;
        _bvShowConfirm(n ? 'Удалить вкладку и ' + n + ' карт?' : 'Удалить пустую вкладку?', () => {
            STATE.minicTabs = getTabs().filter(t => t.id !== tabId);
            if (STATE.minicActiveTab === tabId) STATE.minicActiveTab = 'main';
            setCards(getCards().filter(b => b.tab !== tabId));
        });
    };

    window._mcMoveToMain = function () {
        const from = STATE.minicActiveTab;
        if (!from || from === 'main') return;
        const all = getCards();
        if (!all.some(b => b.tab === from)) { toast('Нет карт для переноса', 'warning'); return; }
        const inMain = new Set(all.filter(b => b.tab === 'main').map(b => b.bin + '|' + b.last4));
        let moved = 0, dupes = 0;
        const next = all.map(b => {
            if (b.tab !== from) return b;
            const key = b.bin + '|' + b.last4;
            if (inMain.has(key)) { dupes++; return b; }
            inMain.add(key); moved++;
            return { ...b, tab: 'main' };
        });
        setCards(next);
        toast(moved + ' карт перенесено в Main' + (dupes ? ' (' + dupes + ' дубл. осталось)' : ''), 'success');
    };
})();
