/* ═══════════════════════════════════════════
 * MINIC — Google mini-charge card tracker
 * Row: Octo profile · BIN(6)+last4 · card type · charges · status · note.
 * Data lives in STATE.minicBins (persisted by app.js save()).
 * ═══════════════════════════════════════════ */
(function () {
    'use strict';

    const STATUSES = [
        { id: 'wait', label: 'WAIT', hint: 'Ждём — миник ещё не пришёл', color: '#a5b4fc' },
        { id: 'ok', label: 'OK', hint: 'Миник пришёл, транзакция прошла', color: '#22c55e' },
        { id: 'fail', label: 'FAIL', hint: 'Миник пришёл, но транзакция не прошла', color: '#f43f5e' },
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

    const MASK_RE = /[*•·xX#]/g;
    const isCardToken = t => /^[\d*]+$/.test(t);
    const isMaskOnly = t => /^\*+$/.test(t);
    const isDigits = (t, n) => new RegExp('^\\d{' + n + '}$').test(t);

    /** s = digits + '*' masks; valid when it starts with 6 digits and ends with 4 digits. */
    function fromPan(s) {
        if (s.length < 13 || s.length > 19 || !/^\d{6}/.test(s) || !/\d{4}$/.test(s)) return null;
        return { bin: s.slice(0, 6), last4: s.slice(-4) };
    }

    function findCard(tokens) {
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (!t) continue;
            const pan = fromPan(t);                                   // 4036231234567725 / 453700••••••5021
            if (pan) return pan;
            if (isDigits(t, 6)) {                                     // 453700 [••••••] 5021
                let j = i + 1;
                while (tokens[j] && isMaskOnly(tokens[j])) j++;
                if (tokens[j] && isDigits(tokens[j], 4)) return { bin: t, last4: tokens[j] };
            }
            let joined = '';                                          // 4036 2312 3456 7725 / 3782 822463 10005
            for (let j = i; j < tokens.length && tokens[j] && tokens[j].length >= 3 && tokens[j].length <= 6; j++) {
                joined += tokens[j];
                if (joined.length > 16) break;
                if ((joined.length === 15 || joined.length === 16) && fromPan(joined)) return fromPan(joined);
            }
        }
        const bin = tokens.find(t => t && isDigits(t, 6));             // BIN only
        return bin ? { bin, last4: '' } : null;
    }

    function parseLine(line) {
        const amounts = [];
        const take = a => { amounts.push(a.replace(',', '.')); return ' '; };
        const clean = String(line || '')
            .replace(/[|;\t]/g, ' ')
            .replace(/\b(0[1-9]|1[0-2])\s*\/\s*(\d{4}|\d{2})\b/g, ' ')            // expiry MM/YY
            .replace(/\$\s*(\d+(?:[.,]\d{1,2})?)/g, (m, a) => take(a))            // $9.51
            .replace(/(^|\s)(\d{1,5}[.,]\d{2})(?=\s|$)/g, (m, p, a) => take(a))    // 9.51
            .replace(MASK_RE, '*')
            .replace(/-/g, ' ');
        const tokens = clean.split(/\s+/).filter(Boolean).map(t => (isCardToken(t) ? t : null));
        const found = findCard(tokens);
        return found ? { bin: found.bin, last4: found.last4, amounts } : null;
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
            profile: b.profile || '',
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

    /**
     * Returns a NEW array. A duplicate (same BIN+last4 in tab) gets extra amounts appended
     * and its profile filled if it was empty; otherwise it is skipped.
     */
    function mergeCards(existing, parsed, opts, makeId) {
        const { tab, date, profile = '' } = opts;
        const index = new Map(existing.map((b, i) => [cardKey(b.bin, b.last4, b.tab), i]));
        const cards = existing.slice();
        let added = 0, merged = 0, skipped = 0;
        parsed.forEach(p => {
            const key = cardKey(p.bin, p.last4, tab);
            if (index.has(key)) {
                const i = index.get(key);
                const cur = cards[i];
                const patch = {};
                if (p.amounts.length) patch.amounts = [...cur.amounts, ...p.amounts];
                if (profile && !cur.profile) patch.profile = profile;
                if (!Object.keys(patch).length) { skipped++; return; }
                cards[i] = { ...cur, ...patch };
                merged++;
                return;
            }
            cards.push({ id: makeId(), profile, bin: p.bin, last4: p.last4, type: '', status: 'wait', amounts: p.amounts, note: '', date, tab });
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

    // UI state that must survive re-renders
    const ui = { addOpen: false, draft: '', draftProfile: '', search: '' };

    function getCards() {
        const raw = STATE.minicBins || [];
        if (raw.some(b => !b || !b.id || !Array.isArray(b.amounts) || b.profile === undefined)) {
            STATE.minicBins = raw.filter(Boolean).map(b => normalize(b, newId));
            save();
        }
        return STATE.minicBins;
    }
    function setCards(next) { STATE.minicBins = next; save(); render(); }
    function updateCard(id, patch) { setCards(getCards().map(b => (b.id === id ? { ...b, ...patch } : b))); }
    const findById = id => getCards().find(b => b.id === id);
    const getTabs = () => (STATE.minicTabs && STATE.minicTabs.length ? STATE.minicTabs : [{ id: 'main', name: 'Main' }]);
    const activeTabId = () => (getTabs().some(t => t.id === STATE.minicActiveTab) ? STATE.minicActiveTab : 'main');

    function cardType(b) {
        if (b.type) return { main: b.type.toUpperCase(), sub: '' };
        const info = binInfo(b.bin);
        const brand = info.brand || (typeof _brandByDigit === 'function' ? _brandByDigit(b.bin) : '');
        return { main: [brand, info.type].filter(Boolean).join(' ').toUpperCase(), sub: (info.level || '').toUpperCase() };
    }

    function matchesSearch(b, q) {
        if (!q) return true;
        const hay = (b.profile + ' ' + b.bin + ' ' + b.last4 + ' ' + b.note).toLowerCase();
        return q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
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
        }, 500);
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
            const close = t.id !== 'main' ? `<span class="mn-tab-x" onclick="event.stopPropagation();_mcCloseTab('${t.id}')">✕</span>` : '';
            return `<div class="mn-tab ${t.id === activeTab ? 'on' : ''}" onclick="_mcSwitchTab('${t.id}')">${esc(t.name)}<span class="mn-tab-cnt">${cnt}</span>${close}</div>`;
        }).join('') + '<div class="mn-tab mn-tab-add" title="Новая вкладка (сервис)" onclick="_mcAddTab()">+</div>';
    }

    function statsHtml(cards, filter) {
        const count = id => cards.filter(b => b.status === id).length;
        const done = count('ok') + count('fail') + count('nocode');
        const rate = done ? Math.round((count('ok') / done) * 100) : null;
        const pill = (id, label, n, color) =>
            `<button class="mn-pill ${filter === id ? 'on' : ''}" style="--c:${color}" onclick="_mcFilter('${id}')"><span>${label}</span><b>${n}</b></button>`;
        return '<div class="mn-stats">'
            + pill('all', 'ALL', cards.length, '#e2e8f0')
            + STATUSES.map(s => pill(s.id, s.label, count(s.id), s.color)).join('')
            + (rate === null ? '' : `<div class="mn-rate" title="OK / (OK + FAIL + NO CODE)"><span>Успех</span><b>${rate}%</b></div>`)
            + '</div>';
    }

    function toolbarHtml(activeTab) {
        const move = activeTab !== 'main' ? '<button class="mn-btn" onclick="_mcMoveToMain()">📥 Move to Main</button>' : '';
        return `<div class="mn-toolbar">
            <button class="mn-btn mn-btn-primary" onclick="_mnToggleAdd()">+ Добавить карты</button>
            ${move}
            <input id="mn-search" class="mn-search" placeholder="🔍 Поиск: профиль, BIN, last4..." value="${esc(ui.search)}" oninput="_mnSearch(this.value)">
        </div>
        <div id="mn-add-panel" class="mn-add" style="display:${ui.addOpen ? 'block' : 'none'}">
            <label class="mn-lbl">Профиль Octo (для всех вставленных карт)</label>
            <input id="mn-add-profile" class="mn-inp" maxlength="60" placeholder="например: Octo 15 / US-Melio-03" value="${esc(ui.draftProfile)}" oninput="_mnDraft()">
            <label class="mn-lbl">Карты — по одной в строке (подойдёт любой формат, суммы по желанию)</label>
            <textarea id="mn-add-text" class="mn-ta" rows="6" placeholder="4036231234567725|12|28|123&#10;453700 5021 $9.51&#10;4537 00** **** 5021 9.51 634.24" oninput="_mnDraft()">${esc(ui.draft)}</textarea>
            <div class="mn-add-foot">
                <span id="mn-add-count" class="mn-add-count"></span>
                <button class="mn-btn" onclick="_mnToggleAdd(false)">Отмена</button>
                <button class="mn-btn mn-btn-primary" onclick="_mnDoAdd()">Добавить</button>
            </div>
        </div>`;
    }

    function rowHtml(b, idx, pos) {
        const t = cardType(b);
        const info = binInfo(b.bin);
        const brandIcon = typeof _brandIconGlobal === 'function' && t.main ? _brandIconGlobal(t.main, b.bin + '0000000000') : '';
        const last4 = b.last4 ? esc(b.last4) : `<span class="mn-miss" onclick="event.stopPropagation();_mnEdit('${b.id}')" title="Добавить последние 4">····</span>`;
        const chips = b.amounts.map((a, k) => `<span class="mn-chip">$${esc(a)}<i onclick="_mnDelAmt('${b.id}',${k})" title="Удалить сумму">×</i></span>`).join('');
        const total = b.amounts.length > 1 ? `<span class="mn-total">= $${sumAmounts(b.amounts).toFixed(2)}</span>` : '';
        const btns = STATUSES.map(s =>
            `<button class="mn-sb ${b.status === s.id ? 'on' : ''}" style="--c:${s.color}" title="${s.hint}" onclick="_mnSetStatus('${b.id}','${s.id}')">${s.label}</button>`).join('');
        return `<tr class="mn-row" style="--st:${STATUSES.find(s => s.id === b.status).color}" oncontextmenu="event.preventDefault();_mnCtx(event,'${b.id}')">
            <td class="mn-c-chk" onclick="event.stopPropagation()"><label class="bulk-check"><input type="checkbox" class="row-select-cb" data-card-id="mc-${idx}" onchange="toggleCardSelect(this.dataset.cardId,this.checked)"></label></td>
            <td class="mn-c-idx">${pos}</td>
            <td class="mn-c-prof"><input class="mn-prof-in ${b.profile ? '' : 'empty'}" value="${esc(b.profile)}" placeholder="профиль?" maxlength="60" onchange="_mnProfile('${b.id}',this.value)"></td>
            <td class="mn-c-card" title="Клик — скопировать" onclick="_mnCopy('${b.id}')"><span class="mn-bin">${esc(b.bin)}</span><span class="mn-dots">••••••</span><span class="mn-last">${last4}</span></td>
            <td class="mn-c-type" title="${esc(info.bank || '')}">${brandIcon}<span>${esc(t.main) || '—'}</span>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</td>
            <td class="mn-c-amts">${chips}${total}<input class="mn-amt-in" data-amt-for="${b.id}" placeholder="+ $" title="Сумма списания, Enter — добавить" onkeydown="if(event.key==='Enter')_mnAddAmt('${b.id}',this.value)"></td>
            <td class="mn-c-status">${btns}</td>
            <td class="mn-c-note"><input class="mn-note-in" list="mn-note-presets" value="${esc(b.note)}" placeholder="заметка…" onchange="_mnNote('${b.id}',this.value)"></td>
            <td class="mn-c-date">${esc(b.date) || '—'}</td>
        </tr>`;
    }

    function tableHtml(rows, emptyText) {
        const body = rows.length
            ? rows.map(({ b, i, pos }) => rowHtml(b, i, pos)).join('')
            : `<tr><td colspan="9" class="mn-empty">${emptyText}</td></tr>`;
        return `<div class="mn-table-wrap"><table class="mn-table"><thead><tr>
            <th style="width:28px"><label class="bulk-check"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></label></th>
            <th style="width:36px">#</th><th>Профиль</th><th>Карта</th><th>Тип</th><th>Списания</th><th>Статус</th><th>Заметка</th><th>Дата</th>
        </tr></thead><tbody>${body}</tbody></table></div>
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

    function updateAddCount() {
        const el = document.getElementById('mn-add-count');
        if (!el) return;
        const lines = ui.draft.split(/\r?\n/).filter(l => l.trim());
        const ok = parseText(ui.draft).length;
        el.textContent = lines.length ? `Распознано: ${ok} из ${lines.length}` : '';
        el.classList.toggle('bad', lines.length > 0 && ok < lines.length);
    }

    function render() {
        const area = document.getElementById('content-area');
        if (!area) return;
        const all = getCards();
        const tabs = getTabs();
        const activeTab = activeTabId();
        const filter = STATUS_IDS.includes(STATE.minicTagFilter) ? STATE.minicTagFilter : 'all';
        const inTab = all.map((b, i) => ({ b, i })).filter(x => x.b.tab === activeTab)
            .map((x, n) => ({ ...x, pos: n + 1 })).reverse(); // newest first
        const shown = inTab.filter(x => (filter === 'all' || x.b.status === filter) && matchesSearch(x.b, ui.search));
        const emptyText = inTab.length ? 'Ничего не найдено' : 'Нет карт — нажми «+ Добавить карты» и вставь список';

        area.innerHTML = `<div class="mn-root">
            <div class="mn-tabs">${tabsHtml(tabs, activeTab, all)}</div>
            ${statsHtml(inTab.map(x => x.b), filter)}
            ${toolbarHtml(activeTab)}
            ${tableHtml(shown, emptyText)}
        </div>`;

        ensureOverlays();
        updateAddCount();
        if (typeof renderFooter === 'function') renderFooter(shown.length, 1, 1);
        lookupMissing(inTab.map(x => x.b));
    }

    // ── Actions ──

    window.renderMinicBins = render;

    window._mnDraft = function () {
        ui.draft = document.getElementById('mn-add-text').value;
        ui.draftProfile = document.getElementById('mn-add-profile').value;
        updateAddCount();
    };

    window._mnSearch = function (q) {
        ui.search = q;
        render();
        const s = document.getElementById('mn-search');
        if (s) { s.focus(); s.setSelectionRange(q.length, q.length); }
    };

    window._mnToggleAdd = function (show) {
        ui.addOpen = typeof show === 'boolean' ? show : !ui.addOpen;
        const p = document.getElementById('mn-add-panel');
        if (p) p.style.display = ui.addOpen ? 'block' : 'none';
        if (ui.addOpen) {
            const target = document.getElementById(ui.draftProfile ? 'mn-add-text' : 'mn-add-profile');
            if (target) target.focus();
        }
    };

    window._mnDoAdd = function () {
        try {
            window._mnDraft();
            const lines = ui.draft.split(/\r?\n/).filter(l => l.trim());
            const parsed = parseText(ui.draft);
            if (!parsed.length) {
                toast('Не распознано ни одной карты. Нужны первые 6 и последние 4 цифры', 'error');
                return;
            }
            const profile = ui.draftProfile.trim().slice(0, 60);
            const r = mergeCards(getCards(), parsed, { tab: activeTabId(), date: todayStr(), profile }, newId);
            ui.draft = '';
            ui.addOpen = false;
            setCards(r.cards);
            const bad = lines.length - parsed.length;
            const extra = [r.merged && r.merged + ' обновлено', r.skipped && r.skipped + ' уже были', bad > 0 && bad + ' строк не распознано']
                .filter(Boolean).join(', ');
            toast('Добавлено карт: ' + r.added + (extra ? ' (' + extra + ')' : ''), r.added || r.merged ? 'success' : 'warning');
        } catch (e) {
            console.error('[Minic] add failed', e);
            toast('Ошибка при добавлении: ' + e.message, 'error');
        }
    };

    window._mnSetStatus = (id, status) => {
        const b = findById(id);
        if (b && STATUS_IDS.includes(status)) updateCard(id, { status: b.status === status ? 'wait' : status });
    };

    window._mnAddAmt = function (id, value) {
        const amt = parseAmount(value);
        if (!amt) { toast('Неверная сумма', 'error'); return; }
        const b = findById(id);
        if (!b) return;
        updateCard(id, { amounts: [...b.amounts, amt] });
        const inp = document.querySelector(`[data-amt-for="${id}"]`);
        if (inp) inp.focus();
    };

    window._mnDelAmt = (id, k) => {
        const b = findById(id);
        if (b) updateCard(id, { amounts: b.amounts.filter((_, i) => i !== k) });
    };

    function patchSilently(id, patch) {
        STATE.minicBins = getCards().map(b => (b.id === id ? { ...b, ...patch } : b));
        save();
    }
    window._mnNote = (id, value) => patchSilently(id, { note: String(value).slice(0, 200) });
    window._mnProfile = (id, value) => patchSilently(id, { profile: String(value).trim().slice(0, 60) });

    window._mnCopy = function (id) {
        const b = findById(id);
        if (!b) return;
        const text = b.bin + (b.last4 ? '******' + b.last4 : '');
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        toast('Скопировано: ' + text, 'success');
    };

    window._mnCtx = function (e, id) {
        const ctx = document.getElementById('bv-ctx-menu');
        ctx.innerHTML = `<div class="bv-ctx-item" onclick="_mnEdit('${id}')">&#9998; Изменить</div>`
            + `<div class="bv-ctx-item bv-ctx-danger" onclick="_mnDelete('${id}')">&#x2715; Удалить</div>`;
        ctx.style.display = 'block';
        ctx.style.left = Math.min(e.clientX, window.innerWidth - 160) + 'px';
        ctx.style.top = Math.min(e.clientY, window.innerHeight - 80) + 'px';
    };

    window._mnEdit = function (id) {
        document.getElementById('bv-ctx-menu').style.display = 'none';
        const b = findById(id);
        if (!b) return;
        const modal = document.getElementById('bv-edit-modal');
        modal.innerHTML = `<div class="bv-edit-box">
            <div class="bv-edit-title">Изменить карту</div>
            <label class="bv-edit-lbl">Профиль Octo</label>
            <input id="mn-e-prof" class="bv-edit-inp" maxlength="60" value="${esc(b.profile)}">
            <label class="bv-edit-lbl">Первые 6 (BIN)</label>
            <input id="mn-e-bin" class="bv-edit-inp bv-edit-sm" maxlength="6" inputmode="numeric" value="${esc(b.bin)}">
            <label class="bv-edit-lbl">Последние 4</label>
            <input id="mn-e-last" class="bv-edit-inp bv-edit-sm" maxlength="4" inputmode="numeric" value="${esc(b.last4)}">
            <label class="bv-edit-lbl">Тип (пусто = авто по BIN)</label>
            <input id="mn-e-type" class="bv-edit-inp" maxlength="40" placeholder="${esc(cardType({ ...b, type: '' }).main)}" value="${esc(b.type)}">
            <div class="bv-edit-btns">
                <button class="bv-edit-save" onclick="_mnSaveEdit('${id}')">Сохранить</button>
                <button class="bv-edit-cancel" onclick="document.getElementById('bv-edit-modal').style.display='none'">Отмена</button>
            </div></div>`;
        modal.style.display = 'flex';
        document.getElementById(b.last4 ? 'mn-e-prof' : 'mn-e-last').focus();
    };

    window._mnSaveEdit = function (id) {
        const profile = document.getElementById('mn-e-prof').value.trim().slice(0, 60);
        const bin = document.getElementById('mn-e-bin').value.trim();
        const last4 = document.getElementById('mn-e-last').value.trim();
        const type = document.getElementById('mn-e-type').value.trim().slice(0, 40);
        if (!/^\d{6}$/.test(bin)) { toast('BIN — ровно 6 цифр', 'error'); return; }
        if (last4 && !/^\d{4}$/.test(last4)) { toast('Последние 4 — ровно 4 цифры', 'error'); return; }
        document.getElementById('bv-edit-modal').style.display = 'none';
        updateCard(id, { profile, bin, last4, type });
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
            <div class="bv-edit-title">Новая вкладка</div>
            <label class="bv-edit-lbl">Название (сервис)</label>
            <input id="mc-new-tab-name" class="bv-edit-inp" placeholder="Melio, Navan..." maxlength="20" onkeydown="if(event.key==='Enter')_mcSaveNewTab()">
            <div class="bv-edit-btns">
                <button class="bv-edit-save" onclick="_mcSaveNewTab()">Создать</button>
                <button class="bv-edit-cancel" onclick="document.getElementById('bv-edit-modal').style.display='none'">Отмена</button>
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
