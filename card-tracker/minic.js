/* ═══════════════════════════════════════════
 * MINIC — Google mini-charge card tracker (UI)
 * Profile (group row) → cards[] (nested rows): number · exp · cvv · type · charges · status · note.
 * Pure logic lives in minic-core.js. Data lives in STATE.minicBins (persisted by app.js save()).
 * ═══════════════════════════════════════════ */
(function () {
    'use strict';

    const C = window.MinicCore;
    if (!C) { console.error('[Minic] minic-core.js must be loaded before minic.js'); return; }
    const { STATUSES, STATUS_IDS, LIMITS, esc } = C;

    const newId = () => 'mn_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const binInfo = bin => (bin && typeof BIN_CACHE !== 'undefined' && BIN_CACHE[bin]) || {};
    const statusOf = id => STATUSES.find(s => s.id === id) || STATUSES[0];
    const today = () => (typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10));
    const notify = (msg, type) => (typeof toast === 'function' ? toast(msg, type) : console.log('[Minic]', msg));
    const $ = id => document.getElementById(id);
    const ENTER_BLUR = `onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"`;

    // UI state that must survive re-renders. `search` = input value, `query` = applied (debounced).
    const ui = { addOpen: false, draft: '', draftProfile: '', search: '', query: '', words: [] };
    let searchTimer = null;

    // ── State access (immutable updates) ──

    function getProfiles() {
        const raw = Array.isArray(STATE.minicBins) ? STATE.minicBins : [];
        if (raw !== STATE.minicBins || C.needsMigration(raw)) {
            STATE.minicBins = C.migrate(raw, newId);
            save();
        }
        return STATE.minicBins;
    }
    function commit(next, silent) { STATE.minicBins = next; save(); if (!silent) render(); }
    const findProfile = pid => getProfiles().find(p => p.id === pid);
    const findCard = (pid, cid) => { const p = findProfile(pid); return p ? p.cards.find(c => c.id === cid) : undefined; };
    const mapProfile = (pid, fn) => getProfiles().map(p => (p.id === pid ? fn(p) : p));
    const mapCard = (pid, cid, fn) => mapProfile(pid, p => ({ ...p, cards: p.cards.map(c => (c.id === cid ? fn(c) : c)) }));
    const getTabs = () => (STATE.minicTabs && STATE.minicTabs.length ? STATE.minicTabs : [{ id: 'main', name: 'Main' }]);
    const activeTabId = () => (getTabs().some(t => t.id === STATE.minicActiveTab) ? STATE.minicActiveTab : 'main');
    const cardsOf = profiles => profiles.flatMap(p => p.cards);

    function cardType(c) {
        const parts = C.cardParts(c.number);
        const info = binInfo(parts.bin);
        if (c.type) return { main: c.type.toUpperCase(), sub: '', bank: info.bank || '' };
        const brand = info.brand || (typeof _brandByDigit === 'function' ? _brandByDigit(parts.digits) : '');
        return { main: [brand, info.type].filter(Boolean).join(' ').toUpperCase(), sub: (info.level || '').toUpperCase(), bank: info.bank || '' };
    }

    // ── Auto-growing textareas with search highlight backdrop ──

    function autoGrow(el) {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight + 2) + 'px';
    }
    function growAll() { document.querySelectorAll('.mn-root .mn-grow').forEach(autoGrow); }

    window._mnGrow = function (el) {
        autoGrow(el);
        const bd = el.previousElementSibling;
        if (bd) bd.innerHTML = C.highlight(el.value, ui.words);
    };

    function hlField(cls, value, attrs) {
        return `<div class="mn-hl ${value ? '' : 'empty'}"><div class="mn-hl-bd" aria-hidden="true">${C.highlight(value, ui.words)}</div>`
            + `<textarea class="mn-grow ${cls}" rows="1" spellcheck="false" oninput="_mnGrow(this)" ${attrs}>${esc(value)}</textarea></div>`;
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (STATE.currentView === 'minic-bins') growAll(); }, 100);
    });

    // ── BIN lookups (async, re-render once data arrives) ──

    const requested = new Set();
    let renderTimer = null;
    function scheduleRender() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(() => {
            if (STATE.currentView !== 'minic-bins') return;
            const ae = document.activeElement;
            if (ae && ae.id !== 'mn-search' && /INPUT|TEXTAREA/.test(ae.tagName) && ae.closest('#content-area')) { scheduleRender(); return; }
            render();
        }, 500);
    }
    function lookupMissing(cards) {
        if (typeof lookupBin !== 'function' || typeof BIN_CACHE === 'undefined') return;
        cards.forEach(c => {
            const bin = C.cardParts(c.number).bin;
            if (!bin || BIN_CACHE[bin] || requested.has(bin)) return;
            requested.add(bin);
            lookupBin(bin).catch(() => null).finally(scheduleRender);
        });
    }

    // ── Render pieces ──

    function tabsHtml(tabs, activeTab, profiles) {
        return tabs.map(t => {
            const cnt = cardsOf(profiles.filter(p => p.tab === t.id)).length;
            const close = t.id !== 'main' ? `<span class="mn-tab-x" onclick="event.stopPropagation();_mcCloseTab('${esc(t.id)}')">✕</span>` : '';
            return `<div class="mn-tab ${t.id === activeTab ? 'on' : ''}" onclick="_mcSwitchTab('${esc(t.id)}')">${esc(t.name)}<span class="mn-tab-cnt">${cnt}</span>${close}</div>`;
        }).join('') + '<div class="mn-tab mn-tab-add" title="New tab (service)" onclick="_mcAddTab()">+</div>';
    }

    function statsHtml(cards, filter) {
        const n = C.countStatuses(cards);
        const pill = (id, label, count, color) =>
            `<button class="mn-pill ${filter === id ? 'on' : ''}" style="--c:${color}" onclick="_mcFilter('${id}')"><span>${label}</span><b>${count}</b></button>`;
        return '<div class="mn-stats">'
            + pill('all', 'ALL', n.all, '#e2e8f0')
            + STATUSES.map(s => pill(s.id, s.label, n[s.id], s.color)).join('')
            + (n.rate === null ? '' : `<div class="mn-rate" title="OK / (OK + FAIL + NO CODE)"><span>Success</span><b>${n.rate}%</b></div>`)
            + '</div>';
    }

    function toolbarHtml(activeTab, names) {
        const move = activeTab !== 'main' ? '<button id="mn-move-main" class="mn-btn" onclick="_mcMoveToMain()">📥 Move to Main</button>' : '';
        return `<div class="mn-toolbar">
            <button id="mn-add-toggle" class="mn-btn mn-btn-primary" onclick="_mnToggleAdd()">+ Add cards</button>
            ${move}
            <div class="mn-search-box">
                <span id="mn-found" class="mn-found"></span>
                <input id="mn-search" class="mn-search" type="text" autocomplete="off" placeholder="Search: profile, BIN, last4..." value="${esc(ui.search)}" oninput="_mnSearch(this.value)">
            </div>
        </div>
        <div id="mn-add-panel" class="mn-add" style="display:${ui.addOpen ? 'block' : 'none'}">
            <label class="mn-lbl" for="mn-add-profile">Profile — if it already exists, the cards are attached to it</label>
            <input id="mn-add-profile" class="mn-inp" list="mn-prof-list" maxlength="${LIMITS.name}" placeholder="e.g. [Transferred] Sales-UK-DC-T1 Part-46" value="${esc(ui.draftProfile)}" oninput="_mnDraft()">
            <datalist id="mn-prof-list">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
            <label class="mn-lbl" for="mn-add-text">Cards — one per line: card number exp cvv - note</label>
            <textarea id="mn-add-text" class="mn-ta" rows="6" placeholder="54741520-8220 09/28 681 - sent minic, -$100 charged&#10;5474-5912032 05/30 354 - minic not sent&#10;4036231234567725|12|28|123" oninput="_mnDraft()">${esc(ui.draft)}</textarea>
            <div class="mn-add-foot">
                <span id="mn-add-count" class="mn-add-count"></span>
                <button id="mn-add-cancel" class="mn-btn" onclick="_mnToggleAdd(false)">Cancel</button>
                <button id="mn-add-submit" class="mn-btn mn-btn-primary" onclick="_mnDoAdd()">Add</button>
            </div>
        </div>`;
    }

    function summaryHtml(p) {
        const n = C.countStatuses(p.cards);
        const parts = [`<b>${n.all} card${n.all === 1 ? '' : 's'}</b>`]
            .concat(STATUSES.filter(s => n[s.id]).map(s => `<span style="color:${s.color}">${n[s.id]} ${s.label}</span>`));
        return `<span class="mn-badge">${parts.join('<i>·</i>')}</span>`;
    }

    function profileRowHtml(p, pos, expanded) {
        const prof = hlField('mn-prof-in', p.name,
            `placeholder="profile name" maxlength="${LIMITS.name}" ${ENTER_BLUR} onchange="_mnRename('${p.id}',this)"`);
        return `<tr class="mn-prow" data-pid="${p.id}" oncontextmenu="event.preventDefault();_mnCtxProfile(event,'${p.id}')">
            <td class="mn-c-chk"><label class="bulk-check"><input type="checkbox" class="mn-prof-cb" ${p.cards.length ? '' : 'disabled'} onchange="_mnSelProfile('${p.id}',this.checked)"></label></td>
            <td class="mn-c-idx"><button class="mn-caret" title="${expanded ? 'Collapse' : 'Expand'}" onclick="_mnToggle('${p.id}')">${expanded ? '▾' : '▸'}</button><span>${pos}</span></td>
            <td class="mn-c-prof">${prof}</td>
            <td class="mn-c-sum" colspan="5"><div class="mn-sum">${summaryHtml(p)}<button class="mn-addcard" onclick="_mnAddCard('${p.id}')">+ Add card</button></div></td>
            <td class="mn-c-date">${C.highlight(p.date, ui.words) || '—'}</td>
        </tr>`;
    }

    function cardRowHtml(p, c, k) {
        const w = ui.words;
        const t = cardType(c);
        const digits = C.cardParts(c.number).digits;
        const icon = typeof _brandIconGlobal === 'function' && t.main ? _brandIconGlobal(t.main, (digits || '0').padEnd(16, '0')) : '';
        const ids = `'${p.id}','${c.id}'`;
        const chips = c.amounts.map((a, i) => `<span class="mn-chip">$${C.highlight(a, w)}<i onclick="_mnDelAmt(${ids},${i})" title="Remove amount">×</i></span>`).join('');
        const total = c.amounts.length > 1 ? `<span class="mn-total">= $${C.sumAmounts(c.amounts).toFixed(2)}</span>` : '';
        const btns = STATUSES.map(s =>
            `<button class="mn-sb ${c.status === s.id ? 'on' : ''}" style="--c:${s.color}" title="${esc(s.hint)}" onclick="_mnSetStatus(${ids},'${s.id}')">${s.label}</button>`).join('');
        const number = hlField('mn-num-in', c.number,
            `placeholder="card number" maxlength="${LIMITS.number}" data-num-for="${c.id}" ${ENTER_BLUR} onchange="_mnCardField(${ids},'number',this)"`);
        const note = hlField('mn-note-in', c.note, `placeholder="note…" maxlength="${LIMITS.note}" onchange="_mnNote(${ids},this.value)"`);
        return `<tr class="mn-row" data-id="mc-${c.id}" style="--st:${statusOf(c.status).color}" oncontextmenu="event.preventDefault();_mnCtx(event,${ids})">
            <td class="mn-c-chk"><label class="bulk-check"><input type="checkbox" class="row-select-cb" data-card-id="mc-${c.id}" data-pid="${p.id}" onchange="toggleCardSelect(this.dataset.cardId,this.checked)"></label></td>
            <td class="mn-c-idx mn-c-sub">${k}</td>
            <td class="mn-c-tree"></td>
            <td class="mn-c-card">${number}
                <div class="mn-ec">
                    <input class="mn-mini-in mn-exp-in" value="${esc(c.exp)}" placeholder="MM/YY" maxlength="7" ${ENTER_BLUR} onchange="_mnCardField(${ids},'exp',this)">
                    <input class="mn-mini-in mn-cvv-in" value="${esc(c.cvv)}" placeholder="CVV" maxlength="4" inputmode="numeric" ${ENTER_BLUR} onchange="_mnCardField(${ids},'cvv',this)">
                    <button class="mn-copy" title="Copy card" onclick="_mnCopy(${ids})">⧉</button>
                </div>
            </td>
            <td class="mn-c-type" title="${esc(t.bank)}">${icon}<span>${C.highlight(t.main, w) || '—'}</span>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</td>
            <td class="mn-c-amts">${chips}${total}<input class="mn-amt-in" data-amt-for="${c.id}" placeholder="+ $" title="Charged amount, Enter to add" onkeydown="if(event.key==='Enter')_mnAddAmt(${ids},this.value)"></td>
            <td class="mn-c-status"><div class="mn-sgrid">${btns}</div></td>
            <td class="mn-c-note">${note}</td>
            <td class="mn-c-date">${C.highlight(c.date, w) || '—'}</td>
        </tr>`;
    }

    function tableHtml(shown, emptyText) {
        const searching = ui.words.length > 0;
        const body = shown.length
            ? shown.map(({ profile: p, cards, pos }) => {
                const expanded = !p.collapsed || searching;
                return profileRowHtml(p, pos, expanded)
                    + (expanded ? cards.map(c => cardRowHtml(p, c, p.cards.indexOf(c) + 1)).join('') : '');
            }).join('')
            : `<tr><td colspan="9" class="mn-empty">${emptyText}</td></tr>`;
        return `<div class="mn-table-wrap"><table class="mn-table">
            <colgroup><col class="w-chk"><col class="w-idx"><col class="w-prof"><col class="w-card"><col><col><col class="w-status"><col class="w-note"><col class="w-date"></colgroup>
            <thead><tr>
                <th><label class="bulk-check"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></label></th>
                <th>#</th><th>Profile</th><th>Card</th><th>Type</th><th>Charges</th><th>Status</th><th>Note</th><th>Date</th>
            </tr></thead><tbody>${body}</tbody></table></div>`;
    }

    function ensureOverlays() {
        [['bv-edit-modal', 'bv-edit-overlay'], ['bv-ctx-menu', 'bv-ctx']].forEach(([id, cls]) => {
            if ($(id)) return;
            const el = document.createElement('div');
            el.id = id; el.className = cls; el.style.display = 'none';
            document.body.appendChild(el);
            if (id === 'bv-ctx-menu') document.addEventListener('click', () => { el.style.display = 'none'; });
        });
    }

    function updateAddCount() {
        const el = $('mn-add-count');
        if (!el) return;
        const lines = ui.draft.split(/\r?\n/).filter(l => l.trim());
        const ok = C.parseText(ui.draft).length;
        const existing = C.findProfileByName(getProfiles(), ui.draftProfile.trim(), activeTabId());
        el.textContent = lines.length ? `Recognized: ${ok} of ${lines.length}${existing ? ' · existing profile' : ''}` : '';
        el.classList.toggle('bad', lines.length > 0 && ok < lines.length);
    }

    // ── Render ──

    function computeView() {
        const profiles = getProfiles();
        const activeTab = activeTabId();
        const inTab = profiles.filter(p => p.tab === activeTab);
        const filter = STATUS_IDS.includes(STATE.minicTagFilter) ? STATE.minicTagFilter : 'all';
        const pos = new Map(inTab.map((p, i) => [p.id, i + 1]));
        const shown = C.filterProfiles(inTab.slice().reverse(), { status: filter, query: ui.query, infoFn: binInfo }) // newest first
            .map(r => ({ ...r, pos: pos.get(r.profile.id) }));
        const emptyText = inTab.length ? 'Nothing found' : 'No cards yet — click “+ Add cards” and paste a list';
        return { profiles, activeTab, inTab, filter, shown, emptyText };
    }

    function afterRender(v) {
        growAll();
        requestAnimationFrame(growAll);
        const found = $('mn-found');
        if (found) found.textContent = ui.query.trim() ? `${v.shown.length} found` : '';
        if (typeof renderFooter === 'function') renderFooter(v.shown.length, 1, 1);
        lookupMissing(cardsOf(v.inTab));
    }

    function render() {
        const area = $('content-area');
        if (!area) return;
        const ae = document.activeElement;
        const caret = ae && ae.id === 'mn-search' ? ae.selectionStart : null;
        const v = computeView();
        const names = [...new Set(v.inTab.map(p => p.name).filter(Boolean))];
        area.innerHTML = `<div class="mn-root">
            <div class="mn-tabs">${tabsHtml(getTabs(), v.activeTab, v.profiles)}</div>
            ${statsHtml(cardsOf(v.inTab), v.filter)}
            ${toolbarHtml(v.activeTab, names)}
            <div id="mn-table-host">${tableHtml(v.shown, v.emptyText)}</div>
        </div>`;
        ensureOverlays();
        updateAddCount();
        afterRender(v);
        if (caret !== null) { const s = $('mn-search'); s.focus(); s.setSelectionRange(caret, caret); }
    }

    function renderResults() {
        const host = $('mn-table-host');
        if (!host) { render(); return; }
        const v = computeView();
        host.innerHTML = tableHtml(v.shown, v.emptyText);
        afterRender(v);
    }

    // ── Actions: search / add panel ──

    window.renderMinicBins = render;

    window._mnSearch = function (q) {
        ui.search = String(q || '');
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            ui.query = ui.search;
            ui.words = C.queryWords(ui.query);
            renderResults();
        }, 150);
    };

    window._mnDraft = function () {
        ui.draft = $('mn-add-text').value;
        ui.draftProfile = $('mn-add-profile').value;
        updateAddCount();
    };

    window._mnToggleAdd = function (show) {
        ui.addOpen = typeof show === 'boolean' ? show : !ui.addOpen;
        const p = $('mn-add-panel');
        if (p) p.style.display = ui.addOpen ? 'block' : 'none';
        if (ui.addOpen) {
            const target = $(ui.draftProfile ? 'mn-add-text' : 'mn-add-profile');
            if (target) target.focus();
        }
    };

    window._mnDoAdd = function () {
        try {
            window._mnDraft();
            const lines = ui.draft.split(/\r?\n/).filter(l => l.trim());
            const parsed = C.parseText(ui.draft);
            if (!parsed.length) { notify('No cards recognized. Each line needs a card number (at least 6 digits)', 'error'); return; }
            const r = C.mergeCards(getProfiles(), parsed, { tab: activeTabId(), date: today(), profile: ui.draftProfile }, newId);
            ui.draft = '';
            ui.addOpen = false;
            commit(r.profiles);
            const bad = lines.length - parsed.length;
            const extra = [r.merged && r.merged + ' updated', r.skipped && r.skipped + ' already existed', bad > 0 && bad + ' lines not recognized']
                .filter(Boolean).join(', ');
            notify(`Cards added: ${r.added}${r.attached ? ' (to existing profile)' : ''}${extra ? ' — ' + extra : ''}`, r.added || r.merged ? 'success' : 'warning');
        } catch (e) {
            console.error('[Minic] add failed', e);
            notify('Failed to add cards: ' + e.message, 'error');
        }
    };

    // ── Actions: profiles ──

    window._mnToggle = pid => commit(mapProfile(pid, p => ({ ...p, collapsed: !p.collapsed })));

    window._mnSelProfile = function (pid, checked) {
        document.querySelectorAll(`.row-select-cb[data-pid="${pid}"]`).forEach(cb => {
            cb.checked = checked;
            if (typeof toggleCardSelect === 'function') toggleCardSelect(cb.dataset.cardId, checked);
        });
    };

    window._mnAddCard = function (pid) {
        hideCtx();
        const card = C.normalizeCard({ id: newId(), date: today() }, newId);
        STATE.minicTagFilter = 'all';            // make sure the new empty card is visible
        ui.search = ui.query = ''; ui.words = [];
        commit(mapProfile(pid, p => ({ ...p, collapsed: false, cards: [...p.cards, card] })));
        const inp = document.querySelector(`[data-num-for="${card.id}"]`);
        if (inp) inp.focus();
    };

    /** Appends `cards` to profile `targetId` and removes profile `dropId`. */
    function mergeInto(targetId, cards, dropId) {
        return getProfiles()
            .filter(p => p.id !== dropId)
            .map(p => (p.id === targetId ? { ...p, collapsed: false, cards: [...p.cards, ...cards] } : p));
    }

    window._mnRename = function (pid, el) {
        const p = findProfile(pid);
        if (!p) return;
        const name = String(el.value).replace(/\s*\n\s*/g, ' ').trim().slice(0, LIMITS.name);
        const twin = name && getProfiles().find(x => x.id !== pid && x.tab === p.tab && C.sameName(x.name, name));
        if (!twin) { commit(mapProfile(pid, x => ({ ...x, name })), true); return; }
        commit(mergeInto(twin.id, p.cards, pid), true);
        notify(`Merged into existing profile “${twin.name}”`, 'success');
        scheduleRender();
    };

    window._mnDeleteProfile = function (pid) {
        hideCtx();
        const p = findProfile(pid);
        if (!p) return;
        confirmThen(p.cards.length ? `Delete profile and ${p.cards.length} card(s)?` : 'Delete empty profile?', () => {
            commit(getProfiles().filter(x => x.id !== pid));
            notify('Profile deleted', 'success');
        });
    };

    // ── Actions: cards ──

    window._mnSetStatus = function (pid, cid, status) {
        const c = findCard(pid, cid);
        if (c && STATUS_IDS.includes(status)) commit(mapCard(pid, cid, x => ({ ...x, status: c.status === status ? 'wait' : status })));
    };

    window._mnAddAmt = function (pid, cid, value) {
        const amt = C.parseAmount(value);
        if (!amt) { notify('Invalid amount', 'error'); return; }
        if (!findCard(pid, cid)) return;
        commit(mapCard(pid, cid, c => ({ ...c, amounts: [...c.amounts, amt] })));
        const inp = document.querySelector(`[data-amt-for="${cid}"]`);
        if (inp) inp.focus();
    };

    window._mnDelAmt = (pid, cid, k) => commit(mapCard(pid, cid, c => ({ ...c, amounts: c.amounts.filter((_, i) => i !== k) })));

    window._mnNote = (pid, cid, value) => commit(mapCard(pid, cid, c => ({ ...c, note: String(value).slice(0, LIMITS.note) })), true);

    window._mnCardField = function (pid, cid, field, el) {
        const c = findCard(pid, cid);
        if (!c) return;
        const v = String(el.value).trim();
        let val;
        if (field === 'number') {
            val = v.replace(/\s*\n\s*/g, ' ').slice(0, LIMITS.number);
        } else if (field === 'exp') {
            const m = v.match(/^(0[1-9]|1[0-2])\s*\/?\s*(\d{2}|\d{4})$/);
            if (v && !m) { notify('Expiry must be MM/YY', 'error'); el.value = c.exp; return; }
            val = m ? m[1] + '/' + m[2].slice(-2) : '';
            el.value = val;
        } else if (field === 'cvv') {
            if (v && !/^\d{3,4}$/.test(v)) { notify('CVV must be 3–4 digits', 'error'); el.value = c.cvv; return; }
            val = v;
        } else return;
        commit(mapCard(pid, cid, x => ({ ...x, [field]: val })), true);
        if (field === 'number') scheduleRender(); // refresh card type once editing is done
    };

    window._mnCopy = function (pid, cid) {
        const c = findCard(pid, cid);
        if (!c || !c.number) { notify('Card number is empty', 'warning'); return; }
        const text = [c.number, c.exp, c.cvv].filter(Boolean).join(' ');
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        notify('Copied: ' + c.number, 'success');
    };

    window._mnDeleteCard = function (pid, cid) {
        hideCtx();
        confirmThen('Delete this card?', () => {
            commit(mapProfile(pid, p => ({ ...p, cards: p.cards.filter(c => c.id !== cid) })));
            notify('Card deleted', 'success');
        });
    };

    // ── Context menus & modals ──

    function confirmThen(msg, fn) {
        if (typeof _bvShowConfirm === 'function') _bvShowConfirm(msg, fn);
        else if (window.confirm(msg)) fn();
    }
    function hideCtx() { const ctx = $('bv-ctx-menu'); if (ctx) ctx.style.display = 'none'; }
    function closeModal() { const m = $('bv-edit-modal'); if (m) m.style.display = 'none'; }
    window._mnCloseModal = closeModal;

    function showCtx(e, items) {
        ensureOverlays();
        const ctx = $('bv-ctx-menu');
        ctx.innerHTML = items.map(([label, action, danger]) =>
            `<div class="bv-ctx-item ${danger ? 'bv-ctx-danger' : ''}" onclick="${action}">${label}</div>`).join('');
        ctx.style.display = 'block';
        ctx.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
        ctx.style.top = Math.min(e.clientY, window.innerHeight - 120) + 'px';
    }

    window._mnCtx = (e, pid, cid) => showCtx(e, [
        ['&#9998; Edit type', `_mnEdit('${pid}','${cid}')`],
        ['&#8644; Move to profile…', `_mnMove('${pid}','${cid}')`],
        ['&#x2715; Delete card', `_mnDeleteCard('${pid}','${cid}')`, true],
    ]);

    window._mnCtxProfile = (e, pid) => showCtx(e, [
        ['+ Add card', `_mnAddCard('${pid}')`],
        ['&#x2715; Delete profile', `_mnDeleteProfile('${pid}')`, true],
    ]);

    function openModal(title, inner, saveLabel, saveAction) {
        ensureOverlays();
        const modal = $('bv-edit-modal');
        modal.innerHTML = `<div class="bv-edit-box"><div class="bv-edit-title">${title}</div>${inner}
            <div class="bv-edit-btns">
                <button class="bv-edit-save" onclick="${saveAction}">${saveLabel}</button>
                <button class="bv-edit-cancel" onclick="_mnCloseModal()">Cancel</button>
            </div></div>`;
        modal.style.display = 'flex';
    }

    window._mnEdit = function (pid, cid) {
        hideCtx();
        const c = findCard(pid, cid);
        if (!c) return;
        openModal('Card type', `<label class="bv-edit-lbl" for="mn-e-type">Type (empty = auto by BIN)</label>
            <input id="mn-e-type" class="bv-edit-inp" maxlength="${LIMITS.type}" placeholder="${esc(cardType({ ...c, type: '' }).main)}" value="${esc(c.type)}"
                onkeydown="if(event.key==='Enter')_mnSaveEdit('${pid}','${cid}')">`, 'Save', `_mnSaveEdit('${pid}','${cid}')`);
        $('mn-e-type').focus();
    };

    window._mnSaveEdit = function (pid, cid) {
        const type = $('mn-e-type').value.trim().slice(0, LIMITS.type);
        closeModal();
        commit(mapCard(pid, cid, c => ({ ...c, type })));
        notify('Card updated', 'success');
    };

    window._mnMove = function (pid, cid) {
        hideCtx();
        const p = findProfile(pid);
        if (!p) return;
        const names = [...new Set(getProfiles().filter(x => x.tab === p.tab && x.id !== pid && x.name).map(x => x.name))];
        openModal('Move card to profile', `<label class="bv-edit-lbl" for="mn-mv-name">Profile name (existing or new)</label>
            <input id="mn-mv-name" class="bv-edit-inp" list="mn-mv-list" maxlength="${LIMITS.name}" onkeydown="if(event.key==='Enter')_mnDoMove('${pid}','${cid}')">
            <datalist id="mn-mv-list">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`, 'Move', `_mnDoMove('${pid}','${cid}')`);
        setTimeout(() => $('mn-mv-name').focus(), 50);
    };

    window._mnDoMove = function (pid, cid) {
        const name = $('mn-mv-name').value.replace(/\s+/g, ' ').trim().slice(0, LIMITS.name);
        if (!name) { notify('Enter a profile name', 'error'); return; }
        const src = findProfile(pid);
        const card = findCard(pid, cid);
        closeModal();
        if (!src || !card || C.sameName(src.name, name)) return;
        let list = getProfiles().map(p => (p.id === pid ? { ...p, cards: p.cards.filter(c => c.id !== cid) } : p));
        const target = C.findProfileByName(list, name, src.tab);
        list = target
            ? list.map(p => (p.id === target.id ? { ...p, collapsed: false, cards: [...p.cards, card] } : p))
            : [...list, C.normalizeProfile({ id: newId(), name, tab: src.tab, date: today(), cards: [card] }, newId)];
        commit(list.filter(p => p.id !== pid || p.cards.length));
        notify(target ? `Card moved to “${target.name}”` : `Card moved to new profile “${name}”`, 'success');
    };

    // ── Bulk actions (used by app.js bulk bar). Selection ids are 'mc-<cardId>'. ──

    function selectedCards(ids) {
        const set = new Set([...(ids || [])].map(String));
        const out = [];
        getProfiles().forEach(p => p.cards.forEach(c => { if (set.has('mc-' + c.id)) out.push({ profile: p, card: c }); }));
        return out;
    }
    const cardLine = c => [c.number, c.exp, c.cvv].filter(Boolean).join(' ') + (c.note ? ' - ' + c.note : '');

    window._mnBulkCount = ids => selectedCards(ids).length;

    window._mnBulkText = function (ids) {
        const groups = new Map();
        selectedCards(ids).forEach(({ profile, card }) => {
            if (!groups.has(profile.id)) groups.set(profile.id, { name: profile.name, lines: [] });
            groups.get(profile.id).lines.push(cardLine(card));
        });
        return [...groups.values()].map(g => (g.name ? g.name + '\n' : '') + g.lines.join('\n')).join('\n\n');
    };

    window._mnBulkDelete = function (ids, done) {
        const sel = selectedCards(ids);
        if (!sel.length) return 0;
        const del = new Set(sel.map(x => x.card.id));
        const touched = new Set(sel.map(x => x.profile.id));
        confirmThen(`Delete ${sel.length} card(s)?`, () => {
            const next = getProfiles()
                .map(p => ({ ...p, cards: p.cards.filter(c => !del.has(c.id)) }))
                .filter(p => p.cards.length || !touched.has(p.id));
            if (typeof done === 'function') done();
            commit(next);
            notify(sel.length + ' card(s) deleted', 'info');
        });
        return sel.length;
    };

    // ── Tabs (services) & filter — names kept for compatibility with app.js ──

    window._mcFilter = f => { STATE.minicTagFilter = f; render(); };
    window._mcSwitchTab = id => { STATE.minicActiveTab = id; STATE.minicTagFilter = 'all'; render(); };

    window._mcAddTab = function () {
        openModal('New tab', `<label class="bv-edit-lbl" for="mc-new-tab-name">Name (service)</label>
            <input id="mc-new-tab-name" class="bv-edit-inp" placeholder="Melio, Navan..." maxlength="20" onkeydown="if(event.key==='Enter')_mcSaveNewTab()">`,
        'Create', '_mcSaveNewTab()');
        setTimeout(() => $('mc-new-tab-name').focus(), 50);
    };

    window._mcSaveNewTab = function () {
        const name = $('mc-new-tab-name').value.trim();
        if (!name) { notify('Enter a name', 'error'); return; }
        const id = 'mctab_' + Date.now();
        STATE.minicTabs = [...getTabs(), { id, name }];
        STATE.minicActiveTab = id;
        closeModal();
        save(); render();
    };

    window._mcCloseTab = function (tabId) {
        if (tabId === 'main') return;
        const n = cardsOf(getProfiles().filter(p => p.tab === tabId)).length;
        confirmThen(n ? `Delete tab and ${n} card(s)?` : 'Delete empty tab?', () => {
            STATE.minicTabs = getTabs().filter(t => t.id !== tabId);
            if (STATE.minicActiveTab === tabId) STATE.minicActiveTab = 'main';
            commit(getProfiles().filter(p => p.tab !== tabId));
        });
    };

    window._mcMoveToMain = function () {
        const from = STATE.minicActiveTab;
        if (!from || from === 'main') return;
        const moving = getProfiles().filter(p => p.tab === from);
        if (!cardsOf(moving).length) { notify('No cards to move', 'warning'); return; }
        let list = getProfiles().filter(p => p.tab !== from);
        const mainKeys = new Set(cardsOf(list.filter(p => p.tab === 'main')).map(c => C.cardKey(c.number)).filter(Boolean));
        let moved = 0, dupes = 0;
        moving.forEach(p => {
            const isDupe = c => { const k = C.cardKey(c.number); return !!k && mainKeys.has(k); };
            const fresh = p.cards.filter(c => !isDupe(c));
            const left = p.cards.filter(isDupe);
            fresh.forEach(c => { const k = C.cardKey(c.number); if (k) mainKeys.add(k); });
            dupes += left.length; moved += fresh.length;
            if (left.length) list = [...list, { ...p, cards: left }];
            if (!fresh.length) return;
            const twin = p.name && C.findProfileByName(list, p.name, 'main');
            list = twin
                ? list.map(x => (x.id === twin.id ? { ...x, cards: [...x.cards, ...fresh] } : x))
                : [...list, { ...p, id: left.length ? newId() : p.id, tab: 'main', cards: fresh }];
        });
        commit(list);
        notify(`${moved} card(s) moved to Main${dupes ? ` (${dupes} duplicate(s) left)` : ''}`, 'success');
    };
})();
