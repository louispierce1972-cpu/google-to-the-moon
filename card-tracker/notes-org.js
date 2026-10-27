/* ═══════════════════════════════════════════
 * NOTES ORGANIZER — folders, statuses, search, cleanup, merge (UI layer).
 * Pure logic lives in notes-model.js. Data lives in STATE.notesTabs (persisted by app.js save()).
 * Hooked into renderNotes() in app.js via: NotesOrg.prepare(), sidebarHtml(), toolbarHtml(),
 * quickBarHtml(), wire(), afterRender().
 * ═══════════════════════════════════════════ */
(function () {
    'use strict';

    const N = window.NotesModel;
    if (!N) { console.error('[Notes] notes-model.js must be loaded before notes-org.js'); return; }
    const esc = N.esc;
    const $ = id => document.getElementById(id);
    const notify = (m, t) => (typeof toast === 'function' ? toast(m, t) : console.log('[Notes]', m));
    const K = {
        since: 'ct_notes_model_since',
        backup: 'ct_notes_backup_premigration',
        folders: 'ct_notes_folders',
        archive: 'ct_notes_search_archive',
        days: 'ct_notes_cleanup_days',
    };
    const readJson = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
    const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('[Notes] storage', e); } };

    const ui = {
        query: '',
        selected: new Set(),
        collapsed: readJson(K.folders, { archive: true }),
        includeArchive: readJson(K.archive, true),
        days: readJson(K.days, 14),
        keepOpen: false,
        scrollTo: null,
        undo: null,
    };
    let searchTimer = null;
    const cardCache = new Map();

    // ── Environment helpers ──

    let isoSet = null, nameToIso = null;
    function getIsoSet() {
        if (!isoSet) isoSet = new Set(typeof COUNTRY_DB !== 'undefined' ? Object.keys(COUNTRY_DB) : []);
        return isoSet;
    }
    function countryOf(bin) {
        const info = typeof BIN_CACHE !== 'undefined' ? BIN_CACHE[bin] : null;
        const raw = info && (info.countryCode || info.country_code || info.country);
        if (!raw) return '';
        if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
        if (!nameToIso && typeof COUNTRY_DB !== 'undefined') {
            nameToIso = new Map(Object.entries(COUNTRY_DB).map(([k, v]) => [String(v).toLowerCase(), k]));
        }
        return (nameToIso && nameToIso.get(String(raw).toLowerCase())) || '';
    }
    const modelOpts = () => ({ now: Date.now(), since: +localStorage.getItem(K.since) || Date.now(), isoSet: getIsoSet(), countryOf });
    const tabs = () => STATE.notesTabs || [];
    const findTab = id => tabs().find(t => t.id === id);
    const newId = () => 'tab-' + Date.now() + Math.random().toString(36).slice(2, 5);

    function cardsIn(tab) {
        const content = String(tab.content || '');
        const hit = cardCache.get(tab.id);
        if (hit && hit.len === content.length) return hit.n;
        const n = N.countCards(N.plainText(content));
        cardCache.set(tab.id, { len: content.length, n });
        return n;
    }

    function confirmThen(msg, fn) {
        if (typeof _bvShowConfirm === 'function') _bvShowConfirm(msg, fn);
        else if (window.confirm(msg)) fn();
    }

    function download(name, data) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }

    const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const backupPayload = kind => ({
        kind, exportedAt: new Date().toISOString(),
        notesTabs: tabs(), notesActiveTab: STATE.notesActiveTab || '', notes: STATE.notes || '',
    });

    // ── Migration (runs once; idempotent) ──

    function backupBeforeMigration() {
        const payload = backupPayload('notes-backup-before-migration');
        try { localStorage.setItem(K.backup, JSON.stringify(payload)); }
        catch (e) { console.warn('[Notes] could not keep a localStorage copy of the backup (quota?)', e); }
        download('notes-backup-before-migration-' + stamp() + '.json', payload);
        notify('Notes backup downloaded before migration', 'info');
    }

    /** Applies the model to new/legacy tabs and records content changes. Returns true if something changed. */
    function prepare() {
        let list = tabs();
        let changed = 0;
        if (N.needsMigration(list)) {
            if (!localStorage.getItem(K.since)) {
                backupBeforeMigration();
                localStorage.setItem(K.since, String(Date.now()));
            }
            const r = N.migrateAll(list, modelOpts());
            list = r.tabs;
            changed += r.changed;
        }
        const t = N.touchChanged(list, modelOpts());
        changed += t.changed;
        if (!changed) return false;
        STATE.notesTabs = t.tabs;
        save();
        return true;
    }

    function restorePreMigrationBackup() {
        const raw = localStorage.getItem(K.backup);
        if (!raw) { notify('No pre-migration backup in this browser — use the downloaded JSON file', 'warning'); return; }
        const data = JSON.parse(raw);
        confirmThen(`Restore ${data.notesTabs.length} tabs from the pre-migration backup? Current Notes will be replaced (a backup of them is downloaded first).`, () => {
            download('notes-backup-before-restore-' + stamp() + '.json', backupPayload('notes-backup-before-restore'));
            STATE.notesTabs = data.notesTabs;
            STATE.notesActiveTab = data.notesActiveTab || (data.notesTabs[0] && data.notesTabs[0].id) || '';
            localStorage.removeItem(K.since);
            closeModal();
            save();
            renderNotes();
            notify('Pre-migration backup restored', 'success');
        });
    }

    // ── Mutations (immutable array replacement) ──

    /**
     * Saves the editor into the current tab FIRST, then computes the next list from fresh state.
     * update(all) → Tab[] | { tabs, active }
     */
    function commit(update) {
        if (typeof _saveActiveTab === 'function') _saveActiveTab();
        const res = update(tabs());
        const next = Array.isArray(res) ? res : res.tabs;
        if (!Array.isArray(res) && res.active) STATE.notesActiveTab = res.active;
        if (!next.some(t => t.id === STATE.notesActiveTab)) STATE.notesActiveTab = (next[0] || {}).id || '';
        STATE.notesTabs = next;
        save();
        refresh();
    }

    /** Re-renders Notes and keeps the sidebar open. */
    function refresh() {
        ui.keepOpen = !!($('nt-sidebar') && $('nt-sidebar').classList.contains('open'));
        renderNotes();
    }

    function rememberUndo(label, beforeTabs, addedIds = []) {
        ui.undo = { label, before: beforeTabs.map(t => ({ ...t })), addedIds };
    }

    function applyUndo() {
        const u = ui.undo;
        if (!u) return;
        ui.undo = null;
        commit(all => {
            const byId = new Map(u.before.map(t => [t.id, t]));
            const kept = all.filter(t => !u.addedIds.includes(t.id)).map(t => byId.get(t.id) || t);
            const missing = u.before.filter(b => !kept.some(t => t.id === b.id));
            return { tabs: [...missing, ...kept], active: u.addedIds.includes(STATE.notesActiveTab) ? (u.before[0] || {}).id : '' };
        });
        notify('Undone: ' + u.label, 'success');
    }

    const setStatus = (ids, status) => commit(all => N.patchTabs(all, ids, { status }));

    function moveTo(ids, target) {
        if (target === N.ARCHIVE) return setStatus(ids, 'archived');
        const unarchive = t => (t.status === 'archived' ? 'active' : t.status);
        if (target === 'pinned') return commit(all => N.patchTabs(all, ids, t => ({ pinned: true, status: unarchive(t) })));
        if (!N.FOLDER_IDS.includes(target)) return;
        commit(all => N.patchTabs(all, ids, t => ({ folder: target, pinned: false, status: unarchive(t) })));
        notify(`Moved to ${N.folderLabel(target)}`, 'success');
    }

    function toggleUsed(id) {
        const t = findTab(id);
        if (t) setStatus([id], t.status === 'used' ? 'active' : 'used');
    }

    function togglePin(id) {
        commit(all => N.patchTabs(all, [id], t => ({ pinned: !t.pinned })));
    }

    function mergeSelected(ids) {
        const list = ids.filter(id => findTab(id));
        if (list.length < 2) { notify('Select at least 2 tabs', 'warning'); return; }
        confirmThen(`Merge ${list.length} tabs into one? The originals will be moved to Archive (not deleted).`, () => {
            ui.selected.clear();
            commit(all => {
                const r = N.mergeTabs(all, list, { ...modelOpts(), makeId: newId });
                rememberUndo(`merge of ${list.length} tabs`, all.filter(t => list.includes(t.id)), [r.merged.id]);
                return { tabs: r.tabs, active: r.merged.id };
            });
            notify(`Merged ${list.length} tabs`, 'success');
        });
    }


    // ── Sidebar HTML ──

    function itemHtml(t) {
        const active = t.id === STATE.notesActiveTab;
        const n = cardsIn(t);
        const sub = [N.formatDate(t.modifiedAt || t.createdAt), n ? n + (n === 1 ? ' card' : ' cards') : ''].filter(Boolean).join(' · ');
        const badge = t.status === 'used' ? '<span class="nto-badge used">USED</span>' : '';
        const archived = t.status === 'archived';
        const acts = archived
            ? `<button class="nto-act" data-act="restore" title="Restore">↩</button>`
            : `<button class="nto-act ${t.pinned ? 'on' : ''}" data-act="pin" title="${t.pinned ? 'Unpin' : 'Pin'}">📌</button>`
              + `<button class="nto-act ${t.status === 'used' ? 'on' : ''}" data-act="used" title="${t.status === 'used' ? 'Mark as active' : 'Mark as used'}">✓</button>`
              + `<button class="nto-act" data-act="archive" title="Archive">🗄</button>`;
        return `<div class="nto-item ${active ? 'active' : ''} st-${t.status || 'active'}" data-tab="${esc(t.id)}" draggable="true">
            <input type="checkbox" class="nto-cb" data-tab="${esc(t.id)}" ${ui.selected.has(t.id) ? 'checked' : ''} title="Select for merge">
            <div class="nto-main"><div class="nto-name">${esc(N.displayName(t))}</div><div class="nto-sub">${esc(sub)}${badge}</div></div>
            <div class="nto-acts">${acts}</div>
        </div>`;
    }

    function folderHtml(id, label, list) {
        const collapsed = !!ui.collapsed[id];
        return `<section class="nto-folder ${collapsed ? 'collapsed' : ''}" data-folder="${id}">
            <div class="nto-fhead" data-drop="${id}"><span class="nto-caret">${collapsed ? '▸' : '▾'}</span>${label} <b>(${list.length})</b></div>
            ${collapsed ? '' : `<div class="nto-items">${list.map(itemHtml).join('') || '<div class="nto-empty">No tabs</div>'}</div>`}
        </section>`;
    }

    function foldersHtml() {
        const g = N.groupTabs(tabs());
        return (g.pinned.length ? folderHtml('pinned', '📌 Pinned', g.pinned) : '')
            + N.FOLDERS.map(f => folderHtml(f.id, f.label, g[f.id])).join('')
            + folderHtml(N.ARCHIVE, '🗄 Archive', g.archive);
    }

    function resultsHtml() {
        const res = N.search(tabs(), ui.query, { includeArchive: ui.includeArchive });
        const words = N.queryWords(ui.query);
        const head = `<div class="nto-res-head">${res.length} found</div>`;
        return head + res.slice(0, 200).map(r => {
            const where = r.tab.status === 'archived' ? 'Archive' : N.folderLabel(r.tab.folder);
            return `<div class="nto-result st-${r.tab.status || 'active'}" data-tab="${esc(r.tab.id)}" data-line="${r.lineIndex}" data-frag="${esc(r.fragment)}">
                <div class="nto-name">${N.highlight(N.displayName(r.tab), words).html}</div>
                ${r.snippet ? `<div class="nto-snip">${r.snippetHtml}</div>` : ''}
                <div class="nto-sub">${esc(where)} · ${esc(N.formatDate(r.tab.modifiedAt || r.tab.createdAt))}</div>
            </div>`;
        }).join('');
    }

    const bodyHtml = () => (N.queryWords(ui.query).length ? resultsHtml() : foldersHtml());

    function mergeBarHtml() {
        const n = ui.selected.size;
        return n ? `<span>${n} selected</span><button class="nto-btn primary" data-act="merge">Merge into one tab</button><button class="nto-btn" data-act="clear-sel">Clear</button>` : '';
    }

    function sidebarHtml() {
        const c = N.counts(tabs());
        return `<div class="nt-sidebar-header nto-head">
                <span class="nt-sidebar-title">📝 Notes <span class="nto-count">${c.total} tabs → ${c.active} active</span></span>
                <button class="nt-sidebar-close" id="nt-sidebar-close" title="Close">×</button>
            </div>
            <div class="nto-tools">
                <input id="nto-search" class="nto-search" type="text" autocomplete="off" placeholder="Search all tabs: card, BIN, last4, profile, text..." value="${esc(ui.query)}">
                <div class="nto-tools-row">
                    <label class="nto-toggle"><input type="checkbox" id="nto-inc-arch" ${ui.includeArchive ? 'checked' : ''}> Include archive</label>
                    <span class="nto-spacer"></span>
                    <button class="nto-btn" id="nt-sidebar-new-btn">+ New Tab</button>
                    <button class="nto-btn" id="nto-cleanup-btn">🧹 Cleanup</button>
                </div>
            </div>
            <div class="nto-mergebar" id="nto-mergebar">${mergeBarHtml()}</div>
            <div class="nt-sidebar-list nto-body" id="nto-body">${bodyHtml()}</div>`;
    }

    function renderBody() {
        const body = $('nto-body');
        if (body) body.innerHTML = bodyHtml();
        const bar = $('nto-mergebar');
        if (bar) bar.innerHTML = mergeBarHtml();
    }

    // ── Editor toolbar / quick inserts ──

    function toolbarHtml(tab) {
        if (!tab) return '';
        const used = tab.status === 'used', archived = tab.status === 'archived';
        return `<button class="nt-tool-btn ${used ? 'nto-on' : ''}" id="notes-used-btn" title="Toggle used">${used ? '✓ USED' : 'MARK AS USED'}</button>`
            + `<button class="nt-tool-btn" id="notes-archive-btn" title="${archived ? 'Restore from Archive' : 'Move to Archive'}">${archived ? 'RESTORE' : 'ARCHIVE'}</button>`;
    }

    function quickBarHtml() {
        return `<div class="nto-quick" id="nto-quick">
            <button class="nto-qbtn" data-insert="date" title="Insert current date and time">📅 Insert date</button>
            ${['OK', 'FAIL', 'WAIT', 'USED'].map(t => `<button class="nto-qbtn nto-tag-${t.toLowerCase()}" data-insert="[${t}] ">[${t}]</button>`).join('')}
        </div>`;
    }

    function insertText(text) {
        const ed = $('notes-editor');
        if (!ed) return;
        ed.focus();
        const sel = window.getSelection();
        if (!sel.rangeCount || !ed.contains(sel.anchorNode)) {
            const r = document.createRange();
            r.selectNodeContents(ed);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
        }
        document.execCommand('insertText', false, text);
    }

    function dateText() {
        const d = new Date();
        const pad = n => String(n).padStart(2, '0');
        return `${N.formatDate(d)} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())} `;
    }

    // ── Scroll to search match ──

    function scrollToMatch(fragment, lineIndex) {
        const ed = $('notes-editor');
        if (!ed) return;
        const range = fragment ? findRange(ed, fragment) : null;
        if (range) {
            ed.focus();
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            const rect = range.getBoundingClientRect(), box = ed.getBoundingClientRect();
            ed.scrollTop += rect.top - box.top - ed.clientHeight / 3;
        } else if (lineIndex > 0) {
            const lh = parseFloat(getComputedStyle(ed).lineHeight) || 20;
            ed.scrollTop = Math.max(0, lineIndex * lh - ed.clientHeight / 3);
        }
        const nums = $('notes-line-nums');
        if (nums) nums.scrollTop = ed.scrollTop;
    }

    function findRange(root, fragment) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let full = '';
        for (let n = walker.nextNode(); n; n = walker.nextNode()) { nodes.push([n, full.length]); full += n.nodeValue; }
        const at = full.toLowerCase().indexOf(fragment.toLowerCase());
        if (at < 0) return null;
        const locate = pos => {
            for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i][1] <= pos) return [nodes[i][0], pos - nodes[i][1]];
            return null;
        };
        const s = locate(at), e = locate(at + fragment.length - 1);
        if (!s || !e) return null;
        const r = document.createRange();
        r.setStart(s[0], s[1]);
        r.setEnd(e[0], e[1] + 1);
        return r;
    }

    // ── Context menu ──

    function closeCtx() { const m = $('nto-ctx'); if (m) m.remove(); }

    function showCtx(e, id) {
        closeCtx();
        const t = findTab(id);
        if (!t) return;
        const archived = t.status === 'archived';
        const item = (act, label, extra = '') => `<div class="nto-ctx-item ${extra}" data-act="${act}">${label}</div>`;
        const moves = N.FOLDERS.filter(f => archived || f.id !== t.folder).map(f => item('move:' + f.id, '→ ' + f.label)).join('')
            + (archived ? '' : item('move:archive', '→ Archive'));
        const menu = document.createElement('div');
        menu.id = 'nto-ctx';
        menu.className = 'nto-ctx';
        menu.dataset.tab = id;
        menu.innerHTML = item('open', 'Open')
            + item('rename', '✏️ Rename')
            + (t.customName ? item('autoname', '↺ Use auto name') : '')
            + item('pin', t.pinned ? '📌 Unpin' : '📌 Pin')
            + (archived ? item('restore', '↩ Restore') : item('used', t.status === 'used' ? 'Mark as active' : 'Mark as used'))
            + '<div class="nto-ctx-sep"></div><div class="nto-ctx-head">Move to...</div>' + moves
            + '<div class="nto-ctx-sep"></div>' + item('delete', '🗑 Delete…', 'danger');
        document.body.appendChild(menu);
        const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8);
        const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.addEventListener('click', ev => {
            const act = ev.target.closest('[data-act]')?.dataset.act;
            if (!act) return;
            closeCtx();
            itemAction(act, id);
        });
        setTimeout(() => document.addEventListener('mousedown', function off(ev) {
            if (!menu.contains(ev.target)) { closeCtx(); document.removeEventListener('mousedown', off); }
        }), 0);
    }

    function openTab(id, scroll) {
        if (!findTab(id)) return;
        if (typeof _saveActiveTab === 'function') _saveActiveTab();
        STATE.notesActiveTab = id;
        ui.scrollTo = scroll || null;
        ui.keepOpen = !!scroll;
        save();
        renderNotes();
    }

    function itemAction(act, id) {
        if (act === 'open') return openTab(id);
        if (act === 'rename') return window._ntStartRename(id);
        if (act === 'autoname') return commit(all => all.map(t => (t.id === id ? N.rename(t, '') : t)));
        if (act === 'pin') return togglePin(id);
        if (act === 'used') return toggleUsed(id);
        if (act === 'archive') return setStatus([id], 'archived');
        if (act === 'restore') return setStatus([id], 'active');
        if (act === 'delete') return window._ntDeleteTab(id);
        if (act.startsWith('move:')) return moveTo([id], act.slice(5));
    }

    // ── Cleanup panel ──

    function closeModal() { const m = $('nto-modal'); if (m) m.remove(); }

    function cleanupHtml() {
        const all = tabs();
        const stale = N.staleTabs(all, ui.days);
        const empty = N.emptyTabs(all);
        const groups = N.duplicateGroups(all);
        const dupCount = groups.reduce((s, g) => s + g.length - 1, 0);
        const list = arr => arr.slice(0, 6).map(t => `<li>${esc(N.displayName(t))}</li>`).join('') + (arr.length > 6 ? `<li class="more">+${arr.length - 6} more</li>` : '');
        const groupList = groups.slice(0, 5).map(g => `<li>${g.length}× ${esc(N.displayName(g[0]))}</li>`).join('') + (groups.length > 5 ? `<li class="more">+${groups.length - 5} more groups</li>` : '');
        return `<div class="nto-modal-box">
            <div class="nto-modal-title">🧹 Cleanup suggestions <span>Nothing is deleted automatically</span></div>
            <div class="nto-card">
                <div class="nto-card-head">Not modified for <input id="nto-days" type="number" min="1" max="365" value="${ui.days}"> days <b>${stale.length}</b></div>
                <ul class="nto-list">${list(stale)}</ul>
                <button class="nto-btn primary" data-clean="stale" ${stale.length ? '' : 'disabled'}>Archive all (${stale.length})</button>
            </div>
            <div class="nto-card">
                <div class="nto-card-head">Empty tabs <b>${empty.length}</b></div>
                <ul class="nto-list">${list(empty)}</ul>
                <button class="nto-btn primary" data-clean="empty" ${empty.length ? '' : 'disabled'}>Archive all (${empty.length})</button>
                <button class="nto-btn danger" data-clean="empty-delete" ${empty.length ? '' : 'disabled'}>Delete (${empty.length})…</button>
            </div>
            <div class="nto-card">
                <div class="nto-card-head">Duplicate tabs <b>${groups.length} group(s) · ${dupCount} extra</b></div>
                <ul class="nto-list">${groupList}</ul>
                <button class="nto-btn primary" data-clean="dup-merge" ${groups.length ? '' : 'disabled'}>Merge (${groups.length} groups)</button>
                <button class="nto-btn" data-clean="dup-archive" ${dupCount ? '' : 'disabled'}>Archive duplicates (${dupCount})</button>
            </div>
            <div class="nto-modal-foot">
                ${ui.undo ? `<button class="nto-btn" data-clean="undo">↶ Undo ${esc(ui.undo.label)}</button>` : ''}
                <button class="nto-btn" data-clean="export">⬇ Export backup</button>
                ${localStorage.getItem(K.backup) ? '<button class="nto-btn subtle" data-clean="restore-backup">Restore pre-migration backup…</button>' : ''}
                <span class="nto-spacer"></span>
                <button class="nto-btn" data-clean="close">Close</button>
            </div>
        </div>`;
    }

    function openCleanup() {
        closeModal();
        const m = document.createElement('div');
        m.id = 'nto-modal';
        m.className = 'nto-modal';
        m.innerHTML = cleanupHtml();
        document.body.appendChild(m);
        m.addEventListener('click', e => {
            if (e.target === m) return closeModal();
            const act = e.target.closest('[data-clean]')?.dataset.clean;
            if (act) cleanupAction(act);
        });
        m.addEventListener('change', e => {
            if (e.target.id !== 'nto-days') return;
            ui.days = Math.min(365, Math.max(1, parseInt(e.target.value, 10) || 14));
            writeJson(K.days, ui.days);
            m.innerHTML = cleanupHtml();
        });
    }

    function archiveWithUndo(list, label) {
        confirmThen(`Archive ${list.length} tab(s) (${label})? They can be restored any time.`, () => {
            rememberUndo(`archive of ${list.length} ${label} tab(s)`, list);
            closeModal();
            setStatus(list.map(t => t.id), 'archived');
            notify(`${list.length} tab(s) archived`, 'success');
        });
    }

    function cleanupAction(act) {
        const all = tabs();
        if (act === 'close') return closeModal();
        if (act === 'export') return download('notes-backup-' + stamp() + '.json', backupPayload('notes-backup'));
        if (act === 'restore-backup') return restorePreMigrationBackup();
        if (act === 'undo') { closeModal(); return applyUndo(); }
        if (act === 'stale') return archiveWithUndo(N.staleTabs(all, ui.days), `not modified for ${ui.days} days`);
        if (act === 'empty') return archiveWithUndo(N.emptyTabs(all), 'empty');
        if (act === 'empty-delete') {
            let list = N.emptyTabs(all);
            if (list.length >= all.length) list = list.slice(1); // never remove the very last tab
            return confirmThen(`Permanently delete ${list.length} empty tab(s)? You can undo this until the next cleanup action.`, () => {
                rememberUndo(`delete of ${list.length} empty tab(s)`, list);
                const ids = new Set(list.map(t => t.id));
                closeModal();
                commit(cur => cur.filter(t => !ids.has(t.id)));
                notify(`${list.length} empty tab(s) deleted`, 'success');
            });
        }
        const groups = N.duplicateGroups(all);
        if (act === 'dup-archive') {
            const extra = groups.flatMap(g => g.slice(1));
            return archiveWithUndo(extra, 'duplicate');
        }
        if (act === 'dup-merge') {
            const total = groups.reduce((s, g) => s + g.length, 0);
            return confirmThen(`Merge ${groups.length} duplicate group(s) (${total} tabs) into ${groups.length} tab(s)? Originals go to Archive.`, () => {
                closeModal();
                commit(cur => {
                    let next = cur;
                    const added = [];
                    groups.forEach(g => {
                        const r = N.mergeTabs(next, g.map(t => t.id), { ...modelOpts(), makeId: newId });
                        next = r.tabs;
                        if (r.merged) added.push(r.merged.id);
                    });
                    const ids = new Set(groups.flat().map(t => t.id));
                    rememberUndo(`merge of ${groups.length} duplicate group(s)`, cur.filter(t => ids.has(t.id)), added);
                    return next;
                });
                notify(`Merged ${groups.length} group(s)`, 'success');
            });
        }
    }

    // ── Wiring (called after each renderNotes) ──

    function wire() {
        const sb = $('nt-sidebar');
        if (!sb) return;
        const search = $('nto-search');
        search?.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { ui.query = search.value; renderBody(); }, 150);
        });
        $('nto-inc-arch')?.addEventListener('change', e => {
            ui.includeArchive = e.target.checked;
            writeJson(K.archive, ui.includeArchive);
            renderBody();
        });
        $('nto-cleanup-btn')?.addEventListener('click', openCleanup);

        sb.addEventListener('click', e => {
            const t = e.target;
            const act = t.closest('[data-act]')?.dataset.act;
            if (act === 'merge') return mergeSelected([...ui.selected]);
            if (act === 'clear-sel') { ui.selected.clear(); return renderBody(); }
            const head = t.closest('.nto-fhead');
            if (head) {
                const f = head.dataset.drop;
                ui.collapsed = { ...ui.collapsed, [f]: !ui.collapsed[f] };
                writeJson(K.folders, ui.collapsed);
                return renderBody();
            }
            if (t.classList.contains('nto-cb')) return;
            const res = t.closest('.nto-result');
            if (res) return openTab(res.dataset.tab, { line: +res.dataset.line, frag: res.dataset.frag });
            const item = t.closest('.nto-item');
            if (!item) return;
            if (act) return itemAction(act, item.dataset.tab);
            openTab(item.dataset.tab);
        });
        sb.addEventListener('change', e => {
            if (!e.target.classList.contains('nto-cb')) return;
            const id = e.target.dataset.tab;
            if (e.target.checked) ui.selected.add(id); else ui.selected.delete(id);
            const bar = $('nto-mergebar');
            if (bar) bar.innerHTML = mergeBarHtml();
        });
        sb.addEventListener('contextmenu', e => {
            const item = e.target.closest('.nto-item, .nto-result');
            if (!item) return;
            e.preventDefault();
            showCtx(e, item.dataset.tab);
        });
        // Drag & drop onto folder headers
        sb.addEventListener('dragstart', e => {
            const item = e.target.closest('.nto-item');
            if (item) { e.dataTransfer.setData('text/nto-tab', item.dataset.tab); e.dataTransfer.effectAllowed = 'move'; }
        });
        sb.addEventListener('dragover', e => {
            const head = e.target.closest('.nto-fhead');
            if (!head || !e.dataTransfer.types.includes('text/nto-tab')) return;
            e.preventDefault();
            sb.querySelectorAll('.nto-fhead.drop').forEach(h => h !== head && h.classList.remove('drop'));
            head.classList.add('drop');
        });
        sb.addEventListener('dragleave', e => { e.target.closest?.('.nto-fhead')?.classList.remove('drop'); });
        sb.addEventListener('drop', e => {
            const head = e.target.closest('.nto-fhead');
            const id = e.dataTransfer.getData('text/nto-tab');
            if (!head || !id) return;
            e.preventDefault();
            moveTo([id], head.dataset.drop);
        });

        $('notes-used-btn')?.addEventListener('click', () => toggleUsed(STATE.notesActiveTab));
        $('notes-archive-btn')?.addEventListener('click', () => {
            const t = findTab(STATE.notesActiveTab);
            if (t) setStatus([t.id], t.status === 'archived' ? 'active' : 'archived');
        });
        const quick = $('nto-quick');
        quick?.addEventListener('mousedown', e => { if (e.target.closest('[data-insert]')) e.preventDefault(); });
        quick?.addEventListener('click', e => {
            const v = e.target.closest('[data-insert]')?.dataset.insert;
            if (v) insertText(v === 'date' ? dateText() : v);
        });
    }

    /** Re-open the drawer / scroll to a search hit after a full re-render. */
    function afterRender() {
        if (ui.keepOpen) {
            const sb = $('nt-sidebar'), ov = $('nt-sidebar-overlay');
            if (sb) { sb.classList.add('nto-noanim', 'open'); requestAnimationFrame(() => sb.classList.remove('nto-noanim')); }
            if (ov) ov.classList.add('open');
            ui.keepOpen = false;
        }
        if (ui.scrollTo) {
            const s = ui.scrollTo;
            ui.scrollTo = null;
            requestAnimationFrame(() => scrollToMatch(s.frag, s.line));
        }
    }

    /** Tabs shown in the top tab bar: everything except archived (the open tab is always shown). */
    const tabBarTabs = list => list.filter(t => t.status !== 'archived' || t.id === STATE.notesActiveTab);

    window.NotesOrg = {
        prepare, sidebarHtml, toolbarHtml, quickBarHtml, wire, afterRender, tabBarTabs,
        restorePreMigrationBackup, openCleanup,
    };
})();
