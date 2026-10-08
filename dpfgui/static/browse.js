/* Reading files in the page: syntax highlighting (Shiki) and a file browser (Pierre's file tree, @pierre/trees, vendored in static/vendor)
   for things that are really file trees: a MachineConfig's files, a Helm chart. */

// Syntax highlighting: Shiki with Pierre's themes (static/vendor/shiki-pierre.mjs, see the README
// there), loaded on first use. Hl.block returns a <pre>: highlighted if Shiki is ready, else plain
// and highlighted in place once it is.
const Hl = (() => {
  let loading, hl;
  const cache = new Map();    // lang + text -> highlighted HTML
  const pending = new Map();  // placeholder id -> {text, lang, cls}
  let nextId = 0;
  const load = () => (loading ||= import('/static/vendor/shiki-pierre.mjs').then(m => m.createHighlighter()).then(h => { hl = h; upgrade(); return h; }));
  const e = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const langOf = path => {
    const p = (path || '').toLowerCase();
    if (/\.(ya?ml)$/.test(p) || /templates\/.*\.tpl$/.test(p)) return 'yaml';
    if (/\.json$/.test(p)) return 'json';
    if (/\.(sh|bash)$/.test(p)) return 'shellscript';
    if (/\.(service|socket|timer|target|mount|automount|path|slice|scope)$/.test(p) || /\.d\/[^/]+\.conf$/.test(p)) return 'systemd';
    if (/\.(conf|ini|cfg|toml)$/.test(p)) return 'ini';
    if (/\.md$/.test(p)) return 'markdown';
    return null;
  };
  const guess = text => /^#!.*\b(ba)?sh\b/.test(text) ? 'shellscript' : /^\s*[{[]/.test(text) ? 'json'
    : /^\s*\[(Unit|Service|Install|Socket|Timer|Mount|Path)\]\s*$/m.test(text) ? 'systemd'
    : /^\s*\[[\w .-]+\]\s*$/m.test(text) && /^\s*[\w.-]+\s*=/m.test(text) ? 'ini'
    : /^\s*[\w"'.-][^:\n]*:(\s|$)/m.test(text) ? 'yaml' : null;

  const render = (text, lang, cls) => {
    const key = `${lang}\0${text}`;
    let html = cache.get(key);
    if (!html) {
      html = hl.codeToHtml(text, { lang, themes: { light: 'pierre-light', dark: 'pierre-dark' }, defaultColor: false });
      if (cache.size > 300) cache.delete(cache.keys().next().value);
      cache.set(key, html);
    }
    return html.replace('<pre class="', `<pre class="code ${cls} `);
  };

  // A <pre> with the text highlighted (lang: yaml, json, shellscript, systemd, ini, markdown; else
  // from the path or the text itself).
  function block(text, { lang, path, cls = '' } = {}) {
    text = String(text ?? '');
    lang = lang === 'shell' ? 'shellscript' : lang || langOf(path) || guess(text);
    if (!lang || text.length > 300000) return `<pre class="code ${cls}">${e(text)}</pre>`;
    if (hl) return render(text, lang, cls);
    const id = `hl${++nextId}`;
    pending.set(id, { text, lang, cls });
    load();
    return `<pre class="code ${cls}" data-hl="${id}">${e(text)}</pre>`;
  }

  // Highlights the placeholders on the page (once Shiki is loaded).
  function upgrade() {
    if (!hl) return;
    for (const el of document.querySelectorAll('pre[data-hl]')) {
      const p = pending.get(el.dataset.hl);
      if (p) el.outerHTML = render(p.text, p.lang, p.cls);
    }
    pending.clear();  // anything not on the page anymore was redrawn (highlighted, now that Shiki is here)
  }

  return { block, langOf, load };
})();

/* A file browser in a dialog: Pierre's tree on the left, the chosen file on the right.
   files: [{path, text, note?}] (note: HTML shown above the file, e.g. its mode and owner). */
const FileBrowser = (() => {
  let treesModule;
  const loadTrees = () => (treesModule ||= import('/static/vendor/pierre-trees.mjs'));

  async function open({ title, subtitle = '', files, select, extraTabs = [] }) {
    const byPath = new Map(files.map(f => [f.path.replace(/^\/+/, ''), f]));
    const paths = [...byPath.keys()].sort();
    const tabs = [{ id: 'files', label: `Files · ${paths.length}` }, ...extraTabs];
    modal.show(`<div class="modal-head"><div style="flex:1"><h3 class="mono">${esc(title)}</h3>${subtitle ? `<div class="muted small">${subtitle}</div>` : ''}</div>
        <button class="icon-btn" data-m="close" title="Close (Esc)">${icon('x')}</button></div>
      ${tabs.length > 1 ? `<div class="fb-tabs">${tabs.map((t, i) => `<button class="fb-tab ${i ? '' : 'active'}" data-fb-tab="${esc(t.id)}">${esc(t.label)}</button>`).join('')}</div>` : ''}
      <div class="modal-body fb-body">
        <div class="fb-pane" data-fb-pane="files"><div class="fb-tree" id="fb-tree">${paths.length ? '<div class="muted small" style="padding:10px"><span class="spinner"></span> Loading…</div>' : '<div class="muted small" style="padding:10px">No files.</div>'}</div>
          <div class="fb-file" id="fb-file"><div class="muted small">Pick a file.</div></div></div>
        ${extraTabs.map(t => `<div class="fb-pane fb-scroll" data-fb-pane="${esc(t.id)}" hidden>${t.html}</div>`).join('')}
      </div>`, { wide: true, onClose: () => { tree?.cleanUp?.(); return true; } });
    let tree;
    $('#modal [data-m="close"]').addEventListener('click', () => modal.close(), { signal: modal.signal });
    $$('#modal [data-fb-tab]').forEach(b => b.addEventListener('click', () => {
      $$('#modal [data-fb-tab]').forEach(x => x.classList.toggle('active', x === b));
      $$('#modal [data-fb-pane]').forEach(p => { p.hidden = p.dataset.fbPane !== b.dataset.fbTab; });
    }, { signal: modal.signal }));
    const show = path => {
      const f = byPath.get(path), el = $('#fb-file');
      if (!el) return;
      if (!f) { el.innerHTML = '<div class="muted small">A folder.</div>'; return; }
      el.innerHTML = `<div class="fb-file-head"><span class="mono">/${esc(path)}</span>${f.note ? `<span class="small muted">${f.note}</span>` : ''}
          <span class="spacer"></span>${f.text != null ? `<button class="btn small" id="fb-copy">${icon('copy', 'sm')}Copy</button>` : ''}</div>
        ${f.text == null ? `<div class="muted small">${f.empty || 'No contents.'}</div>` : Hl.block(f.text, { path })}`;
      $('#fb-copy')?.addEventListener('click', () => copyText(f.text, 'Copied'));
    };
    if (!paths.length) return;
    try {
      const { FileTree } = await loadTrees();
      if (!$('#fb-tree')) return;  // closed meanwhile
      const first = select && byPath.has(select) ? select : paths[0];
      tree = new FileTree({
        // Small trees open fully; big ones (a chart's 100+ files) two levels deep.
        paths, initialExpansion: paths.length > 40 ? 2 : 'open', flattenEmptyDirectories: true, search: paths.length > 15,
        initialSelectedPaths: [first], density: 'compact',
        onSelectionChange: sel => sel[0] && show(sel[0]),
        renderRowDecoration: ({ item }) => { const f = byPath.get(item.path); return f?.badge ? { text: f.badge, title: f.badgeTitle || '' } : null; },
      });
      $('#fb-tree').innerHTML = '';
      tree.render({ containerWrapper: $('#fb-tree') });
      show(first);
    } catch (err) {
      // Without the tree, a plain list still works.
      $('#fb-tree').innerHTML = `<div class="small" style="color:var(--bad);padding:8px">Couldn’t load the file tree: ${esc(err.message)}</div>${paths.map(pth => `<button class="link-btn mono fb-plain" data-fb-path="${esc(pth)}">${esc(pth)}</button>`).join('')}`;
      $$('#modal [data-fb-path]').forEach(b => b.addEventListener('click', () => show(b.dataset.fbPath), { signal: modal.signal }));
      show(paths[0]);
    }
  }

  return { open };
})();
