/* Setting cards: related settings shown and chosen together.
 *
 * Cards sit above the plain list of settings in the editor. By default a card shows values
 * (marked "default" or "yours") and lets you pick from presets: lab machines, files that
 * exist on the hypervisor, versions that are actually offered. Typing values in is the
 * card's custom mode (the ⋯ button), meant for power users.
 *
 * A card renders from a context object built by the editor:
 *
 *   ctx.row(key) / ctx.eff(key)   analysis row / effective value of a setting
 *   ctx.src(key)                   'set' (the profile's own value) or 'default' (the repo's)
 *   ctx.adv                        true in custom mode
 *   ctx.facts                      what the hypervisor told us (bridges, VMs, DNS, files…)
 *   ctx.set({KEY: value, …})       change the draft; picking what the value would be anyway drops your entry
 *   ctx.reset(KEY, …)              back to the repo default
 *   ctx.lazy(id, fetch)            {loading, data, error, onData} of a slow fetch, cached per editor
 *   ctx.ui                         per-editor UI state (open pickers, revealed secrets…)
 *
 * Inside a card: <input data-bind="KEY"> edits KEY live (data-scale="1024" stores value×1024),
 * <button data-set="KEY" data-val="v">, <button data-setmany='{"K":"v"}'> and
 * <button data-reset="KEY"> change values, and [data-copy] copies. Other clicks go to the
 * card's click(e, ctx, card), select/checkbox changes to its change(e, ctx, card).
 */

/* ── Small helpers ──────────────────────────────────────────────────── */

const GIB = 1024; // MiB per GiB

function fmtGiB(mib) {
  const g = mib / GIB;
  return `${g >= 100 || Number.isInteger(g) ? Math.round(g) : g.toFixed(1)} GiB`;
}
const num = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const okIcon = t => `<span class="ci-ok" title="${esc(t || '')}">${icon('check', 'sm')}</span>`;
const badIcon = t => `<span class="ci-bad" title="${esc(t || '')}">${icon('alert', 'sm')}</span>`;
const spin = '<span class="spinner" style="width:12px;height:12px"></span>';

function bindInput(ctx, key, { cls = '', placeholder = '', type = 'text', scale = 0, size = 0, title = '' } = {}) {
  let v = ctx.eff(key) ?? '';
  if (scale && v !== '') v = String(+(num(v) / scale).toFixed(2));
  const ph = placeholder || ctx.row(key)?.default || '';
  const sz = size ? `size="${Math.max(size, String(v).length + 1, ph.length + 1)}"` : '';
  return `<input class="input ci ${cls}" data-bind="${key}" ${scale ? `data-scale="${scale}"` : ''} value="${esc(v)}" type="${type}"
    placeholder="${esc(placeholder || ctx.row(key)?.default || '')}" spellcheck="false" autocomplete="off" ${sz} ${title ? `title="${esc(title)}"` : ''}>`;
}

const isMine = (ctx, key) => ctx.src(key) !== 'default';
// Required and still empty: shown as a textbox to fill in, not as a default you could edit.
const isTodo = (ctx, key) => (ctx.row(key)?.issues || []).some(i => i.level === 'todo');

// ↺ back to the repo default, shown only next to values you set.
function resetBtn(ctx, ...keys) {
  // Your values, and defaults you opened with ✎ but haven't changed (so there's a way back).
  const mine = keys.filter(k => isMine(ctx, k) || ctx.ui.editing.has(k));
  if (!mine.length) return '';
  const def = mine.length === 1 ? ctx.row(mine[0])?.default : null;
  return `<button class="vc-btn vc-reset" data-reset="${mine.join(',')}" title="Back to the repo default${def ? `: ${esc(def)}` : def === '' ? ' (empty)' : ''}">${icon('undo', 'sm')}</button>`;
}

// The one way a free-form value is shown: yours is a textbox with ↺, a default is plain
// text with ✎ (which turns it into a textbox).
function edit(ctx, key, { show, input = {}, empty = 'not set', required = false } = {}) {
  if ((isTodo(ctx, key) || (required && !ctx.eff(key))) && !isMine(ctx, key)) {
    return `<span class="vc req">${bindInput(ctx, key, { cls: 'mono', placeholder: 'required', ...input })}</span>`;
  }
  if (isMine(ctx, key) || ctx.ui.editing.has(key)) {
    return `<span class="vc">${bindInput(ctx, key, { cls: 'mono', ...input })}${resetBtn(ctx, key)}</span>`;
  }
  const v = ctx.eff(key);
  return `<span class="vc def">${show ?? (v ? `<span class="mono">${esc(v)}</span>` : `<span class="muted">${empty}</span>`)}
    <button class="vc-btn" data-vedit="${key}" title="Change (${esc(key)})">${icon('edit', 'sm')}</button></span>`;
}

// An explanation, tucked behind an ⓘ (shown on hover and keyboard focus). Plain text.
const infoTip = text => text ? `<button type="button" class="info-tip" aria-label="${esc(text)}" data-tip="${esc(text)}">${icon('info', 'sm')}</button>` : '';

// A labelled input for custom mode.
function field(ctx, key, label, control, hint = '', info = '') {
  const r = ctx.row(key);
  return `<div class="cf"><div class="cf-label">${label}${infoTip(info)}<code class="cf-key" title="${esc(r?.description || '')}">${esc(key)}</code>${resetBtn(ctx, key)}</div>
    ${control}${hint ? `<div class="cf-hint">${hint}</div>` : ''}</div>`;
}

// A labelled free-form value.
function val(ctx, key, label, { show, input = {}, hint = '', advHint, empty, info = '' } = {}) {
  return `<div class="kv"><div class="kv-label">${label}${infoTip(info)}</div>
    <div class="kv-val">${edit(ctx, key, { show, input, empty })}</div>
    ${(ctx.adv ? advHint ?? hint : hint) ? `<div class="cf-hint">${ctx.adv ? advHint ?? hint : hint}</div>` : ''}</div>`;
}

// Pick one of a few presets. ✎ types your own value; a value of yours that isn't a preset
// is a textbox (`input`: its control), with ↺ back to the default.
function choice(ctx, key, label, options, { fmt = v => esc(v), hint = '', input, info = '' } = {}) {
  const cur = String(ctx.eff(key) ?? '');
  if (!isMine(ctx, key) && !ctx.ui.editing.has(key)) {
    return `<div class="kv"><div class="kv-label">${label}${infoTip(info)}</div>
      <div class="kv-val"><span class="vc def">${fmt(cur)}<button class="vc-btn" data-vedit="${key}" title="Change (${esc(key)})">${icon('edit', 'sm')}</button></span></div>
      ${hint ? `<div class="cf-hint">${hint}</div>` : ''}</div>`;
  }
  const opts = options.map(o => Array.isArray(o) ? o : [o, fmt(o)]);
  const typed = input && ((isMine(ctx, key) && !opts.some(([v]) => String(v) === cur)) || ctx.ui.editing.has(key));
  const pills = opts.map(([v, l]) => `<button class="ci-pill ${String(v) === cur && !typed ? 'active' : ''}" data-set="${key}" data-val="${esc(v)}">${l}</button>`).join('');
  const own = typed ? input : input ? `<button class="vc-btn" data-vedit="${key}" title="Your own value (${esc(key)})">${icon('edit', 'sm')}</button>` : '';
  return `<div class="kv"><div class="kv-label">${label}${infoTip(info)}</div>
    <div class="kv-val"><div class="ci-pills">${typed ? `<span class="vc">${own}</span>` : ''}${pills}${typed ? '' : own}${resetBtn(ctx, key)}</div></div>
    ${hint ? `<div class="cf-hint">${hint}</div>` : ''}</div>`;
}

function segmented(key, cur, options) {
  return `<div class="seg">${options.map(([v, label]) =>
    `<button data-set="${key}" data-val="${esc(v)}" class="${String(cur) === String(v) ? 'active' : ''}">${label}</button>`).join('')}</div>`;
}

function checkbox(key, checked, label, { on = 'true', off = 'false' } = {}) {
  return `<label class="ci-check"><input type="checkbox" data-bind-check="${key}" data-on="${on}" data-off="${off}" ${checked ? 'checked' : ''}>${label}</label>`;
}


// A stacked bar of [{value, cls, label}] against total; flags what doesn't fit.
function usageBar(total, segs, unit, { overcommit = false } = {}) {
  const used = segs.reduce((a, s) => a + Math.max(0, s.value), 0);
  const scale = Math.max(total, used) || 1;
  const over = used - total;
  const bar = segs.map(s => `<div class="seg ${s.cls}" style="width:${Math.max(0, s.value) / scale * 100}%" title="${esc(s.label)}: ${unit(s.value)}"></div>`).join('');
  const marker = over > 0 ? `<div class="ub-limit" style="left:${total / scale * 100}%" title="Host total"></div>` : '';
  return `<div class="membar ub">${bar}${marker}</div>
    <div class="legend">${segs.map(s => `<span><i class="${s.cls}"></i>${esc(s.label)} ${unit(s.value)}</span>`).join('')}
      <span><i class="free"></i>${over > 0 ? (overcommit ? `overcommitted ×${(used / total).toFixed(1)}` : `<b class="ub-over">short by ${unit(over)}</b>`) : `free ${unit(total - used)}`}</span></div>`;
}

function verKey(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-(ec|rc)\.(\d+))?/.exec(v) || [];
  const pre = m[4] ? (m[4] === 'ec' ? 0 : 1) * 1000 + +m[5] : 9999;
  return [+m[1] || 0, +m[2] || 0, +m[3] || 0, pre];
}
const cmpVer = (a, b) => { const x = verKey(a), y = verKey(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const minorOf = v => (/^(\d+\.\d+)/.exec(v || '') || [])[1];

function ipInCidr(ip, cidr) {
  const [net, bits] = (cidr || '').split('/');
  if (!ip || !net || bits === undefined) return null;
  const toInt = s => s.split('.').reduce((a, o) => a * 256 + (+o), 0);
  const block = 2 ** (32 - +bits);
  return Math.floor(toInt(ip) / block) === Math.floor(toInt(net) / block);
}

// Avatars only (not links): they sit inside things you click to pick; GitHub is a separate icon.
function userAvatars(users, me = []) {
  return users.map(u => `<span class="dpu-user ${me.includes(u) ? 'me' : ''}" title="@${esc(u)}">${avatarHtml(`https://avatars.githubusercontent.com/${encodeURIComponent(u)}?s=48`, 18)}</span>`).join('');
}

/* ── Lab machines (DPU hosts) ───────────────────────────────────────── */

// A DPU host's settings (WORKER_<n>_<field>).
const DPU_FIELDS = ['NAME', 'BMC_IP', 'BMC_USER', 'BMC_PASSWORD', 'BOOT_MAC', 'ROOT_DEVICE', 'DPU', 'REDFISH_SYSTEM_PATH'];

function dpusOf(d) {
  return (d?.sections || []).flatMap(s => s.machines).filter(m => m.type === 'DPU Worker');
}

// The DPU machine a WORKER_<n>_* block points at: by BMC address, else by name (as in machines.find_worker).
function findWorkerMachine(d, name, bmc) {
  const ms = dpusOf(d);
  return (bmc && ms.find(m => bmc === m.bmc || bmc === m.dpu_bmc))
    || (name && ms.find(m => name === m.id || name === m.address || (m.address || '').startsWith(name + '.')))
    || null;
}

const workerMachine = (ctx, n) => findWorkerMachine(ctx.machines, ctx.eff(`WORKER_${n}_NAME`), ctx.eff(`WORKER_${n}_BMC_IP`));

function hostIp(ctx, address) {
  const r = ctx.facts?.dns?.[address];
  return r ? (r.dns?.[0] || r.hosts?.[0] || null) : undefined;
}

const probeKey = (ctx, n) => {
  const k = f => ctx.eff(`WORKER_${n}_${f}`);
  return `bmc:${ctx.host}|${k('BMC_IP')}|${k('BMC_USER')}|${k('BMC_PASSWORD')}|${workerMachine(ctx, n)?.address || ''}`;
};

// Ask the host's BMC for its NICs (and whether the login works). Picks the boot NIC when none is set.
function probeBmc(ctx, n) {
  const k = f => ctx.eff(`WORKER_${n}_${f}`);
  const m = workerMachine(ctx, n);
  const bmc = k('BMC_IP'), user = k('BMC_USER'), password = k('BMC_PASSWORD');
  if (!bmc || !user || !password) return null;
  const host = m?.address || '';
  const entry = ctx.lazy(probeKey(ctx, n),
    () => api('POST', ctx.url('bmc-probe'), { bmc, user, password, host }));
  entry.onData ??= d => {
    // Workers may have been renumbered meanwhile: find this host's slot now.
    const w = selectedWorkers(ctx).find(x => ctx.eff(`WORKER_${x.n}_BMC_IP`) === bmc);
    if (w && !ctx.eff(`WORKER_${w.n}_BOOT_MAC`) && d.recommended) ctx.set({ [`WORKER_${w.n}_BOOT_MAC`]: d.recommended });
  };
  return entry;
}

// The machines this profile deploys to: worker n for n = 1..WORKER_COUNT.
function selectedWorkers(ctx) {
  const out = [];
  for (let n = 1; n <= ctx.workerCount(); n++) out.push({ n, m: workerMachine(ctx, n), name: ctx.eff(`WORKER_${n}_NAME`) });
  return out;
}

// Checking a host gives it the next worker slot; unchecking frees it, and later workers move up
// so the slots stay 1..WORKER_COUNT. The server does it on the draft (ops.add_dpu / remove_dpu).
async function changeDpus(ctx, change) {
  try {
    const r = await api('POST', `/api/profiles/${encodeURIComponent(ctx.name)}/dpus`, { settings: ctx.draft(), slots: ctx.workerSlots(), ...change });
    ctx.machines.remembered = r.remembered;
    ctx.replace(r.settings);
  } catch (e) { toast(e.message, 'bad'); ctx.rerender(); }
}

function addDpu(ctx, id) {
  const m = dpusOf(ctx.machines).find(x => x.id === id), me = ctx.machines.me || [];
  const theirs = m && m.users.length && !m.users.some(u => me.includes(u));
  if (theirs && !window.confirm(`${m.id} is allocated to ${m.users.map(u => '@' + u).join(', ')}. Use it anyway?`)) return ctx.rerender();
  return changeDpus(ctx, { add: id, force: !!theirs });
}

const removeDpu = (ctx, n) => changeDpus(ctx, { remove: n });

const nicLabel = nic => `${esc(nic.name || nic.id)}`;
const nicLink = nic => nic.link === 'LinkUp' ? `<span class="ci-ok-text">link up${nic.speed ? ` · ${nic.speed >= 1000 ? nic.speed / 1000 + ' Gb' : nic.speed + ' Mb'}` : ''}</span>` : `<span class="muted">${nic.link === 'LinkDown' ? 'link down' : 'no link info'}</span>`;

// Login, boot NIC, address and disk of a chosen host (worker n).
function workerDetails(ctx, n, m) {
  const k = f => `WORKER_${n}_${f}`;
  const probe = probeBmc(ctx, n);
  const user = ctx.eff(k('BMC_USER')), pw = ctx.eff(k('BMC_PASSWORD'));
  const pwType = ctx.ui.reveal.has(k('BMC_PASSWORD')) ? 'text' : 'password';
  const login = `<div class="ci-row">${edit(ctx, k('BMC_USER'), { input: { cls: 'mono ci-user', placeholder: 'user' } })}
    ${edit(ctx, k('BMC_PASSWORD'), { required: true, show: '<span class="mono">••••••</span>', input: { cls: 'mono ci-user', type: pwType, placeholder: 'password' } })}
    ${isMine(ctx, k('BMC_PASSWORD')) ? `<button class="vc-btn" data-reveal-key="${k('BMC_PASSWORD')}" title="Show/hide the password">${icon('eye', 'sm')}</button>` : ''}</div>`;
  // Where the login came from, when it wasn't typed here.
  const mem = m && ctx.machines?.remembered?.[m.id];
  const origin = mem && mem.BMC_USER === user && mem.BMC_PASSWORD === pw && mem._from && mem._from !== (ctx.title || ctx.name)
    ? `<span class="muted small">Remembered from ${esc(mem._from)}</span>` : '';
  const loginState = !user || !pw ? '<span class="muted">Type the BMC password; the BMC is asked whether it works.</span>'
    : !probe || probe.loading ? `${spin}<span class="muted">checking with the BMC…</span>`
    : probe.data?.auth ? `${okIcon()}<span class="ci-ok-text">the BMC accepts it</span>`
    : probe.data?.auth === false ? `${badIcon()}<span class="ci-bad-text">refused by the BMC</span>`
    : `<span class="muted">can’t reach the BMC: ${esc(probe.data?.error || probe.error || '')}</span> <button class="link-btn" data-bmc-retry="${n}">Try again</button>`;

  // Boot NIC: one of the host's NICs, as reported by the BMC.
  const mac = (ctx.eff(k('BOOT_MAC')) || '').toUpperCase();
  const nics = probe?.data?.nics || [];
  const curNic = nics.find(x => x.mac === mac);
  const rec = nics.find(x => x.mac === probe?.data?.recommended);
  let nic;
  const macBox = () => edit(ctx, k('BOOT_MAC'), { required: true, input: { placeholder: 'aa:bb:cc:dd:ee:ff' } });
  if (!mac && probe?.loading) nic = `${spin}<span class="muted">asking the BMC…</span>`;
  else if (curNic) nic = `${nicLabel(curNic)} <span class="mono small">${esc(mac)}</span> ${nicLink(curNic)}`;
  // Without the BMC's list of NICs, the MAC is typed (or pasted from the BMC's web page).
  else if (!nics.length) nic = macBox();
  else nic = `<span class="mono">${esc(mac)}</span> ${badIcon()}<span class="ci-bad-text">not a NIC of this host</span>`;
  const showNics = ctx.ui.nicOpen?.has(n);
  const why = rec && probe.data.arp_mac === rec.mac ? `carries ${esc(probe.data.host_ip)}` : 'link up';
  const noLink = curNic && curNic.link !== 'LinkUp' && rec
    ? ' title="This NIC has no link. DPF only uses the MAC to identify the host, but with the nno profile and MTU 9000 this NIC also gets the network config."' : '';
  const nicHint = (rec && rec.mac !== mac ? `<button class="ci-chip" data-set="${k('BOOT_MAC')}" data-val="${esc(rec.mac)}"${noLink}>${icon('check', 'sm')}Use the ${rec.link === 'LinkUp' ? 'link-up' : 'recommended'} NIC (${why})</button> ` : '')
    + (nics.length > 1 ? `<button class="link-btn" data-nic-toggle="${n}">${showNics ? 'Hide' : 'All'} ${nics.length} NICs</button>` : '');
  const nicList = showNics ? `<div class="nic-list">${nics.map(x => `<button class="nic ${x.mac === mac ? 'here' : ''}" ${x.mac === mac ? '' : `data-set="${k('BOOT_MAC')}" data-val="${esc(x.mac)}"`}>
      <span>${x.mac === mac ? icon('check', 'sm') : ''}</span><span>${nicLabel(x)}</span><span class="mono">${esc(x.mac)}</span>${nicLink(x)}${x.mac === probe.data.arp_mac ? `<span class="muted">carries ${esc(probe.data.host_ip)}</span>` : '<span></span>'}</button>`).join('')}</div>` : '';

  let ipLine = '';
  if (m) {
    const ip = hostIp(ctx, m.address), cidr = ctx.eff('DPU_HOST_CIDR');
    const inside = ipInCidr(ip, cidr);
    ipLine = ip === undefined ? `${spin}<span class="muted">resolving…</span>`
      : !ip ? `${badIcon()}<span class="ci-bad-text">${esc(m.address)} doesn't resolve</span>`
      : `<span class="mono">${esc(ip)}</span> ${inside === false ? `${badIcon()}<span class="ci-bad-text">outside DPU_HOST_CIDR ${esc(cidr)}</span>` : inside ? `${okIcon()}<span class="muted">in ${esc(cidr)}</span>` : ''}`;
  }
  return `<div class="kv-grid">
      <div class="kv"><div class="kv-label">BMC login</div><div class="kv-val">${login}</div><div class="ci-status">${loginState}</div>${origin ? `<div>${origin}</div>` : ''}</div>
      <div class="kv span2"><div class="kv-label">Boot NIC</div><div class="kv-val">${nic}${resetBtn(ctx, k('BOOT_MAC'))}</div>${nicHint ? `<div class="cf-hint">${nicHint}</div>` : ''}</div>
      ${m ? `<div class="kv"><div class="kv-label">Host address</div><div class="kv-val ci-status">${ipLine}</div></div>` : ''}
      ${val(ctx, k('ROOT_DEVICE'), 'Install disk', { show: `<span class="mono">${esc(ctx.eff(k('ROOT_DEVICE')) || '/dev/sda')}</span>`, input: { placeholder: '/dev/sda' } })}
    </div>${nicList}`;
}

// Custom DPU worker: every field typed in by hand.
function workerCustom(ctx, n) {
  const k = f => `WORKER_${n}_${f}`;
  const secretType = ctx.ui.reveal.has(k('BMC_PASSWORD')) ? 'text' : 'password';
  const dpuOn = (ctx.eff(k('DPU')) || (ctx.eff('DEPLOYMENT_PROFILE') === 'nno' ? 'false' : 'true')) === 'true';
  return `<div class="ci-sub">Worker ${n}</div><div class="cf-grid">
      ${field(ctx, k('NAME'), 'Node name', bindInput(ctx, k('NAME'), { cls: 'mono' }))}
      ${field(ctx, k('BMC_IP'), 'BMC address', bindInput(ctx, k('BMC_IP'), { cls: 'mono' }))}
      ${field(ctx, k('BMC_USER'), 'BMC user', bindInput(ctx, k('BMC_USER'), { cls: 'mono', placeholder: 'root' }))}
      ${field(ctx, k('BMC_PASSWORD'), 'BMC password', `<div class="ci-row">${bindInput(ctx, k('BMC_PASSWORD'), { cls: 'mono', type: secretType })}<button class="icon-btn" data-reveal-key="${k('BMC_PASSWORD')}" title="Show/hide">${icon('eye', 'sm')}</button></div>`)}
      ${field(ctx, k('BOOT_MAC'), 'Boot MAC', bindInput(ctx, k('BOOT_MAC'), { cls: 'mono', placeholder: 'aa:bb:cc:dd:ee:ff' }))}
      ${field(ctx, k('ROOT_DEVICE'), 'Install disk', bindInput(ctx, k('ROOT_DEVICE'), { cls: 'mono', placeholder: '/dev/sda' }))}
    </div>
    <div class="ci-line">${checkbox(k('DPU'), dpuOn, 'This host has a BlueField DPU')}</div>`;
}

const DPUS_CARD = {
  icon: 'chip',
  title: () => 'DPU hosts',
  sub(ctx) {
    const sel = selectedWorkers(ctx);
    return sel.length ? sel.map(w => w.m?.id || w.name || `worker ${w.n}`).join(', ') : 'None picked';
  },
  render(ctx) {
    const sel = selectedWorkers(ctx), slots = ctx.workerSlots().length;
    if (ctx.adv) {
      const n = sel.length + 1;
      return `${sel.map(w => workerCustom(ctx, w.n)).join('')}
        ${ctx.workerSlots().includes(n) ? `<div class="ci-line"><button class="btn small" data-set="WORKER_COUNT" data-val="${n}">${icon('plus', 'sm')}Add a custom DPU host (worker ${n})</button></div>` : ''}`;
    }
    const d = ctx.machines;
    if (!d) return `<div class="muted small">${spin} Loading lab machines…</div>`;
    const me = d.me || [];
    const byId = Object.fromEntries(sel.filter(w => w.m).map(w => [w.m.id, w]));
    const full = sel.length >= slots;
    const rank = m => byId[m.id] ? 0 : m.broken ? 4 : m.users.some(u => me.includes(u)) ? 1 : !m.users.length ? 2 : 3;
    const row = m => {
      const w = byId[m.id], mine = m.users.some(u => me.includes(u));
      const disabled = !w && (m.broken || !m.bmc || full);
      const why = m.broken ? `Broken${m.notes ? ': ' + m.notes : ''}` : !m.bmc ? 'No BMC address in the lab machine list'
        : full && !w ? `The automation repo only has slots for ${slots} DPU hosts` : '';
      const state = m.broken ? '<span class="sn-badge bad">broken</span>' : m.cluster === 'pending validation' ? '<span class="sn-badge">pending</span>' : m.cluster ? `<span class="sn-badge">${esc(m.cluster)}</span>` : '';
      return `<div class="dh ${w ? 'on' : ''} ${disabled ? 'dis' : ''} ${m.broken ? 'broken' : ''}">
        <label class="dh-row" title="${esc(why)}">
          <input type="checkbox" data-dh="${esc(m.id)}" ${w ? `data-dh-n="${w.n}" checked` : ''} ${disabled ? 'disabled' : ''}>
          <span class="dh-name">${esc(m.id)}</span>${mine ? '<span class="tag">you</span>' : ''}${state}
          <span class="dh-users">${m.users.length ? `${userAvatars(m.users, me)}<span class="small muted">${m.users.map(u => '@' + esc(u)).join(', ')}</span>${m.users.map(ghLink).join('')}` : '<span class="small muted">free</span>'}</span>
          <span class="dh-feats">${(m.features || []).filter(f => f !== 'x86').map(f => `<span class="mach-feat">${esc(f)}</span>`).join('')}</span>
          ${w ? `<span class="dh-links">${m.bmc ? `<a href="https://${esc(m.bmc)}" target="_blank" rel="noopener" title="Open the host’s BMC">BMC ↗</a>` : ''}${m.dpu_bmc ? `<a href="https://${esc(m.dpu_bmc)}" target="_blank" rel="noopener" title="Open the DPU’s BMC">DPU BMC ↗</a>` : ''}</span>` : ''}
        </label>
        ${w ? `<div class="dh-detail">${workerDetails(ctx, w.n, m)}</div>` : ''}
      </div>`;
    };
    // Hosts typed in by hand (not in the lab list) stay visible, checked.
    const custom = sel.filter(w => !w.m).map(w => `<div class="dh on"><label class="dh-row">
        <input type="checkbox" data-dh-n="${w.n}" checked><span class="dh-name">${esc(w.name || `worker ${w.n}`)}</span>
        <span class="small muted">not in the lab list · edit it with ⋯</span></label>
        <div class="dh-detail">${workerDetails(ctx, w.n, null)}</div></div>`).join('');
    const srcLabel = (d.source || '').replace(/^\/home\/[^/]+/, '~');
    const none = sel.length ? '' : `<div class="cf-hint">${icon('info', 'sm')} None picked: the cluster installs without DPU hosts. Tick one to add it.</div>`;
    const csr = ctx.row('AUTO_APPROVE_WORKER_CSR')?.known ? `<div class="ci-line">${checkbox('AUTO_APPROVE_WORKER_CSR', ctx.eff('AUTO_APPROVE_WORKER_CSR') === 'true', 'Approve their certificate requests automatically')}${infoTip('When the DPU hosts join, each asks the cluster for certificates that someone has to approve (oc adm certificate approve). With this on, a CronJob approves every pending request once a minute: all of them, not only the DPU hosts’. (AUTO_APPROVE_WORKER_CSR)')}${resetBtn(ctx, 'AUTO_APPROVE_WORKER_CSR')}</div>` : '';
    return `${none}${hostSubnetLine(ctx)}${csr}<div class="dh-list">${custom}${dpusOf(d).slice().sort((a, b) => rank(a) - rank(b)).map(row).join('')}</div>
      <div class="sn-foot muted small"><span>From <span class="mono">${esc(srcLabel)}</span> · <button class="link-btn" data-dpu-reload>reload</button></span>
        <span>${sel.length} of ${slots} slots used</span></div>`;
  },
  change(e, ctx) {
    const cb = e.target.closest('[data-dh], [data-dh-n]');
    if (!cb) return;
    if (cb.checked) addDpu(ctx, cb.dataset.dh);
    else removeDpu(ctx, +cb.dataset.dhN);
  },
  async click(e, ctx) {
    const rb = e.target.closest('[data-bmc-retry]');
    if (rb) return ctx.relazy(probeKey(ctx, +rb.dataset.bmcRetry));
    const t = e.target.closest('[data-nic-toggle]');
    if (t) { const n = +t.dataset.nicToggle; ctx.ui.nicOpen ??= new Set(); ctx.ui.nicOpen.has(n) ? ctx.ui.nicOpen.delete(n) : ctx.ui.nicOpen.add(n); return ctx.rerender(); }
    if (e.target.closest('[data-dpu-reload]')) { await loadMachines(true); ctx.reanalyze(); }
  },
};

/* ── Cluster address and DNS ────────────────────────────────────────── */

const labDomains = ctx => ctx.machines?.domains || [];

// The bridge the VMs attach to, and its subnet (where the VIPs have to be).
function bridgeInfo(ctx) {
  const name = ctx.eff('BRIDGE_NAME'), b = ctx.facts?.bridges?.[name];
  return { name, ...(b || {}), subnet: (b?.ipv4 || [])[0]?.replace(/\.\d+\/(\d+)$/, '.0/$1') };
}

const CLUSTER_CARD = {
  icon: 'globe',
  title: () => 'Cluster address',
  sub: ctx => ctx.eff('CLUSTER_NAME') && ctx.eff('BASE_DOMAIN') ? `${ctx.eff('CLUSTER_NAME')}.${ctx.eff('BASE_DOMAIN')}` : 'Name and DNS domain',
  render(ctx) {
    const cl = ctx.eff('CLUSTER_NAME') || '', dom = ctx.eff('BASE_DOMAIN') || '';
    const fqdn = cl && dom ? `${cl}.${dom}` : '';
    const sno = num(ctx.eff('VM_COUNT'), 3) === 1;
    // A single-node cluster's address: its VM's, which we only know while the VM runs.
    const me = ctx.machines?.me || [];
    const domains = labDomains(ctx);

    const part = (key, ph, size) => edit(ctx, key, { show: `<span title="${key}">${esc(ctx.eff(key) || '?')}</span>`, input: { cls: 'cl-in', placeholder: ph, size } });
    const name = `<div class="cl-fqdn"><span class="cl-fix">api.</span>${part('CLUSTER_NAME', 'cluster-name', 10)}<span class="cl-fix">.</span>${part('BASE_DOMAIN', 'example.com', 12)}</div>`;

    const domChips = domains.map(dm => {
      const here = dm.cluster === cl && dm.base === dom;
      const mine = dm.users.some(u => me.includes(u)), free = !dm.users.length;
      return `<button class="ci-chip ${here ? 'here' : ''} ${mine ? 'me' : ''} ${!free && !mine ? 'taken' : ''}" ${here ? '' : `data-domain="${esc(dm.id)}"`}
          title="api.${esc(dm.cluster)}.${esc(dm.base)}${dm.purpose ? ` · ${esc(dm.purpose)}` : ''}${dm.users.length ? ` · used by ${dm.users.map(u => '@' + u).join(', ')}` : ' · free'}">
        ${here ? icon('check', 'sm') : icon('globe', 'sm')}<b>${esc(dm.cluster)}</b>
        ${dm.users.length ? `<span class="dpu-users">${userAvatars(dm.users, me)}</span>` : '<span class="muted small">free</span>'}</button>`;
    }).join('');

    // VIPs: two free addresses in the bridge's subnet; multi-node only.
    const br = bridgeInfo(ctx);
    let vips, snoAddr = '';
    if (sno) {
      // Single-node: no VIPs, the cluster answers on its VM's own address, which the lab's DHCP
      // gives the VM's MAC. create-vms derives the MAC from the hypervisor and the VM name, so
      // the app leases that MAC an address from the DHCP before the VM exists and shows it.
      const vmName = `${ctx.eff('VM_PREFIX') || ''}1`, mac = ctx.facts?.vm_macs?.[vmName];
      const seen = ctx.facts?.node_addrs?.[vmName], running = seen?.how === 'running';
      const hv = ctx.facts?.hostname || 'the hypervisor', bridge = ctx.eff('BRIDGE_NAME') || 'br0';
      const lid = `dhcp:${ctx.host}:${bridge}:${mac}`;
      const lease = mac && !running ? ctx.lazy(lid, () => api('POST', ctx.url('dhcp-lease'), { bridge, mac })) : null;
      const leased = lease?.data?.leased ? lease.data : null;
      snoAddr = running ? seen.ip : leased?.ip || '';
      const macHow = ctx.eff('MAC_PREFIX')
        ? `create-vms gives ${vmName} 52:54:00, then MAC_PREFIX (${ctx.eff('MAC_PREFIX')}), then the VM’s number.`
        : `create-vms makes it from ${hv}’s /etc/machine-id and the VM name: 52:54:00 followed by the first 6 hex digits of sha256("&lt;machine-id&gt;-${vmName}"). Another hypervisor or VM name gives another MAC.`;
      let addrHtml;
      if (!mac) addrHtml = `<span class="muted">Waiting for ${esc(hv)}…</span>`;
      else if (running) addrHtml = `<span class="mono">${esc(seen.ip)}</span>${okIcon()}<span class="ci-ok-text small">${esc(vmName)} is running with it</span>`;
      else if (lease?.loading) addrHtml = `${spin}<span class="muted small">Getting an address for this MAC from the lab’s DHCP…</span>`;
      else if (leased) addrHtml = `<span class="mono">${esc(leased.ip)}</span>${okIcon()}<span class="ci-ok-text small">leased to this MAC</span>${infoTip(
        `${hv} asked the lab’s DHCP${leased.server ? ` (${leased.server})` : ''} for an address for ${mac}, the way the VM will, and accepted it: the DHCP holds ${leased.ip} for this MAC${leased.lease_seconds ? ` for ${Math.round(leased.lease_seconds / 60)} minutes` : ''}, and renews it each time you open these settings. When the VM boots and asks with the same MAC, it gets the same address.`)}`;
      else addrHtml = `${badIcon()}<span class="ci-bad-text small">No address from the lab’s DHCP: ${esc(lease?.data?.error || lease?.error || 'no answer')}. The VM will get whatever address the DHCP hands out when it boots.</span> <button class="link-btn" data-relazy="${esc(lid)}">Try again</button>`;
      const before = seen && !running && seen.ip !== snoAddr ? `<div class="cf-hint">Last time ${esc(vmName)} had <span class="mono">${esc(seen.ip)}</span>${seen.how === 'remembered' && seen.seen ? ` (${esc(new Date(seen.seen * 1000).toLocaleDateString())})` : ''}.</div>` : '';
      const unused = ['API_VIP', 'INGRESS_VIP'].filter(k => ctx.eff(k));
      vips = `<div class="ci-sub">Node address${infoTip('A single-node cluster has no VIPs: the API and the apps answer on its VM’s own address, which the VM gets from the lab’s DHCP by its MAC.')}</div>
        <div class="kv-grid">
          <div class="kv"><div class="kv-label">VM</div><div class="kv-val mono">${esc(vmName)}</div></div>
          <div class="kv"><div class="kv-label">MAC</div><div class="kv-val">${mac ? `<span class="mono">${esc(mac)}</span>${infoTip(macHow)}` : '<span class="muted">…</span>'}</div></div>
          <div class="kv"><div class="kv-label">Address</div><div class="kv-val">${addrHtml}</div>${before}</div>
        </div>
        ${unused.length ? `<div class="cf-hint">${unused.join(' and ')} ${unused.length > 1 ? 'are' : 'is'} set, but a single-node cluster doesn’t use ${unused.length > 1 ? 'them' : 'it'}. <button class="link-btn" data-reset="${unused.join(',')}">Clear</button></div>` : ''}`;
    } else {
      const free = ctx.ui.freeIps;
      const sugg = free?.data?.free || [];
      const avoid = new Set([ctx.eff('API_VIP'), ctx.eff('INGRESS_VIP')]);
      const pickable = sugg.filter(ip => !avoid.has(ip));
      vips = `<div class="ci-sub">Virtual IPs${infoTip(`With ${num(ctx.eff('VM_COUNT'), 3)} control-plane VMs the cluster floats two extra addresses between them: one for the API, one for the apps. They must differ and be free (nothing else using them, not handed out by DHCP)${br.subnet ? `, in ${br.name}’s subnet ${br.subnet}` : ''}.`)}</div>
        <div class="cf-grid two">
          ${val(ctx, 'API_VIP', 'API', { input: { cls: 'ci-ip', placeholder: br.subnet ? br.subnet.replace(/0\/\d+$/, 'x') : 'IP address' } })}
          ${val(ctx, 'INGRESS_VIP', 'Apps', { input: { cls: 'ci-ip', placeholder: br.subnet ? br.subnet.replace(/0\/\d+$/, 'x') : 'IP address' } })}
        </div>
        <div class="ci-line">
          ${br.subnet ? `<button class="btn small" data-free-ips ${free?.loading ? 'disabled' : ''}>${free?.loading ? spin : icon('search', 'sm')}Find free addresses in ${esc(br.subnet)}</button>` : ''}
          ${pickable.length >= 2 ? `<button class="ci-chip" data-setmany="${esc(JSON.stringify({ API_VIP: pickable[0], INGRESS_VIP: pickable[1] }))}">Use ${esc(pickable[0])} and ${esc(pickable[1])}</button>${infoTip('These don’t answer ping and aren’t in the hypervisor’s neighbour table, and no lab domain or other profile of yours uses them. A good sign, not a guarantee: check they’re not in a DHCP range.')}` : ''}
          ${free?.data && !pickable.length ? '<span class="muted small">Nothing free found; ask in the lab channel.</span>' : ''}
          ${free?.error || free?.data?.error ? `<span class="ci-bad-text small">${esc(free.error || free.data.error)}</span>` : ''}
        </div>
        `;
    }

    // DNS: what the records must be (information only; we never look these names up, so
    // nothing caches a "doesn't exist" for them before you create them).
    // Where each record has to point: the VIPs, or for single-node the node address.
    const vip = (key, label) => { const v = sno ? snoAddr : ctx.eff(key); return v ? `<span class="mono">${esc(v)}</span>` : `<span class="muted">${sno ? 'the node’s address' : label}</span>`; };
    const recs = fqdn ? [
      [`api.${fqdn}`, vip('API_VIP', 'the API VIP'), 'kubectl, and the DPU hosts and DPUs (OVN reaches the cluster by this name)', `api.${fqdn}`, 'API_VIP'],
      [`api-int.${fqdn}`, vip('API_VIP', 'the API VIP'), 'nodes joining the cluster fetch their ignition here', `api-int.${fqdn}`, 'API_VIP'],
      [`*.apps.${fqdn}`, vip('INGRESS_VIP', 'the apps VIP'), 'the console and OAuth login', `console-openshift-console.apps.${fqdn}`, 'INGRESS_VIP'],
    ] : [];
    // Looked up only when you ask (a lookup before the records exist gets "doesn't exist" cached).
    const chk = ctx.ui.dnsCheck?.fqdn === fqdn ? ctx.ui.dnsCheck : null;
    const status = (probe, key) => {
      if (!chk?.data) return '';
      if (chk.data.error) return '';
      const got = chk.data.records?.[probe] || [];
      // What the record should point at: the VIP, or for single-node the node's address.
      const want = sno ? snoAddr : ctx.eff(key);
      if (!got.length) return `${badIcon()}<span class="ci-bad-text">no record</span>`;
      if (!want) return `<span class="muted">${esc(got.join(', '))}</span>`;
      if (!got.includes(want)) return `${badIcon()}<span class="ci-bad-text">points at ${esc(got.join(', '))}</span>`;
      return `${okIcon()}<span class="ci-ok-text">${esc(got.join(', '))}</span>`;
    };
    const zone = recs.map(([n, , ]) => n).map((n, i) => `${n}.`.padEnd(fqdn.length + 16) + ` IN A ${(sno ? snoAddr : i < 2 ? ctx.eff('API_VIP') : ctx.eff('INGRESS_VIP')) || '<IP>'}`).join('\n');
    const dns = fqdn ? `<div class="ci-sub">DNS records you need${infoTip(`The DPU hosts and DPUs reach the cluster by name, so these have to be in DNS; the automation only adds api.${fqdn} to the hypervisor’s own /etc/hosts.`)}</div>
      <table class="dns-chart"><tbody>${recs.map(([n, t, why, probe, key]) => `<tr><td class="mono">${esc(n)}</td><td class="dns-arrow">→</td><td>${t}</td>
        <td class="dns-why">${infoTip(why)}</td>${chk?.data ? `<td class="dns-status">${status(probe, key)}</td>` : ''}</tr>`).join('')}</tbody></table>
      <div class="ci-line"><button class="btn small" data-dns-check ${chk?.loading ? 'disabled' : ''}
          title="Looks the names up from the hypervisor. Do it once you’ve created the records: asking before that can make DNS servers remember “doesn’t exist” for a while.">
          ${chk?.loading ? spin : icon('search', 'sm')}${chk?.data ? 'Check again' : 'Check DNS now'}</button>
        ${chk?.data?.error || chk?.error ? `<span class="ci-bad-text small">${esc(chk.data?.error || chk.error)}</span>` : infoTip('Do this once the records exist: looking them up earlier can get “doesn’t exist” cached by the DNS servers for a while.')}</div>
      <div class="ci-line"><button class="link-btn" data-copy="${esc(zone)}">${icon('copy', 'sm')}Copy as zone records</button></div>` : '';
    const etcHosts = (ctx.eff('SKIP_ETC_HOSTS') || 'false') !== 'true';
    return `${name}
      ${domains.length ? `<div class="ci-chips"><span class="muted small">Or a lab domain${infoTip('Lab domains already have their DNS records, pointing at their VIPs.')}</span>${domChips}</div>` : ''}
      ${vips}
      ${dns}
      ${ctx.adv ? `<div class="ci-line">${checkbox('SKIP_ETC_HOSTS', etcHosts, `Add <code>api.${esc(fqdn || '…')}</code> to the hypervisor’s /etc/hosts`, { on: 'false', off: 'true' })}</div>` : ''}`;
  },
  async click(e, ctx) {
    const rl = e.target.closest('[data-relazy]');
    if (rl) return ctx.relazy(rl.dataset.relazy);
    if (e.target.closest('[data-dns-check]')) {
      const fqdn = `${ctx.eff('CLUSTER_NAME')}.${ctx.eff('BASE_DOMAIN')}`;
      ctx.ui.dnsCheck = { fqdn, loading: true };
      ctx.rerender();
      const names = [`api.${fqdn}`, `api-int.${fqdn}`, `console-openshift-console.apps.${fqdn}`];
      try { ctx.ui.dnsCheck = { fqdn, data: await api('POST', ctx.url('dns-check'), { names }) }; }
      catch (err) { ctx.ui.dnsCheck = { fqdn, error: err.message }; }
      return ctx.rerender();
    }
    if (e.target.closest('[data-free-ips]')) {
      const br = bridgeInfo(ctx);
      ctx.ui.freeIps = { loading: true };
      ctx.rerender();
      try { ctx.ui.freeIps = { data: await api('POST', ctx.url('free-ips'), { bridge: br.name }) }; }
      catch (err) { ctx.ui.freeIps = { error: err.message }; }
      return ctx.rerender();
    }
    const b = e.target.closest('[data-domain]');
    if (!b) return;
    const dm = labDomains(ctx).find(x => x.id === b.dataset.domain);
    const me = ctx.machines?.me || [];
    if (dm.users.length && !dm.users.some(u => me.includes(u))
        && !window.confirm(`${dm.id} is used by ${dm.users.map(u => '@' + u).join(', ')}. Use it anyway?`)) return;
    ctx.set(dm.values);
    toast(`Using ${dm.id}: api.${dm.cluster}.${dm.base} (not saved yet)`, 'ok');
  },
};

/* ── Pull secrets and SSH key ───────────────────────────────────────── */

const SECRET_SPECS = [
  { key: 'OPENSHIFT_PULL_SECRET', label: 'OpenShift pull secret', need: ['registry.redhat.io'], bf: true, hint: 'Get one from console.redhat.com/openshift/install/pull-secret' },
  { key: 'DPF_PULL_SECRET', label: 'NVIDIA NGC pull secret', need: ['nvcr.io'], hint: 'It needs nvcr.io credentials for the DPF images', dpfOnly: true },
];

const SECRETS_CARD = {
  icon: 'key',
  ownsIssues: true, // each file's chip already says what's wrong with it
  title: () => 'Pull secrets and SSH key',
  sub: ctx => ['OPENSHIFT_PULL_SECRET', 'DPF_PULL_SECRET', 'SSH_KEY'].map(k => (ctx.eff(k) || '').split('/').pop()).filter(Boolean).join(' · '),
  render(ctx) {
    const files = ctx.facts?.files || {};
    const cands = ctx.facts?.secret_files || [];
    const nno = ctx.eff('DEPLOYMENT_PROFILE') === 'nno';
    // The file in use shows its state on the chip itself: ✓ when it's good, ✗ and why when not.
    const fileChip = (key, path, { current = false, problem = '', extra = '' } = {}) => current
      ? `<span class="ci-chip ${problem ? 'bad' : 'here'}" title="${esc(problem || 'In use')}">${icon(problem ? 'alert' : 'check', 'sm')}<span class="mono">${esc(path)}</span>${problem ? `<b class="small">${esc(problem)}</b>` : ''}${extra}</span>`
      : `<button class="ci-chip" data-set="${key}" data-val="${esc(path)}">${icon('file', 'sm')}<span class="mono">${esc(path)}</span>${extra}</button>`;
    // A default file is just shown (with ✎); the other files show when you edit, or when it has a problem.
    const pickOthers = (key, list, problem) => {
      if (problem || isMine(ctx, key) || ctx.ui.editing.has(key)) return list ? `${problem ? '<span class="muted small ci-or">Use instead:</span>' : ''}${list}` : '';
      return list ? `<button class="vc-btn" data-vedit="${key}" title="Pick another file">${icon('edit', 'sm')}</button>` : '';
    };
    const defaultNote = key => isMine(ctx, key) ? '' : ` The automation repo’s default is ${ctx.row(key)?.default || '?'}.`;
    // The file the setting names now (relative paths are in the automation repo), and what the
    // hypervisor last said about it; that's stale for a moment after you pick another one.
    const current = key => {
      const v = ctx.eff(key) || '';
      const path = !v || v.startsWith('/') || v.startsWith('~/') ? v : `${(ctx.dir || '').replace(/\/$/, '')}/${v.replace(/^\.\//, '')}`;
      const f = files[key];
      const fresh = f && (f.path === path || (path.startsWith('~/') && f.path.endsWith(path.slice(1))));
      return { path: fresh ? f.path : path, f: fresh ? f : null };
    };
    const checking = path => `<span class="ci-chip here" title="Checking it on the hypervisor">${spin}<span class="mono">${esc(path)}</span></span>`;
    // The cluster pulls the BlueField image with the OpenShift pull secret, so each file is asked
    // whether it can read that repo (the registry's answer, shared with the versions card).
    const bf = ctx.eff('BLUEFIELD_OCP_IMAGE') || '', bfRepo = bf.includes(':') ? bf.slice(0, bf.lastIndexOf(':')) : bf;
    const readsBf = path => {
      if (!path || !/^[a-z0-9.\-]+\/.+/.test(bfRepo)) return null;
      const t = ctx.lazy(`tags:${ctx.host}:${bfRepo}:${path}`, () => api('GET', ctx.url(`image-tags?repo=${encodeURIComponent(bfRepo)}&authfile=${encodeURIComponent(path)}`)));
      if (t.loading) return 'checking';
      if (t.data?.tags) return 'yes';
      return /unauthori[sz]ed|denied/i.test(t.data?.error || t.error || '') ? 'no' : null;
    };
    const bfShort = bfRepo.split('/').slice(1).join('/');
    const secretRow = s => {
      if (s.dpfOnly && nno) return `<div class="kv"><div class="kv-label">${s.label}</div><div class="kv-val muted">Not used by the nno profile</div></div>`;
      const { path: curPath, f } = current(s.key);
      const auths = f?.auths || [];
      const missing = s.need.filter(r => !auths.includes(r));
      const bfOk = s.bf && f?.json ? readsBf(f.path) : null;
      const problem = !f ? '' : !f.exists ? 'missing' : !f.json ? 'not valid JSON' : missing.length ? `no ${missing.join(', ')}`
        : bfOk === 'no' ? `can’t pull ${bfShort}` : '';
      const extra = f?.exists && !problem && auths.length > s.need.length ? `<span class="muted small" title="${esc(auths.join('\n'))}">${auths.length} registr${auths.length === 1 ? 'y' : 'ies'}</span>` : '';
      // Only files with the right credentials are offered; each says whether it can pull the BlueField image.
      const good = cands.filter(c => s.need.every(r => (c.auths || []).includes(r)) && c.path !== curPath);
      const chips = good.map(c => {
        const reads = s.bf ? readsBf(c.path) : null;
        const n = (c.auths || []).length;
        return fileChip(s.key, c.path, { extra: reads === 'no' ? `<span class="ci-bad-text small" title="${esc(`Can’t read ${bfRepo}, which BLUEFIELD_OCP_IMAGE is pulled from`)}">can’t pull ${esc(bfShort)}</span>`
          : reads === 'checking' ? spin : `<span class="muted small">${n} registr${n === 1 ? 'y' : 'ies'}</span>` });
      }).join('');
      if (ctx.adv) return field(ctx, s.key, s.label, `${bindInput(ctx, s.key)}${problem ? `<div class="ci-status">${badIcon()}<span class="ci-bad-text">${esc(problem)}</span></div>` : ''}`);
      return `<div class="kv"><div class="kv-label">${s.label}${infoTip(`${s.hint}.${defaultNote(s.key)}`)}</div>
        <div class="ci-chips">${f ? fileChip(s.key, f.path, { current: true, problem, extra }) : checking(curPath)}${resetBtn(ctx, s.key)}${pickOthers(s.key, chips, problem)}</div>
        ${problem && !good.length ? `<div class="cf-hint">No file in /root/secrets has ${esc(s.need.join(', '))} credentials. ${s.hint}, put it there and reload.</div>` : ''}</div>`;
    };
    const { path: keyPath, f: kf } = current('SSH_KEY');
    const keys = (ctx.facts?.ssh_keys || []).filter(x => x.path !== keyPath);
    const keyProblem = !kf ? '' : !kf.exists ? 'missing' : !kf.path.endsWith('.pub') ? 'not a .pub key' : '';
    const keyChips = keys.map(x => fileChip('SSH_KEY', x.path, { extra: `<span class="muted small" title="${esc(x.comment)}">${esc(x.type.replace('ssh-', ''))}</span>` })).join('');
    const keyRow = ctx.adv ? field(ctx, 'SSH_KEY', 'SSH public key', `${bindInput(ctx, 'SSH_KEY', { cls: 'mono' })}${keyProblem ? `<div class="ci-status">${badIcon()}<span class="ci-bad-text">${esc(keyProblem)}</span></div>` : ''}`)
      : `<div class="kv"><div class="kv-label">SSH public key${infoTip(`Installed on the cluster nodes, so the matching private key can ssh in as core.${isMine(ctx, 'SSH_KEY') ? '' : ' The automation repo’s default is ~/.ssh/id_ed25519.pub: the key of the user the automation runs as on the hypervisor (root), so you ssh to the nodes from there.'}`)}</div>
        <div class="ci-chips">${kf ? fileChip('SSH_KEY', kf.path, { current: true, problem: keyProblem }) : checking(keyPath)}${resetBtn(ctx, 'SSH_KEY')}${pickOthers('SSH_KEY', keyChips, keyProblem)}</div>
</div>`;
    return `<div class="cf-stack">${SECRET_SPECS.map(secretRow).join('')}${keyRow}</div>`;
  },
};

/* ── VMs: names and resources ───────────────────────────────────────── */

const VM_KEYS = ['VM_PREFIX', 'VM_COUNT', 'RAM', 'VCPUS', 'DISK_SIZE1', 'DISK_SIZE2', 'DISK_PATH',
  'VM_WORKER_COUNT', 'VM_WORKER_PREFIX', 'VM_WORKER_RAM', 'VM_WORKER_VCPUS', 'VM_WORKER_DISK_SIZE1', 'VM_WORKER_DISK_SIZE2'];

const VMS_CARD = {
  click(e, ctx) {
    const d = e.target.closest('[data-done]');
    if (d) { ctx.ui.editing.delete(d.dataset.done); ctx.rerender(); }
  },
  icon: 'server',
  title: () => 'Management cluster VMs',
  sub(ctx) {
    const n = num(ctx.eff('VM_COUNT'), 3), w = num(ctx.eff('VM_WORKER_COUNT'));
    return `${n === 1 ? 'Single-node OpenShift' : `${n} control-plane VMs`}${w ? ` + ${w} worker VM${w > 1 ? 's' : ''}` : ''} on ${ctx.facts?.hostname?.split('.')[0] || 'the hypervisor'}`;
  },
  render(ctx) {
    const f = ctx.facts || {}, vms = f.vms || {};
    const prefix = ctx.eff('VM_PREFIX') || '', count = num(ctx.eff('VM_COUNT'), 3);
    const wcount = num(ctx.eff('VM_WORKER_COUNT')), wprefix = ctx.eff('VM_WORKER_PREFIX') || `${prefix}-worker`;
    const login = ((ctx.machines?.me || ctx.subnets?.me || [])[0] || '').toLowerCase();

    // Names
    const names = Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
    const wnames = Array.from({ length: wcount }, (_, i) => `${wprefix}${i + 1}`);
    const expected = new Set([...names, ...wnames]);
    const chip = n => { const st = vms[n]?.state || 'not created'; return `<span class="vm-chip ${st.replace(' ', '')}" title="${esc(st)}"><span class="dot ${esc(st.replace(' ', ''))}"></span>${esc(n)}</span>`; };
    const doomed = prefix ? Object.keys(vms).filter(n => n.startsWith(prefix) && !expected.has(n)).sort() : [];
    const prefixCtl = val(ctx, 'VM_PREFIX', 'Name prefix', { hint: login ? '' : 'Pick who you are in the sidebar to put your GitHub login in it.' });
    const namesHtml = `
      <div class="cf-grid two">
        ${prefixCtl}
        <div class="kv"><div class="kv-label">Control-plane VMs</div><div class="kv-val">${segmented('VM_COUNT', count, [[1, '1 · single-node'], [3, '3 · HA']])}
          ${![1, 3].includes(count) ? `<span class="mono">${count}</span>` : ''}${resetBtn(ctx, 'VM_COUNT')}</div>
</div>
      </div>
      ${bridgeLine(ctx)}
      <div class="cf-hint vm-names">${icon('server', 'sm')} Creates ${[...names, ...wnames].map(n => `<span class="mono">${esc(n)}</span>${vms[n] ? ` <span class="muted">(exists, ${esc(vms[n].state)})</span>` : ''}`).join(', ')} on ${esc(f.hostname?.split('.')[0] || 'the hypervisor')}.</div>
      ${doomed.length ? `<div class="ov-issue warn">${icon('alert', 'sm')}<span><b>make clean-all</b> deletes every VM whose name starts with <code>${esc(prefix)}</code>, so also ${doomed.map(n => `<code>${esc(n)}</code>`).join(', ')}${doomed.some(n => vms[n].state === 'running') ? ' (running)' : ''}.</span></div>` : ''}`;

    // Sizes: presets, typed values only in custom mode.
    const ram = num(ctx.eff('RAM')), vcpus = num(ctx.eff('VCPUS')), d1 = num(ctx.eff('DISK_SIZE1')), d2 = num(ctx.eff('DISK_SIZE2'));
    const gib = v => `${+(v / GIB).toFixed(1)} GiB`;
    const sizes = `<div class="cf-grid sizes">
      ${choice(ctx, 'RAM', 'Memory per VM', [32, 41, 48, 64, 96].map(g => [g * GIB, `${g} GiB`]), { fmt: v => gib(num(v)),
        info: count === 1 ? 'A single node runs the whole management cluster; give it more than the default if the hypervisor has room.' : 'The default suits most deployments.',
        input: `<div class="ci-row">${bindInput(ctx, 'RAM', { cls: 'mono ci-num', scale: GIB })}<span class="ov-unit">GiB</span></div>` })}
      ${choice(ctx, 'VCPUS', 'vCPUs per VM', [8, 14, 16, 24, 32], { info: 'The default suits most deployments; vCPUs can be overcommitted.', input: bindInput(ctx, 'VCPUS', { cls: 'mono ci-num' }) })}
      ${choice(ctx, 'DISK_SIZE1', 'OS disk', [120, 200, 300].map(g => [g, `${g} GiB`]), { fmt: v => `${esc(v)} GiB`, info: 'Thin-provisioned, so a bigger disk costs nothing until it fills up.',
        input: `<div class="ci-row">${bindInput(ctx, 'DISK_SIZE1', { cls: 'mono ci-num' })}<span class="ov-unit">GiB</span></div>` })}
      ${choice(ctx, 'DISK_SIZE2', 'Data disk', [80, 120, 200].map(g => [g, `${g} GiB`]), { fmt: v => `${esc(v)} GiB`, info: 'etcd storage of the hosted cluster',
        input: `<div class="ci-row">${bindInput(ctx, 'DISK_SIZE2', { cls: 'mono ci-num' })}<span class="ov-unit">GiB</span></div>` })}
      ${choice(ctx, 'VM_WORKER_COUNT', 'Extra worker VMs', [[0, 'none'], 1, 2, 3], { fmt: v => String(v) === '0' ? 'none' : esc(v), info: 'Day-2 workers next to the control plane; not the DPU hosts.', input: bindInput(ctx, 'VM_WORKER_COUNT', { cls: 'mono ci-num' }) })}
      ${ctx.adv ? field(ctx, 'DISK_PATH', 'Disk directory', bindInput(ctx, 'DISK_PATH', { cls: 'mono' })) : ''}
    </div>
    ${ctx.adv && wcount ? `<div class="ci-sub">Worker VMs</div><div class="cf-grid four">
      ${field(ctx, 'VM_WORKER_RAM', 'Memory each', `<div class="ci-row">${bindInput(ctx, 'VM_WORKER_RAM', { cls: 'mono ci-num', scale: GIB })}<span class="ov-unit">GiB</span></div>`)}
      ${field(ctx, 'VM_WORKER_VCPUS', 'vCPUs each', bindInput(ctx, 'VM_WORKER_VCPUS', { cls: 'mono ci-num' }))}
      ${field(ctx, 'VM_WORKER_PREFIX', 'Name prefix', bindInput(ctx, 'VM_WORKER_PREFIX', { cls: 'mono' }))}
    </div>` : ''}`;

    // What it all takes on the hypervisor
    const wram = num(ctx.eff('VM_WORKER_RAM'), ram), wvcpus = num(ctx.eff('VM_WORKER_VCPUS'), vcpus);
    const wd = num(ctx.eff('VM_WORKER_DISK_SIZE1'), d1) + num(ctx.eff('VM_WORKER_DISK_SIZE2'), d2);
    const mine = new Set(f.my_running_vms || []);
    const myMem = count * ram + wcount * wram, myCpu = count * vcpus + wcount * wvcpus, myDisk = count * (d1 + d2) + wcount * wd;
    let memBar = '', cpuBar = '', diskBar = '';
    if (f.mem_total_kib) {
      const total = f.mem_total_kib / 1024;
      const myRunning = [...mine].reduce((a, n) => a + (vms[n]?.mem_kib || 0) / 1024, 0);
      const othersVms = Object.entries(vms).filter(([n, v]) => v.state === 'running' && !mine.has(n)).reduce((a, [, v]) => a + v.mem_kib / 1024, 0);
      const usedNow = total - (f.mem_available_kib || 0) / 1024 - myRunning;
      memBar = usageBar(total, [
        { value: othersVms, cls: 'others', label: 'Other VMs' },
        { value: Math.max(0, usedNow - othersVms), cls: 'host', label: 'Host' },
        { value: myMem, cls: 'mine', label: `Yours (${count}${wcount ? `+${wcount}` : ''} × ${fmtGiB(ram)})` },
      ], fmtGiB);
    }
    if (f.cpus) {
      const others = Object.entries(vms).filter(([n, v]) => v.state === 'running' && !mine.has(n)).reduce((a, [, v]) => a + v.vcpus, 0);
      cpuBar = usageBar(f.cpus, [{ value: others, cls: 'others', label: 'Other VMs' }, { value: myCpu, cls: 'mine', label: 'Yours' }], v => `${Math.round(v)} vCPU`, { overcommit: true });
    }
    const disk = f.disk?.DISK_PATH;
    if (disk) {
      const G = 1024 ** 3, total = disk.total / G;
      diskBar = usageBar(total, [{ value: total - disk.free / G, cls: 'others', label: 'Used' }, { value: myDisk, cls: 'mine', label: 'Yours at most' }], v => `${Math.round(v)} GiB`);
    }
    return `${namesHtml}
      ${sizes}
      <div class="ci-sub">On ${esc(f.hostname?.split('.')[0] || 'the hypervisor')}</div>
      <div class="ub-grid">
        ${memBar ? `<div><div class="ub-label">Memory</div>${memBar}</div>` : ''}
        ${cpuBar ? `<div><div class="ub-label">vCPUs${infoTip('vCPUs can be overcommitted: more than the host has is normal.')}</div>${cpuBar}</div>` : ''}
        ${diskBar ? `<div><div class="ub-label">Disk in <span class="mono">${esc(ctx.eff('DISK_PATH') || '')}</span> ${infoTip('Thin-provisioned: this is the most the disks can grow to.')}</div>${diskBar}</div>` : ''}
        ${!memBar && !cpuBar ? `<div class="muted small">${spin} Asking the hypervisor…</div>` : ''}
      </div>`;
  },
};

/* ── OpenShift versions ─────────────────────────────────────────────── */

const RELEASE_REPO = 'quay.io/openshift-release-dev/ocp-release';

function versionSelect(attr, cur, versions) {
  const bases = [...new Set(versions.map(v => v.replace(/-multi$/, '')))].sort(cmpVer).reverse();
  const minors = [...new Set(bases.map(minorOf))].slice(0, 4);
  if (cur && !minors.includes(minorOf(cur))) minors.push(minorOf(cur));
  const latest = mi => bases.find(b => minorOf(b) === mi && !/-(ec|rc)/.test(b));
  const groups = minors.map(mi => `<optgroup label="${esc(mi)}">${bases.filter(v => minorOf(v) === mi)
    .map(v => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(v)}${v === latest(mi) ? ' (latest)' : ''}</option>`).join('')}</optgroup>`).join('');
  const known = bases.includes(cur);
  return `<select class="input mono ci-ver" ${attr}>${!known ? `<option value="${esc(cur || '')}" selected>${esc(cur || 'choose…')}${cur ? ' (not offered)' : ''}</option>` : ''}${groups}</select>`;
}

function newerPatch(cur, versions) {
  const same = versions.map(v => v.replace(/-multi$/, '')).filter(v => minorOf(v) === minorOf(cur) && !/-(ec|rc)/.test(v));
  const best = same.sort(cmpVer).pop();
  return best && cmpVer(best, cur) > 0 ? best : null;
}

const VERSIONS_CARD = {
  icon: 'tag',
  title: () => 'OpenShift versions',
  sub(ctx) {
    const m = (ctx.eff('OPENSHIFT_VERSION') || '').replace(/-multi$/, '');
    const h = (/:(\d+\.\d+\.\d+[^-\s]*)/.exec(ctx.eff('OCP_RELEASE_IMAGE') || '') || [])[1];
    return `Management ${m || '?'} · hosted DPU cluster ${h || '?'}`;
  },
  render(ctx) {
    const vers = ctx.lazy(`ocp-versions:${ctx.host}`, () => api('GET', ctx.url('ocp-versions')));
    const list = vers.data?.versions || [];
    const mgmt = ctx.eff('OPENSHIFT_VERSION') || '', mBase = mgmt.replace(/-multi$/, ''), multi = mgmt.endsWith('-multi');
    const rel = ctx.eff('OCP_RELEASE_IMAGE') || '';
    const relM = rel.startsWith(RELEASE_REPO + ':') ? /^(.+?)(-multi|-x86_64|-aarch64)?$/.exec(rel.slice(RELEASE_REPO.length + 1)) : null;
    const hosted = relM?.[1] || (/:(\d+\.\d+\.\d+[^-\s]*)/.exec(rel) || [])[1] || '';
    const bf = ctx.eff('BLUEFIELD_OCP_IMAGE') || '';
    const [bfRepo, bfTag] = bf.includes(':') ? [bf.slice(0, bf.lastIndexOf(':')), bf.slice(bf.lastIndexOf(':') + 1)] : [bf, ''];
    const bfVer = (/^(\d+\.\d+\.\d+)/.exec(bfTag) || [])[1];
    const bfb = ctx.eff('BFB_URL') || '', bfbName = bfb.split('/').pop(), bfbDir = bfb.slice(0, bfb.length - bfbName.length);

    const kvSel = (label, key, control, hint, show, info = '') => {
      const open = isMine(ctx, key) || ctx.ui.editing.has(key);
      return `<div class="kv"><div class="kv-label">${label}${infoTip(info)}</div><div class="kv-val">${open ? `${control}${resetBtn(ctx, key)}`
        : `<span class="vc def">${show}<button class="vc-btn" data-vedit="${key}" title="Change (${esc(key)})">${icon('edit', 'sm')}</button></span>`}</div>${hint ? `<div class="cf-hint">${hint}</div>` : ''}</div>`;
    };
    const loading = vers.loading ? `${spin}<span class="muted small">Asking Assisted Installer which versions it offers…</span>` : '';
    const vErr = vers.error ? `<span class="ci-bad-text">Couldn't list versions: ${esc(vers.error)}</span>` : '';

    // Management cluster
    const mNewer = list.length && newerPatch(mBase, list);
    const mgmtRow = ctx.adv ? field(ctx, 'OPENSHIFT_VERSION', 'Management cluster', bindInput(ctx, 'OPENSHIFT_VERSION', { cls: 'mono' }), '-multi also creates an arm64 InfraEnv.')
      : kvSel('Management cluster', 'OPENSHIFT_VERSION', list.length ? versionSelect('data-ver="mgmt"', mBase, list) : `<span class="mono">${esc(mgmt)}</span>${loading}`,
        `${mNewer ? `<button class="link-btn" data-setver="mgmt" data-val="${esc(mNewer)}">Newer patch: ${esc(mNewer)}</button>` : ''}${vErr}`,
        `<span class="mono">${esc(mBase)}</span>`, `The versions Assisted Installer offers${multi ? ' (multi-arch)' : ''}.`);

    // Hosted cluster
    const hNewer = relM && list.length && newerPatch(hosted, list);
    const hostedRow = ctx.adv ? field(ctx, 'OCP_RELEASE_IMAGE', 'Hosted DPU cluster release', bindInput(ctx, 'OCP_RELEASE_IMAGE', { cls: 'mono' }))
      : kvSel('Hosted DPU cluster', 'OCP_RELEASE_IMAGE', relM && list.length ? versionSelect('data-ver="hosted"', hosted, list) : `<span class="mono">${esc(relM ? hosted : rel)}</span>${relM ? loading : ''}`,
        `${hNewer ? `<button class="link-btn" data-setver="hosted" data-val="${esc(hNewer)}">Newer patch: ${esc(hNewer)}</button>` : ''}${relM ? '' : `<button class="link-btn" data-setver="hosted" data-val="${esc(mBase)}">Use the official ${esc(mBase)} release</button>`}`,
        `<span class="mono">${esc(relM ? hosted : rel)}</span>`, 'The release the DPUs run; keep the BlueField image on the same version.');

    // BlueField image tags from the registry, read with your OpenShift pull secret.
    const authfile = ctx.facts?.files?.OPENSHIFT_PULL_SECRET?.path || ctx.eff('OPENSHIFT_PULL_SECRET') || '';
    let bfCtl = `<span class="mono">${esc(bf)}</span>`, bfHint = '';
    if (bfRepo && /^[a-z0-9.\-]+\/.+/.test(bfRepo)) {
      const tags = ctx.lazy(`tags:${ctx.host}:${bfRepo}:${authfile}`, () => api('GET', ctx.url(`image-tags?repo=${encodeURIComponent(bfRepo)}&authfile=${encodeURIComponent(authfile)}`)));
      if (tags.data?.tags) {
        const all = tags.data.tags.slice().sort((a, b) => cmpVer(b, a));
        const matching = all.filter(t => hosted && t.startsWith(hosted));
        const opts = t => `<option value="${esc(t)}" ${t === bfTag ? 'selected' : ''}>${esc(t)}</option>`;
        bfCtl = `<select class="input mono ci-ver" data-bf-repo="${esc(bfRepo)}" title="${esc(bfRepo)}">
          ${!all.includes(bfTag) ? `<option selected>${esc(bfTag)}</option>` : ''}
          ${matching.length ? `<optgroup label="Built for ${esc(hosted)}">${matching.map(opts).join('')}</optgroup>` : ''}
          <optgroup label="All tags">${all.filter(t => !matching.includes(t)).map(opts).join('')}</optgroup></select>`;
        bfHint = '';
        if (hosted && !matching.length) bfHint += `No tag there starts with ${esc(hosted)}.`;
        else if (hosted && bfVer !== hosted) bfHint += `<div class="ci-chips">${matching.slice(0, 4).map(t => `<button class="ci-chip" data-set="BLUEFIELD_OCP_IMAGE" data-val="${esc(bfRepo)}:${esc(t)}">${icon('check', 'sm')}Use <span class="mono">${esc(t)}</span></button>`).join('')}</div>`;
      } else if (tags.data?.error) {
        bfHint = /unauthori[sz]ed|denied/i.test(tags.data.error)
          ? `<span class="ci-bad-text">Your OpenShift pull secret can’t read ${esc(bfRepo)}, so its tags can’t be listed (and the DPUs may not be able to pull it).</span> <button class="link-btn" data-tab-id="secrets">Check the pull secret</button>`
          : `<span class="muted">Couldn’t list the tags of ${esc(bfRepo)}: ${esc(tags.data.error.replace(/^.*msg="?/, '').replace(/"$/, ''))}</span>`;
      } else if (tags.loading) bfHint = `${spin} Listing tags of ${esc(bfRepo)}…`;
    }
    const bfRow = ctx.adv ? field(ctx, 'BLUEFIELD_OCP_IMAGE', 'BlueField OCP image', bindInput(ctx, 'BLUEFIELD_OCP_IMAGE', { cls: 'mono' }))
      : kvSel('BlueField OCP image', 'BLUEFIELD_OCP_IMAGE', bfCtl, bfHint, `<span class="mono">${esc(bf)}</span>`);

    // BFB: the files next to the current one, when the server lists its directory.
    let bfbRow;
    if (ctx.adv) bfbRow = field(ctx, 'BFB_URL', 'BFB the DPUs are flashed with', bindInput(ctx, 'BFB_URL', { cls: 'mono' }));
    else {
      // Shown as its file name; the full URL is one click away. Editing offers the files of its
      // directory when the server lists them, or else the URL itself.
      const open = bfb ? `<a class="icon-link" href="${esc(bfb)}" target="_blank" rel="noopener" title="Open ${esc(bfb)}">${icon('external', 'sm')}</a>` : '';
      const show = `<span class="mono" title="${esc(bfb)}">${esc(bfbName) || '<span class="muted">not set</span>'}</span>${open}`;
      let ctl = bindInput(ctx, 'BFB_URL', { cls: 'mono', placeholder: 'https://…/….bfb' }), hint = '';
      if (/^https?:\/\//.test(bfbDir)) {
        const ls = ctx.lazy(`bfb:${bfbDir}`, () => api('GET', `/api/bfb-files?url=${encodeURIComponent(bfbDir)}`));
        const files = ls.data?.files || [];
        if (files.length) {
          ctl = `<select class="input mono ci-ver" data-bfb-dir="${esc(bfbDir)}">${!files.some(x => x.name === bfbName) ? `<option selected>${esc(bfbName)}</option>` : ''}
            ${files.map(x => `<option value="${esc(x.name)}" ${x.name === bfbName ? 'selected' : ''}>${esc(x.name)}${x.date ? ` · ${esc(x.date)}` : ''}</option>`).join('')}</select>`;
          hint = `From <a href="${esc(bfbDir)}" target="_blank" rel="noopener" class="mono">${esc(bfbDir.replace(/^https?:\/\//, ''))}</a>. `;
        }
      }
      if (hosted && bfbName && !bfbName.includes(minorOf(hosted))) hint += 'The file name doesn’t say which OpenShift it’s for; make sure it matches the hosted cluster.';
      bfbRow = kvSel('BFB the DPUs are flashed with', 'BFB_URL', ctl, hint, show);
    }

    const match = (a, b) => a && b ? (a === b ? okIcon('same version') : badIcon(`${a} ≠ ${b}`)) : '';
    const strip = `<div class="ver-strip">
      <div class="ver-node"><span class="ver-label">Management cluster</span><b class="mono">${esc(mBase || '?')}</b></div>
      <div class="ver-node"><span class="ver-label">Hosted DPU cluster</span><b class="mono">${esc(hosted || '?')}</b></div>
      <div class="ver-link">${match(hosted, bfVer)}</div>
      <div class="ver-node"><span class="ver-label">BlueField OCP image</span><b class="mono">${esc(bfVer || bfTag || '?')}</b></div>
    </div>`;
    return `${strip}<div class="kv-grid wide">${mgmtRow}${hostedRow}${bfRow}${bfbRow}</div>`;
  },
  click(e, ctx) {
    const b = e.target.closest('[data-setver]');
    if (b) setVersion(ctx, b.dataset.setver, b.dataset.val);
  },
  change(e, ctx) {
    const sel = e.target.closest('[data-ver]');
    if (sel) return setVersion(ctx, sel.dataset.ver, sel.value);
    const bf = e.target.closest('[data-bf-repo]');
    if (bf) return ctx.set({ BLUEFIELD_OCP_IMAGE: `${bf.dataset.bfRepo}:${bf.value}` });
    const bfb = e.target.closest('[data-bfb-dir]');
    if (bfb) return ctx.set({ BFB_URL: bfb.dataset.bfbDir + bfb.value });
  },
};

function setVersion(ctx, which, v) {
  if (which === 'mgmt') {
    const multi = (ctx.eff('OPENSHIFT_VERSION') || '-multi').endsWith('-multi');
    ctx.set({ OPENSHIFT_VERSION: v + (multi ? '-multi' : '') });
  } else {
    ctx.set({ OCP_RELEASE_IMAGE: `${RELEASE_REPO}:${v}-multi` });
  }
}

/* ── Hypervisor network: not a page of its own ──────────────────────── */
// The bridge, its MTU and the DPU host subnet all follow from the hypervisor and the DPU hosts,
// so they're filled in and shown where they come from (the VMs and DPU hosts tabs).

// One line: the bridge the VMs attach to and the MTU; ✎ to pick another.
function bridgeLine(ctx) {
  const bridges = ctx.facts?.bridges || {};
  const cur = ctx.eff('BRIDGE_NAME'), mtu = num(ctx.eff('NODES_MTU')), br = bridges[cur];
  const mine = isMine(ctx, 'BRIDGE_NAME') || isMine(ctx, 'NODES_MTU');
  if (ctx.ui.editing.has('BRIDGE_NAME')) {
    const tiles = Object.entries(bridges).map(([n, b]) => `<div class="sn-slot br-slot ${n === cur ? 'here' : 'pickable'}" ${n === cur ? '' : `data-set="BRIDGE_NAME" data-val="${esc(n)}"`}>
        <div class="sn-who"><div class="sn-name">${esc(n)}${b.state !== 'up' ? `<span class="sn-badge">${esc(b.state || '?')}</span>` : ''}</div>
          <div class="sn-sub mono">${esc((b.ipv4 || []).join(', ') || 'no IPv4')} · MTU ${b.mtu}</div></div>
        ${n === cur ? `<span class="sn-check">${icon('check', 'sm')}</span>` : ''}</div>`).join('');
    return `<div class="kv"><div class="kv-label">Bridge and MTU</div><div class="dpu-grid">${tiles}</div>
      <div class="ci-line">MTU ${segmented('NODES_MTU', mtu, [[1500, '1500'], [9000, '9000']])}${resetBtn(ctx, 'BRIDGE_NAME', 'NODES_MTU')}
        <span class="spacer"></span><button class="link-btn" data-done="BRIDGE_NAME">Done</button></div></div>`;
  }
  const where = br ? `<span class="mono">${esc(cur)}</span> <span class="muted">(${esc((br.ipv4 || []).join(', ') || 'no IPv4')})</span>`
    : `<span class="mono">${esc(cur || '?')}</span> ${ctx.facts ? `<span class="ci-bad-text">${badIcon()} not on this hypervisor</span>` : ''}`;
  const mtuNote = br && mtu > br.mtu ? ` <span class="ci-bad-text">${badIcon()} the bridge only carries ${br.mtu}</span>` : '';
  return `<div class="cf-hint vm-names">${icon('network', 'sm')} Attached to ${where} with MTU <span class="mono">${mtu}</span>${mtuNote}
    ${mine ? resetBtn(ctx, 'BRIDGE_NAME', 'NODES_MTU') : ''}<button class="vc-btn" data-vedit="BRIDGE_NAME" title="Pick another bridge or MTU">${icon('edit', 'sm')}</button></div>`;
}

// The DPU hosts' subnet, and the one their addresses are in (the server works it out: ops.host_subnet).
function hostSubnetLine(ctx) {
  const cur = ctx.eff('DPU_HOST_CIDR'), cidr = ctx.hostSubnet, sel = selectedWorkers(ctx);
  if (!sel.length) return '';
  const ips = sel.map(w => w.m && hostIp(ctx, w.m.address));
  const pending = ips.some(ip => ip === undefined);
  const outside = sel.filter((w, i) => ips[i] && cur && !ipInCidr(ips[i], cur));
  const state = pending ? `${spin}<span class="muted">working out their subnet…</span>`
    : outside.length ? `${badIcon()}<span class="ci-bad-text">${outside.map(w => esc(w.m?.id || w.name)).join(', ')} outside it</span>${cidr ? ` <button class="link-btn" data-set="DPU_HOST_CIDR" data-val="${esc(cidr)}">Use ${esc(cidr)}</button>` : ''}`
    : cur ? '' : '<span class="muted">set it on “Everything else” (DPU_HOST_CIDR)</span>';
  return `<div class="cf-hint vm-names">${icon('network', 'sm')} Their subnet: ${cur ? `<span class="mono">${esc(cur)}</span>` : '<span class="muted">unknown</span>'} ${state}</div>`;
}

/* ── HBN slot (VTEP_CIDR) ───────────────────────────────────────────── */

const HBN_CARD = {
  icon: 'layers',
  ownsIssues: true, // the status line says it
  title: () => 'HBN slot',
  sub: ctx => isMine(ctx, 'VTEP_CIDR') ? ctx.eff('VTEP_CIDR') : 'No slot',
  render(ctx) {
    const d = ctx.subnets, cur = ctx.eff('VTEP_CIDR');
    if (!d) return `<div class="muted small">${spin} Loading the HBN switch allocations…</div>`;
    if (d.error) return `<div class="ov-issue error">${icon('alert', 'sm')}<span>Couldn't load the HBN switch allocations: ${esc(d.error)}</span></div>`;
    const me = d.me || [];
    const slots = d.subnets.flatMap(sub => sub.slots.map(s => ({ ...s, subnet: sub.id })));
    const hosts = Math.max(ctx.workerCount(), 1);
    // Your slots (a /29 each, room for one DPU host), plus adjacent ones together as one bigger range.
    const options = d.options || [];
    const curSlot = slots.find(s => s.cidr === cur);
    const curOpt = options.find(o => o.cidr === cur);
    let status;
    if (curOpt) status = `${okIcon()}<span>Using ${curOpt.room > 1 ? `${curOpt.room} of your slots` : 'your slot'}</span><span class="dpu-users">${userAvatars(curOpt.owners, me)}</span><span><span class="mono">${esc(cur)}</span>${curOpt.room < hosts ? ` <span class="ci-bad-text">: room for ${curOpt.room} DPU host${curOpt.room > 1 ? 's' : ''}, you picked ${hosts}</span>` : ''}</span>`;
    else if (curSlot?.owner) status = `${badIcon()}<span class="ci-bad-text"><span class="mono">${esc(cur)}</span> is ${curSlot.kind === 'ci' ? `reserved for ${esc(curSlot.owner)} CI` : `@${esc(curSlot.owner)}’s slot`}</span>`;
    else if (curSlot) status = `${badIcon()}<span class="ci-bad-text"><span class="mono">${esc(cur)}</span> is a free slot, not yours: request it first</span>`;
    else if (!isMine(ctx, 'VTEP_CIDR')) status = !ctx.workerCount()
      ? `<span class="muted">No slot. You don’t need one without DPU hosts.</span>`
      : `${badIcon()}<span class="ci-bad-text">No slot picked. Your DPUs need one: without it they use addresses that can clash with other people’s on the shared switch.</span>`;
    else status = `${badIcon()}<span class="ci-bad-text"><span class="mono">${esc(cur)}</span> isn’t a slot on the shared switch</span>`;

    // Your slots, and "no slot" (the repo's default range, which isn't on the shared switch).
    const none = !isMine(ctx, 'VTEP_CIDR');
    const noneOpt = `<button class="slot-opt ${none ? 'on' : ''}" ${none ? 'aria-pressed="true"' : 'data-noslot'}>
        <span class="hv-radio"></span><span class="slot-none">No slot</span>
        <span class="muted small">the repo’s <span class="mono">${esc(ctx.row('VTEP_CIDR')?.default || '10.0.120.0/22')}</span>, not on the shared switch${ctx.workerCount() ? '' : ' (fine without DPU hosts)'}</span></button>`;
    const list = `<div class="slot-opts">${options.map(o => `<button class="slot-opt ${o.cidr === cur ? 'on' : ''}" ${o.cidr === cur ? 'aria-pressed="true"' : `data-pick="${esc(o.cidr)}"`}>
          <span class="hv-radio"></span><span class="dpu-users">${userAvatars(o.owners, me)}</span><span class="mono">${esc(o.cidr)}</span>
          <span class="muted small">${esc(o.what)} · room for ${o.room} DPU host${o.room > 1 ? 's' : ''}</span>
          ${o.room < hosts ? `<span class="ci-bad-text small">you picked ${hosts}</span>` : ''}</button>`).join('')}${noneOpt}</div>
      ${options.length ? '' : `<div class="muted small">${me.length ? `You (${me.map(m => '@' + esc(m)).join(', ')}) have no slot on the shared switch yet.` : 'Pick who you are (bottom of the sidebar) to see your slots.'}</div>`}`;
    const request = d.request_url ? `<a class="btn small" href="${esc(d.request_url)}" target="_blank" rel="noopener" title="Opens the allocations file on GitHub; saving your edit there opens a pull request">${icon('github', 'sm')}Request a slot</a>${infoTip('Slots are handed out by pull request: add yourself to a free slot in the allocations file and open the PR.')}` : '';

    const srcLabel = (d.source || '').startsWith('github:') ? d.source.slice(7) : (d.source || '').replace(/^\/home\/[^/]+/, '~');
    const all = ctx.ui.hbnAll;
    return `<div class="ci-status hbn-status">${status}${infoTip('Your share of the shared HBN switch: VTEP addresses for OVN/HBN on the high-speed fabric, a /29 per DPU host. Slots are handed out by pull request to dpf-allocations.')}</div>
      ${list}
      <div class="ci-line">${request}<button class="link-btn" data-hbn-all>${icon(all ? 'minus' : 'layers', 'sm')}${all ? 'Hide' : 'Show'} the whole switch</button>
</div>
      ${all ? `${slotGridHtml(d, cur)}<div class="sn-foot muted small"><span>From <span class="mono">${esc(srcLabel)}</span></span></div>` : ''}`;
  },
  click(e, ctx) {
    if (e.target.closest('[data-hbn-all]')) { ctx.ui.hbnAll = !ctx.ui.hbnAll; return ctx.rerender(); }
    const pick = e.target.closest('[data-pick]');
    if (pick) return ctx.set({ VTEP_CIDR: pick.dataset.pick });
    if (e.target.closest('[data-noslot]')) return ctx.reset('VTEP_CIDR');
  },
};

/* ── Hosted DPU cluster names ───────────────────────────────────────── */

const HOSTED_CARD = {
  icon: 'cloud',
  title: () => 'Hosted DPU cluster',
  sub: ctx => `${ctx.eff('HOSTED_CLUSTER_NAME') || '?'} in ${ctx.eff('CLUSTERS_NAMESPACE') || '?'}`,
  render(ctx) {
    const name = ctx.eff('HOSTED_CLUSTER_NAME') || '', ns = ctx.eff('CLUSTERS_NAMESPACE') || '';
    const want = `${ns}-${name}`, hcp = ctx.eff('HOSTED_CONTROL_PLANE_NAMESPACE') || '';
    const api = ctx.eff('HYPERSHIFT_API_IP');
    const hcpVal = `<span class="mono">${esc(hcp)}</span> ${hcp === want ? okIcon('matches') : `${badIcon()} <button class="ci-chip" data-set="HOSTED_CONTROL_PLANE_NAMESPACE" data-val="${esc(want)}">Fix: ${esc(want)}</button>`}`;
    return `<div class="kv-grid">
        ${val(ctx, 'HOSTED_CLUSTER_NAME', 'Name')}
        ${val(ctx, 'CLUSTERS_NAMESPACE', 'Namespace')}
        ${ctx.adv ? field(ctx, 'HOSTED_CONTROL_PLANE_NAMESPACE', 'Control-plane namespace', `<div class="ci-status">${hcpVal}</div>`, '', 'Must be <namespace>-<name>; the automation doesn’t derive it, so this keeps it in sync.')
          : `<div class="kv"><div class="kv-label">Control-plane namespace</div><div class="kv-val">${hcpVal}${resetBtn(ctx, 'HOSTED_CONTROL_PLANE_NAMESPACE')}</div></div>`}
        ${val(ctx, 'HYPERSHIFT_API_IP', 'API', { show: api ? `MetalLB IP <span class="mono">${esc(api)}</span>` : 'NodePort', input: { placeholder: 'empty = NodePort' },
          info: 'A free IP in the management subnet for MetalLB, or empty for a NodePort.' })}
        <div class="kv"><div class="kv-label">Admin kubeconfig</div><div class="kv-val small mono">${esc(name)}-admin-kubeconfig in ${esc(ns)}</div></div>
      </div>`;
  },
  // Keep the control-plane namespace in sync while you rename.
  bind(key, value, ctx) {
    if (key !== 'HOSTED_CLUSTER_NAME' && key !== 'CLUSTERS_NAMESPACE') return {};
    const name = ctx.eff('HOSTED_CLUSTER_NAME') || '', ns = ctx.eff('CLUSTERS_NAMESPACE') || '';
    if (ctx.eff('HOSTED_CONTROL_PLANE_NAMESPACE') !== `${ns}-${name}`) return {};
    return { HOSTED_CONTROL_PLANE_NAMESPACE: key === 'HOSTED_CLUSTER_NAME' ? `${ns}-${value}` : `${value}-${name}` };
  },
};

/* ── Advanced tabs: the repo's other settings, by what they're for ──── */

// Each tab: [setting, label, {choices: [[value, label]], when: ctx => applies?, why, empty}]. Nothing
// is hidden: a setting that doesn't apply right now (`when`, or a tab's `gate` switch is off) is
// shown greyed out with why. Settings in no tab stay in "Everything else".
const on = (ctx, k) => ctx.eff(k) === 'true';
const ADV_TABS = [
  { id: 'install', title: 'Install options', icon: 'rocket', sections: [{ keys: [
    ['DEPLOYMENT_PROFILE', 'What to deploy', { choices: [['dpf', 'DPF'], ['nno', 'plain OpenShift (nno)']] }],
    ['OLM_WORKAROUND', 'Operators from the previous release’s catalog'],
    ['CUSTOM_POSTINSTALL_SCRIPT', 'Command to run at the end of make all'],
    ['KUBECONFIG', 'Kubeconfig file in the repo'],
    ['MANAGEMENT_UPGRADE_TARGET_VERSION', 'make upgrade-management target', { empty: 'the next z-stream' }],
  ] }] },
  { id: 'iso', title: 'Discovery ISO', icon: 'disc', sections: [{ keys: [
    ['ISO_TYPE', 'Discovery ISO', { choices: [['minimal', 'minimal'], ['full', 'full']] }],
    ['ISO_FOLDER', 'Downloaded to'],
  ] }] },
  { id: 'vmnet', title: 'VM network', icon: 'network', sections: [{ keys: [
    ['MAC_PREFIX', 'MAC prefix', { empty: 'derived from the hypervisor' }],
    ['VM_STATIC_IP', 'Static addresses instead of DHCP'],
    ['PRIMARY_IFACE', 'Interface name inside the VMs'],
    ['STATIC_NET_FILE', 'Generated NMState file (control plane)'],
    ['WORKER_STATIC_NET_FILE', 'Generated NMState file (worker VMs)', { when: ctx => num(ctx.eff('VM_WORKER_COUNT')) > 0, why: 'Only made with extra worker VMs (Management cluster VMs tab)' }],
  ] }] },
  { id: 'hostedsetup', title: 'Hosted cluster setup', icon: 'cloud', sections: [
    { title: 'HyperShift', keys: [
      ['HYPERSHIFT_INSTALL_METHOD', 'Installed with', { choices: [['binary', 'hypershift CLI'], ['mce', 'MultiCluster Engine']] }],
      ['HYPERSHIFT_IMAGE', 'HyperShift operator image', { when: ctx => ctx.eff('HYPERSHIFT_INSTALL_METHOD') !== 'mce', why: 'Only used when installed with the hypershift CLI' }],
      ['MCE_OPERATOR_CHANNEL', 'MultiCluster Engine channel', { when: ctx => ctx.eff('HYPERSHIFT_INSTALL_METHOD') === 'mce', why: 'Only used when installed with MultiCluster Engine' }],
    ] },
    { title: 'etcd storage', keys: [
      ['STORAGE_TYPE', 'Storage', { choices: [['lvm', 'LVMS'], ['odf', 'ODF']] }],
      ['SKIP_DEPLOY_STORAGE', 'Use an existing StorageClass instead'],
    ] },
    { title: 'Network', keys: [['FLANNEL_POD_CIDR', 'Pod network (Flannel)']] },
  ] },
  { id: 'joining', title: 'DPU host provisioning', icon: 'power', sections: [{ keys: [
    ['WORKER_POWER_ON_DELAY', 'Wait after powering them on (seconds)'],
    ['ENABLE_SHORT_WORKER_HOSTNAMES', 'Rename nodes to worker-<MAC>'],
    ['WORKER_NODE_LABELS', 'Node labels'],
  ] }] },
  { id: 'charts', title: 'DPF and OVN charts', icon: 'file', sections: [
    { title: 'DPF operator', keys: [
      ['DPF_VERSION', 'Version'],
      ['DPF_HELM_REPO_URL', 'Chart source'],
    ] },
    { title: 'OVN-Kubernetes', keys: [
      ['OVN_CHART_VERSION', 'Chart version'],
      ['OVN_CHART_URL', 'Chart registry'],
      ['INJECTOR_CHART_VERSION', 'Resource injector chart version', { empty: 'same as OVN-Kubernetes' }],
      ['OVNK_NAMESPACE', 'Resource injector namespace'],
    ] },
  ] },
  { id: 'sriov', title: 'SR-IOV VFs', icon: 'split', sections: [{ keys: [
    ['NUM_VFS', 'VFs per DPU PF'],
    ['SRIOV_DP_RESOURCE_PREFIX', 'Resource prefix'],
    ['SRIOV_DP_CONFIG_NAME', 'Main VF pool'],
    ['SRIOV_DP_MGMT_POOL_NAME', 'Management VF pool'],
    ['SRIOV_DP_CONFIG_CR_NAME', 'Device plugin config object'],
    ['INJECTOR_RESOURCE_NAME', 'Resource injected into pods'],
  ] }] },
  { id: 'overrides', title: 'HBN and DTS overrides', icon: 'swap', gate: 'GENERATE_DPUSERVICETEMPLATE_OVERRIDES', gateWhy: 'Only used when the overrides are generated', sections: [
    { keys: [['GENERATE_DPUSERVICETEMPLATE_OVERRIDES', 'Override the DPU service charts']] },
    { title: 'HBN', keys: [
      ['HBN_HELM_CHART_VERSION', 'Chart version'],
      ['HBN_HELM_REPO_URL', 'Chart repository'],
      ['HBN_IMAGE_REPO', 'Image'],
      ['HBN_IMAGE_TAG', 'Image tag'],
    ] },
    { title: 'DOCA Telemetry Service', keys: [
      ['DTS_HELM_CHART_VERSION', 'Chart version'],
      ['DTS_HELM_REPO_URL', 'Chart repository'],
      ['DTS_IMAGE', 'Image'],
    ] },
  ] },
  { id: 'provisioner', title: 'DPF HCP provisioner', icon: 'cog', sections: [
    { title: 'Operator', keys: [
      ['DPF_HCP_PROVISIONER_OPERATOR_VERSION', 'Chart version', { empty: 'the newest' }],
      ['DPF_HCP_PROVISIONER_OPERATOR_CHART_URL', 'Chart'],
      ['DPF_HCP_PROVISIONER_OPERATOR_IMAGE_REPO', 'Image'],
      ['DPF_HCP_PROVISIONER_OPERATOR_IMAGE_TAG', 'Image tag'],
      ['DPF_HCP_PROVISIONER_OPERATOR_NAMESPACE', 'Namespace'],
    ] },
    { title: 'dpu-worker-config', keys: [
      ['DPU_WORKER_CONFIG_CHART_VERSION', 'Chart version', { empty: 'the newest' }],
      ['DPU_WORKER_CONFIG_CHART_URL', 'Chart'],
    ] },
    { title: 'Secrets it gives the hosted cluster', keys: [
      ['DPFHCPPROVISIONER_PULL_SECRET_NAME', 'Pull secret'],
      ['DPFHCPPROVISIONER_SSH_SECRET_NAME', 'SSH key'],
    ] },
  ] },
  { id: 'kata', title: 'Kata containers', icon: 'shield', gate: 'KATA_ENABLED', gateWhy: 'Applies once Kata cold-plug is on', sections: [
    { keys: [['KATA_ENABLED', 'Kata cold-plug']] },
    { title: 'VFs', keys: [
      ['KATA_NUM_VFS', 'VFs for Kata pods'],
      ['KATA_SRIOV_PF_INDEX', 'Taken from PF'],
      ['KATA_SRIOV_DP_CONFIG_NAME', 'VF pool'],
      ['KATA_INJECTOR_RESOURCE_NAME', 'Resource injected into Kata pods'],
      ['KATA_NAD_NAME', 'NetworkAttachmentDefinition'],
      ['KATA_RUNTIME_CLASS', 'RuntimeClass'],
    ] },
    { title: 'RHCOS layer', keys: [
      ['KATA_SKIP_RHCOS_LAYER', 'Skip the RHCOS layer'],
      ['KATA_RHCOS_LAYER_IMAGE', 'Layer image', { when: ctx => !on(ctx, 'KATA_SKIP_RHCOS_LAYER'), why: 'Not used while the RHCOS layer is skipped' }],
    ] },
    { title: 'make deploy-kata-test', keys: [['KATA_TEST_REPLICAS', 'Test pods']] },
  ] },
  { id: 'verify', title: 'Verification', icon: 'check', sections: [{ keys: [
    ['VERIFY_DEPLOYMENT', 'Check the deployment at the end of make all'],
    ['VERIFY_MAX_RETRIES', 'Attempts per check'],
    ['VERIFY_SLEEP_SECONDS', 'Between attempts (seconds)'],
  ] }] },
  { id: 'tests', title: 'Tests', icon: 'flask', sections: [
    { title: 'make run-dpf-sanity', keys: [
      ['SANITY_TESTS_PING_COUNT', 'Pings per SR-IOV and HBN test'],
      ['SANITY_TESTS_PING_HBN_TO_HBN_PODS', 'Also ping between HBN pods'],
      ['SANITY_TESTS_WORKLOAD_NAMESPACE', 'Workload namespace'],
      ['SANITY_TESTS_PODS_WORKLOAD_FILE', 'Workload manifest'],
      ['SANITY_TESTS_OVN_ENABLED', 'OVN connectivity tests'],
      ['SANITY_TESTS_OVN_PING_COUNT', 'Pings per OVN test', { when: ctx => on(ctx, 'SANITY_TESTS_OVN_ENABLED'), why: 'Only with the OVN connectivity tests on' }],
      ['SANITY_TESTS_OVN_IMAGE', 'OVN test pod image', { when: ctx => on(ctx, 'SANITY_TESTS_OVN_ENABLED'), why: 'Only with the OVN connectivity tests on' }],
      ['SANITY_TESTS_OVN_NAMESPACE', 'OVN test namespace (deleted by the tests)', { when: ctx => on(ctx, 'SANITY_TESTS_OVN_ENABLED'), why: 'Only with the OVN connectivity tests on' }],
    ] },
    { title: 'make traffic-flow-tests', keys: [
      ['TFT_TEST_CASES', 'Test cases'],
      ['TFT_CONNECTION_TYPE', 'Traffic'],
      ['TFT_DURATION', 'Each case runs (seconds)'],
      ['TFT_REPO_REV', 'kubernetes-traffic-flow-tests revision'],
    ] },
  ] },
];

// One setting: on/off and fixed choices as pills, anything else as a value. The ⓘ has the
// repo's description and the variable's name.
function advRow(ctx, [key, label, { choices, empty } = {}]) {
  const r = ctx.row(key);
  const info = `${r.description ? `${r.description} ` : ''}(${key})`;
  if (r.kind === 'bool') return choice(ctx, key, label, [['true', 'on'], ['false', 'off']], { fmt: v => v === 'true' ? 'on' : v === 'false' ? 'off' : esc(v || 'not set'), info });
  const opts = choices || (r.kind === 'enum' && r.choices ? r.choices.map(c => [c, esc(c)]) : null);
  if (opts) return choice(ctx, key, label, opts, { fmt: v => opts.find(([x]) => String(x) === v)?.[1] ?? esc(v), info });
  return val(ctx, key, label, { info, input: { cls: 'mono' }, empty: empty || 'not set' });
}

const ADV_CARD = {
  sub(ctx, cd) {
    if (cd.gate && !on(ctx, cd.gate)) return 'Off';
    const n = [...cd.keys].filter(k => isMine(ctx, k)).length;
    return n ? `${n} changed by you` : 'All at repo defaults';
  },
  render(ctx, cd) {
    const all = cd.spec.sections.flatMap(s => s.keys).filter(([k]) => cd.keys.has(k));
    if (ctx.adv) return all.map(([k, label]) => field(ctx, k, label, bindInput(ctx, k, { cls: 'mono' }), '', ctx.row(k)?.description)).join('');
    const gate = cd.gate && all.find(([k]) => k === cd.gate);
    const gateOff = gate && !on(ctx, cd.gate);
    // Doesn't apply right now: shown, greyed out and not editable, with the reason.
    const na = (html, why) => `<div class="adv-na"><div class="adv-na-body" inert>${html}</div><div class="adv-why">${icon('info', 'sm')}${esc(why)}</div></div>`;
    return cd.spec.sections.map(s => {
      const rows = s.keys.filter(([k]) => cd.keys.has(k));
      if (!rows.length) return '';
      const offHere = gateOff && !rows.some(([k]) => k === cd.gate);
      const body = rows.map(x => {
        const o = x[2] || {};
        return o.when && !o.when(ctx) && !offHere ? na(advRow(ctx, x), o.why) : advRow(ctx, x);
      }).join('');
      return `${s.title ? `<div class="ci-sub">${esc(s.title)}</div>` : ''}${offHere
        ? na(`<div class="kv-grid wide">${body}</div>`, cd.spec.gateWhy)
        : `<div class="kv-grid wide">${body}</div>`}`;
    }).join('');
  },
};

/* ── Registry ───────────────────────────────────────────────────────── */

// The cards for the current analysis, in display order: [{id, def, keys: Set, n?}].
function editorCards(ctx) {
  const out = [];
  const add = (id, def, keys, extra = {}) => {
    const present = keys.filter(k => ctx.row(k)?.known);
    if (present.length) out.push({ id, def, keys: new Set(present), ...extra });
  };
  add('vms', VMS_CARD, [...VM_KEYS, 'BRIDGE_NAME', 'NODES_MTU']);
  add('cluster', CLUSTER_CARD, ['CLUSTER_NAME', 'BASE_DOMAIN', 'API_VIP', 'INGRESS_VIP', 'SKIP_ETC_HOSTS']);
  add('secrets', SECRETS_CARD, ['OPENSHIFT_PULL_SECRET', 'DPF_PULL_SECRET', 'SSH_KEY']);
  add('versions', VERSIONS_CARD, ['OPENSHIFT_VERSION', 'OCP_RELEASE_IMAGE', 'BLUEFIELD_OCP_IMAGE', 'BFB_URL']);
  add('dpus', DPUS_CARD, ['WORKER_COUNT', 'DPU_HOST_CIDR', 'AUTO_APPROVE_WORKER_CSR', ...ctx.workerSlots().flatMap(n => DPU_FIELDS.map(f => `WORKER_${n}_${f}`))]);
  add('hbn', HBN_CARD, ['VTEP_CIDR']);
  add('hosted', HOSTED_CARD, ['HOSTED_CLUSTER_NAME', 'CLUSTERS_NAMESPACE', 'HOSTED_CONTROL_PLANE_NAMESPACE', 'HYPERSHIFT_API_IP']);
  if (ctx.ui.advTabs) {
    const taken = new Set(out.flatMap(cd => [...cd.keys]));
    for (const spec of ADV_TABS) {
      const keys = spec.sections.flatMap(s => s.keys.map(([k]) => k)).filter(k => ctx.row(k)?.known && !ctx.row(k)?.unused && !taken.has(k));
      if (keys.length) out.push({ id: spec.id, def: { ...ADV_CARD, icon: spec.icon, title: () => spec.title }, keys: new Set(keys), spec, gate: spec.gate });
    }
  }
  return out;
}
