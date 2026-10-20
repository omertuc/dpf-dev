'use strict';

/* ════════════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════════════ */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const ICONS = {
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  server: '<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01M6 17h.01"/>',
  git: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="8" r="3"/><path d="M6 9v6M18 11c0 4-5 4-9.5 6.5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  contrast: '<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  chip: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  minus: '<path d="M5 12h14"/>',
  undo: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  github: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  cloud: '<path d="M17.5 19H8a6 6 0 1 1 5.7-7.9A4.5 4.5 0 1 1 17.5 19z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  network: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>',
  swap: '<path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
  power: '<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  split: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="M6 7v1a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V7"/><path d="M12 12v5"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  shield: '<path d="M12 3 19 6v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 15h9"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  more: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
};

function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach(el => { el.outerHTML = icon(el.dataset.icon); });
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtKiB(kib) {
  const gib = kib / 1048576;
  if (gib >= 1024) return `${(gib / 1024).toFixed(2)} TiB`;
  if (gib >= 100) return `${Math.round(gib)} GiB`;
  return `${gib.toFixed(1)} GiB`;
}
const nowSec = () => Date.now() / 1000;
function fmtAgo(ts) {
  if (!ts) return 'never';
  const d = Math.max(0, nowSec() - ts);
  if (d < 10) return 'just now';
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 14) return `${Math.floor(d / 86400)}d ago`;
  return `${Math.floor(d / 86400 / 7)}w ago`;
}
function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
function fmtClock(ts) {
  const d = new Date(ts * 1000);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString(undefined, today
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : (detail ? JSON.stringify(detail) : `${res.status} ${res.statusText}`));
  }
  return data;
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = (kind === 'ok' ? icon('check') : kind === 'bad' ? icon('alert') : '') + `<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); },
    kind === 'bad' ? 6000 : 2600);
}

async function copyText(text, what = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast(what, 'ok');
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
// Where you last were used to be remembered here; views now open at the start.
try { ['settingsTab', 'ovRowsFilter', 'clusterTab'].forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }

function stripAnsi(s) { return s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''); }

function ansiToHtml(s) {
  let out = '', open = 0, i = 0;
  const re = /\x1b\[([0-9;]*)([A-Za-z])/g;
  let m;
  while ((m = re.exec(s))) {
    out += esc(s.slice(i, m.index));
    i = re.lastIndex;
    if (m[2] !== 'm') continue;
    const codes = (m[1] || '0').split(';').map(Number);
    const cls = [];
    for (const c of codes) {
      if (c === 0) { out += '</span>'.repeat(open); open = 0; }
      else if (c === 1) cls.push('a-b');
      else if (c === 2) cls.push('a-d');
      else if (c === 3) cls.push('a-i');
      else if (c === 4) cls.push('a-u');
      else if ((c >= 30 && c <= 37) || (c >= 90 && c <= 97)) cls.push(`a-${c}`);
    }
    if (cls.length) { out += `<span class="${cls.join(' ')}">`; open++; }
  }
  out += esc(s.slice(i)) + '</span>'.repeat(open);
  return out;
}

/* ════════════════════════════════════════════════════════════════════════
   State
   ════════════════════════════════════════════════════════════════════════ */

const STAGES = {
  clone: { title: 'Clone automation repo', cmd: 'git clone' },
  pull: { title: 'Pull automation repo', cmd: 'git pull' },
  'pull-rebase': { title: 'Pull automation repo with rebase', cmd: 'git pull --rebase' },
  clean: { title: 'Clean up existing deployment', cmd: 'make clean-all' },
  'clean-workers': { title: 'Power off physical workers', cmd: 'scripts/worker.sh shutoff-all-workers' },
  'clean-vms': { title: 'Destroy VMs', cmd: 'make delete-worker-vms delete-vms' },
  'clean-cluster': { title: 'Delete cluster & generated files' },
  config: { title: 'Apply your settings', cmd: 'make generate-env' },
  install: { title: 'Install', cmd: 'make all' },
};
const PLAN_KEYS = ['pull', 'clean', 'install', 'kube'];

const S = {
  profiles: [],
  cur: null,
  status: {},          // profile -> /status response
  loading: {},         // profile -> bool
  fetchedOnce: {},     // profile -> bool (git fetch done this session)
  plan: {},            // profile -> {key: bool} user overrides
  live: {},            // profile -> LiveJob of the running/most recent job
  jobCache: new Map(), // `${profile}/${id}` -> LiveJob
  drawerJob: null,
  pollTimer: null,
};

/* ════════════════════════════════════════════════════════════════════════
   Live job: streams a job log and derives progress from it
   ════════════════════════════════════════════════════════════════════════ */

const TRACE_RES = [
  /^GNU Make \d/, /^Built for /, /^Copyright \(C\) \d/, /^License GPLv3\+/, /^This is free software/,
  /^There is NO WARRANTY/, /^Reading makefiles\.\.\.$/, /^Updating makefiles\.\.\.\.$/, /^Updating goal targets\.\.\.\.$/,
  /^\s*File '.*' does not exist\.$/, /^\s*Must remake target '.*'\.$/, /^\s*Successfully remade target file '.*'\.$/,
  /^\s*Prerequisite '.*' is (newer|older) than target '.*'\.$/, /^\s*No need to remake target '.*'\.$/,
  /^\s*Target '.*' not remade because of errors\.$/, /^\s*Finished prerequisites of target file '.*'\.$/,
  /^\s*Considering target file '.*'\.$/, /^\s*Pruning file '.*'\.$/,
];
const ERR_RE = /(\[ERROR\]|\bERROR\b|\bFAILED\b|\bfatal:|\*\*\* \[|^Error:|\bError \d+$|Traceback \(most recent)/;

class LiveJob {
  constructor(profile, meta) {
    this.profile = profile;
    this.id = meta.id;
    this.meta = meta;
    this.title = meta.title || meta.id;
    this.stageNames = meta.stages || [];
    this.stages = Object.fromEntries(this.stageNames.map(s => [s, { state: 'pending' }]));
    for (const [s, rc] of Object.entries(meta.stage_results || {})) {
      if (this.stages[s]) this.stages[s].state = rc === 0 ? 'succeeded' : 'failed';
    }
    this.status = meta.status || 'running';
    this.rc = meta.rc ?? null;
    this.created = meta.created;
    this.ended = meta.ended || null;
    this.lines = [];
    this.partial = '';
    this.offset = 0;
    this.steps = [];
    this.stepState = {};
    this.curStep = null;
    this.lastLine = '';
    this.loaded = false;
    this.complete = false; // whole log received
    this.es = null;
    this.retryTimer = null;
    this.listeners = new Set();
    this.closed = false;
  }

  get running() { return this.status === 'running'; }

  connect() {
    if (this.es || this.closed) return;
    const url = `/api/profiles/${encodeURIComponent(this.profile)}/jobs/${encodeURIComponent(this.id)}/stream?offset=${this.offset}`;
    const es = new EventSource(url);
    this.es = es;
    es.addEventListener('log', e => {
      const d = JSON.parse(e.data);
      this.offset = d.o;
      this.feed(d.t);
    });
    es.addEventListener('done', e => {
      const d = JSON.parse(e.data);
      this.disconnect();
      this.complete = true;
      this.flushPartial();
      this.finish(d.status, d.rc);
    });
    const retry = () => {
      this.disconnect();
      if (!this.closed && this.status === 'running') this.retryTimer = setTimeout(() => this.connect(), 3000);
    };
    es.addEventListener('reconnect', retry);
    es.addEventListener('failure', retry);
    es.onerror = retry;
  }

  disconnect() {
    if (this.es) { this.es.close(); this.es = null; }
    clearTimeout(this.retryTimer);
  }

  close() { this.closed = true; this.disconnect(); }

  feed(text) {
    const parts = (this.partial + text).split('\n');
    this.partial = parts.pop();
    for (const raw of parts) this.processLine(raw);
    this.loaded = true;
    this.emit({ lines: true });
  }

  flushPartial() {
    if (this.partial) { this.processLine(this.partial); this.partial = ''; }
    this.loaded = true;
    this.emit({ lines: true });
  }

  processLine(raw) {
    // Carriage-return progress output: keep what is visible last.
    if (raw.includes('\r')) {
      const segs = raw.split('\r').filter(x => stripAnsi(x).trim());
      raw = segs.length ? segs[segs.length - 1] : '';
    }
    const plain = stripAnsi(raw);
    const m = plain.match(/^::dpfgui::(\S+)\s*(.*)$/);
    if (m) return this.marker(m[1], m[2]);

    let cls = '';
    let html = null;
    let mk = plain.match(/^\s*Must remake target '(.+)'\.$/);
    if (mk && this.steps.includes(mk[1])) {
      this.curStep = mk[1];
      this.stepState[mk[1]] = 'cur';
      cls = 'makestep';
      const n = this.steps.indexOf(mk[1]) + 1;
      html = `▸ make ${esc(mk[1])}  <span class="a-d">(step ${n} of ${this.steps.length})</span>`;
      this.lastLine = `make ${mk[1]}`;
    } else if ((mk = plain.match(/^\s*Successfully remade target file '(.+)'\.$/)) && this.steps.includes(mk[1])) {
      this.stepState[mk[1]] = 'done';
      if (this.curStep === mk[1]) this.curStep = null;
      cls = 'trace';
    } else if (TRACE_RES.some(r => r.test(plain))) {
      cls = 'trace';
    } else {
      const f = plain.match(/make(?:\[\d+\])?: \*\*\* \[[^\]]*?:\d+: ([^\]]+)\] Error/);
      if (f && this.steps.includes(f[1])) this.stepState[f[1]] = 'fail';
      if (ERR_RE.test(plain)) cls = 'err';
      if (plain.trim()) this.lastLine = plain.trim();
    }
    this.lines.push({ text: plain, html: html ?? ansiToHtml(raw), cls });
  }

  marker(kind, rest) {
    const a = rest.split(/\s+/);
    if (kind === 'stage-start') {
      const st = this.stages[a[0]] || (this.stages[a[0]] = { state: 'pending' });
      st.state = 'running'; st.start = +a[1];
      this.lines.push({ text: `▶ ${STAGES[a[0]]?.title || a[0]}`, html: `▶ ${esc(STAGES[a[0]]?.title || a[0])}  <span class="a-d">${esc(STAGES[a[0]]?.cmd || '')}</span>`, cls: 'marker', stage: a[0] });
    } else if (kind === 'stage-end') {
      const st = this.stages[a[0]] || (this.stages[a[0]] = {});
      const rc = +a[1];
      st.state = rc === 0 ? 'succeeded' : (rc === 130 || rc === 143 ? 'cancelled' : 'failed');
      st.rc = rc; st.end = +a[2];
      const dur = st.start ? fmtDur(st.end - st.start) : '';
      const ok = rc === 0;
      const t = `${ok ? '✓' : '✗'} ${STAGES[a[0]]?.title || a[0]} ${ok ? 'finished' : `failed (exit ${rc})`}${dur ? ' in ' + dur : ''}`;
      this.lines.push({ text: t, html: esc(t), cls: `marker ${ok ? 'ok' : 'bad'}` });
      if (a[0] === 'install') this.curStep = null;
    } else if (kind === 'steps') {
      this.steps = a.filter(Boolean);
    } else if (kind === 'job-start') {
      this.created = this.created || +a[0];
    } else if (kind === 'job-end') {
      this.ended = +a[0];
    } else if (kind === 'cancelled') {
      this.lines.push({ text: '■ Cancelled', html: '■ Cancelled', cls: 'marker bad' });
    }
  }

  finish(status, rc) {
    const was = this.status;
    this.status = status;
    this.rc = rc;
    this.ended = this.ended || nowSec();
    let failedSeen = false;
    for (const s of this.stageNames) {
      const st = this.stages[s];
      if (st.state === 'running') { st.state = status === 'succeeded' ? 'succeeded' : status; failedSeen = true; }
      else if (st.state === 'failed' || st.state === 'cancelled') failedSeen = true;
      else if (st.state === 'pending' && (failedSeen || status !== 'succeeded')) st.state = 'skipped';
    }
    if (this.curStep && status !== 'succeeded') this.stepState[this.curStep] = 'fail';
    this.curStep = null;
    this.emit({ finished: was === 'running' });
  }

  failedStep() {
    return this.steps.find(s => this.stepState[s] === 'fail') || null;
  }

  stepProgress() {
    if (!this.steps.length) return null;
    const done = this.steps.filter(s => this.stepState[s] === 'done').length;
    const cur = this.curStep ? this.steps.indexOf(this.curStep) : -1;
    return { done, total: this.steps.length, cur, pct: Math.round((done / this.steps.length) * 100) };
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev) { this.listeners.forEach(fn => fn(this, ev)); }
}

function getJob(profile, meta) {
  const key = `${profile}/${meta.id}`;
  let job = S.jobCache.get(key);
  if (!job) {
    job = new LiveJob(profile, meta);
    job.on(onJobEvent);
    S.jobCache.set(key, job);
    if (S.jobCache.size > 20) {
      for (const [k, j] of S.jobCache) {
        if (j.running || j === S.drawerJob || Object.values(S.live).includes(j)) continue;
        j.close(); S.jobCache.delete(k);
        if (S.jobCache.size <= 20) break;
      }
    }
  } else if (meta.status && meta.status !== 'running' && job.status === 'running' && !job.es) {
    // Finished while we were not streaming it.
    job.finish(meta.status, meta.rc);
  }
  return job;
}

let renderQueued = false;
function onJobEvent(job, ev) {
  if (ev.finished) {
    notifyFinished(job);
    if (job.stageNames.includes('config')) loadAnalysis(job.profile);
    refresh(job.profile, { quiet: true });
  }
  if (S.drawerJob === job) drawer.update(ev);
  if (job.profile === S.cur && job === S.live[job.profile] && !renderQueued) {
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderDeploy(); renderSidebar(); });
  }
}

function notifyFinished(job) {
  const ok = job.status === 'succeeded';
  const msg = `${job.title} ${ok ? 'succeeded' : job.status} on ${job.profile}`;
  toast(msg, ok ? 'ok' : 'bad');
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(ok ? '✅ DPF job finished' : '❌ DPF job ' + job.status, { body: msg });
  }
}

/* ════════════════════════════════════════════════════════════════════════
   Data loading
   ════════════════════════════════════════════════════════════════════════ */

async function loadProfiles() {
  S.profiles = await api('GET', '/api/profiles');
  const want = location.hash.slice(1) || store.get('profile', null);
  const names = S.profiles.map(p => p.name);
  S.cur = names.includes(want) ? want : names[0] || null;
  renderSidebar();
  if (S.cur) selectProfile(S.cur);
  else { $('#main').innerHTML = ''; $('#main').append(emptyState()); }
}

// Every word of the query has to appear somewhere in the given fields.
function matchesWords(query, ...fields) {
  const hay = fields.filter(Boolean).join(' ').toLowerCase().replace(/_/g, ' ');
  return query.toLowerCase().replace(/_/g, ' ').split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

function emptyState() {
  const d = document.createElement('div');
  d.className = 'empty-state';
  d.innerHTML = `<h2>No profiles yet</h2><p>A profile is one deployment: a hypervisor, its DPU hosts and settings.</p>
    <button class="btn primary" onclick="newProfile()">${icon('plus')}New profile</button>`;
  return d;
}

function selectProfile(name) {
  S.cur = name;
  store.set('profile', name);
  if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
  renderSidebar();
  renderMain();
  refresh(name, { fetch: !S.fetchedOnce[name] });
}

async function refresh(name = S.cur, { fetch = false, quiet = false } = {}) {
  if (!name || S.loading[name]) return;
  S.loading[name] = true;
  if (name === S.cur) renderHeadState();
  try {
    const st = await api('GET', `/api/profiles/${encodeURIComponent(name)}/status${fetch ? '?fetch=1' : ''}`);
    st.at = nowSec();
    S.status[name] = st;
    if (fetch && st.ok) S.fetchedOnce[name] = true;
    if (st.ok && !S.analysis?.[name]) loadAnalysis(name);
    syncLiveJob(name, st);
  } catch (e) {
    if (!quiet) toast(e.message, 'bad');
  } finally {
    S.loading[name] = false;
  }
  if (name === S.cur) renderMain();
  renderSidebar();
  schedulePoll();
}

function syncLiveJob(name, st) {
  const jobs = st.remote?.jobs || [];
  const running = jobs.find(j => j.status === 'running');
  const latest = running || jobs[0];
  if (!latest) { S.live[name] = null; return; }
  const job = getJob(name, latest);
  S.live[name] = job;
  if (job.running) job.connect();
}

function schedulePoll() {
  clearTimeout(S.pollTimer);
  const st = S.status[S.cur];
  const busy = S.live[S.cur]?.running || st?.local?.auto_fetch_running;
  const delay = st?.local?.auto_fetch_running ? 3000 : busy ? 15000 : 30000;
  S.pollTimer = setTimeout(() => { if (!document.hidden) refresh(S.cur, { quiet: true }); else schedulePoll(); }, delay);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && S.cur) {
    const st = S.status[S.cur];
    if (!st || nowSec() - st.at > 10) refresh(S.cur, { quiet: true });
  }
});

/* ════════════════════════════════════════════════════════════════════════
   Derived data
   ════════════════════════════════════════════════════════════════════════ */

function derive(name) {
  const st = S.status[name];
  if (!st) return null;
  const r = st.remote || {};
  const local = st.local || {};
  const summary = local.summary?.values || {};
  // r.env is empty unless the checkout's .env is this profile's (other profiles may share it).
  const prefixes = [r.env?.VM_PREFIX || summary.VM_PREFIX, r.env?.VM_WORKER_PREFIX || summary.VM_WORKER_PREFIX].filter(Boolean);
  const isMine = n => prefixes.some(p => n.startsWith(p));
  const vms = (r.vms || []).map(v => ({ ...v, mine: isMine(v.name) }));
  const mine = vms.filter(v => v.mine);
  const host = r.host || {};
  const total = host.mem_total_kib || 0;
  const avail = host.mem_available_kib || 0;
  const used = Math.max(0, total - avail);
  const mineRun = mine.filter(v => v.state === 'running').reduce((a, v) => a + (v.rss_kib || v.mem_kib || 0), 0);
  const minePart = Math.min(mineRun, used);
  const needKiB = (local.summary?.required_mem_mib || 0) * 1024;
  const projected = avail + minePart;
  const fit = !needKiB ? 'unknown' : needKiB > projected ? 'nofit' : needKiB > projected - 32 * 1048576 ? 'tight' : 'ok';
  const jobs = r.jobs || [];
  const running = jobs.find(j => j.status === 'running') || null;
  return {
    st, r, local, summary, prefixes, vms, mine, host, total, avail, used, mineRun, minePart, needKiB, projected, fit,
    jobs, running, repo: r.repo || {}, externalMakes: r.external_makes || [], workers: r.workers,
    conflict: r.conflict || null, // the automation repo clone isn't (only) this profile's
    clusterName: r.env?.CLUSTER_NAME || summary.CLUSTER_NAME || ptitle(profileObj(name)),
  };
}

/* ════════════════════════════════════════════════════════════════════════
   Rendering: sidebar
   ════════════════════════════════════════════════════════════════════════ */

function renderSidebar() {
  const nav = $('#profiles');
  nav.innerHTML = S.profiles.map(p => {
    const st = S.status[p.name];
    const live = S.live[p.name];
    let dot = '';
    let sub = p.host ? esc(p.host.split('.')[0]) : 'No hypervisor yet';
    if (live?.running) { dot = 'busy'; sub = 'Running: ' + esc(live.title.replace(/^Deploy: .*/, 'deploy')); }
    else if (st && !st.ok) { dot = 'bad'; sub = 'Unreachable'; }
    else if (st?.ok) dot = 'ok';
    return `<div class="profile-row">
      <button class="profile-link ${p.name === S.cur ? 'active' : ''}" data-profile="${esc(p.name)}">
        <span class="dot ${dot}"></span>
        <div><div class="pname">${esc(ptitle(p))}</div><div class="psub">${sub}</div></div>
      </button>
      <button class="profile-more" data-profile-menu="${esc(p.name)}" title="More actions" aria-label="More actions for ${esc(p.name)}">${icon('more')}</button>
    </div>`;
  }).join('');
}

$('#profiles').addEventListener('click', e => {
  const m = e.target.closest('[data-profile-menu]');
  if (m) { e.stopPropagation(); return openProfileMenu(m.dataset.profileMenu, m); }
  const b = e.target.closest('[data-profile]');
  if (b && b.dataset.profile !== S.cur) selectProfile(b.dataset.profile);
});
$('#profiles').addEventListener('contextmenu', e => {
  const b = e.target.closest('[data-profile]');
  if (!b) return;
  e.preventDefault();
  openProfileMenu(b.dataset.profile, b.parentElement.querySelector('.profile-more'));
});

function closeMenu() { $('#menu')?.remove(); }

// Pull; if the remote branch was rewritten (force-pushed) so it can't fast-forward, offer a rebase.
async function pull(r) {
  const job = await runJob(['pull'], { openLog: true });
  const off = job?.on(async (j, ev) => {
    if (!ev.finished) return;
    off();
    if (j.status !== 'failed' || !j.lines.some(l => /Not possible to fast-forward|Diverging branches/.test(l.text))) return;
    const ok = await modal.confirm({
      title: 'Pull with rebase?', icon: 'down', ok: 'Pull with rebase',
      body: `<p><span class="mono">${esc(r.branch)}</span> can’t fast-forward to <span class="mono">${esc(r.upstream || 'its upstream')}</span>:
        both have commits the other doesn’t, usually because the remote branch was force-pushed.</p>
        <p class="muted small">Rebasing puts this clone’s own commits on top of the remote branch. If it conflicts, it’s undone and nothing changes.</p>`,
    });
    if (ok) runJob(['pull-rebase'], { openLog: true });
  });
}

/* ── Branch picker: the clone's branches and its remotes', newest commit first ── */

const branchKey = b => `${b.local ? 'local' : b.remote}/${b.name}`;

async function openBranchMenu(anchor) {
  if ($('#menu')?.dataset.for === 'branches') return closeMenu();
  closeMenu();
  const name = S.cur;
  S.branches ??= {};
  const st = { q: '', remote: null, list: S.branches[name], fetching: true, error: null, switching: null };
  const menu = document.createElement('div');
  menu.id = 'menu';
  menu.className = 'menu branch-menu';
  menu.dataset.for = 'branches';
  menu.innerHTML = `<div class="br-head"><input class="input" placeholder="Filter branches…" spellcheck="false" autocomplete="off">
      <div class="br-remotes"></div><div class="br-status small muted"></div></div>
    <div class="br-list" role="listbox"></div>`;
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + 4}px`;
  menu.style.left = `${Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.maxHeight = `${innerHeight - r.bottom - 16}px`;
  const input = menu.querySelector('input');
  input.focus();

  const paint = () => {
    const all = st.list?.branches || [];
    const remotes = [...new Set(all.map(b => b.remote || 'local'))].sort((a, b) => (a === 'origin') - (b === 'origin') || a.localeCompare(b));
    // Your fork's branches first (its remote is named after your GitHub login), if it has any.
    const mine = (S.me?.[0] || '').toLowerCase();
    if (st.remote === null && all.length) st.remote = remotes.find(x => x.toLowerCase() === mine) || 'all';
    menu.querySelector('.br-remotes').innerHTML = all.length ? ['all', ...remotes].map(x =>
      `<button class="br-chip ${st.remote === x ? 'on' : ''}" data-remote-filter="${esc(x)}">${x === 'all' ? 'All' : esc(x)}<span>${x === 'all' ? all.length : all.filter(b => (b.remote || 'local') === x).length}</span></button>`).join('') : '';
    menu.querySelector('.br-status').innerHTML = st.error ? `<span class="ci-bad-text">${esc(st.error)}</span>`
      : st.fetching ? `<span class="spinner" style="width:10px;height:10px"></span> Fetching${st.list ? ' (showing what the clone knew)' : ''}…`
      : st.list?.fetch_error ? `<span class="ci-bad-text" title="${esc(st.list.fetch_error)}">Fetch failed; showing what the clone knew</span>` : '';
    if (!st.list) { menu.querySelector('.br-list').innerHTML = ''; return; }
    const words = st.q.toLowerCase().split(/\s+/).filter(Boolean);
    // The current branch first, then newest commit first (as the server sorted them).
    const shown = all.filter(b => (st.remote === 'all' || (b.remote || 'local') === st.remote)
        && words.every(w => `${b.name} ${b.remote || ''} ${b.subject} ${b.author}`.toLowerCase().includes(w)))
      .sort((a, b) => (b.local && b.name === st.list.current) - (a.local && a.name === st.list.current));
    const LIMIT = 60;
    menu.querySelector('.br-list').innerHTML = shown.slice(0, LIMIT).map(b => {
      const cur = b.local && b.name === st.list.current;
      return `<button class="br-item ${cur ? 'current' : ''}" role="option" data-branch="${esc(branchKey(b))}">
        <div class="br-top"><span class="br-name mono ellipsis">${esc(b.name)}</span>
          ${b.remote ? `<span class="br-tag ${b.remote === 'origin' ? '' : 'fork'}">${esc(b.remote)}</span>` : '<span class="br-tag local">local</span>'}
          ${b.local ? '' : '<span class="br-tag ghost" title="Not checked out yet: switching makes a local branch tracking it">remote</span>'}
          <span class="br-when">${st.switching === branchKey(b) ? '<span class="spinner" style="width:10px;height:10px"></span>' : cur ? icon('check', 'sm') : esc(fmtAgo(b.time))}</span></div>
        <div class="br-sub ellipsis" title="${esc(b.subject)}">${esc(b.subject)}</div>
        <div class="br-meta"><span class="mono">${esc(b.sha)}</span> · ${esc(b.author)}</div></button>`;
    }).join('') + (shown.length > LIMIT ? `<div class="br-more small muted">${shown.length - LIMIT} more; type to narrow it down</div>`
      : !shown.length ? `<div class="br-more small muted">No branch matches</div>` : '');
  };
  const load = fetch => api('GET', `/api/profiles/${encodeURIComponent(name)}/branches${fetch ? '?fetch=1' : ''}`)
    .then(l => { S.branches[name] = st.list = l; }, e => { st.error = e.message; });
  paint();
  if (!st.list) { await load(false); paint(); } // what the clone knows, right away
  load(true).finally(() => { st.fetching = false; if (menu.isConnected) paint(); });

  input.addEventListener('input', () => { st.q = input.value; paint(); });
  menu.addEventListener('click', async e => {
    const chip = e.target.closest('[data-remote-filter]');
    if (chip) { st.remote = chip.dataset.remoteFilter; paint(); input.focus(); return; }
    const item = e.target.closest('[data-branch]');
    if (!item || st.switching) return;
    const b = st.list.branches.find(x => branchKey(x) === item.dataset.branch);
    if (b.local && b.name === st.list.current) return closeMenu();
    st.switching = branchKey(b); paint();
    try {
      const res = await api('POST', `/api/profiles/${encodeURIComponent(name)}/branch`, { name: b.name, remote: b.local ? null : b.remote });
      closeMenu();
      toast(`Switched to ${res.branch}`, 'ok');
      delete S.branches[name];
      refresh(name, { quiet: true });
      loadAnalysis(name); // another branch may have other settings
    } catch (err) { st.switching = null; st.error = err.message; paint(); }
  });
  menu.addEventListener('keydown', e => {
    const items = $$('.br-item', menu);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0])?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); i <= 0 ? input.focus() : items[i - 1].focus(); }
    else if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); items[0]?.click(); }
    else if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); anchor.focus(); }
  });
}

function openProfileMenu(name, anchor) {
  const wasOpen = $('#menu')?.dataset.for === name;
  closeMenu();
  if (wasOpen) return;
  const menu = document.createElement('div');
  menu.id = 'menu';
  menu.className = 'menu';
  menu.dataset.for = name;
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <button role="menuitem" data-act="edit">${icon('edit')}Settings</button>
    <button role="menuitem" data-act="duplicate">${icon('copy')}Duplicate…</button>
    <button role="menuitem" data-act="copy-ssh">${icon('terminal')}Copy ssh command</button>
    <div class="menu-sep"></div>
    <button role="menuitem" class="danger" data-act="delete">${icon('trash')}Delete…</button>`;
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${Math.min(r.bottom + 4, innerHeight - menu.offsetHeight - 8)}px`;
  menu.style.left = `${Math.min(r.left, innerWidth - menu.offsetWidth - 8)}px`;
  menu.querySelector('button').focus();
  menu.onclick = async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    closeMenu();
    const p = profileObj(name);
    if (act === 'edit') { if (name !== S.cur) selectProfile(name); openEditor(); }
    else if (act === 'duplicate') newProfile(name);
    else if (act === 'copy-ssh') copyText(`ssh ${p.user ? p.user + '@' : ''}${p.host}`, 'Copied ssh command');
    else if (act === 'delete') deleteProfile(name);
  };
  menu.onkeydown = e => {
    const items = $$('button', menu);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); anchor.focus(); }
  };
}

document.addEventListener('mousedown', e => { if (!e.target.closest('#menu, [data-profile-menu], #btn-branch')) closeMenu(); });

async function deleteProfile(name) {
  const p = profileObj(name);
  const running = S.live[name]?.running;
  const kcDir = S.status[name]?.local?.kubeconfigs?.mgmt?.path?.replace(/\/[^/]+$/, '/');
  const hasClone = !!(p.host && p.automation_dir);
  // With a clone, ask outright whether it goes too; what's in it is looked up right away.
  const alsoClone = await new Promise(resolve => {
    modal.show(`
      <div class="modal-head"><div class="icon-wrap bad">${icon('trash')}</div><div><h3>Delete ${esc(p.title || name)}?</h3></div></div>
      <div class="modal-body">
        <p>Removes <strong>${esc(p.title || name)}</strong> and its settings from this app.</p>
        ${hasClone ? `<p style="margin-top:12px"><strong>Its automation repo clone</strong> <code class="wrap">${esc(p.automation_dir)}</code> on ${esc(shortHost(p.host))}: delete it too, or keep it?</p>
          <div class="small" id="dp-clone"><span class="spinner" style="width:10px;height:10px"></span> Looking at the clone…</div>` : ''}
        <p class="muted small" style="margin-top:12px">Nothing else on the hypervisor is touched. Fetched kubeconfigs are kept${kcDir ? ` in <code class="wrap">${esc(kcDir)}</code>` : ''}.</p>
        ${running ? `<p style="color:var(--warn)">A job is still running there. It will keep running, but you won't see it here.</p>` : ''}
      </div>
      <div class="modal-foot">
        <button class="btn" data-dp="cancel">Cancel</button>
        ${hasClone ? `<button class="btn danger" data-dp="keep">Delete profile, keep clone</button>
          <button class="btn danger solid" data-dp="both" disabled>Delete profile and clone</button>`
        : '<button class="btn danger solid" data-dp="keep" autofocus>Delete</button>'}
      </div>`, { onClose: () => { resolve(null); return true; } }); // Esc / backdrop: cancel
    $('#modal').addEventListener('click', e => {
      const b = e.target.closest('[data-dp]');
      if (!b) return;
      const v = { cancel: null, keep: false, both: true }[b.dataset.dp];
      resolve(v); modal.close();
    }, { signal: modal.signal });
    if (hasClone) api('GET', `/api/profiles/${encodeURIComponent(name)}/clone`).then(i => {
      $('#dp-clone').innerHTML = cloneLossHtml(i);
      $('#modal [data-dp="both"]').disabled = false;
    }, e => { $('#dp-clone').innerHTML = `<span class="ci-bad-text">Can't delete the clone: ${esc(e.message)}</span>`; });
  });
  if (alsoClone === null) return;
  try {
    // The clone first: deleting it needs the profile, and if it fails the profile stays.
    if (alsoClone) await api('DELETE', `/api/profiles/${encodeURIComponent(name)}/clone`);
    await api('DELETE', `/api/profiles/${encodeURIComponent(name)}`);
    delete S.status[name];
    S.live[name]?.close();
    delete S.live[name];
    toast(`Deleted ${p.title || name}${alsoClone ? ' and its clone' : ''}`, 'ok');
    if (S.cur === name) { S.cur = null; store.set('profile', null); history.replaceState(null, '', location.pathname + location.search); $('#main').dataset.profile = ''; }
    await loadProfiles();
  } catch (e) { toast(e.message, 'bad'); }
}

/* ════════════════════════════════════════════════════════════════════════
   Rendering: main page
   ════════════════════════════════════════════════════════════════════════ */

// Quoted for a POSIX shell, only when it needs to be.
const shq = s => /^[\w.\/@:=+-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;

// An interactive shell in the profile's automation repo clone. RemoteCommand=none: an ssh config
// that attaches you to tmux would otherwise refuse a command.
function shellCommand(p) {
  return `ssh -t -o RemoteCommand=none ${shq((p.user ? p.user + '@' : '') + p.host)} ${shq(`cd ${shq(p.automation_dir)} && $SHELL -l`)}`;
}

function profileObj(name = S.cur) { return S.profiles.find(p => p.name === name); }
const ptitle = p => p?.title || p?.name || '';

function renderMain() {
  const p = profileObj();
  if (!p) return;
  const main = $('#main');
  if (main.dataset.profile !== p.name) {
    main.dataset.profile = p.name;
    main.innerHTML = `
      <div class="page-head" id="page-head"></div>
      <div id="banners"></div>
      <div class="grid cols-4">
        <div class="card" id="card-host"></div>
        <div class="card" id="card-deployment"></div>
        <div class="card" id="card-repo"></div>
        <div class="card" id="card-config"></div>
      </div>
      <div class="section"><div class="card deploy" id="card-deploy"></div></div>
      <div class="section grid cols-3 dash-row">
        <div class="card" id="card-install" hidden></div>
        <div class="card" id="card-kube"></div>
        <div class="card" id="card-accounts"></div>
      </div>
      <div class="section" id="cluster-section"></div>
`;
  }
  renderHead();
  renderBanners();
  renderHost();
  renderDeployment();
  renderRepo();
  renderConfig();
  renderDeploy();
  renderInstall();
  renderAccounts();
  renderKube();
  renderCluster();
}

function renderHead() {
  const p = profileObj();
  const st = S.status[p.name];
  $('#page-head').innerHTML = `
    <div>
      <h1>${esc(ptitle(p))}</h1>
      <div class="sub">
        <span class="copyable" data-copy="ssh ${esc(p.user ? p.user + '@' : '')}${esc(p.host)}" title="Copy ssh command">${icon('terminal', 'sm')} ${esc(p.user ? p.user + '@' : '')}${esc(p.host)}</span>
        <span class="copyable mono" data-copy="${esc(p.automation_dir)}" title="Copy path">${esc(p.automation_dir)}</span>
      </div>
    </div>
    <div class="head-actions">
      <span class="muted small" id="updated">${st?.at ? 'Updated ' + fmtAgo(st.at) + (st.remote?.latency_ms ? ` · ${st.remote.latency_ms} ms` : '') : ''}</span>
      <button class="btn" id="btn-edit">${icon('edit')}Settings</button>
      <button class="btn" id="btn-refresh" title="Refresh and check for repo updates (R)">${S.loading[p.name] ? '<span class="spinner"></span>' : icon('refresh')}Refresh</button>
    </div>`;
  $('#btn-refresh').onclick = () => refresh(S.cur, { fetch: true });
  $('#btn-edit').onclick = () => openEditor();
}

function renderHeadState() {
  const b = $('#btn-refresh');
  if (b) b.innerHTML = `${S.loading[S.cur] ? '<span class="spinner"></span>' : icon('refresh')}Refresh`;
}

function renderBanners() {
  const d = derive(S.cur);
  const st = S.status[S.cur];
  const out = [];
  if (st?.incomplete) {
    out.push(`<div class="banner warn">${icon('server')}<div class="b-body"><div class="b-title">Pick a hypervisor for ${esc(ptitle(profileObj()))}</div>
      <div class="small">And where the automation repo is checked out there.</div></div>
      <div class="b-actions"><button class="btn small primary" onclick="openEditor('conn')">${icon('server')}Pick one</button></div></div>`);
  } else if (st && !st.ok) {
    out.push(`<div class="banner bad">${icon('alert')}<div class="b-body"><div class="b-title">Can't reach ${esc(profileObj().host)}</div>
      <div class="mono small">${esc(st.error)}</div></div>
      <div class="b-actions"><button class="btn small" onclick="refresh(S.cur,{fetch:true})">${icon('refresh')}Retry</button></div></div>`);
  }
  if (d?.conflict) {
    const c = d.conflict, who = esc(c.title || c.profile || 'another profile');
    const [title, body] = c.kind === 'shared'
      ? [`${who} uses the same automation repo clone`, 'Each profile needs its own clone, or their deployments get mixed up. Pick or clone another one for this profile.']
      : c.kind === 'laptop'
      ? [`This automation repo clone belongs to ${who} on ${esc(c.laptop || 'another laptop')}`, `${c.user ? esc(c.user) + ' set it up' : 'It was set up'} from another laptop. Deploying from both would mix up their deployments.`]
      : [`This automation repo clone belongs to ${who}`, c.gone ? 'That profile isn’t here any more, so you can take the clone over.' : 'Each profile needs its own clone, or their deployments get mixed up.'];
    out.push(`<div class="banner bad">${icon('alert')}<div class="b-body"><div class="b-title">${title}</div><div class="small">${body}</div></div>
      <div class="b-actions">${c.kind !== 'shared' ? `<button class="btn small" data-take-over>Take it over…</button>` : ''}
        <button class="btn small primary" onclick="openEditor('conn')">${icon('server')}Pick another clone</button></div></div>`);
  }
  if (d?.externalMakes.length) {
    const m = d.externalMakes[0];
    out.push(`<div class="banner warn">${icon('terminal')}<div class="b-body"><div class="b-title">make is running in the automation dir outside this app</div>
      <div class="small"><span class="mono">${esc(m.cmd)}</span> · pid ${m.pid}${m.started ? ' · started ' + fmtAgo(m.started) : ''}.
      Starting a job here now would race with it.</div></div></div>`);
  }
  const lost = d?.jobs.find(j => j.status === 'lost');
  if (lost && lost === d.jobs[0]) {
    out.push(`<div class="banner warn">${icon('alert')}<div class="b-body"><div class="b-title">The last job stopped without finishing</div>
      <div class="small">${esc(lost.title)}: its process is gone but it never recorded an exit code (hypervisor reboot or killed?).</div></div>
      <div class="b-actions"><button class="btn small" data-open-job="${esc(lost.id)}">${icon('eye')}View log</button></div></div>`);
  }
  if (d?.r.vm_error) {
    out.push(`<div class="banner warn">${icon('alert')}<div class="b-body"><div class="b-title">Couldn't list VMs</div><div class="mono small">${esc(d.r.vm_error)}</div></div></div>`);
  }
  $('#banners').innerHTML = out.join('');
  const to = $('#banners [data-take-over]');
  if (to) to.onclick = () => takeOver(d);
}

async function takeOver(d) {
  const c = d.conflict, p = profileObj();
  const ok = await modal.confirm({
    title: `Take over ${p.automation_dir}?`, icon: 'alert', ok: 'Take it over',
    body: `<p>It's marked as ${esc(c.title || c.profile)}'s${c.kind === 'laptop' ? ` on ${esc(c.laptop || 'another laptop')}` : ''}. Taking it over makes it ${esc(ptitle(p))}'s; ${c.kind === 'laptop' ? 'that laptop' : 'that profile'} won't be able to run jobs in it any more.</p>
      <p class="muted small">Its .env and kubeconfigs are from that deployment until this profile deploys.</p>`,
  });
  if (!ok) return;
  try { await api('POST', `/api/profiles/${encodeURIComponent(p.name)}/take-over`, {}); toast(`${ptitle(p)} owns the clone now`, 'ok'); refresh(p.name, { quiet: true }); }
  catch (e) { toast(e.message, 'bad'); }
}

function cardHead(iconName, title, right = '') {
  return `<div class="card-head"><h2>${icon(iconName)}${esc(title)}</h2>${right ? `<div class="right">${right}</div>` : ''}</div>`;
}

function skeleton(lines = 3) {
  return Array.from({ length: lines }, (_, i) => `<div class="skeleton" style="width:${[70, 90, 55, 80][i % 4]}%;margin:8px 0"></div>`).join('');
}

function renderHost() {
  const el = $('#card-host');
  const d = derive(S.cur);
  const editHv = `<button class="icon-btn" data-edit-hv title="Change the hypervisor">${icon('edit', 'sm')}</button>`;
  el.onclick = e => { if (e.target.closest('[data-edit-hv]')) openEditor('conn'); };
  if (!d?.st.ok) { el.innerHTML = cardHead('server', 'Hypervisor', editHv) + (d ? '<div class="muted">Unavailable</div>' : skeleton()); return; }
  const pct = v => (d.total ? (v / d.total) * 100 : 0);
  const others = d.used - d.minePart;
  const needLeft = pct(others), needW = Math.min(pct(d.needKiB), 100 - needLeft);
  const fitText = {
    ok: `${icon('check', 'sm')} Fits your deployment`,
    tight: `${icon('alert', 'sm')} Tight for your deployment`,
    nofit: `${icon('alert', 'sm')} Not enough memory`,
    unknown: '',
  }[d.fit];
  const othersRunning = d.vms.filter(v => v.state === 'running' && !v.mine).length;
  el.innerHTML = cardHead('server', 'Hypervisor', `<span class="muted small">${d.host.cpus} CPUs · load ${d.host.load?.[0]?.toFixed(1)}</span>${editHv}`) + `
    <div class="card-body">
      <div class="big-num">${fmtKiB(d.avail)} <small>available of ${fmtKiB(d.total)}</small></div>
      <div class="membar" title="Memory">
        <div class="seg others" style="width:${pct(others)}%"></div>
        <div class="seg mine" style="width:${pct(d.minePart)}%"></div>
        ${d.needKiB ? `<div class="need ${d.fit}" style="left:${needLeft}%;width:${needW}%" title="Your deployment: ${fmtKiB(d.needKiB)}"></div>` : ''}
      </div>
      <div class="legend">
        <span><i class="others"></i>Others ${fmtKiB(others)}</span>
        <span><i class="mine"></i>Yours ${d.minePart ? fmtKiB(d.minePart) : '0 GiB'}</span>
        ${d.needKiB ? `<span><i class="need"></i>Needed ${fmtKiB(d.needKiB)}</span>` : ''}
      </div>
      <div class="line" style="margin-top:12px">
        ${fitText ? `<span class="pill ${d.fit === 'ok' ? 'ok' : d.fit === 'tight' ? 'warn' : 'bad'}">${fitText}</span>` : ''}
        <button class="link-btn" id="btn-vms" style="margin-left:auto">${othersRunning} other VM${othersRunning === 1 ? '' : 's'} running</button>
      </div>
    </div>`;
  $('#btn-vms').onclick = openVMs;
}

function openVMs() {
  const d = derive(S.cur);
  if (!d?.st.ok) return;
  const order = { running: 0, paused: 1, blocked: 1, 'shut off': 2 };
  const vms = [...d.vms].sort((a, b) => (b.mine - a.mine) || ((order[a.state] ?? 3) - (order[b.state] ?? 3)) || a.name.localeCompare(b.name));
  const runningAlloc = d.vms.filter(v => v.state === 'running').reduce((a, v) => a + (v.mem_kib || 0), 0);
  modal.show(`
    <div class="modal-head"><div class="icon-wrap info">${icon('chip')}</div>
      <div style="flex:1"><h3>Virtual machines on ${esc(profileObj().host.split('.')[0])}</h3>
        <div class="muted small">${d.vms.length} VMs · ${fmtKiB(runningAlloc)} allocated to running ones</div></div>
      <button class="icon-btn" data-m="close" title="Close (Esc)">${icon('x')}</button></div>
    <div class="modal-body" style="padding:8px 8px 12px">
      <table class="table">
        <thead><tr><th>Name</th><th>State</th><th class="num">Memory</th><th class="num">In use</th><th class="num">vCPUs</th></tr></thead>
        <tbody>${vms.map(v => `<tr class="${v.mine ? 'mine' : ''}">
          <td><span class="vmname">${esc(v.name)}</span>${v.mine ? '<span class="tag">yours</span>' : ''}</td>
          <td>${vmStateDot(v.state)}</td>
          <td class="num">${v.mem_kib ? fmtKiB(v.mem_kib) : '—'}</td>
          <td class="num">${v.rss_kib ? fmtKiB(v.rss_kib) : '<span class="muted">—</span>'}</td>
          <td class="num">${v.vcpus ?? '—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`, { size: 'mid' });
  $('#modal [data-m="close"]').onclick = () => modal.close();
}

function vmStateDot(s) { return `<span class="state"><span class="dot ${esc((s || '').replace(' ', ''))}"></span>${esc(s)}</span>`; }

function renderDeployment() {
  const el = $('#card-deployment');
  const d = derive(S.cur);
  if (!d?.st.ok) { el.innerHTML = cardHead('box', 'Your deployment') + (d ? '<div class="muted">Unavailable</div>' : skeleton()); return; }
  const mineTitle = `Your VMs are the ones named ${d.prefixes.map(p => p + '*').join(' or ') || '(VM_PREFIX not set)'}`;

  if (!d.mine.length && !d.running) {
    const interrupted = leftoverInstall(d);
    el.innerHTML = cardHead('box', 'Your deployment', interrupted ? '<span class="pill warn"><span class="dot"></span>May have leftovers</span>' : '') + `
      <div class="card-body empty-card" title="${esc(mineTitle)}">
        <div class="empty-icon">${icon('box')}</div>
        <div class="empty-title">${interrupted ? 'No VMs' : 'Nothing deployed'}</div>
        <div class="muted small">${interrupted
          ? `The last install didn't finish, so the Assisted Installer cluster or generated files may still be around`
          : `${esc(d.clusterName)} has no VMs on ${esc(profileObj().host.split('.')[0] || 'the hypervisor')}`}</div>
        <button class="btn primary small" id="btn-goto-deploy" style="margin-top:12px">${icon('rocket')}Deploy</button>
      </div>
      ${cleanFootHtml(d, interrupted)}`;
    $('#btn-goto-deploy').onclick = () => {
      $('#card-deploy').scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => $('#btn-run')?.focus({ preventScroll: true }), 350);
    };
    bindCleanFoot(el);
    return;
  }

  const running = d.mine.filter(v => v.state === 'running');
  let pill;
  if (d.running && d.running.stages?.includes('install')) pill = '<span class="pill busy"><span class="dot"></span>Installing</span>';
  else if (d.running?.stages?.some(s => s.startsWith('clean'))) pill = '<span class="pill busy"><span class="dot"></span>Cleaning up</span>';
  else if (d.running) pill = '<span class="pill busy"><span class="dot"></span>Job running</span>';
  else if (running.length) pill = '<span class="pill ok"><span class="dot"></span>Up</span>';
  else pill = '<span class="pill warn"><span class="dot"></span>VMs shut off</span>';
  el.innerHTML = cardHead('box', 'Your deployment', pill) + `
    <div class="card-body">
      <div title="${esc(mineTitle)}"><strong>${esc(d.clusterName)}</strong></div>
      <div class="vm-mini" style="margin-top:10px">
        ${d.mine.length ? d.mine.map(v => `<div class="vm">${vmStateDot(v.state)}<span class="name ellipsis">${esc(v.name)}</span><span class="muted small" style="margin-left:auto">${v.mem_kib ? fmtKiB(v.mem_kib) : ''}</span></div>`).join('')
          : '<div class="muted small">No VMs yet</div>'}
      </div>
    </div>
    ${cleanFootHtml(d, true)}`;
  bindCleanFoot(el);
}

// No VMs doesn't mean nothing was created: an install stopped early may already have
// registered the Assisted Installer cluster or written generated files. Jobs are newest first.
function leftoverInstall(d) {
  for (const j of d.jobs) {
    if (j.status === 'succeeded' && (j.stages?.includes('clean') || j.stages?.includes('clean-cluster'))) return false;
    if (j.stages?.includes('install')) return j.status !== 'succeeded';
  }
  return false;
}

function cleanFootHtml(d, emphasize) {
  const busy = d.running ? 'disabled title="A job is running"' : d.conflict ? 'disabled title="The automation repo clone isn\'t this profile\'s"' : '';
  const why = (cond, title) => busy || (cond ? `disabled title="${esc(title)}"` : '');
  return `<div class="card-foot clean-foot">
      <button class="btn danger ${emphasize ? '' : 'ghost'}" data-clean="clean" ${busy}>${icon('trash')}Clean all…</button>
      <div class="clean-parts"><span class="muted small">or only:</span>
        <button class="btn small ghost" data-clean="clean-workers" ${why(d.workers && !d.workers.length, "WORKER_COUNT is 0 in the hypervisor's .env")}>${icon('stop', 'sm')}Power off workers…</button>
        <button class="btn small ghost" data-clean="clean-vms" ${why(!d.mine.length, 'No VMs with your prefix')}>${icon('chip', 'sm')}Destroy VMs…</button>
        <button class="btn small ghost" data-clean="clean-cluster" ${busy}>${icon('file', 'sm')}Delete cluster & files…</button>
      </div>
    </div>`;
}

function bindCleanFoot(el) {
  el.querySelectorAll('[data-clean]').forEach(b => b.onclick = () => confirmAndRun([b.dataset.clean], false));
}

function renderRepo() {
  const el = $('#card-repo');
  const d = derive(S.cur);
  if (!d?.st.ok) { el.innerHTML = cardHead('git', 'Automation repo') + (d ? '<div class="muted">Unavailable</div>' : skeleton()); return; }
  const r = d.repo;
  // Fast-forward pulls fail once the remote branch was rewritten (force-pushed): offer a rebase.
  const diverged = !!(r.ahead && r.behind);
  const lastPull = d.jobs.find(j => j.stages?.some(s => s.startsWith('pull')));
  const pullFailed = lastPull?.stages.includes('pull') && lastPull.status === 'failed' && !!r.behind;
  let pill = '', body;
  if (!r.exists) {
    pill = '<span class="pill bad">Missing</span>';
    body = `<div class="muted small">${esc(profileObj().automation_dir)} does not exist on the hypervisor.</div>`;
  } else if (!r.git) {
    pill = '<span class="pill warn">Not a git repo</span>';
    body = '';
  } else {
    if (r.behind) pill = `<span class="pill warn">${r.behind} behind</span>`;
    else if (r.upstream) pill = `<span class="pill ok">${icon('check', 'sm')}Up to date</span>`;
    if (r.ahead) pill += ` <span class="pill info">${r.ahead} ahead</span>`;
    body = `
      <div class="line"><button class="branch-btn" id="btn-branch" ${d.running || d.conflict ? 'disabled' : ''}
          title="${d.running ? 'A job is running' : d.conflict ? 'The automation repo clone isn’t this profile’s' : 'Switch branch'}">${icon('git', 'sm')}<span class="mono ellipsis">${esc(r.branch)}</span>${icon('down', 'sm')}</button>
        <span class="muted small ellipsis">→ ${esc(r.upstream || 'no upstream')}</span></div>
      ${r.head ? `<div style="margin-top:10px;font-size:13px" class="ellipsis" title="${esc(r.head.subject)}">${esc(r.head.subject)}</div>
      <div class="muted small"><span class="mono">${esc(r.head.sha)}</span> · ${esc(r.head.author)} · ${fmtAgo(r.head.time)}</div>` : ''}
      ${r.dirty ? `<div class="line small" style="margin-top:8px;color:var(--warn)">${icon('alert', 'sm')}${r.dirty} modified tracked file${r.dirty > 1 ? 's' : ''}</div>` : ''}
      ${diverged || pullFailed ? `<div class="line small" style="margin-top:8px;color:var(--warn)">${icon('alert', 'sm')}<span>${diverged
        ? `${esc(r.branch)} and ${esc(r.upstream)} have diverged (${r.ahead} ahead, ${r.behind} behind): force-pushed?`
        : 'The last pull failed'}</span></div>` : ''}
      ${r.fetch_error ? `<div class="line small" style="margin-top:8px;color:var(--bad)">${icon('alert', 'sm')}<span class="ellipsis" title="${esc(r.fetch_error)}">fetch failed: ${esc(r.fetch_error)}</span></div>` : ''}
      <div class="muted small" style="margin-top:8px">Last fetched ${fmtAgo(r.fetched_at)}</div>`;
  }
  el.innerHTML = cardHead('git', 'Automation repo', pill) + `<div class="card-body">${body}</div>
    <div class="card-foot">
      ${diverged || pullFailed
        ? `<button class="btn" id="btn-pull-rebase" ${d.running || d.conflict ? 'disabled' : ''} title="git pull --rebase: your commits on top of ${esc(r.upstream)}; undone if it conflicts">${icon('down')}Pull with rebase</button>`
        : `<button class="btn" id="btn-pull" ${d.running || d.conflict || !r.git ? 'disabled' : ''}>${icon('down')}Pull</button>`}
      <button class="btn" id="btn-shell" title="Copy an ssh command that opens a shell in ${esc(profileObj().automation_dir)}">${icon('terminal')}Shell</button>
    </div>`;
  $('#btn-pull')?.addEventListener('click', () => pull(r));
  $('#btn-pull-rebase')?.addEventListener('click', () => runJob(['pull-rebase'], { openLog: true }));
  $('#btn-branch')?.addEventListener('click', e => openBranchMenu(e.currentTarget));
  $('#btn-shell').onclick = () => copyText(shellCommand(profileObj()), 'Copied: ssh to a shell in the automation repo');
}

function setAnalysis(name, a) {
  S.analysis = { ...(S.analysis || {}), [name]: a };
  if (name === S.cur) { renderConfig(); renderDeploy(); }
}

async function loadAnalysis(name) {
  S.analysisLoading = S.analysisLoading || {};
  if (S.analysisLoading[name]) return;
  S.analysisLoading[name] = true;
  try { setAnalysis(name, await api('POST', `/api/profiles/${encodeURIComponent(name)}/config/analyze`, {})); }
  catch { /* shown when the overview is opened */ }
  finally { S.analysisLoading[name] = false; }
}

function analysisPills(name) {
  const a = S.analysis?.[name];
  if (!a) return S.analysisLoading?.[name] ? '<span class="muted small"><span class="spinner" style="width:11px;height:11px;vertical-align:-1px"></span> Checking…</span>' : '';
  if (a.no_clone) return '<span class="pill warn">No clone</span>';
  const c = a.counts;
  const todo = c.todo ? `<button class="pill info pill-btn" data-open-issues title="Required settings without a value">${c.todo} to fill in</button> ` : '';
  if (!c.error && !c.warn) return todo || `<button class="pill ok pill-btn" data-open-issues title="Open the overview">${icon('check', 'sm')}Validated</button>`;
  return todo + (c.error ? `<button class="pill bad pill-btn" data-open-issues>${c.error} error${c.error > 1 ? 's' : ''}</button> ` : '')
    + (c.warn ? `<button class="pill warn pill-btn" data-open-issues>${c.warn} warning${c.warn > 1 ? 's' : ''}</button>` : '');
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-open-issues]')) openEditor('overview', { filter: 'issues' });
});

function renderConfig() {
  const el = $('#card-config');
  const d = derive(S.cur);
  if (!d) { el.innerHTML = cardHead('file', 'Settings') + skeleton(); return; }
  // The values the deployment will use: from the last settings check (repo defaults included),
  // else just what the profile sets.
  const rows = S.analysis?.[S.cur]?.rows;
  const v = k => rows ? rows.find(r => r.key === k)?.effective : d.summary[k];
  const n = +v('VM_COUNT') || 0, workers = +v('WORKER_COUNT') || 0;
  const names = Array.from({ length: workers }, (_, i) => v(`WORKER_${i + 1}_NAME`)).filter(Boolean);
  const gib = +v('RAM') ? `${Math.round(+v('RAM') / 1024)} GiB` : '';
  const hosted = (/:(\d+\.\d+\.\d+)/.exec(v('OCP_RELEASE_IMAGE') || '') || [])[1];
  el.innerHTML = cardHead('file', 'Settings', `${d.st.ok ? analysisPills(S.cur) : ''}<button class="icon-btn" id="btn-cfg-edit" title="Edit settings">${icon('edit', 'sm')}</button>`) + `
    <div class="card-body"><div class="cfg-lines">
      <div><span>Cluster</span><b class="mono">${esc(v('CLUSTER_NAME') && v('BASE_DOMAIN') ? `${v('CLUSTER_NAME')}.${v('BASE_DOMAIN')}` : v('CLUSTER_NAME') || '—')}</b></div>
      <div><span>Management</span><b>${n ? `${n === 1 ? 'single node' : `${n} nodes`}${gib ? ` · ${gib}` : ''}` : '—'}${v('OPENSHIFT_VERSION') ? ` · ${esc(v('OPENSHIFT_VERSION'))}` : ''}</b></div>
      <div><span>DPU hosts</span><b>${workers ? esc(names.join(', ') || `${workers}`) : 'none'}${v('VTEP_CIDR') && workers ? ` <span class="muted mono small">${esc(v('VTEP_CIDR'))}</span>` : ''}</b></div>
      <div><span>Hosted cluster</span><b>${hosted ? `OpenShift ${esc(hosted)}` : '—'}</b></div>
    </div></div>`;
  $('#btn-cfg-edit').onclick = () => openEditor('overview');
}

/* ── Deploy pipeline ─────────────────────────────────────────────────── */

function planDefaults(d) {
  return {
    pull: true,
    clean: d.mine.length > 0,
    install: true,
    kube: true,
  };
}

function currentPlan(d) {
  const plan = { ...planDefaults(d), ...(S.plan[S.cur] || {}) };
  if (!plan.install && !kubeState(d).onHost) plan.kube = false; // nothing to fetch from
  return plan;
}

function planHints(d) {
  const r = d.repo;
  const kc = d.local.kubeconfigs || {};
  if (!d.st.ok) {
    const unknown = ['Unknown while the hypervisor is unreachable', ''];
    return { pull: unknown, clean: unknown, install: unknown, kube: unknown };
  }
  return {
    pull: !r.git ? ['Not a git repo', 'warn'] : r.behind && r.ahead ? [`Your branch and ${r.upstream} have diverged; Pull with rebase on the Automation repo card`, 'warn'] : r.behind ? [`${r.behind} new commit${r.behind > 1 ? 's' : ''} on ${r.upstream}`, 'warn'] : ['Already up to date', ''],
    clean: [[
      d.workers?.length ? `Powers off ${d.workers.map(w => w.name || `worker ${w.n}`).join(', ')}` : '',
      d.mine.length ? `destroys ${d.mine.map(v => v.name).join(', ')}` : '',
      'deletes the Assisted Installer cluster and generated files',
    ].filter(Boolean).join(', ').replace(/^./, c => c.toUpperCase()), d.mine.length || d.workers?.length ? 'warn' : ''],
    install: S.analysis?.[S.cur]?.counts.todo ? [`${S.analysis[S.cur].counts.todo} required setting(s) still need a value`, 'warn']
      : S.analysis?.[S.cur]?.counts.error ? [`Your settings have ${S.analysis[S.cur].counts.error} error(s); fix them first`, 'warn']
      : d.fit === 'nofit' ? [`Needs ${fmtKiB(d.needKiB)} but only ~${fmtKiB(d.projected)} would be free`, 'warn']
      : `${d.needKiB ? `Creates ${d.summary.VM_COUNT || '?'} VM(s) with ${fmtKiB(+d.summary.RAM * 1024)} each and installs DPF; usually takes over an hour.` : 'Installs the cluster and DPF.'}`,
    kube: !kubeState(d).anyAvailable ? ['As soon as the install starts', ''] : kc.mgmt?.exists ? [`Refreshes your local copies (last fetched ${fmtAgo(kc.mgmt.fetched_at)})`, ''] : ['The management and hosted cluster kubeconfigs, saved locally', ''],
  };
}

function renderDeploy() {
  const el = $('#card-deploy');
  if (!el) return;
  const d = derive(S.cur);
  if (!d) { el.innerHTML = `<div style="padding:18px">${skeleton(4)}</div>`; return; }
  const live = S.live[S.cur];
  const showLive = live && (live.running || !dismissed(live.id)) && live.stageNames.length > 1;
  const showPlanner = !live?.running;
  const headRight = live ? `<button class="btn ghost small" id="btn-open-live">${icon('terminal')}Log</button>` : '';
  const liveView = live?.running || (showLive && !showPlanner);
  el.innerHTML = `<div class="card-head"><h2>${icon('rocket')}Deploy</h2><div class="right">${headRight}</div></div>
    ${liveView ? `<div class="deploy-body">
      <ol class="steps" id="steps"></ol>
      <div class="deploy-side" id="deploy-side"></div>
    </div>` : '<div class="card-body plan" id="plan"></div>'}`;
  if (live) $('#btn-open-live').onclick = () => drawer.open(live);
  if (liveView) renderLiveSteps(d, live);
  else renderPlanner(d, showLive ? live : null);
}

function dismissed(id) { return (store.get('dismissed', []) || []).includes(id); }
function dismiss(id) { const l = store.get('dismissed', []) || []; l.push(id); store.set('dismissed', l.slice(-50)); }

function renderPlanner(d, lastJob) {
  const plan = currentPlan(d);
  const hints = planHints(d);
  const rows = [
    ['pull', 'Pull the repo', 'git pull'],
    ['clean', 'Clean up', 'make clean-all'],
    ['install', 'Install', 'make all'],
    ['kube', 'Fetch kubeconfigs', ''],
  ];
  const kubeImpossible = !plan.install && !kubeState(d).onHost;
  const chosen = PLAN_KEYS.filter(k => plan[k]);
  // Installing always applies the current settings first; that's not a separate choice.
  const remoteStages = chosen.filter(k => k !== 'kube').flatMap(k => k === 'install' ? ['config', 'install'] : [k]);
  const busyReason = !d.st.ok ? 'Hypervisor unreachable' : d.running ? 'A job is already running' : d.conflict ? 'The automation repo clone isn’t this profile’s' : d.externalMakes.length ? 'make is already running on the host' : '';
  const chips = rows.map(([k, title, cmd]) => {
    const on = plan[k], disabled = k === 'kube' && kubeImpossible;
    const [hint] = disabled ? ['Nothing deployed to fetch from'] : Array.isArray(hints[k]) ? hints[k] : [hints[k]];
    return `<label class="plan-chip ${on && !disabled ? 'on' : ''} ${disabled ? 'disabled' : ''}" title="${esc(hint || '')}">
      <input type="checkbox" data-plan="${k}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}>${esc(title)}${cmd ? ` <code>${esc(cmd)}</code>` : ''}</label>`;
  }).join('<span class="plan-arrow">→</span>');
  // What a chosen step will do that you'd want to know before running it (e.g. what clean-up destroys)
  const warns = rows.filter(([k]) => plan[k] && Array.isArray(hints[k]) && hints[k][1] === 'warn').map(([k, title]) => problem(`${title}: ${hints[k][0]}`, 'warn')).join('');
  const label = remoteStages.length ? (plan.clean && plan.install ? 'Redeploy' : plan.install ? 'Deploy' : 'Run') : 'Fetch';
  const iconFor = { succeeded: 'check', failed: 'x', cancelled: 'ban', lost: 'alert' };
  const past = d.jobs.length ? fold('past-runs', `<b>Past runs</b> ${fact(`${d.jobs.length} · last ${esc(d.jobs[0].title)} ${d.jobs[0].status === 'running' ? 'running' : esc(d.jobs[0].status)} ${fmtClock(d.jobs[0].created)}`)}`,
    `<div class="activity">${d.jobs.map(j => { const dur = j.ended && j.created ? fmtDur(j.ended - j.created) : '';
      return `<button class="act" data-open-job="${esc(j.id)}">
        <span class="a-icon ${j.status}">${j.status === 'running' ? '<span class="spinner"></span>' : icon(iconFor[j.status] || 'circle')}</span>
        <span><div class="a-title">${esc(j.title)}</div><div class="a-sub">${fmtClock(j.created)}${j.status === 'running' ? ' · running' : dur ? ` · ${dur}` : ''}${j.status === 'failed' ? ` · exit ${j.rc}` : ''}</div></span>
        <span class="muted">${icon('terminal', 'sm')}</span></button>`; }).join('')}</div>`) : '';
  $('#plan').innerHTML = `
    ${lastJob && !lastJob.running ? `<div class="plan-last">${resultHtml(lastJob)}<button class="btn small" id="btn-last-log">${icon('terminal')}Log</button><button class="btn ghost small" id="btn-dismiss">Dismiss</button></div>` : ''}
    <div class="plan-row"><div class="plan-chips">${chips}</div>
      <button class="btn primary" id="btn-run" ${!chosen.length || busyReason ? 'disabled' : ''}
        title="${esc(busyReason || (remoteStages.length ? 'Runs on the hypervisor in the background: you can close this tab and come back to it' : 'Fetches the kubeconfigs now'))}">
        ${icon('play')}${label}${chosen.length ? ` · ${chosen.length} step${chosen.length > 1 ? 's' : ''}` : ''}</button></div>
    ${busyReason ? `<div class="small muted">${esc(busyReason)}</div>` : ''}${warns}${past}`;
  $$('#plan [data-plan]').forEach(cb => cb.onchange = () => {
    S.plan[S.cur] = { ...(S.plan[S.cur] || {}), [cb.dataset.plan]: cb.checked };
    renderDeploy();
  });
  if (lastJob && !lastJob.running) {
    $('#btn-last-log').onclick = () => drawer.open(lastJob);
    $('#btn-dismiss').onclick = () => { dismiss(lastJob.id); renderDeploy(); };
  }
  $('#btn-run').onclick = () => {
    if (!remoteStages.length) return fetchKube(['mgmt-noingress', 'mgmt', 'hcp']);
    confirmAndRun(remoteStages, plan.kube && plan.install, plan.kube && !plan.install);
  };
  keepFolds($('#plan'));
}

function resultHtml(job) {
  const dur = job.ended && job.created ? fmtDur(job.ended - job.created) : '';
  const failed = job.stageNames.find(s => job.stages[s]?.state === 'failed');
  const fstep = job.failedStep();
  const text = {
    succeeded: `<strong>${esc(job.title)}</strong> succeeded${dur ? ' in ' + dur : ''}.`,
    failed: `<strong>Failed</strong>${failed ? ` at ${esc(STAGES[failed]?.title || failed)}` : ''}${fstep ? ` → <code>${esc(fstep)}</code>` : ''}${dur ? ` after ${dur}` : ''}.`,
    cancelled: `<strong>Cancelled</strong>${dur ? ` after ${dur}` : ''}.`,
    lost: '<strong>Stopped unexpectedly</strong> (no exit code recorded).',
  }[job.status] || esc(job.status);
  const ic = job.status === 'succeeded' ? 'check' : job.status === 'failed' ? 'alert' : 'ban';
  return `<div class="result ${job.status}">${icon(ic)}<div>${text}<div class="muted small">${job.created ? fmtClock(job.created) : ''}</div></div></div>`;
}

function renderLiveSteps(d, live) {
  const icons = {
    pending: icon('circle', 'sm'), running: '<span class="spinner"></span>', succeeded: icon('check', 'sm'),
    failed: icon('x', 'sm'), cancelled: icon('ban', 'sm'), skipped: icon('minus', 'sm'), lost: icon('alert', 'sm'),
  };
  const now = nowSec();
  const rows = live.stageNames.map(s => {
    const st = live.stages[s] || { state: 'pending' };
    const dur = st.start ? fmtDur((st.end || (st.state === 'running' ? now : st.start)) - st.start) : '';
    let sub = '';
    if (s === 'install' && (st.state === 'running' || st.state === 'failed' || st.state === 'succeeded')) {
      const pr = live.stepProgress();
      if (pr) {
        const failedStep = live.failedStep();
        const label = live.curStep ? `Step ${pr.cur + 1} of ${pr.total}: <code>${esc(live.curStep)}</code>`
          : failedStep ? `Failed in <code>${esc(failedStep)}</code>` : `${pr.done} of ${pr.total} steps done`;
        sub = `<div class="substeps">
          <div class="line small" style="margin-bottom:6px">${label}<span class="muted" style="margin-left:auto">${pr.pct}%</span></div>
          <div class="progress ${st.state}"><div style="width:${Math.max(pr.pct, 2)}%"></div></div>
          <div class="substep-chips">${live.steps.map(x => `<span class="${live.stepState[x] === 'done' ? 'done' : live.stepState[x] === 'fail' ? 'fail' : x === live.curStep ? 'cur' : ''}">${esc(x)}</span>`).join('')}</div>
        </div>`;
      }
    }
    return `<li class="step ${st.state === 'running' ? 'active' : ''}">
      <span class="step-icon ${st.state}">${icons[st.state] || ''}</span>
      <span class="s-title">${esc(STAGES[s]?.title || s)} ${STAGES[s]?.cmd ? `<span class="muted small" style="font-weight:400"><code>${esc(STAGES[s].cmd)}</code></span>` : ''}</span>
      <span class="s-meta" data-stage-dur="${s}">${dur}</span>
      ${sub}
    </li>`;
  });
  if (live.meta.fetch_kubeconfigs) {
    const kstate = d.local.auto_fetch_running ? 'running' : live.running ? 'pending' : (d.local.kubeconfigs?.auto?.auto_job === live.id ? 'succeeded' : 'pending');
    rows.push(`<li class="step"><span class="step-icon ${kstate}">${icons[kstate]}</span>
      <span class="s-title">Fetch kubeconfigs <span class="muted small" style="font-weight:400">locally</span></span></li>`);
  }
  $('#steps').innerHTML = rows.join('');
  const side = $('#deploy-side');
  if (live.running) {
    side.innerHTML = `
      <div class="summary"><span class="pill busy"><span class="dot"></span>Running</span>
        <span style="margin-left:6px">for <strong data-since="${live.created}">${fmtDur(now - live.created)}</strong></span></div>
      <div class="muted small">Started ${fmtClock(live.created)}. It runs on the hypervisor, so you can close this tab.</div>
      <div class="lastline" title="${esc(live.lastLine)}">${esc(live.lastLine || 'Waiting for output…')}</div>
      <div style="display:flex;gap:8px">
        <button class="btn" id="btn-live-log">${icon('terminal')}Open log</button>
        <button class="btn danger" id="btn-live-stop">${icon('stop')}Stop</button>
      </div>`;
    $('#btn-live-log').onclick = () => drawer.open(live);
    $('#btn-live-stop').onclick = () => confirmStop(live);
  } else {
    side.innerHTML = resultHtml(live) + `<div style="display:flex;gap:6px">
      <button class="btn small" id="btn-live-log">${icon('terminal')}View log</button>
      <button class="btn ghost small" id="btn-dismiss">Back to planner</button></div>`;
    $('#btn-live-log').onclick = () => drawer.open(live);
    $('#btn-dismiss').onclick = () => { dismiss(live.id); renderDeploy(); };
  }
}

/* ── Kubeconfigs ─────────────────────────────────────────────────────── */

// What the hypervisor has to offer right now, for each kubeconfig.
// Something's deployed (or being): this profile has VMs, or an install is running. Without,
// saved kubeconfigs are from a cluster that's gone.
const isDeployed = d => d.mine.length > 0 || !!d.running?.stages?.includes('install');

function kubeState(d) {
  const onHost = !!d.r.kubeconfig?.mtime;
  const up = d.mine.some(v => v.state === 'running');
  const installing = !!d.running?.stages?.includes('install');
  // What Assisted Installer last said about the management cluster (checked during installs).
  const ai = d.local.kubeconfigs?.ai;
  const aiLive = ['installing', 'installing-pending-user-action', 'finalizing', 'installed', 'adding-hosts'].includes(ai?.status);
  return { onHost, up, installing, ai, aiLive, hostMtime: d.r.kubeconfig?.mtime || 0, anyAvailable: onHost || aiLive };
}

function renderKube() {
  const el = $('#card-kube');
  const d = derive(S.cur);
  if (!d?.st.ok) { el.innerHTML = cardHead('key', 'Kubeconfigs') + (d ? '<div class="muted">Unavailable</div>' : skeleton()); return; }
  const kc = d.local.kubeconfigs || {};
  const ks = kubeState(d);
  const busy = S.kubeBusy?.[S.cur];
  const auto = d.local.auto_fetch_running;
  // The noingress kubeconfig only matters until the full one is here.
  const KINDS = ['mgmt-noingress', 'mgmt', 'hcp'].filter(k => k !== 'mgmt-noingress' || !kc.mgmt?.exists);
  const anyLocal = KINDS.some(k => kc[k]?.exists);

  if ((!ks.anyAvailable && !anyLocal) || !isDeployed(d)) {
    el.innerHTML = cardHead('key', 'Kubeconfigs') + `
      <div class="card-body empty-card">
        <div class="empty-icon">${icon('key')}</div>
        <div class="empty-title">${ks.installing ? 'Waiting for the install to start' : 'Nothing deployed'}</div>
        <div class="muted small">${ks.installing ? 'The management cluster’s kubeconfigs show up here as soon as Assisted Installer starts installing; the hosted cluster’s once it exists.' : 'Once you deploy, the kubeconfigs are fetched here automatically.'}</div>
      </div>`;
    return;
  }

  // Can this one be fetched right now, and if not, why?
  const mgmtKind = kind => kind !== 'hcp';
  const avail = kind => {
    if (mgmtKind(kind)) return ks.onHost || ks.aiLive || ks.installing ? { ok: true } : { ok: false, why: 'No cluster yet' };
    if (!ks.onHost) return { ok: false, why: ks.installing ? 'Available once the hosted cluster exists, later in the deploy' : 'No cluster on the hypervisor' };
    if (!ks.up) return { ok: false, why: 'The management cluster’s VMs aren’t running' };
    return { ok: true };
  };
  const entry = kind => {
    const k = kc[kind] || {};
    const a = avail(kind);
    const stale = k.exists && !ks.onHost && !(mgmtKind(kind) && (ks.aiLive || ks.installing));
    // The hosted cluster's comes from the repo's copy of the management kubeconfig; a newer copy means a reinstall.
    const outdated = kind === 'hcp' && k.exists && ks.onHost && k.fetched_at < ks.hostMtime;
    const fetching = (busy && busy.includes(kind)) || (auto && a.ok);
    let status;
    if (fetching) status = '<span class="pill busy"><span class="dot"></span>Fetching</span>';
    else if (stale) status = '<span class="pill warn">Cluster is gone</span>';
    else if (outdated) status = '<span class="pill warn">Outdated</span>';
    else if (k.exists) status = `<span class="small muted">${fmtAgo(k.fetched_at)}</span>`;
    else if (a.ok && k.error) status = '<span class="pill bad">Fetch failed</span>';
    else status = '';
    const actions = [];
    if (k.exists && !stale) actions.push(`<a class="icon-btn" href="/api/profiles/${encodeURIComponent(S.cur)}/kubeconfigs/${kind}" title="Download it">${icon('download', 'sm')}</a>`);
    if (stale) actions.push(`<button class="icon-btn" data-forget="${kind}" title="Delete it">${icon('trash', 'sm')}</button>`);
    else if (a.ok) actions.push(k.exists ? `<button class="icon-btn" data-fetch="${kind}" ${busy || auto ? 'disabled' : ''} title="Fetch it again">${icon('refresh', 'sm')}</button>`
      : `<button class="btn small ${outdated ? 'primary' : ''}" data-fetch="${kind}" ${busy || auto ? 'disabled' : ''}>${icon('download', 'sm')}Fetch</button>`);
    // Only what needs saying goes under the line: why it can't be fetched, or what's off.
    let note = '';
    if (stale) note = `Fetched ${fmtAgo(k.fetched_at)} from a cluster that has since been removed.`;
    else if (outdated) note = 'The cluster was reinstalled after this was fetched.';
    else if (k.exists && mgmtKind(kind) && ks.ai?.api_up === false) note = `Its API isn’t answering yet (checked ${fmtAgo(ks.ai.at)}).`;
    else if (!k.exists && !a.ok) note = a.why;
    const failed = a.ok && k.error && !fetching && (!k.exists || k.error.at > k.fetched_at);
    const copy = k.exists && !stale ? `<button class="btn small" data-copy="export KUBECONFIG=${esc(k.path)}" title="Copy: export KUBECONFIG=${esc(k.path)}">${icon('copy', 'sm')}export</button>` : '';
    return `<div class="kc-line ${stale ? 'stale' : ''}">
      <div class="kc-row"><b title="${esc(k.server || '')}">${esc(k.label || kind)}</b>${status}<span class="spacer"></span>${copy}${actions.join('')}</div>
      ${note ? `<div class="small muted">${esc(note)}</div>` : ''}${failed ? `<div class="small" style="color:var(--bad)">${esc(k.error.message)}</div>` : ''}
    </div>`;
  };
  const fetchable = KINDS.filter(k => avail(k).ok);
  el.innerHTML = cardHead('key', 'Kubeconfigs', fetchable.length > 1
    ? `<button class="btn small" data-fetch="${fetchable.join(',')}" ${busy || auto ? 'disabled' : ''}>${busy ? '<span class="spinner"></span>' : icon('download')}Fetch all</button>` : '')
    + `<div class="card-body">${KINDS.map(entry).join('')}</div>`;
  $$('[data-fetch]', el).forEach(b => b.onclick = () => fetchKube(b.dataset.fetch.split(',')));
  $$('[data-forget]', el).forEach(b => b.onclick = () => forgetKube(b.dataset.forget));
}

/* ── What's on the cluster: the management cluster, the hosted DPU cluster, DPF ─────── */

// Everything here is live: the cards read Kubernetes lists that the page keeps current through
// the app (k8s.js). A card is a function of those lists; to add one, add its resources to
// CL_RES and read them with cl.items(key).
const API = {
  ocp: 'apis/config.openshift.io/v1', olm: 'apis/operators.coreos.com/v1alpha1', mco: 'apis/machineconfiguration.openshift.io/v1',
  hs: 'apis/hypershift.openshift.io/v1beta1', prov: 'apis/provisioning.dpu.nvidia.com/v1alpha1', svc: 'apis/svc.dpu.nvidia.com/v1alpha1',
  dpfop: 'apis/operator.dpu.nvidia.com/v1alpha1', nr: 'apis/noderesources.dpu.nvidia.com/v1alpha1', hcp: 'apis/provisioning.dpu.hcp.io/v1alpha1',
};
const r = (prefix, plural, namespaced = false, params) => ({ prefix, plural, namespaced, params });
const CL_RES = {
  cv: r(API.ocp, 'clusterversions'),
  console: { ...r('apis/route.openshift.io/v1', 'routes', true, { fieldSelector: 'metadata.name=console' }), path: 'apis/route.openshift.io/v1/namespaces/openshift-console/routes' },
  co: r(API.ocp, 'clusteroperators'),
  nodes: r('api/v1', 'nodes'),
  subs: r(API.olm, 'subscriptions', true),
  csvs: r(API.olm, 'clusterserviceversions', true, { labelSelector: '!olm.copiedFrom' }),
  ips: r(API.olm, 'installplans', true),
  mcp: r(API.mco, 'machineconfigpools'),
  mc: r(API.mco, 'machineconfigs', false, { _meta: 1 }),
  helm: r('api/v1', 'secrets', true, { labelSelector: 'owner=helm', _meta: 1 }),
  hc: r(API.hs, 'hostedclusters', true),
  np: r(API.hs, 'nodepools', true),
  // DPF: these exist once deploy-dpf installed it; until then they're "missing", asked again each minute
  dpfcfg: r(API.dpfop, 'dpfoperatorconfigs', true),
  dpucluster: r(API.prov, 'dpuclusters', true),
  dpudeploy: r(API.svc, 'dpudeployments', true),
  dpuset: r(API.prov, 'dpusets', true),
  dpu: r(API.prov, 'dpus', true),
  dpunode: r(API.prov, 'dpunodes', true),
  dpudevice: r(API.prov, 'dpudevices', true),
  bfb: r(API.prov, 'bfbs', true),
  flavor: r(API.prov, 'dpuflavors', true),
  dst: r(API.svc, 'dpuservicetemplates', true),
  dsc: r(API.svc, 'dpuserviceconfigurations', true),
  dpusvc: r(API.svc, 'dpuservices', true),
  dsi: r(API.svc, 'dpuserviceinterfaces', true),
  ipam: r(API.svc, 'dpuserviceipams', true),
  nad: r(API.svc, 'dpuservicenads', true),
  chain: r(API.svc, 'dpuservicechains', true),
  cred: r(API.svc, 'dpuservicecredentialrequests', true),
  vfs: r(API.nr, 'nodesriovdevicepluginconfigs', true),
  prov: r(API.hcp, 'dpfhcpprovisioners', true),
  provcfg: r(API.hcp, 'dpfhcpprovisionerconfigs'),
  // ConfigMaps' metadata, for the provisioner's ignition (bfcfg-<DPUCluster>.cfg)
  cms: r('api/v1', 'configmaps', true, { _meta: 1 }),
};
// A hosted cluster, from the inside (with its own kubeconfig).
const HC_RES = { cv: CL_RES.cv, nodes: CL_RES.nodes, co: CL_RES.co };
// API groups whose other kinds (no card of their own) are listed at the end.
const CL_GROUPS = ['dpu.nvidia.com', 'dpu.hcp.io'];
const CL_OWN = new Set(Object.values(CL_RES).map(x => x.plural));
// A DPU's phases, in the order provisioning goes through them (from its CRD).
const DPU_PHASES = ['Initializing', 'Node Effect', 'Pending', 'Config FW Parameters', 'Prepare BFB', 'OS Installing', 'DPU Config', 'DPU Cluster Config', 'Host Network Configuration', 'Ready'];

// The current profile's live lists. They're dropped when the profile (or its kubeconfig) goes.
const cl = {
  profile: null, unsubs: [], lists: {}, kinds: [], hosted: {},
  items: key => cl.lists[key]?.list || [],
  watch(key, cluster, res) {
    const l = K8s.live(cl.profile, cluster, res.path || `${res.prefix}/${res.plural}`, res.params);
    cl.lists[key] = l;
    cl.unsubs.push(l.subscribe(() => cl.redraw()));
  },
  redraw() { if (!cl.frame) cl.frame = requestAnimationFrame(() => { cl.frame = null; renderCluster(); }); },
  stop() {
    cl.unsubs.forEach(u => u());
    clearTimeout(cl.discoverTimer);
    Object.assign(cl, { profile: null, unsubs: [], lists: {}, kinds: [], hosted: {}, discoverError: null, helm: null });
  },
  start(profile) {
    cl.stop();
    cl.profile = profile;
    for (const [k, x] of Object.entries(CL_RES)) cl.watch(k, 'mgmt', x);
    // Kinds without a card of their own appear during deploy-dpf: look every couple of minutes.
    const discover = async () => {
      clearTimeout(cl.discoverTimer);
      let next = 120000;
      try {
        const kinds = (await K8s.discover(profile, 'mgmt', CL_GROUPS)).filter(k => !CL_OWN.has(k.plural));
        if (cl.profile !== profile) return;
        for (const x of kinds) if (!cl.lists[`kind:${x.plural}`]) cl.watch(`kind:${x.plural}`, 'mgmt', x);
        Object.assign(cl, { kinds, discoverError: null });
      } catch (e) {
        if (cl.profile !== profile) return;
        cl.discoverError = e.message;
        next = 10000;
      }
      cl.redraw();
      cl.discoverTimer = setTimeout(discover, next);
    };
    discover();
  },
  watchHosted(h) {
    const id = `hc~${h.metadata.namespace}~${h.metadata.name}`;
    if (!cl.hosted[id] && (h.status?.kubeconfig || h.status?.kubeConfig)?.name) {
      cl.hosted[id] = true;
      for (const [k, x] of Object.entries(HC_RES)) cl.watch(`${id}:${k}`, id, x);
    }
    return id;
  },
  // Helm releases' details come from the app (their records are Secrets); asked again when the list changes.
  async loadHelm() {
    const sig = cl.items('helm').map(s => `${s.metadata.namespace}/${s.metadata.name}`).sort().join(',');
    if (!cl.profile || (cl.helm && cl.helm.sig === sig) || cl.helmLoading === sig) return;
    cl.helmLoading = sig;
    const profile = cl.profile;
    try {
      const d = await api('GET', `/api/profiles/${encodeURIComponent(profile)}/helm-releases`);
      if (cl.profile === profile) cl.helm = { sig, ...d };
    } catch (e) { if (cl.profile === profile) cl.helm = { sig, error: e.message }; }
    cl.helmLoading = null;
    cl.redraw();
  },
};

/* Small building blocks */
const conds = o => Object.fromEntries((o?.status?.conditions || []).filter(c => c.type).map(c => [c.type, c]));
function condHealth(c = {}) {
  const t = k => c[k]?.status;
  if (t('Degraded') === 'True' || t('Failing') === 'True') return ['bad', 'Degraded'];
  if (t('Available') === 'False' || t('Ready') === 'False') return ['bad', t('Available') === 'False' ? 'Unavailable' : 'Not ready'];
  if (t('Progressing') === 'True') return ['busy', 'Progressing'];
  if (t('Available') === 'True' || t('Ready') === 'True') return ['ok', t('Available') === 'True' ? 'Available' : 'Ready'];
  return ['', 'Unknown'];
}
const healthPill = ([cls, label], title = '') => `<span class="pill ${cls}" title="${esc(title)}">${cls === 'busy' ? '<span class="dot"></span>' : ''}${esc(label)}</span>`;
const condMsg = c => ['Degraded', 'Failing', 'Available', 'Ready', 'Progressing'].map(k => c?.[k]?.message).find(Boolean) || '';
const objLink = (cluster, res, o, label) => `<button class="link-btn" data-obj="${esc(cluster)}|${esc(K8s.objectPath(res, o))}" title="Show the manifest">${esc(label ?? o.metadata.name)}</button>`;
const kv = (label, value, title = '') => value === '' || value == null ? '' : `<div class="cl-kv" title="${esc(title)}"><span>${esc(label)}</span><b>${value}</b></div>`;
const mono = v => `<span class="mono">${esc(v)}</span>`;
const byName = (a, b) => a.metadata.name.localeCompare(b.metadata.name);
const ago = t => t ? fmtAgo(isoSec(t)) : '';
// A time that may be ahead: "in 23h 30m", or how long ago.
const until = t => { const left = isoSec(t) - nowSec(); return left > 0 ? `in ${fmtDur(left)}` : ago(t); };
// Something not right, said in words (the first line of what the object reports).
const problem = (msg, cls = 'bad') => msg ? `<div class="cl-problem ${cls}">${icon('alert', 'sm')}<span>${esc(msg)}</span></div>` : '';
// What's wrong, in the object's own words: its Ready (or Available) condition's message, which
// for DPF objects names the conditions holding it back ("* PrerequisitesReady"); each named one
// with its own message. (Other conditions mean different things when False, so they're left
// to the "All conditions" fold.)
function whyNot(c, top = ['Ready', 'Available']) {
  const head = top.map(k => c[k]).find(Boolean);
  const out = [];
  if (head && head.status !== 'True') {
    const named = [...(head.message || '').matchAll(/^\s*\*\s*([A-Za-z]+)\s*$/gm)].map(m => m[1]).filter(k => c[k]);
    // Those that say why get a line each; those that only say they're pending are listed together.
    const says = k => (c[k].message || '').trim() && !/^(pending|unknown|waiting)\.?$/i.test((c[k].message || '').trim());
    for (const k of named.filter(says)) out.push([k, c[k].message, c[k].status === 'Unknown' ? 'warn' : 'bad']);
    const quiet = named.filter(k => !says(k));
    if (quiet.length) out.push([null, `Also waiting on ${quiet.join(', ')}`, 'warn']);
    if (!named.length && head.message) out.push([head.type, head.message, 'bad']);
  }
  if (c.Degraded?.status === 'True') out.push(['Degraded', c.Degraded.message || '', 'bad']);
  return out.map(([k, m, cls]) => problem(`${k ? `${k}: ` : ''}${m.split('\n').map(x => x.trim()).filter(Boolean).join(' ')}`, cls)).join('');
}
const allConds = c => Object.keys(c).length ? `<details class="cl-more"><summary>All ${Object.keys(c).length} conditions</summary><div class="cl-conds">${Object.values(c).map(x =>
  `<div><span class="cl-dot ${x.status === 'True' ? 'ok' : x.status === 'False' ? 'bad' : ''}"></span><b>${esc(x.type)}</b> <span class="muted">${esc(x.reason || '')}</span>${x.message ? `<div class="small muted">${esc(x.message)}</div>` : ''}</div>`).join('')}</div></details>` : '';
// A value tree (Helm values, flavors) as indented YAML, for reading.
function toYaml(v, ind = '') {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return v.length ? v.map(x => `\n${ind}- ${typeof x === 'object' && x ? toYaml(x, ind + '  ').replace(/^\n\s*/, '') : toYaml(x, ind + '  ')}`).join('') : '[]';
  if (typeof v === 'object') return Object.keys(v).length ? Object.entries(v).map(([k, x]) => `\n${ind}${k}:${typeof x === 'object' && x && (Array.isArray(x) ? x.length : Object.keys(x).length) ? toYaml(x, ind + '  ') : ` ${toYaml(x, ind + '  ')}`}`).join('') : '{}';
  if (typeof v === 'string' && v.includes('\n')) return `|\n${v.split('\n').map(l => ind + l).join('\n')}`;
  return typeof v === 'string' ? (/^[\w./:@+-]+$/.test(v) ? v : JSON.stringify(v)) : String(v);
}
const yamlBlock = v => Hl.block(toYaml(v).replace(/^\n/, ''), { lang: 'yaml', cls: 'cl-yaml' });
// Folds stay open across redraws (live updates and status refreshes redraw cards).
function keepFolds(root) {
  const open = S.clusterOpen ||= new Set();
  $$('details', root).forEach(det => {
    const key = det.dataset.fold || `${det.closest('.card')?.querySelector('.card-head')?.textContent || ''}|${det.querySelector('summary')?.textContent.replace(/\d+/g, '#').trim()}`;
    if (open.has(key)) det.open = true;
    det.ontoggle = () => { det.open ? open.add(key) : open.delete(key); };
  });
}
// One item: a one-line summary that unfolds into the rest. Problems sit under the summary line,
// seen while it's folded. `id` keeps it open across live redraws.
const fold = (id, summary, body, problems = '') => `<details class="cl-fold" data-fold="${esc(id)}"><summary class="cl-sum">${summary}${problems ? `<div class="cl-sum-problems">${problems}</div>` : ''}</summary><div class="cl-fold-body">${body}</div></details>`;
const fact = v => v ? `<span class="cl-fact">${v}</span>` : '';
const card = (iconName, title, body, { wide = false, right = '' } = {}) => `<div class="card ${wide ? 'cl-wide' : ''}">${cardHead(iconName, title, right)}<div class="card-body">${body}</div></div>`;

async function showObject(cluster, path) {
  const name = path.split('/').pop();
  modal.show(`<div class="modal-head"><div style="flex:1"><h3 class="mono">${esc(name)}</h3><div class="muted small mono">${esc(path)}</div></div>
      <button class="icon-btn" data-m="close" title="Close (Esc)">${icon('x')}</button></div>
    <div class="modal-body"><div class="muted"><span class="spinner"></span> Loading…</div></div>`, { wide: true });
  $('#modal [data-m="close"]').addEventListener('click', () => modal.close(), { signal: modal.signal });
  try {
    const res = await K8s.get(S.cur, cluster, path, { _yaml: 1 });
    $('#modal .modal-body').innerHTML = `<div class="ci-line"><button class="btn small" id="obj-copy">${icon('copy', 'sm')}Copy</button></div>${Hl.block(res.yaml, { lang: 'yaml', cls: 'obj-yaml' })}`;
    $('#obj-copy').onclick = () => copyText(res.yaml, 'Manifest copied');
  } catch (e) { $('#modal .modal-body').innerHTML = `<div style="color:var(--bad)">${esc(e.message)}</div>`; }
}

// A MachineConfig as what it puts on the machine: its files (Ignition storage) as a tree, its
// systemd units, its users, and its other settings (kernel arguments, extensions…).
async function showMachineConfig(cluster, path) {
  const name = path.split('/').pop();
  modal.show(`<div class="modal-head"><div style="flex:1"><h3 class="mono">${esc(name)}</h3></div><button class="icon-btn" data-m="close">${icon('x')}</button></div>
    <div class="modal-body"><span class="spinner"></span> Loading…</div>`, { wide: true });
  $('#modal [data-m="close"]').addEventListener('click', () => modal.close(), { signal: modal.signal });
  let mc, raw;
  try { [mc, raw] = await Promise.all([K8s.get(S.cur, cluster, path), K8s.get(S.cur, cluster, path, { _yaml: 1 })]); }
  catch (e) { $('#modal .modal-body').innerHTML = `<div style="color:var(--bad)">${esc(e.message)}</div>`; return; }
  const ign = mc.spec?.config || {}, storage = ign.storage || {}, units = ign.systemd?.units || [], passwd = ign.passwd || {};
  // Ignition file contents: data: URLs (plain or base64), maybe gzip; anything else is fetched at boot.
  const decode = async (contents = {}) => {
    const src = contents.source;
    if (src == null) return { text: '', empty: 'Empty file.' };
    if (!src.startsWith('data:')) return { text: null, empty: `Fetched at boot from ${esc(src)}` };
    const comma = src.indexOf(','), meta = src.slice(5, comma), data = src.slice(comma + 1);
    let bytes = meta.includes(';base64') ? Uint8Array.from(atob(data), c => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(data));
    if (contents.compression === 'gzip') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return /[\x00-\x08\x0e-\x1f]/.test(text.slice(0, 4000)) ? { text: null, empty: `Binary (${bytes.length} bytes).` } : { text };
  };
  const mode = m => m == null ? '' : `0${(m & 0o7777).toString(8).padStart(3, '0')}`;
  const owner = x => [x.user?.name ?? x.user?.id, x.group?.name ?? x.group?.id].filter(v => v != null).join(':');
  const files = await Promise.all((storage.files || []).map(async f => ({ path: f.path, ...(await decode(f.contents)),
    badge: mode(f.mode), badgeTitle: `mode ${mode(f.mode)}`,
    note: [mode(f.mode) && `mode ${mode(f.mode)}`, owner(f) && `owner ${esc(owner(f))}`, f.overwrite ? 'replaces what’s there' : '', (f.append || []).length ? `appends ${f.append.length} part(s)` : ''].filter(Boolean).join(' · ') })));
  for (const dir of storage.directories || []) files.push({ path: `${dir.path.replace(/\/+$/, '')}/`, text: null, empty: 'A directory.', badge: mode(dir.mode) });
  for (const l of storage.links || []) files.push({ path: l.path, text: null, empty: `A ${l.hard ? 'hard' : 'symbolic'} link to ${esc(l.target)}.`, badge: `→ ${l.target}`, note: `link to ${esc(l.target)}` });
  const unitsHtml = units.length ? units.map(u => `<details class="cl-fold" ${units.length < 4 ? 'open' : ''}><summary class="cl-sum"><b class="mono">${esc(u.name)}</b>
      ${u.mask ? '<span class="pill bad">masked</span>' : u.enabled === true ? '<span class="pill ok">enabled</span>' : u.enabled === false ? '<span class="pill warn">disabled</span>' : '<span class="pill">not enabled here</span>'}
      ${(u.dropins || []).length ? `<span class="small muted">${u.dropins.length} drop-in${u.dropins.length > 1 ? 's' : ''}</span>` : ''}</summary>
      <div class="cl-fold-body">${u.contents ? Hl.block(u.contents, { lang: 'systemd' }) : '<div class="small muted">No unit file: only enables or masks it, or adds drop-ins to it.</div>'}
        ${(u.dropins || []).map(dr => `<div class="small muted mono" style="margin-top:8px">${esc(u.name)}.d/${esc(dr.name)}</div>${Hl.block(dr.contents || '', { lang: 'systemd' })}`).join('')}</div></details>`).join('')
    : '<div class="muted small">No systemd units.</div>';
  const usersHtml = (passwd.users || []).length || (passwd.groups || []).length ? `${(passwd.users || []).map(usr => `<div class="cl-item"><div class="cl-title"><b class="mono">${esc(usr.name)}</b>${usr.uid != null ? `<span class="small muted">uid ${esc(usr.uid)}</span>` : ''}</div>
      <div class="cl-kvs">${kv('Groups', (usr.groups || []).map(mono).join(', ') || (usr.primaryGroup ? mono(usr.primaryGroup) : ''))}${kv('Shell', usr.shell ? mono(usr.shell) : '')}${kv('Home', usr.homeDir ? mono(usr.homeDir) : '')}
        ${kv('Password', usr.passwordHash ? 'set (hash not shown)' : '')}</div>
      ${(usr.sshAuthorizedKeys || []).length ? `<div class="ai-sub">SSH keys it accepts · ${usr.sshAuthorizedKeys.length}</div>${usr.sshAuthorizedKeys.map(k => { const [type, key, ...c] = k.trim().split(/\s+/);
        return `<div class="small"><span class="mono">${esc(type || '')}</span> <span class="mono muted" title="${esc(key || '')}">…${esc((key || '').slice(-16))}</span> ${esc(c.join(' '))}</div>`; }).join('')}` : ''}</div>`).join('')}
      ${(passwd.groups || []).length ? `<div class="ai-sub">Groups</div>${passwd.groups.map(g => `<div class="small mono">${esc(g.name)}${g.gid != null ? ` (gid ${esc(g.gid)})` : ''}</div>`).join('')}` : ''}`
    : '<div class="muted small">No users or groups.</div>';
  const sp = mc.spec || {}, a = mc.metadata.annotations || {};
  const settingsHtml = `<div class="cl-kvs">
      ${kv('For', mono(mc.metadata.labels?.['machineconfiguration.openshift.io/role'] || 'any pool selecting it'))}
      ${kv('Made by', a['machineconfiguration.openshift.io/generated-by-controller-version'] ? `the machine config controller (${mono(a['machineconfiguration.openshift.io/generated-by-controller-version'])})` : (mc.metadata.ownerReferences || []).map(o => `${esc(o.kind)} ${mono(o.name)}`).join(', ') || 'someone, not OpenShift')}
      ${kv('Ignition', mono(ign.ignition?.version || '?'))}
      ${kv('Kernel', esc(sp.kernelType || 'default'))}${kv('FIPS', sp.fips ? 'on' : '')}
      ${kv('Kernel arguments', (sp.kernelArguments || []).map(mono).join(' ') || 'none')}
      ${kv('Extensions', (sp.extensions || []).map(mono).join(', '))}
      ${kv('OS image', sp.osImageURL ? mono(sp.osImageURL) : '')}
      ${kv('Created', ago(mc.metadata.creationTimestamp))}</div>`;
  await FileBrowser.open({
    title: name,
    subtitle: `MachineConfig${mc.metadata.labels?.['machineconfiguration.openshift.io/role'] ? ` for the ${esc(mc.metadata.labels['machineconfiguration.openshift.io/role'])} pool` : ''} · ${files.length} file${files.length === 1 ? '' : 's'}, ${units.length} unit${units.length === 1 ? '' : 's'}, ${(passwd.users || []).length} user${(passwd.users || []).length === 1 ? '' : 's'}`,
    files,
    extraTabs: [
      { id: 'units', label: `Systemd units · ${units.length}`, html: unitsHtml },
      { id: 'users', label: `Users · ${(passwd.users || []).length}`, html: usersHtml },
      { id: 'settings', label: 'Kernel and OS', html: settingsHtml },
      { id: 'yaml', label: 'YAML', html: `<div class="ci-line"><button class="btn small" data-copy-yaml>${icon('copy', 'sm')}Copy</button></div>${Hl.block(raw.yaml, { lang: 'yaml', cls: 'obj-yaml' })}` },
    ],
  });
  $('#modal [data-copy-yaml]')?.addEventListener('click', () => copyText(raw.yaml, 'Manifest copied'), { signal: modal.signal });
}

// A Helm release's chart and what it installed, to browse.
async function browseHelmRelease(ns, name) {
  modal.show(`<div class="modal-head"><div style="flex:1"><h3 class="mono">${esc(name)}</h3></div><button class="icon-btn" data-m="close">${icon('x')}</button></div>
    <div class="modal-body"><span class="spinner"></span> Reading the release…</div>`, { wide: true });
  $('#modal [data-m="close"]').addEventListener('click', () => modal.close(), { signal: modal.signal });
  let d;
  try { d = await api('GET', `/api/profiles/${encodeURIComponent(S.cur)}/helm-releases/${encodeURIComponent(ns)}/${encodeURIComponent(name)}/files`); }
  catch (e) { $('#modal .modal-body').innerHTML = `<div style="color:var(--bad)">${esc(e.message)}</div>`; return; }
  const files = Object.entries(d.files).map(([path, text]) => ({ path, text,
    note: path.startsWith('installed/manifests/') ? 'as installed (rendered)' : path === 'installed/values.yaml' ? 'the values it was installed with (credentials masked)' : path === 'chart/values.yaml' ? 'the chart’s defaults' : '' }));
  await FileBrowser.open({ title: name, subtitle: `Helm release in ${esc(ns)} · chart ${esc(d.chart || '?')} ${esc(d.version || '')} · <span class="mono">chart/</span> is the chart, <span class="mono">installed/</span> what it installed`, files, select: 'chart/Chart.yaml' });
}

function renderCluster() {
  const sec = $('#cluster-section');
  if (!sec) return;
  const d = derive(S.cur);
  const kc = d?.local?.kubeconfigs;
  if (!kc) return;  // a status that's loading (or briefly failed) isn't a reason to drop the live lists
  // Hypervisor unreachable: whether it's deployed is unknown, so keep showing what's there.
  if (!(kc.mgmt?.exists || kc['mgmt-noingress']?.exists) || (d.st.ok && !isDeployed(d))) {
    if (cl.profile) cl.stop();
    sec.innerHTML = '';
    return;
  }
  if (cl.profile !== S.cur) cl.start(S.cur);
  cl.loadHelm();
  const M = 'mgmt';
  const lists = Object.values(cl.lists).filter(l => !l.missing);
  const conn = K8s.connection(S.cur);
  const apiDown = lists.find(l => l.error);
  const syncing = lists.some(l => !l.synced && !l.error);
  const consoleHost = cl.items('console')[0]?.spec?.host;
  // One line says what's wrong with the connection; the cards keep showing what they last knew.
  const state = conn && !conn.open
    ? (!conn.everOpened && conn.failures >= 3
      ? `<span class="cl-state warn">${icon('alert', 'sm')}Can’t get live updates from the app. If you just updated it, restart the app’s server.</span>`
      : `<span class="cl-state warn">${icon('refresh', 'sm')}Reconnecting to the app…${conn.everOpened ? ' Showing what it last knew.' : ''}</span>`)
    : apiDown ? `<span class="cl-state warn" title="${esc(apiDown.error)}">${icon('alert', 'sm')}Can’t reach the cluster: ${esc(apiDown.error)}</span>`
    : syncing ? '<span class="cl-state muted"><span class="spinner"></span> Loading…</span>'
    : '<span class="cl-state muted"><span class="live-dot"></span>Live</span>';
  const err = key => { const l = cl.lists[key]; return l?.error && !l.missing && conn?.open && l.error !== apiDown?.error ? problem(l.error) : ''; };
  const loaded = (...keys) => keys.every(k => cl.lists[k]?.synced || cl.lists[k]?.stale || cl.lists[k]?.missing || cl.lists[k]?.items.size);
  const showAll = S.clusterShowAll ||= {};
  const notYet = key => cl.lists[key]?.missing;  // DPF not installed yet

  /* ── Management cluster ── */
  const vtep = (d.summary || {}).VTEP_CIDR;
  const cv = cl.items('cv')[0], cvc = conds(cv), cvs = cv?.status || {};
  const updates = cvs.availableUpdates || [];
  const cos = cl.items('co').slice().sort(byName);
  const badCo = cos.filter(o => condHealth(conds(o))[0] !== 'ok');
  const coLine = (cluster, o) => { const c = conds(o), h = condHealth(c), ver = (o.status?.versions || []).find(v => v.name === 'operator')?.version;
    return `<div class="cl-row">${objLink(cluster, CL_RES.co, o)} ${healthPill(h)} <span class="small muted">${esc(ver || '')}</span>${h[0] !== 'ok' ? `<div class="small cl-why">${esc(condMsg(c).split('\n')[0])}</div>` : ''}</div>`; };
  const overview = card('server', 'Management cluster', !loaded('cv', 'co') ? skeleton(4) : `
    <div class="cl-title">${healthPill(condHealth(cvc), condMsg(cvc))}<span>OpenShift <b>${esc(cvs.desired?.version || '?')}</b></span>
      ${cvc.Progressing?.status === 'True' ? `<span class="small muted">${esc(cvc.Progressing.message || '')}</span>` : ''}</div>
    <div class="cl-kvs">
      ${kv('Channel', mono(cv?.spec?.channel || 'none'))}
      ${kv('Updates', updates.length ? `${updates.length} available, up to ${mono(updates.map(u => u.version).sort(cmpVer).pop())}` : 'none available', updates.map(u => u.version).join(', '))}
      ${kv('Installed', cvs.history?.length ? `${ago(cvs.history[cvs.history.length - 1].completionTime || cvs.history[cvs.history.length - 1].startedTime)}` : '')}
      ${kv('Cluster ID', mono(cv?.spec?.clusterID || ''))}
    </div>${err('cv')}
    <div class="ai-sub">Cluster operators · ${cos.length - badCo.length} of ${cos.length} healthy</div>${err('co')}
    ${badCo.map(o => coLine(M, o)).join('')}
    ${cos.length - badCo.length ? `<details class="cl-more"><summary>The ${cos.length - badCo.length} healthy ones</summary><div class="cl-chips">${cos.filter(o => !badCo.includes(o)).map(o => objLink(M, CL_RES.co, o)).join(' · ')}</div></details>` : ''}`);

  // Nodes: each one with what it is, what it has and which machine config pool it's in
  const pools = cl.items('mcp');
  const poolOf = n => pools.filter(pl => Object.entries(pl.spec?.nodeSelector?.matchLabels || {}).every(([k, v]) => (n.metadata.labels || {})[k] === v)).map(pl => pl.metadata.name);
  const gib = q => { const m = /^(\d+)(Ki|Mi|Gi)?$/.exec(q || ''); return m ? (+m[1] * ({ Ki: 1 / 1048576, Mi: 1 / 1024, Gi: 1 }[m[2]] || 1 / 1073741824)) : null; };
  const nodeCard = (cluster, n, { pools: showPools = true } = {}) => {
    const c = conds(n), labels = n.metadata.labels || {}, st = n.status || {}, info = st.nodeInfo || {};
    const ip = (st.addresses || []).find(a => a.type === 'InternalIP')?.address;
    const roles = Object.keys(labels).filter(k => k.startsWith('node-role.kubernetes.io/')).map(k => k.split('/')[1]).sort();
    const pressure = Object.values(c).filter(x => x.type !== 'Ready' && x.status === 'True');
    const dpu = Object.entries(labels).filter(([k]) => k.toLowerCase().includes('dpu'));
    const mem = gib(st.capacity?.memory);
    return fold(`node:${cluster}:${n.metadata.name}`,
      `${objLink(cluster, CL_RES.nodes, n)} ${healthPill(c.Ready?.status === 'True' ? ['ok', 'Ready'] : ['bad', 'Not ready'], c.Ready?.message || '')}
        ${roles.map(x => `<span class="mach-feat">${esc(x)}</span>`).join(' ')}${n.spec?.unschedulable ? ' <span class="pill warn">Cordoned</span>' : ''}
        ${fact(`${mono(ip || '?')} · ${esc(st.capacity?.cpu || '?')} cores${mem ? ` · ${mem.toFixed(0)} GiB` : ''}`)}`,
      `<div class="cl-kvs">
        ${kv('OS', esc(info.osImage || ''))}${kv('Kernel', mono(info.kernelVersion || ''))}${kv('Kubelet', mono(`${info.kubeletVersion || ''} · ${info.architecture || ''}`))}
        ${showPools ? kv('Machine config', poolOf(n).map(mono).join(', ') || 'none') : ''}
        ${dpu.length ? kv('DPU labels', dpu.map(([k, v]) => `<span class="mach-feat" title="${esc(k)}=${esc(v)}">${esc(k.split('/').pop())}${v ? `=${esc(v)}` : ''}</span>`).join(' ')) : ''}
        ${kv('Joined', ago(n.metadata.creationTimestamp))}</div>`,
      pressure.map(x => problem(`${x.type}: ${x.message || ''}`, 'warn')).join('') + ((n.spec?.taints || []).length ? problem(`Tainted: ${n.spec.taints.map(t => `${t.key}${t.value ? `=${t.value}` : ''}:${t.effect}`).join(', ')}`, 'warn') : ''));
  };
  const nodes = card('chip', `Nodes · ${cl.items('nodes').length}`, !loaded('nodes', 'mcp') ? skeleton(3) : `${err('nodes')}${cl.items('nodes').slice().sort(byName).map(n => nodeCard(M, n)).join('')}`);

  // Installed operators: what's installed, at which version, and what OLM is doing about it
  const csvBy = Object.fromEntries(cl.items('csvs').map(x => [`${x.metadata.namespace}/${x.metadata.name}`, x]));
  const PH = { Succeeded: 'ok', Failed: 'bad', Installing: 'busy', Pending: 'busy', Replacing: 'busy', Deleting: 'busy', InstallReady: 'busy' };
  const subs = cl.items('subs').slice().sort(byName);
  const operators = card('box', `Installed operators · ${subs.length}`, !loaded('subs', 'csvs', 'ips') ? skeleton(4) : `${err('subs')}${err('csvs')}${subs.map(sub => {
    const sp = sub.spec || {}, st = sub.status || {}, ns = sub.metadata.namespace;
    const csv = csvBy[`${ns}/${st.installedCSV || st.currentCSV}`], cs = csv?.status || {};
    const plans = cl.items('ips').filter(ip => ip.metadata.namespace === ns && (ip.spec?.clusterServiceVersionNames || []).includes(st.currentCSV) && ip.status?.phase !== 'Complete');
    const upgrading = st.currentCSV && st.installedCSV && st.currentCSV !== st.installedCSV;
    return fold(`op:${ns}/${sub.metadata.name}`,
      `<b>${esc(csv?.spec?.displayName || sp.name)}</b> ${csv ? objLink(M, CL_RES.csvs, csv, csv.spec?.version || csv.metadata.name) : ''} ${csv ? healthPill([PH[cs.phase] || '', cs.phase || '?'], cs.message || '') : '<span class="pill">not installed yet</span>'}
        ${fact(`${esc(sp.channel || '?')} · ${sp.installPlanApproval === 'Automatic' ? 'auto-upgrades' : 'manual upgrades'}`)}`,
      `<div class="cl-kvs">${kv('Namespace', mono(ns))}${kv('Provider', esc(csv?.spec?.provider?.name || ''))}
        ${kv('Subscription', `${objLink(M, CL_RES.subs, sub, sub.metadata.name)}: channel ${mono(sp.channel || '?')} from ${mono(sp.source || '?')}`)}
        ${kv('Upgrades', sp.installPlanApproval === 'Automatic' ? 'automatically, to the newest in the channel' : 'only when approved')}
        ${kv('Started at', sp.startingCSV ? mono(sp.startingCSV) : '')}${kv('Installed', csv ? ago(csv.metadata.creationTimestamp) : '')}</div>`,
      (csv && cs.phase !== 'Succeeded' ? problem(`${cs.reason || cs.phase}: ${cs.message || ''}`) : '')
      + (upgrading ? problem(`OLM is moving it to ${st.currentCSV}`, 'warn') : '')
      + plans.map(ip => problem(`Install plan ${ip.metadata.name} is ${ip.status?.phase || 'pending'}${ip.spec?.approved ? '' : ' and waits for approval'}`, 'warn')).join(''));
  }).join('')}`);

  // Machine config: each pool, the nodes it targets and the configs it's made of (ours stand out)
  const ownMc = new Set(cl.items('mc').filter(m => !(m.metadata.annotations || {})['machineconfiguration.openshift.io/generated-by-controller-version'] && !/^(00|01)-/.test(m.metadata.name)).map(m => m.metadata.name));
  const helmMade = Object.fromEntries((cl.helm?.releases || []).flatMap(rel => (rel.created || []).filter(o => o.kind === 'MachineConfig' || o.kind === 'MachineConfigPool').map(o => [o.name, rel.name])));
  const machineConfig = card('layers', 'Machine config', !loaded('mcp', 'mc') ? skeleton(3) : `${err('mcp')}${pools.slice().sort(byName).map(pl => {
    const c = conds(pl), st = pl.status || {}, srcs = st.configuration?.source || [];
    const targets = cl.items('nodes').filter(n => poolOf(n).includes(pl.metadata.name)).map(n => n.metadata.name);
    const h = c.Degraded?.status === 'True' ? ['bad', 'Degraded'] : c.Updating?.status === 'True' ? ['busy', 'Updating'] : pl.spec?.paused ? ['warn', 'Paused'] : ['ok', 'Up to date'];
    const own = srcs.filter(x => ownMc.has(x.name));
    return fold(`mcp:${pl.metadata.name}`,
      `${objLink(M, CL_RES.mcp, pl)} ${healthPill(h)} ${fact(`${targets.length ? `${targets.length} node${targets.length > 1 ? 's' : ''}` : 'no nodes yet'} · ${srcs.length} configs${own.length ? `, ${own.length} added` : ''}${helmMade[pl.metadata.name] ? ` · from Helm ${esc(helmMade[pl.metadata.name])}` : ''}`)}`,
      `<div class="cl-kvs">${kv('Machines', `${st.updatedMachineCount ?? '?'} of ${st.machineCount ?? '?'} updated, ${st.readyMachineCount ?? '?'} ready`)}
        ${kv('Targets', targets.length ? targets.map(mono).join(', ') : `nodes labelled ${mono(Object.entries(pl.spec?.nodeSelector?.matchLabels || {}).map(([k, v]) => `${k}${v ? `=${v}` : ''}`).join(', '))}`)}
        ${st.configuration?.name ? kv('All of it, merged', objLink(M, CL_RES.mc, { metadata: { name: st.configuration.name } }), 'The rendered MachineConfig the nodes get') : ''}</div>
      <div class="cl-chips small">${srcs.map(x => ownMc.has(x.name) ? `<b title="${esc(helmMade[x.name] ? `From Helm release ${helmMade[x.name]}` : 'Not one of OpenShift’s own')}">${objLink(M, CL_RES.mc, { metadata: { name: x.name } })}${helmMade[x.name] ? ` <span class="muted">(Helm ${esc(helmMade[x.name])})</span>` : ''}</b>` : objLink(M, CL_RES.mc, { metadata: { name: x.name } })).join(' · ')}</div>`,
      c.Degraded?.status === 'True' ? problem(c.Degraded.message) : '');
  }).join('')}`);

  // Helm releases: chart, version, where it came from, how it was installed, what it made
  const helm = cl.helm;
  const helmCard = card('download', `Helm releases · ${cl.items('helm').length ? new Set(cl.items('helm').map(x => `${x.metadata.namespace}/${x.metadata.labels?.name}`)).size : 0}`, !helm ? skeleton(4) : helm.error ? problem(helm.error) : (helm.releases || []).map(rel => {
    const ch = rel.chart || {}, ok = rel.status === 'deployed', src = rel.source;
    const kinds = Object.entries((rel.created || []).reduce((a, o) => ({ ...a, [o.kind]: (a[o.kind] || 0) + 1 }), {}));
    const host = src ? src.url.replace(/^(oci|https?):\/\//, '').split('/')[0] : '';
    return fold(`helm:${rel.namespace}/${rel.name}`,
      `<b class="mono">${esc(rel.name)}</b> ${healthPill([ok ? 'ok' : /pending/.test(rel.status) ? 'busy' : 'bad', rel.status || '?'], rel.description || '')}
        ${fact(`${mono(`${ch.name} ${ch.version || ''}`)}${host ? ` from ${esc(host)}` : ''} · ${rel.last_deployed ? ago(rel.last_deployed) : ''}`)}
        <span class="spacer"></span><button class="btn small" data-helm-browse="${esc(rel.namespace)}|${esc(rel.name)}" title="Its chart’s files and what it installed">${icon('file', 'sm')}Browse</button>`,
      `${ch.description ? `<div class="small">${esc(ch.description)}</div>` : ''}
      <div class="cl-kvs">
        ${kv('Namespace', mono(rel.namespace))}${kv('Revision', `${esc(rel.revision)}${rel.history?.length > 1 ? ` <span class="muted">(${rel.history.map(x => `${x.revision} ${esc(x.status)}`).join(', ')})</span>` : ''}`)}
        ${kv('Chart', `${mono(ch.name)} ${mono(ch.version || '')}`)}${ch.appVersion && ch.appVersion !== ch.version ? kv('App version', mono(ch.appVersion.length > 20 ? ch.appVersion.slice(0, 12) : ch.appVersion), ch.appVersion) : ''}
        ${kv('From', src ? mono(src.url) : '<span class="muted">not recorded</span>', src ? `The ${src.setting} setting${src.how === 'repository' ? ' (matched by its name: Helm doesn’t record where a chart came from)' : ''}` : 'Helm doesn’t record where a chart came from, and no setting of this deployment points at it')}
        ${ch.home || ch.sources?.length ? kv('Source', [...new Set([ch.home, ...(ch.sources || [])].filter(Boolean))].map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, ''))}</a>`).join(' ')) : ''}
        ${ch.annotations?.commit ? kv('Commit', mono(ch.annotations.commit.slice(0, 12))) : ''}
        ${rel.dependencies?.length ? kv('Includes', rel.dependencies.map(dp => `${mono(dp.name)} ${mono(dp.version || '')}`).join(', ')) : ''}
        ${kv('Created', esc(kinds.map(([k, n]) => `${n} ${k}`).join(', ')))}
        ${kv('Values', Object.keys(rel.values || {}).length ? `set: ${Object.keys(rel.values).map(mono).join(', ')}` : 'the chart’s defaults')}
      </div>`,
      !ok && rel.description ? problem(rel.description) : '');
  }).join(''), { wide: true });

  /* ── Hosted DPU clusters ── */
  const hcs = cl.items('hc').slice().sort(byName);
  const hostedCards = hcs.map(h => {
    const c = conds(h), sp = h.spec || {}, st = h.status || {}, ns = h.metadata.namespace;
    const id = cl.watchHosted(h), inside = cl.items(`${id}:cv`)[0];
    const pools = cl.items('np').filter(x => x.metadata.namespace === ns && x.spec?.clusterName === h.metadata.name);
    const hnodes = cl.items(`${id}:nodes`).slice().sort(byName);
    const hcos = cl.items(`${id}:co`), hbad = hcos.filter(o => condHealth(conds(o))[0] !== 'ok');
    const svc = s => sp.services?.find(x => x.service === s)?.servicePublishingStrategy;
    const pub = s => { const x = svc(s); return x ? `${esc(x.type)}${x.nodePort?.address ? ` on ${mono(x.nodePort.address)}` : ''}` : ''; };
    const prov = cl.items('prov').find(pv => pv.status?.hostedClusterRef?.name === h.metadata.name && pv.status?.hostedClusterRef?.namespace === ns);
    const dpuc = cl.items('dpucluster').find(dc => dc.spec?.kubeconfig === (st.kubeconfig || st.kubeConfig)?.name);
    const etcd = sp.etcd?.managed?.storage?.persistentVolume;
    const history = st.version?.history || [];
    return card('cloud', `Hosted cluster ${h.metadata.name}`, `
      <div class="cl-title">${healthPill(condHealth(c), condMsg(c))}<span>OpenShift <b>${esc(history[0]?.version || '?')}</b>${history[0]?.state === 'Partial' ? ' <span class="small muted">(rolling out)</span>' : ''}</span>
        ${objLink(M, CL_RES.hc, h, 'HostedCluster')}
        ${prov ? fact(`made by provisioner ${objLink(M, CL_RES.prov, prov)}`) : ''}${dpuc ? fact(`DPF’s DPU cluster ${objLink(M, CL_RES.dpucluster, dpuc)}`) : ''}</div>
      ${whyNot(c)}
      ${fold(`hc-cp:${id}`, `<b>Control plane</b> ${fact(`on the management cluster in ${mono(`${ns}-${h.metadata.name}`)} · API ${mono(st.controlPlaneEndpoint?.host ? `${st.controlPlaneEndpoint.host}:${st.controlPlaneEndpoint.port}` : '?')}`)}`,
        `<div class="cl-kvs">
          ${kv('Published', `API ${pub('APIServer')}${svc('Ignition') ? `, ignition ${pub('Ignition')}` : ''}`)}
          ${kv('Replicas', esc(sp.controllerAvailabilityPolicy === 'SingleReplica' ? 'one of each (SingleReplica)' : sp.controllerAvailabilityPolicy || ''))}
          ${kv('etcd', etcd ? `${esc(etcd.size || '?')} on ${mono(etcd.storageClassName || 'default storage')}` : esc(sp.etcd?.managementType || ''))}
          ${kv('Pods', mono((sp.networking?.clusterNetwork || []).map(x => x.cidr).join(', ')))}${kv('Services', mono((sp.networking?.serviceNetwork || []).map(x => x.cidr).join(', ')))}
          ${kv('Release', mono((sp.release?.image || '').split('/').pop()), sp.release?.image)}</div>`)}
      ${fold(`hc-in:${id}`, `<b>Inside</b> ${inside ? `${!hnodes.length && condHealth(conds(inside))[0] === 'bad' ? healthPill(['warn', 'waiting for its nodes'], 'Expected until the DPUs join: what runs on nodes can’t be available without any') : healthPill(condHealth(conds(inside)), condMsg(conds(inside)))} ${fact(`${hcos.length - hbad.length} of ${hcos.length} operators healthy · ${hnodes.length} node${hnodes.length === 1 ? '' : 's'} (DPUs)`)}` : fact((st.kubeconfig || st.kubeConfig)?.name ? 'connecting…' : 'no kubeconfig yet')}`,
        `${hbad.length && !hnodes.length ? '<div class="small muted">Expected for now: it has no nodes yet, and these run on its nodes (the DPUs).</div>' : ''}
          ${hbad.map(o => coLine(id, o)).join('')}
          ${pools.map(np => `<div class="small" style="margin-top:6px">Node pool ${objLink(M, CL_RES.np, np)}: ${np.status?.replicas ?? 0} of ${np.spec?.replicas ?? 0}${np.spec?.replicas ? '' : ' <span class="muted">(DPF adds the DPUs as they come up)</span>'}</div>`).join('')}
          ${hnodes.map(n => nodeCard(id, n, { pools: false })).join('')}`)}`, { wide: true });
  });

  // The provisioner: what it was asked to make, how that's going, and the DPU ignition it wrote
  const provCards = cl.items('prov').slice().sort(byName).map(pv => {
    const c = conds(pv), sp = pv.spec || {}, ref = sp.dpuClusterRef || {};
    const cfg = cl.items('provcfg')[0]?.spec || {};
    const cmName = `bfcfg-${ref.name}.cfg`, cm = cl.items('cms').find(x => x.metadata.namespace === ref.namespace && x.metadata.name === cmName);
    const a = cm?.metadata?.annotations || {};
    const built = { release: a['dpfhcpprovisioner.dpu.hcp.io/bfcfg-template-ocp-release-image'] || a['provisioning.dpu.nvidia.com/bfcfg-template-ocp-release-image'], os: a['dpfhcpprovisioner.dpu.hcp.io/bfcfg-template-machine-os-url'] };
    const vs = (have, want) => have ? `${mono(have.split('/').pop())}${want && have !== want ? ` ${healthPill(['warn', 'stale'], `The provisioner now asks for ${want}`)}` : ''}` : '';
    const phase = pv.status?.phase;
    return card('cog', `DPF HCP provisioner ${pv.metadata.name}`, `
      <div class="cl-title">${healthPill([phase === 'Ready' ? 'ok' : phase === 'Error' ? 'bad' : 'busy', phase || '?'], condMsg(c))}${objLink(M, CL_RES.prov, pv, 'DPFHCPProvisioner')}
        ${fact(`makes ${mono(`api.${pv.metadata.name}.${sp.baseDomain || '?'}`)}`)}</div>
      ${whyNot(c)}
      ${fold(`prov:${pv.metadata.name}`, `<b>What it was asked for</b> ${fact(`${mono((sp.ocpReleaseImage || '').split('/').pop())} · DPU OS ${mono((sp.machineOSURL || '').split(':').pop())}`)}`,
        `<div class="cl-kvs">
          ${kv('For', `DPU cluster ${mono(ref.name || '?')} and DPUDeployment ${mono(sp.dpuDeploymentRef?.name || '?')}`)}
          ${kv('Release', mono((sp.ocpReleaseImage || '').split('/').pop()), sp.ocpReleaseImage)}
          ${kv('DPU OS', mono((sp.machineOSURL || '').split('/').pop()), sp.machineOSURL)}
          ${kv('Control plane', `${esc(sp.controlPlaneAvailabilityPolicy || '')}, etcd on ${mono(sp.etcdStorageClass || 'default')}`)}
          ${kv('Pod network', sp.flannelEnabled ? 'Flannel' : 'not Flannel')}
          ${kv('Secrets', `pull ${mono(sp.pullSecretRef?.name || '?')}, SSH ${mono(sp.sshKeySecretRef?.name || '?')} ${c.SecretsValid ? healthPill(c.SecretsValid.status === 'True' ? ['ok', 'valid'] : ['bad', 'invalid'], c.SecretsValid.message || '') : ''}`)}
          ${kv('Templates', cfg.manageDPUServiceTemplates ? 'makes the DPU service templates' : 'leaves DPU service templates to you')}</div>
          ${allConds(c)}`)}
      ${fold(`prov-ign:${pv.metadata.name}`, `<b>DPU ignition</b> ${cm ? `${objLink(M, CL_RES.cms, cm)} ${fact(`written ${ago(cm.metadata.creationTimestamp)}`)}${built.release && sp.ocpReleaseImage && built.release !== sp.ocpReleaseImage ? healthPill(['warn', 'stale'], `Built for ${built.release}; the provisioner now asks for ${sp.ocpReleaseImage}`) : ''}` : fact('not written yet')}`,
        cm ? `<div class="cl-kvs">${kv('ConfigMap', `${mono(cmName)} in ${mono(ref.namespace)}`)}
            ${kv('Built for', vs(built.release, sp.ocpReleaseImage), built.release)}${kv('DPU OS', vs(built.os, sp.machineOSURL), built.os)}
            ${kv('With', `BFB ${mono(a['provisioning.dpu.nvidia.com/bfcfg-template-bfb-name'] || '?')}, flavor ${mono(a['provisioning.dpu.nvidia.com/bfcfg-template-dpuflavor-name'] || '?')}`)}
            ${c.IgnitionEndpointAvailable ? kv('Served by', `the hosted cluster’s ignition server ${healthPill(c.IgnitionEndpointAvailable.status === 'True' ? ['ok', 'up'] : ['bad', 'down'], c.IgnitionEndpointAvailable.message || '')}`) : ''}</div>`
          : `<div class="small muted">It will be ${mono(cmName)} in ${mono(ref.namespace || '?')}.</div>`)}`);
  });

  /* ── DPF ── */
  const dpfcfg = cl.items('dpfcfg')[0];
  const dpfCard = card('layers', 'DPF', notYet('dpfcfg') ? '<div class="muted small">Not installed yet: deploy-dpf installs it.</div>' : !dpfcfg ? skeleton(3) : (() => {
    const c = conds(dpfcfg), sp = dpfcfg.spec || {}, pc = sp.provisioningController || {}, net = sp.networking || {};
    // "System components must be ready …:\n * sfc-controller: …" → one problem per component
    const blockers = (c.SystemComponentsReady?.status !== 'True' ? (c.SystemComponentsReady?.message || '').split('\n').filter(l => /^\s*\*/.test(l)).map(l => l.replace(/^\s*\*\s*/, '')) : []);
    const on = (x, name) => x && !x.disable ? `<span class="mach-feat">${name}</span>` : '';
    return `<div class="cl-title">${healthPill(condHealth(c), condMsg(c))}<span>DPF <b>${esc(dpfcfg.status?.version || '?')}</b></span>${objLink(M, CL_RES.dpfcfg, dpfcfg, 'DPFOperatorConfig')}
        ${fact(`MTU ${esc(net.highSpeedMTU || '?')} · up to ${esc(pc.maxDPUParallelInstallations ?? '?')} DPU installs at once`)}</div>
      ${blockers.map(b => problem(b)).join('')}
      ${whyNot(c)}
      ${fold('dpf-settings', '<b>Settings</b>', `<div class="cl-kvs">
        ${kv('MTU', `${esc(net.highSpeedMTU || '?')} high-speed, ${esc(net.controlPlaneMTU || '?')} control plane`)}
        ${kv('DPU OOB bridge', mono(net.dpuNodeOOBBridgeName || ''))}
        ${kv('API for DPUs', mono(`${sp.overrides?.kubernetesAPIServerVIP || '?'}:${sp.overrides?.kubernetesAPIServerPort || ''}`))}
        ${kv('Flannel pods', mono(sp.flannel?.podCIDR || ''))}
        ${kv('VF resources', `${mono(sp.nodeSRIOVDevicePluginController?.devicePlugin?.defaultResourcePrefix || '?')}/…`)}
        ${kv('Installs', `up to ${esc(pc.maxDPUParallelInstallations ?? '?')} DPUs at once; OS install timeout ${esc(pc.osInstallTimeout || '?')}`)}
        ${kv('Runs', [on(sp.staticClusterManager, 'static cluster manager'), on(sp.kamajiClusterManager, 'Kamaji'), on(sp.nodeSRIOVDevicePluginController, 'SR-IOV device plugin'), on(sp.multus, 'Multus'), on(sp.cniInstaller, 'CNI installer'), on(sp.dpuServiceController, 'DPU service controller')].filter(Boolean).join(' '))}
        ${kv('Pull secrets', (sp.imagePullSecrets || []).map(mono).join(', '))}
      </div>${allConds(c)}`)}`;
  })());

  // The DPU cluster DPF puts the DPUs in (here, the hosted cluster)
  const dpuClusterCards = cl.items('dpucluster').map(dc => {
    const c = conds(dc), st = dc.status || {};
    const h = hcs.find(x => (x.status?.kubeconfig || x.status?.kubeConfig)?.name === dc.spec?.kubeconfig);
    return card('cloud', `DPU cluster ${dc.metadata.name}`, `
      <div class="cl-title">${healthPill([st.phase === 'Ready' ? 'ok' : 'busy', st.phase || '?'], condMsg(c))}${objLink(M, CL_RES.dpucluster, dc, 'DPUCluster')}</div>
      ${whyNot(c)}
      <div class="cl-kvs">${kv('Type', esc(dc.spec?.type || ''))}${kv('Kubernetes', mono(st.version || '?'))}
        ${kv('DPUs', `${esc(st.nodesCount ?? 0)} of up to ${esc(dc.spec?.maxNodes ?? '?')}`)}
        ${kv('Is', h ? `the hosted cluster ${mono(h.metadata.name)} (its kubeconfig ${mono(dc.spec.kubeconfig)})` : `reached with ${mono(dc.spec?.kubeconfig || '?')}`)}</div>`);
  });

  // DPUDeployment: the whole chain, from BFB and flavor through DPU sets to DPUs, and the services on them
  const svcLine = (name, v, ns) => {
    const t = cl.items('dst').find(o => o.metadata.namespace === ns && o.metadata.name === v.serviceTemplate);
    const f = cl.items('dsc').find(o => o.metadata.namespace === ns && o.metadata.name === v.serviceConfiguration);
    const src = t?.spec?.helmChart?.source || {};
    return `<div class="cl-svc"><b class="mono">${esc(name)}</b>
      <span>${t ? `${objLink(M, CL_RES.dst, t, `${src.chart || 'chart'} ${src.version || ''}`)} ${Object.keys(conds(t)).length ? healthPill(condHealth(conds(t))) : ''}` : `<span class="pill bad" title="DPUServiceTemplate ${esc(v.serviceTemplate)} doesn’t exist">no template ${esc(v.serviceTemplate || '')}</span>`}</span>
      <span>${f ? `${objLink(M, CL_RES.dsc, f, 'configuration')}${(f.spec?.interfaces || []).length ? ` <span class="small muted">· ${f.spec.interfaces.map(i => `${esc(i.name)}→${esc(i.network)}`).join(', ')}</span>` : ''}` : `<span class="pill bad">no configuration ${esc(v.serviceConfiguration || '')}</span>`}</span>
      ${t?.spec?.resourceRequirements ? `<span class="small muted">needs ${esc(Object.entries(t.spec.resourceRequirements).map(([k, x]) => `${x} ${k}`).join(', '))}</span>` : ''}</div>`;
  };

  // DPU services as DPF builds them: a DPUServiceTemplate (the chart, and the values every
  // deployment shares) and the DPUServiceConfiguration with the same deploymentServiceName (this
  // deployment's values, interfaces and DaemonSet settings), which a DPUDeployment pairs under that
  // name in its services; DPF makes a DPUService from the two. It merges the values like Helm does:
  // the configuration's win, tables merge key by key, and anything else (lists too) is replaced whole.
  const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const mergeVals = (cfg, tpl) => {
    if (!isMap(cfg) || !isMap(tpl)) return cfg ?? tpl;
    const out = { ...cfg };
    for (const [k, v] of Object.entries(tpl)) if (!(k in out)) out[k] = v; else if (isMap(v) && isMap(out[k])) out[k] = mergeVals(out[k], v);
    return out;
  };
  const canon = v => JSON.stringify(v, (_, x) => isMap(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
  // The merged values as YAML, each line marked with where it comes from: t(emplate), c(onfiguration),
  // o (the configuration overriding the template, which said something else).
  const vBlock = (cls, ind, key, v, note = '', title = '') => toYaml({ [key]: v }, ind).replace(/^\n/, '').split('\n').map((l, i) =>
    `<div class="cl-v ${cls}"${title ? ` title="${esc(title)}"` : ''}>${esc(l)}${i === 0 && note ? `<span class="cl-v-note">  # ${esc(note)}</span>` : ''}</div>`).join('');
  const was = t => isMap(t) ? 'the template’s table' : Array.isArray(t) ? `the template’s list of ${t.length}`
    : typeof t === 'string' && t.includes('\n') ? `the template’s ${t.split('\n').length} lines` : `template: ${toYaml(t).slice(0, 60)}`;
  const valLines = (cfg, tpl, n, ind = '') => [...new Set([...Object.keys(tpl || {}), ...Object.keys(cfg || {})])].map(k => {
    const inC = isMap(cfg) && k in cfg, inT = isMap(tpl) && k in tpl, c = cfg?.[k], t = tpl?.[k];
    if (inC && inT && isMap(c) && isMap(t)) return `<div class="cl-v">${esc(`${ind}${k}:`)}</div>${valLines(c, t, n, `${ind}  `)}`;
    const cls = !inC ? 't' : !inT ? 'c' : canon(c) === canon(t) ? 'c same' : 'o';
    n[cls[0]]++;
    return vBlock(cls, ind, k, inC ? c : t, cls === 'o' ? `replaces ${was(t)}` : cls === 'c same' ? 'the template says the same' : '', cls === 'o' ? `The template’s value:\n${toYaml(t)}` : '');
  }).join('');
  const valuesView = (tv, fv) => {
    const n = { t: 0, c: 0, o: 0 };
    const lines = valLines(isMap(fv) ? fv : {}, isMap(tv) ? tv : {}, n);
    return lines ? `<div class="cl-v-legend small"><span class="cl-v t">${n.t} from the template</span><span class="cl-v c">${n.c} from the configuration</span>${n.o ? `<span class="cl-v o">${n.o} where the configuration overrides the template</span>` : ''}</div>
      <div class="cl-vals">${lines}</div>` : '<div class="small muted">No values: the chart’s defaults.</div>';
  };
  const svcGroups = new Map();
  const svcGroup = (ns, name) => { const k = `${ns}/${name}`; if (!svcGroups.has(k)) svcGroups.set(k, { ns, name, tpls: [], cfgs: [], uses: [] }); return svcGroups.get(k); };
  for (const t of cl.items('dst')) svcGroup(t.metadata.namespace, t.spec?.deploymentServiceName || t.metadata.name).tpls.push(t);
  for (const f of cl.items('dsc')) svcGroup(f.metadata.namespace, f.spec?.deploymentServiceName || f.metadata.name).cfgs.push(f);
  for (const dd of cl.items('dpudeploy')) for (const [n, v] of Object.entries(dd.spec?.services || {})) svcGroup(dd.metadata.namespace, n).uses.push({ dd, v });
  const tplKvs = t => { const src = t.spec?.helmChart?.source || {}, a = t.metadata.annotations || {}, st = t.status || {};
    return `<div class="cl-kvs">
      ${kv('Chart', `${mono(src.chart || src.path || '?')} ${mono(src.version || '')}`, src.repoURL)}${kv('From', mono(src.repoURL || ''))}${kv('Release name', src.releaseName ? mono(src.releaseName) : '')}
      ${kv('Needs on each node', esc(Object.entries(t.spec?.resourceRequirements || {}).map(([k, x]) => `${x} ${k}`).join(', ')))}
      ${t.spec?.security ? kv('Security', esc([t.spec.security.privileged != null && (t.spec.security.privileged ? 'privileged' : 'unprivileged'), t.spec.security.spiffe && 'SPIFFE identity'].filter(Boolean).join(', '))) : ''}
      ${Object.keys(st.versions || {}).length ? kv('Needs versions', esc(Object.entries(st.versions).map(([k, x]) => `${k.split('/').pop()} ${x}`).join(', '))) : ''}
      ${t.metadata.labels?.['dpfhcpprovisioner.dpu.hcp.io/managed'] === 'true' ? kv('Kept by', `the DPF HCP provisioner <span class="muted">(it rewrites it, so edits don’t stick; set its overrides instead)</span>`) : ''}
      ${a['dpfhcpprovisioner.dpu.hcp.io/source-x86-ovn-image'] ? kv('Follows the host’s OVN', mono(a['dpfhcpprovisioner.dpu.hcp.io/source-x86-ovn-image'].split('/').pop()), a['dpfhcpprovisioner.dpu.hcp.io/source-x86-ovn-image']) : ''}
      ${kv('Changed', ago(t.metadata.managedFields?.map(m => m.time).filter(Boolean).sort().pop() || t.metadata.creationTimestamp))}</div>`; };
  const cfgKvs = f => { const sc = f.spec?.serviceConfiguration || {}, ds = sc.serviceDaemonSet || {}, ports = sc.configPorts;
    return `<div class="cl-kvs">
      ${kv('Runs on', sc.deployInCluster ? 'the hosts (deployInCluster)' : 'the DPUs')}
      ${kv('Interfaces', (f.spec?.interfaces || []).map(i => `${mono(i.name)} → ${mono(i.network)}${i.virtualNetwork ? ` (${mono(i.virtualNetwork)})` : ''}`).join(', '))}
      ${Object.keys(ds.annotations || {}).length ? kv('DaemonSet annotations', Object.keys(ds.annotations).map(k => `<span class="mono" title="${esc(ds.annotations[k])}">${esc(k)}</span>`).join(', ')) : ''}
      ${Object.keys(ds.labels || {}).length ? kv('DaemonSet labels', esc(Object.entries(ds.labels).map(([k, x]) => `${k}=${x}`).join(', '))) : ''}
      ${Object.keys(ds.resources || {}).length ? kv('DaemonSet resources', esc(Object.entries(ds.resources).map(([k, x]) => `${x} ${k}`).join(', '))) : ''}
      ${ds.updateStrategy ? kv('Updates', esc(ds.updateStrategy.type || ''), toYaml(ds.updateStrategy)) : ''}
      ${ports ? kv('Ports to the host', `${esc(ports.serviceType || '')} ${(ports.ports || []).map(p => mono(`${p.name || ''}:${p.port}/${p.protocol || 'TCP'}`)).join(', ')}`) : ''}
      ${Object.keys(f.spec?.upgradePolicy || {}).length ? kv('Upgrade policy', esc(toYaml(f.spec.upgradePolicy).replace(/^\n/, '').replace(/\n\s*/g, ', '))) : ''}</div>`; };
  const svcFolds = [...svcGroups.values()].sort((a, b) => a.name.localeCompare(b.name) || a.ns.localeCompare(b.ns)).map(g => {
    const inNs = (list, name) => cl.items(list).find(o => o.metadata.namespace === g.ns && o.metadata.name === name);
    // What gets merged: each DPUDeployment's pair; with none, the template and configuration that would be.
    const pairs = new Map();
    for (const u of g.uses) {
      const t = inNs('dst', u.v.serviceTemplate), f = inNs('dsc', u.v.serviceConfiguration), k = `${u.v.serviceTemplate}|${u.v.serviceConfiguration}`;
      if (!pairs.has(k)) pairs.set(k, { t, f, tName: u.v.serviceTemplate, fName: u.v.serviceConfiguration, uses: [] });
      pairs.get(k).uses.push(u);
    }
    if (!pairs.size) {
      if (g.tpls.length === 1 && g.cfgs.length === 1) pairs.set('', { t: g.tpls[0], f: g.cfgs[0], uses: [] });
      else for (const x of [...g.tpls.map(t => ({ t })), ...g.cfgs.map(f => ({ f }))]) pairs.set(x.t?.metadata.name || `|${x.f.metadata.name}`, { ...x, uses: [] });
    }
    const probs = [];
    if (!g.tpls.length) probs.push([`No DPUServiceTemplate has deploymentServiceName ${g.name}`, g.uses.length ? 'bad' : 'warn']);
    if (!g.cfgs.length) probs.push([`No DPUServiceConfiguration has deploymentServiceName ${g.name}`, g.uses.length ? 'bad' : 'warn']);
    const body = [...pairs.values()].map(p => {
      const tv = p.t?.spec?.helmChart?.values, fv = p.f?.spec?.serviceConfiguration?.helmChart?.values;
      if (p.uses.length && !p.t) probs.push([`DPUDeployment ${p.uses.map(u => u.dd.metadata.name).join(', ')} names template ${p.tName}, which doesn’t exist`, 'bad']);
      if (p.uses.length && !p.f) probs.push([`DPUDeployment ${p.uses.map(u => u.dd.metadata.name).join(', ')} names configuration ${p.fName}, which doesn’t exist`, 'bad']);
      for (const [o, kind] of [[p.t, 'template'], [p.f, 'configuration']]) if (o && p.uses.length && o.spec?.deploymentServiceName !== g.name)
        probs.push([`The ${kind} ${o.metadata.name} is for ${o.spec?.deploymentServiceName || '?'}, but the DPUDeployment lists it under ${g.name}`, 'bad']);
      // The DPUService DPF made from them, for each deployment: its newest revision should carry the merge.
      const made = p.uses.map(u => {
        const svcs = cl.items('dpusvc').filter(s => s.metadata.namespace === g.ns && s.metadata.labels?.['svc.dpu.nvidia.com/owned-by-dpudeployment'] === `${g.ns}_${u.dd.metadata.name}`
          && s.metadata.labels?.['svc.dpu.nvidia.com/dpudeployment-service'] === g.name).sort((a, b) => (b.metadata.creationTimestamp || '').localeCompare(a.metadata.creationTimestamp || ''));
        const s = svcs[0], deps = (u.v.dependsOn || []).map(x => x.name);
        let check = '';
        if (s && p.t && p.f) {
          const sameChart = canon(s.spec?.helmChart?.source) === canon(p.t.spec?.helmChart?.source);
          // With dependsOn, DPF first fills the configuration's {{ .Services.<name> }} references, so the values can't be compared here.
          const sameVals = deps.length || canon(s.spec?.helmChart?.values ?? null) === canon(mergeVals(fv, tv) ?? null);
          if (!sameChart) probs.push([`DPUService ${s.metadata.name} still uses another chart than template ${p.t.metadata.name}: DPF hasn’t rolled the change out yet`, 'warn']);
          if (!sameVals) probs.push([`DPUService ${s.metadata.name}’s values differ from what template ${p.t.metadata.name} and configuration ${p.f.metadata.name} give now: DPF hasn’t rolled the change out yet`, 'warn']);
          check = sameChart && sameVals ? `<span class="ci-ok-text small">${deps.length ? 'same chart' : 'same chart and values'}</span>` : '';
        }
        return `<div class="cl-row">DPUDeployment ${objLink(M, CL_RES.dpudeploy, u.dd)} → ${s ? `${objLink(M, CL_RES.dpusvc, s)} ${healthPill(condHealth(conds(s)), condMsg(conds(s)))} ${check}` : '<span class="muted">no DPUService yet</span>'}
          ${svcs.length > 1 ? `<span class="small muted">· older revisions still there: ${svcs.slice(1).map(x => objLink(M, CL_RES.dpusvc, x)).join(', ')}</span>` : ''}
          ${deps.length ? `<div class="small muted">Made after ${deps.map(mono).join(', ')}: DPF fills the configuration’s <span class="mono">{{ .Services.&lt;name&gt; }}</span> references with their DPUServices first.</div>` : ''}</div>`;
      }).join('');
      return `<div class="cl-pair">
        <div class="cl-pair-objs">
          <div><div class="ai-sub">Template ${p.t ? objLink(M, CL_RES.dst, p.t) : `<span class="mono">${esc(p.tName || '')}</span> <span class="pill ${p.uses.length ? 'bad' : ''}">none</span>`} ${p.t && Object.keys(conds(p.t)).length ? healthPill(condHealth(conds(p.t)), condMsg(conds(p.t))) : ''}</div>${p.t ? tplKvs(p.t) : ''}</div>
          <div><div class="ai-sub">Configuration ${p.f ? objLink(M, CL_RES.dsc, p.f) : `<span class="mono">${esc(p.fName || '')}</span> <span class="pill ${p.uses.length ? 'bad' : ''}">none</span>`}</div>${p.f ? cfgKvs(p.f) : ''}</div>
        </div>
        ${made}
        <div class="ai-sub">${p.t && p.f ? 'Values DPF gives the chart' : p.t ? 'The template’s values' : 'The configuration’s values'}</div>
        ${valuesView(tv, fv)}</div>`;
    }).join('');
    const t0 = g.tpls[0], src = t0?.spec?.helmChart?.source || {};
    const svc0 = cl.items('dpusvc').find(s => s.metadata.namespace === g.ns && s.metadata.labels?.['svc.dpu.nvidia.com/dpudeployment-service'] === g.name);
    return fold(`svcpair:${g.ns}/${g.name}`,
      `<b class="mono">${esc(g.name)}</b> ${t0 ? fact(`${mono(src.chart || src.path || '?')} ${mono(src.version || '')}`) : ''}
        ${g.uses.length ? fact(`in ${g.uses.map(u => mono(u.dd.metadata.name)).join(', ')}`) : '<span class="pill" title="No DPUDeployment lists it in its services">not used</span>'}
        ${svc0 ? healthPill(condHealth(conds(svc0)), condMsg(conds(svc0))) : ''}
        ${fact(g.ns)}`,
      body, probs.map(([m, cls]) => problem(m, cls)).join(''));
  });
  const svcPairsCard = svcFolds.length ? card('file', `DPU service templates and configurations · ${svcGroups.size}`, `
    <div class="small muted">A DPUDeployment pairs a template (the chart, and values every deployment shares) with a configuration (this deployment’s values, interfaces and DaemonSet settings) under one service name, and DPF makes a DPUService from the two. Their values merge like Helm’s: the configuration wins, tables merge key by key, lists are replaced whole.</div>
    ${svcFolds.join('')}`, { wide: true }) : '';
  const deployCards = cl.items('dpudeploy').slice().sort(byName).map(dd => {
    const c = conds(dd), sp = dd.spec || {}, dp = sp.dpus || {}, ns = dd.metadata.namespace;
    const bfb = cl.items('bfb').find(b => b.metadata.namespace === ns && b.metadata.name === dp.bfb);
    const flavor = cl.items('flavor').find(f => f.metadata.namespace === ns && f.metadata.name === dp.flavor);
    const sets = cl.items('dpuset').filter(s => s.metadata.namespace === ns && s.metadata.name.startsWith(`${dd.metadata.name}-`));
    const dpus = cl.items('dpu').filter(u => sets.some(s => u.metadata.labels?.['provisioning.dpu.nvidia.com/dpuset-name'] === s.metadata.name));
    const hostsFor = sel => cl.items('nodes').filter(n => Object.entries(sel?.matchLabels || {}).every(([k, v]) => (n.metadata.labels || {})[k] === v));
    const chains = sp.serviceChains?.switches || [];
    const port = p => p.service ? `${p.service.name}:${p.service.interface}` : p.serviceInterface ? Object.values(p.serviceInterface.matchLabels || {}).join(',') : '?';
    return card('rocket', `DPUDeployment ${dd.metadata.name}`, `
      <div class="cl-title">${healthPill(condHealth(c), condMsg(c))}${objLink(M, CL_RES.dpudeploy, dd, 'DPUDeployment')}</div>
      ${whyNot(c)}
      <div class="cl-chain">
        <div><span>BFB</span>${bfb ? `${objLink(M, CL_RES.bfb, bfb)} ${healthPill(bfb.status?.phase === 'Ready' ? ['ok', 'Ready'] : ['busy', bfb.status?.phase || '?'])}<small>DOCA ${esc((bfb.status?.versions || bfb.spec?.versions || {}).doca || '?')}</small>` : `<b class="mono">${esc(dp.bfb || '?')}</b> <span class="pill bad">missing</span>`}</div>
        <div><span>Flavor</span>${flavor ? objLink(M, CL_RES.flavor, flavor) : `<b class="mono">${esc(dp.flavor || '?')}</b> <span class="pill bad">missing</span>`}<small>${esc(flavor?.spec?.dpuMode || '')}</small></div>
        ${(dp.dpuSets || []).map(ds => { const s = sets.find(x => x.metadata.name === `${dd.metadata.name}-${ds.nameSuffix}`); const hosts = hostsFor(ds.dpuNodeSelector);
          return `<div><span>DPU set</span>${s ? objLink(M, CL_RES.dpuset, s) : `<b class="mono">${esc(ds.nameSuffix)}</b>`}<small title="${esc(Object.entries(ds.dpuNodeSelector?.matchLabels || {}).map(([k, v]) => `${k}=${v}`).join(', '))}">${hosts.length} host${hosts.length === 1 ? '' : 's'} labelled ${esc(Object.keys(ds.dpuNodeSelector?.matchLabels || {}).map(k => k.split('/').pop()).join(', ') || 'any')}</small></div>`; }).join('')}
        <div><span>DPUs</span><b>${dpus.length}</b><small>${dpus.filter(u => u.status?.phase === 'Ready').length} ready</small></div>
      </div>
      <div class="ai-sub">Services on each DPU</div>
      <div class="cl-svcs">${Object.entries(sp.services || {}).map(([n, v]) => svcLine(n, v, ns)).join('')}</div>
      ${chains.length ? `<div class="ai-sub">Service chains</div>${chains.map(sw => `<div class="small mono">${sw.ports.map(port).map(esc).join(' ⇄ ')}${sw.serviceMTU ? ` <span class="muted">(MTU ${esc(sw.serviceMTU)})</span>` : ''}</div>`).join('')}` : ''}
      <div class="small muted">Node effect: ${dp.nodeEffect?.drain ? 'drains the host' : esc(Object.keys(dp.nodeEffect || {}).join(', ') || 'none')} · DPU sets roll out ${esc(dp.dpuSetStrategy?.type || '?')}</div>
      ${allConds(c)}`, { wide: true });
  });

  // DPUs: each one, where it is in provisioning, and how it's doing since
  const dpuCards = cl.items('dpu').slice().sort(byName).map(u => {
    const c = conds(u), st = u.status || {}, sp = u.spec || {};
    const oc = Object.fromEntries((st.operationalConditions || []).map(x => [x.type, x]));
    const agent = Object.fromEntries((st.agentStatus?.conditions || []).map(x => [x.type, x]));
    const dev = cl.items('dpudevice').find(x => x.metadata.name === sp.dpuDeviceName);
    const at = DPU_PHASES.indexOf(st.phase);
    const services = Object.entries(sp.cluster?.nodeLabels || {}).filter(([k]) => k.startsWith('svc.dpu.nvidia.com/dpuservice-') && k.endsWith('-version')).map(([k, v]) => [k.replace('svc.dpu.nvidia.com/dpuservice-', '').replace(/-version$/, ''), v]);
    const links = ['PF0LinkDown', 'PF1LinkDown'].filter(k => agent[k]).map(k => `${k.slice(0, 3)} ${agent[k].status === 'False' ? '<span class="ci-ok-text">up</span>' : '<span class="ci-bad-text">down</span>'}`);
    return card('chip', `DPU ${sp.dpuDeviceName || u.metadata.name}`, `
      <div class="cl-title">${healthPill(st.phase === 'Ready' ? ['ok', 'Ready'] : st.phase === 'Error' ? ['bad', 'Error'] : ['busy', st.phase || '?'], condMsg(c))}
        ${oc.OperationalReady ? healthPill(oc.OperationalReady.status === 'True' ? ['ok', 'Operational'] : ['bad', 'Not operational'], oc.OperationalReady.message || '') : ''}${objLink(M, CL_RES.dpu, u, 'DPU')}</div>
      ${st.phase !== 'Ready' ? `<div class="cl-steps">${DPU_PHASES.map((p, i) => `<span class="${i < at ? 'done' : i === at ? 'cur' : ''}" title="${esc(p)}">${esc(p)}</span>`).join('')}</div>` : ''}
      ${whyNot(c)}${Object.values(oc).filter(x => x.status !== 'True').map(x => problem(`${x.type}: ${x.message || x.reason}`)).join('')}
      <div class="cl-kvs">
        ${kv('Host', mono(sp.dpuNodeName || '?'))}${kv('IP', mono((st.addresses || []).find(a => a.type === 'InternalIP')?.address || ''))}
        ${kv('Card', `${mono(sp.serialNumber || '')} at PCI ${mono(sp.pciAddress || '')}${dev?.status?.pf0Name ? ` (${mono(dev.status.pf0Name)})` : ''}`)}
        ${kv('Runs', `BFB ${mono(sp.bfb || '?')} · flavor ${mono(sp.dpuFlavor || '?')} · ${esc(st.dpuMode || '')} mode`)}
        ${kv('Installed via', esc(st.dpuInstallInterface || ''))}${links.length ? kv('Ports', links.join(' · ')) : ''}
        ${agent.HostAgentConnected ? kv('Host agent', agent.HostAgentConnected.status === 'True' ? `connected <span class="muted">(${esc(agent.HostAgentConnected.message || '')})</span>` : `<span class="ci-bad-text">not connected</span>`) : ''}
        ${['NICFirmwareUpgraded', 'BMCFirmwareUpgraded'].filter(k => agent[k]).map(k => kv(k.startsWith('NIC') ? 'NIC firmware' : 'BMC firmware', esc(agent[k].message || agent[k].status))).join('')}
        ${services.length ? kv('Services', services.map(([n]) => mono(n)).join(', ')) : ''}
      </div>
      ${st.agentStatus?.conditions?.length ? `<details class="cl-more"><summary>Host agent checks · ${st.agentStatus.conditions.filter(x => x.status === 'True' || /LinkDown$/.test(x.type)).length} of ${st.agentStatus.conditions.length} fine</summary><div class="cl-conds">${st.agentStatus.conditions.map(x =>
        `<div><span class="cl-dot ${(/LinkDown$/.test(x.type) ? x.status === 'False' : x.status === 'True') ? 'ok' : 'bad'}"></span><b>${esc(x.type)}</b> <span class="small muted">${esc(x.message || '')}</span></div>`).join('')}</div></details>` : ''}
      ${allConds(c)}`);
  });
  const dpusEmpty = !cl.items('dpu').length && cl.items('dpudeploy').length ? card('chip', 'DPUs', `<div class="small muted">None yet. DPF makes a DPU for each card on the hosts its DPU sets select${cl.items('dpuset').length ? '' : ', once the DPUDeployment’s DPU sets exist'}.</div>`) : '';

  // DPF's own components on the DPUs and the hosts (DPUServices it makes itself), by component
  const comps = Object.entries(cl.items('dpusvc').filter(s => s.metadata.labels?.['dpu.nvidia.com/component']).reduce((a, s) => { const k = s.metadata.labels['dpu.nvidia.com/component']; (a[k] ||= []).push(s); return a; }, {})).sort(([a], [b]) => a.localeCompare(b));
  const userSvcs = cl.items('dpusvc').filter(s => !s.metadata.labels?.['dpu.nvidia.com/component']);
  const creds = cl.items('cred');
  const chartOf = s => s.spec?.helmChart?.source || {};
  const sameChart = [...new Set(cl.items('dpusvc').map(s => `${chartOf(s).chart} ${chartOf(s).version}`))];
  const componentsCard = cl.items('dpusvc').length ? card('swap', `DPF components · ${comps.length}`, `
    ${sameChart.length === 1 ? `<div class="small muted">All from chart ${mono(sameChart[0])} (${mono(chartOf(cl.items('dpusvc')[0]).repoURL || '')})</div>` : ''}
    <div class="cl-comps">${comps.map(([k, list]) => { const bad = list.filter(s => condHealth(conds(s))[0] === 'bad');
      return `<div class="cl-comp ${bad.length ? 'bad' : ''}"><b>${esc(k)}</b>${list.map(s => `<div class="small">${objLink(M, CL_RES.dpusvc, s, s.spec?.deployInCluster ? 'on the hosts' : 'on the DPUs')} ${healthPill(condHealth(conds(s)), condMsg(conds(s)))}</div>`).join('')}
        ${bad.map(s => problem(condMsg(conds(s)).split('\n')[0])).join('')}</div>`; }).join('')}</div>
    ${userSvcs.length ? `<div class="ai-sub">Your services · ${userSvcs.length}</div>${userSvcs.map(s => `<div class="cl-row">${objLink(M, CL_RES.dpusvc, s)} ${healthPill(condHealth(conds(s)), condMsg(conds(s)))} <span class="small muted">${esc(chartOf(s).chart || '')} ${esc(chartOf(s).version || '')}</span></div>`).join('')}` : ''}
    ${creds.length ? `<div class="small muted" style="margin-top:8px" title="${esc(creds.map(x => x.metadata.name).join(', '))}">${creds.length} of them get a DPU cluster token (DPUServiceCredentialRequests), renewed every ${esc(creds[0].spec?.duration || '?')}; the next expires ${until(creds.map(x => x.status?.expirationTimestamp).filter(Boolean).sort()[0])}</div>` : ''}`) : '';

  // Networking on the DPUs: interfaces, address pools (one is the HBN slot), networks
  const netCard = cl.items('dsi').length || cl.items('ipam').length || cl.items('nad').length ? card('network', 'DPU networking', `
    <div class="ai-sub" style="margin-top:0">Interfaces</div>
    <div class="cl-chips">${cl.items('dsi').slice().sort(byName).map(i => { const t = i.spec?.template?.spec?.template?.spec || {};
      return `${objLink(M, CL_RES.dsi, i)} <span class="small muted">${esc(t.interfaceType || '')}${t.physical?.interfaceName ? ` ${esc(t.physical.interfaceName)}` : ''}</span>`; }).join(' · ')}</div>
    <div class="ai-sub">Address pools</div>
    ${cl.items('ipam').slice().sort(byName).map(p => { const n = p.spec?.ipv4Network || p.spec?.ipv4Subnet || {}, c = conds(p);
      return `<div class="cl-row">${objLink(M, CL_RES.ipam, p)} ${mono(n.network || n.subnet || '?')} <span class="small muted">a /${esc(n.prefixSize || '?')} per DPU${n.gatewayIndex != null ? `, gateway .${esc(n.gatewayIndex)}` : ''}</span>
        ${n.network && vtep && n.network === vtep ? '<span class="pill info" title="VTEP_CIDR">your HBN slot</span>' : ''} ${healthPill(condHealth(c))}
        ${whyNot(c)}</div>`; }).join('')}
    <div class="ai-sub">Networks for services</div>
    ${cl.items('nad').slice().sort(byName).map(nd => { const sp = nd.spec || {}, c = conds(nd);
      return `<div class="cl-row">${objLink(M, CL_RES.nad, nd)} <span class="small muted">bridge ${mono(sp.bridge || '?')}, ${esc(sp.resourceType || '?')}s, MTU ${esc(sp.serviceMTU || '?')}${sp.ipam ? ', with addresses' : ''}${(sp.chainedCNIs || []).length ? `, + ${sp.chainedCNIs.map(x => esc(x.type)).join(', ')}` : ''}</span> ${healthPill(condHealth(c))}
        ${whyNot(c)}</div>`; }).join('')}`) : '';

  // Host networking and SR-IOV, as the cluster knows it: OVN-Kubernetes's view of each node's
  // gateway (its node annotations), Node Feature Discovery's of its NIC (labels), the VF pools
  // the node offers (its resources) and how DPF splits the VFs into pools (NodeSRIOVDevicePluginConfig).
  const prefix = cl.items('dpfcfg')[0]?.spec?.nodeSRIOVDevicePluginController?.devicePlugin?.defaultResourcePrefix || '';
  const vfCfgs = cl.items('vfs');
  const vfPools = vfCfgs.flatMap(v => (v.spec?.devicePluginResources || []).map(res => ({ cfg: v, res, name: `${prefix ? `${prefix}/` : ''}${res.name}`,
    count: (res.ranges || []).reduce((n, x) => n + (x.end - x.start + 1), 0) })));
  const json = v => { try { return JSON.parse(v || 'null'); } catch { return null; } };
  const inCidr = (ip, cidr) => { const [net, bits] = (cidr || '').split('/'); if (!net || !ip) return false; const n = x => x.split('.').reduce((a, o) => a * 256 + +o, 0);
    const m = bits === '0' ? 0 : (0xffffffff << (32 - +bits)) >>> 0; return ((n(ip) & m) >>> 0) === ((n(net) & m) >>> 0); };
  const hostNet = n => {
    const a = n.metadata.annotations || {}, l = n.metadata.labels || {};
    const gw = json(a['k8s.ovn.org/l3-gateway-config'])?.default || {};
    const mgmt = json(a['k8s.ovn.org/node-mgmt-port'])?.default;
    const encap = json(a['k8s.ovn.org/node-encap-ips']) || [];
    const hostCidrs = (json(a['k8s.ovn.org/host-cidrs']) || []).filter(x => !x.includes(':'));
    const podNet = json(a['k8s.ovn.org/node-subnets'])?.default || [];
    const gwIp = (gw['ip-address'] || '').split('/')[0];
    const nfd = k => l[`feature.node.kubernetes.io/${k}`];
    const isDpuHost = 'k8s.ovn.org/dpu-host' in l || nfd('dpu-enabled') !== undefined;
    const offered = Object.entries(n.status?.allocatable || {}).filter(([k]) => vfPools.some(p => p.name === k) || (prefix && k.startsWith(`${prefix}/`)));
    return fold(`net:${n.metadata.name}`,
      `<b class="mono">${esc(n.metadata.name)}</b>${isDpuHost ? '<span class="mach-feat">DPU host</span>' : ''}
        ${gw['bridge-id'] ? fact(`out through ${mono(gw['bridge-id'])} as ${mono(gw['ip-address'] || '?')}${isDpuHost && gw['bridge-id'] !== 'br-ex' ? ' (through the DPU)' : ''}`) : fact('OVN-Kubernetes hasn’t set it up (yet)')}
        ${vtep && gwIp && inCidr(gwIp, vtep) ? '<span class="pill info" title="VTEP_CIDR">in your HBN slot</span>' : ''}
        ${offered.length ? fact(offered.map(([k, v]) => `${v} ${esc(k.split('/').pop())}`).join(', ')) : ''}`,
      `<div class="cl-kvs">
        ${kv('Gateway', gw['bridge-id'] ? `${mono(gw['bridge-id'])} ${mono(gw['ip-address'] || '')} via ${mono(gw['next-hop'] || '?')}` : '')}
        ${kv('Gateway MAC', mono(gw['mac-address'] || ''))}
        ${kv('Tunnel IP', encap.length ? encap.map(mono).join(', ') : '', 'Where Geneve tunnels to this node end (node-encap-ips)')}
        ${kv('Other addresses', hostCidrs.filter(x => x.split('/')[0] !== gwIp).map(mono).join(', '))}
        ${kv('Pod subnet', podNet.map(mono).join(', '))}
        ${mgmt ? kv('Management port', `VF ${esc(mgmt.FuncId)} of PF${esc(mgmt.PfId)} (${mono(mgmt.DeviceId || '?')})`, 'The VF OVN-Kubernetes uses for the host’s own traffic (node-mgmt-port)') : ''}
        ${a['k8s.ovn.org/gateway-mtu-support'] === 'false' ? kv('Gateway MTU', 'not supported on this path') : ''}
        ${isDpuHost ? kv('DPU card', `${mono(nfd('dpu-0-pf0-name') || '?')} at PCI ${mono(nfd('dpu-0-pci-address') || '?')}, ${esc(nfd('dpu-0-number-of-pfs') || '?')} PFs`) : ''}
        ${isDpuHost ? kv('SR-IOV', `${nfd('network-sriov.configured') !== undefined ? 'configured' : nfd('network-sriov.capable') !== undefined ? 'capable, not configured' : 'not detected'}${nfd('dpu-oob-bridge-configured') !== undefined ? ' · OOB bridge set up' : ''}`) : ''}
        ${offered.map(([k, v]) => { const pl = vfPools.find(x => x.name === k); return kv(k, `${esc(v)} offered${pl && +v !== pl.count ? ` <span class="muted">(its pool allows ${pl.count})</span>` : ''}`); }).join('')}
      </div>`);
  };
  const netNodes = cl.items('nodes').slice().sort((a, b) => ('k8s.ovn.org/dpu-host' in (b.metadata.labels || {})) - ('k8s.ovn.org/dpu-host' in (a.metadata.labels || {})) || byName(a, b));
  const hostNetCard = card('network', 'Host networking and SR-IOV', !loaded('nodes') ? skeleton(3) : `
    ${netNodes.map(hostNet).join('')}
    ${vfPools.length ? `<div class="ai-sub">How DPF splits the DPU hosts’ VFs</div>${vfCfgs.map(v => `<div class="small muted">${objLink(M, CL_RES.vfs, v)}${(cl.items('dpudeploy')[0]?.spec?.dpus?.dpuSets || []).some(x => x.dpuAnnotations?.['noderesources.dpu.nvidia.com/nodesriovdevicepluginconfig'] === v.metadata.name) ? ' · the DPUDeployment’s DPU sets use it' : ''}</div>`).join('')}
      ${vfPools.map(p => `<div class="cl-row"><b class="mono">${esc(p.name)}</b> <span class="small">${p.count} ${esc(p.res.type || '')}${p.count === 1 ? '' : 's'}${p.res.options?.isRdma ? ', RDMA' : ''}: ${(p.res.ranges || []).map(x => `PF${x.pfIndex} ${x.start === x.end ? `VF ${x.start}` : `VFs ${x.start}–${x.end}`}`).join(' + ')}</span></div>`).join('')}` : ''}`, { wide: true });

  // BFBs and flavors: what the DPUs are flashed with, and how they're configured
  const bfbCard = cl.items('bfb').length ? card('download', 'BFB', cl.items('bfb').map(b => { const st = b.status || {}, v = st.versions || b.spec?.versions || {}, c = conds(b);
    const users = cl.items('dpudeploy').filter(dd => dd.spec?.dpus?.bfb === b.metadata.name).map(dd => dd.metadata.name);
    return fold(`bfb:${b.metadata.name}`,
      `${objLink(M, CL_RES.bfb, b)} ${healthPill(st.phase === 'Ready' ? ['ok', 'Ready'] : /error|fail/i.test(st.phase || '') ? ['bad', st.phase] : ['busy', st.phase || '?'], condMsg(c))}
        ${fact(`${v.doca ? `DOCA ${esc(v.doca)} · ` : ''}<span title="${esc(b.spec?.url || '')}">${esc((b.spec?.url || '').split('/').pop())}</span>`)}`,
      `<div class="cl-kvs">${kv('Image', `<span class="mono">${esc(b.spec?.url || '')}</span>`)}
        ${kv('Inside', ['doca', 'bsp', 'atf', 'uefi'].filter(k => v[k]).map(k => `${k.toUpperCase()} ${mono(v[k])}`).join(' · '))}
        ${kv('Downloaded', c.Downloaded ? (c.Downloaded.status === 'True' ? `yes, as ${mono(st.fileName || '?')}` : esc(c.Downloaded.message || 'not yet')) : '')}
        ${kv('Used by', users.length ? users.map(mono).join(', ') : 'nothing yet')}</div>`,
      whyNot(c)); }).join('')) : '';
  const flavorCard = cl.items('flavor').length ? card('sliders', 'DPU flavor', cl.items('flavor').map(f => { const sp = f.spec || {};
    const nv = (sp.nvconfig || []).flatMap(x => x.parameters || []);
    const nvv = k => (nv.find(x => x.startsWith(`${k}=`)) || '').split('=')[1];
    const grub = sp.grub?.kernelParameters || [];
    const huge = grub.filter(x => /^hugepages/.test(x)).join(' ');
    return fold(`flavor:${f.metadata.name}`,
      `${objLink(M, CL_RES.flavor, f)} ${fact(`${esc(sp.dpuMode || '')} mode${nvv('NUM_OF_VFS') ? ` · ${esc(nvv('NUM_OF_VFS'))} VFs per PF` : ''}${huge ? ` · ${esc(huge)}` : ''}`)}`,
      `<div class="cl-kvs">${kv('SFs', esc(nvv('PF_TOTAL_SF') ? `${nvv('PF_TOTAL_SF')} total` : ''))}
        ${kv('Links', esc([nvv('LINK_TYPE_P1'), nvv('LINK_TYPE_P2')].filter(Boolean).join(' / ')))}
        ${kv('Firmware settings', `${nv.length} (NVConfig)`)}${kv('Kernel arguments', `${grub.length}`)}${kv('OVS', sp.ovs?.rawConfigScript ? 'a setup script' : '')}
        ${kv('Sysctl', sp.sysctl?.parameters?.length ? `${sp.sysctl.parameters.length} settings` : '')}</div>
      <details class="cl-more"><summary>All its settings</summary>${yamlBlock(sp)}</details>`); }).join('')) : '';

  // Anything else in DPF's API groups, by kind
  const others = cl.kinds.map(k => ({ k, list: cl.items(`kind:${k.plural}`) })).filter(x => x.list.length);
  const othersCard = others.length ? card('layers', 'Other DPF objects', others.map(({ k, list }) => `<div class="cl-row"><b>${esc(k.kind)}</b> <span class="small">${list.slice().sort(byName).map(o => `${objLink(M, k, o)} ${condHealth(conds(o))[0] === 'bad' ? healthPill(['bad', 'not ready'], condMsg(conds(o))) : ''}`).join(' · ')}</span></div>`).join('')) : '';

  const head = `<div class="cl-head"><h2>${icon('server')}Cluster</h2>${state}
    ${consoleHost ? `<a class="btn small" href="https://${esc(consoleHost)}" target="_blank" rel="noopener">OpenShift console ${icon('external', 'sm')}</a>` : ''}</div>`;
  // Tabs: each a set of cards. A tab's dot is the worst thing in it (a problem or a red/amber
  // status on its cards); tabs with nothing to show yet are left out.
  const health = html => /cl-problem bad|pill bad/.test(html) ? 'bad' : /cl-problem warn|pill warn/.test(html) ? 'warn' : '';
  const nodesReady = cl.items('nodes').filter(n => conds(n).Ready?.status === 'True').length;
  const csvOk = subs.filter(x => csvBy[`${x.metadata.namespace}/${x.status?.installedCSV}`]?.status?.phase === 'Succeeded').length;
  const helmRel = cl.helm?.releases || [];
  const poolsOk = pools.filter(pl => condHealth(conds(pl))[0] !== 'bad' && conds(pl).Updating?.status !== 'True').length;
  const dpus = cl.items('dpu'), dd = cl.items('dpudeploy')[0];
  const tabs = [
    { id: 'nodes', label: 'Nodes', icon: 'chip', cards: [nodes, hostNetCard],
      glance: `${nodesReady} of ${cl.items('nodes').length} node${cl.items('nodes').length === 1 ? '' : 's'} ready` },
    { id: 'operators', label: 'Operators', icon: 'box', cards: [operators, helmCard],
      glance: `${csvOk} of ${subs.length} operators installed fine · ${helmRel.filter(x => x.status === 'deployed').length} of ${helmRel.length} Helm releases deployed` },
    { id: 'mc', label: 'Machine config', icon: 'layers', cards: [machineConfig],
      glance: `${poolsOk} of ${pools.length} pools up to date` },
    { id: 'hosted', label: 'Hosted cluster', icon: 'cloud', cards: [...hostedCards, ...provCards],
      glance: hcs.map(h => `${esc(h.metadata.name)}: ${esc(condHealth(conds(h))[1].toLowerCase())}, OpenShift ${esc(h.status?.version?.history?.[0]?.version || '?')}`).join(' · ') },
    { id: 'dpf', label: 'DPF', icon: 'layers', cards: [dpfCard, ...dpuClusterCards, ...deployCards, svcPairsCard, componentsCard, netCard, othersCard],
      glance: [dpfcfg && `DPF ${esc(dpfcfg.status?.version || '?')} ${esc(condHealth(conds(dpfcfg))[1].toLowerCase())}`, dd && `DPUDeployment ${esc(condHealth(conds(dd))[1].toLowerCase())}`].filter(Boolean).join(' · ') },
    { id: 'dpus', label: 'DPUs', icon: 'chip', cards: [...dpuCards, dpusEmpty, bfbCard, flavorCard],
      glance: dpus.length ? `${dpus.filter(u => u.status?.phase === 'Ready').length} of ${dpus.length} DPUs ready` : 'none yet' },
  ].map(t => ({ ...t, cards: t.cards.filter(Boolean) })).filter(t => t.cards.length && !(t.id === 'dpf' && notYet('dpfcfg') && !cl.items('dpudeploy').length));
  for (const t of tabs) t.health = health(t.cards.join(''));
  const glance = card('activity', 'At a glance', tabs.map(t => `<button class="cl-glance" data-cl-tab="${t.id}">
      <span class="cl-dot ${t.health === 'bad' ? 'bad' : t.health === 'warn' ? 'warn' : 'ok'}"></span><b>${esc(t.label)}</b><span class="small muted">${t.glance || ''}</span></button>`).join(''));
  tabs.unshift({ id: 'overview', label: 'Overview', icon: 'server', cards: [overview, glance], health: health(overview) });
  let tab = S.clusterTab || 'overview';
  if (!tabs.some(t => t.id === tab)) tab = 'overview';
  const active = tabs.find(t => t.id === tab);
  sec.innerHTML = `${head}
    <div class="cl-tabs" role="tablist">${tabs.map(t => `<button class="cl-tab ${t.id === tab ? 'active' : ''}" role="tab" aria-selected="${t.id === tab}" data-cl-tab="${t.id}">
      ${icon(t.icon, 'sm')}${esc(t.label)}${t.health ? `<span class="cl-dot ${t.health}"></span>` : ''}</button>`).join('')}</div>
    <div class="grid cols-2 cl-grid">${active.cards.join('')}</div>
    ${tab === 'dpf' && cl.discoverError ? `<div class="small muted">Couldn’t list DPF’s other kinds: ${esc(cl.discoverError)}</div>` : ''}`;
  $$('[data-cl-tab]', sec).forEach(b => b.onclick = () => { S.clusterTab = b.dataset.clTab; renderCluster(); });
  $$('[data-obj]', sec).forEach(b => b.onclick = e => { e.preventDefault(); const [c, path] = b.dataset.obj.split('|'); (/\/machineconfigs\//.test(path) ? showMachineConfig : showObject)(c, path); });
  $$('[data-helm-browse]', sec).forEach(b => b.onclick = e => { e.preventDefault(); const [ns, name] = b.dataset.helmBrowse.split('|'); browseHelmRelease(ns, name); });
  keepFolds(sec);
}

/* ── Red Hat accounts: aicli's login on the hypervisor and the pull secret's ─── */

// Identities only (names, emails, org), never credentials. Asked again every 5 minutes.
async function loadAccounts(name = S.cur, force = false) {
  const st = (S.accounts ||= {})[name] ||= {};
  if (st.loading || (!force && st.at && nowSec() - st.at < 300) || !derive(name)?.st.ok) return;
  st.loading = true;
  try { st.data = await api('GET', `/api/profiles/${encodeURIComponent(name)}/accounts`); }
  catch (e) { st.data = { error: e.message }; }
  st.loading = false; st.at = nowSec();
  if (name === S.cur) renderAccounts();
}

function renderAccounts() {
  const el = $('#card-accounts');
  if (!el) return;
  const d = derive(S.cur);
  const st = S.accounts?.[S.cur];
  loadAccounts();
  const hv = (profileObj()?.host || '').split('.')[0];
  const head = cardHead('key', 'Red Hat accounts', `<button class="icon-btn" id="acct-refresh" title="Check again">${st?.loading ? '<span class="spinner"></span>' : icon('refresh')}</button>`);
  if (!d?.st.ok || !st?.data) { el.innerHTML = head + `<div class="card-body">${d && !d.st.ok ? '<div class="muted">Unavailable</div>' : skeleton(3)}</div>`; return; }
  if (st.data.error) { el.innerHTML = head + `<div class="card-body small" style="color:var(--bad)">${esc(st.data.error)}</div>`; }
  else {
    const { aicli: ai = {}, pull_secret: ps = {} } = st.data;
    const who = a => `${a.name ? `${esc(a.name)} ` : ''}<span class="mono small muted">${esc(a.email || a.username || '?')}</span>`;
    const aiBody = ai.error ? `<span class="muted">${esc(ai.error)}</span>`
      : ai.unknown ? '<span class="muted">Logged in, but its cached login is from another session; it’s known after aicli’s next run.</span>'
      : who(ai);
    const same = ps.email && ai.email && ps.email.toLowerCase() === ai.email.toLowerCase();
    const psBody = ps.error ? `<span style="color:var(--bad)">${esc(ps.error)}</span>`
      : `${ps.email ? `<span class="mono">${esc(ps.email)}</span>` : '<span class="muted">No Red Hat account in it</span>'}
        ${ps.email && ai.email ? (same ? `${okIcon()}<span class="ci-ok-text small">same account as aicli</span>`
          : `${badIcon()}<span class="ci-bad-text small">not aicli’s account</span>${infoTip('The automation repo expects the OpenShift pull secret to come from the same Red Hat account aicli uses (scripts/env.sh).')}`) : ''}`;
    el.innerHTML = head + `<div class="card-body cfg-lines">
      <div><span>aicli on ${esc(hv)}${infoTip(`The account aicli is logged in as: the token in ${ai.dir || '~/.aicli'}/offlinetoken.txt (or in AICLI_HOME, if the repo’s .env sets it). The clusters it creates on Assisted Installer belong to this account, so console.redhat.com shows them to it.`)}</span><b>${aiBody}</b></div>
      <div><span title="${esc(ps.path || '')}">Pull secret ${esc((ps.path || '').split('/').pop())}${ps.default ? ' (default)' : ''} <button class="link-btn small" id="acct-change">change</button></span><b>${psBody}</b></div></div>`;
    $('#acct-change').onclick = () => openEditor('overview', { card: 'secrets' });
  }
  $('#acct-refresh').onclick = () => loadAccounts(S.cur, true);
}

/* ── The management cluster's install, as Assisted Installer sees it ───── */

const AI_STATUS = {
  'pending-for-input': ['Not started', ''], insufficient: ['Not started', ''], ready: ['Ready to install', ''],
  'preparing-for-installation': ['Preparing', 'busy'], installing: ['Installing', 'busy'],
  'installing-pending-user-action': ['Needs action', 'warn'], finalizing: ['Finalizing', 'busy'],
  installed: ['Installed', 'ok'], error: ['Failed', 'bad'], cancelled: ['Cancelled', 'warn'], 'adding-hosts': ['Installed', 'ok'],
};
const AI_BUSY = ['preparing-for-installation', 'installing', 'installing-pending-user-action', 'finalizing'];
const isoSec = t => t ? Date.parse(String(t).replace(' ', 'T')) / 1000 : 0;

// Asked every 20s while it installs (or a deploy is running), else every 5 minutes.
async function loadInstall(name = S.cur, force = false) {
  const st = (S.install ||= {})[name] ||= {};
  const d = derive(name);
  if (!d?.st.ok || st.loading) return;
  const busy = AI_BUSY.includes(st.data?.details?.status) || !!d.running?.stages?.includes('install');
  if (!force && st.at && nowSec() - st.at < (busy ? 20 : 300)) return;
  st.loading = true;
  try { st.data = await api('GET', `/api/profiles/${encodeURIComponent(name)}/cluster-install`); }
  catch (e) { st.data = { error: e.message }; }
  st.loading = false; st.at = nowSec();
  if (name === S.cur) renderInstall();
}

function renderInstall() {
  const el = $('#card-install');
  if (!el) return;
  const d = derive(S.cur);
  const st = S.install?.[S.cur];
  if (!st?.at) { loadInstall(); }
  const r = st?.data, det = r?.details;
  const deploying = !!d?.running?.stages?.includes('install');
  // Shown once Assisted Installer has the cluster, or while a deploy is about to create it.
  el.hidden = !det && !deploying;
  if (el.hidden) return;
  const refresh = `<button class="icon-btn" id="ai-refresh" title="Ask Assisted Installer again">${st?.loading ? '<span class="spinner"></span>' : icon('refresh')}</button>`;
  if (!det) {
    el.innerHTML = cardHead('server', 'Management cluster install', refresh) + `<div class="card-body muted small">${
      r?.error ? `<span style="color:var(--bad)">Couldn’t ask Assisted Installer: ${esc(r.error)}</span>`
      : r ? 'Assisted Installer doesn’t have the cluster yet: the deploy creates it in its cluster-install step.' : skeleton(2)}</div>`;
    $('#ai-refresh').onclick = () => loadInstall(S.cur, true);
    return;
  }
  const [label, cls] = AI_STATUS[det.status] || [det.status, ''];
  const started = isoSec(det.started_at), done = isoSec(det.completed_at);
  const timing = started ? (done ? `took ${fmtDur(done - started)}` : AI_BUSY.includes(det.status) ? `started <span data-since="${started}">${fmtDur(nowSec() - started)}</span> ago` : '') : '';
  const stage = det.status === 'finalizing' && det.finalizing_stage ? det.finalizing_stage : det.status_info;

  const hosts = det.hosts.map(h => `<tr>
      <td class="mono">${esc(h.name || '?')}</td>
      <td class="muted">${esc(h.role || '')}${h.bootstrap ? ' · bootstrap' : ''}</td>
      <td>${esc(h.stage || h.status_info || h.status || '')}</td>
      <td class="ai-pct">${h.percent != null ? `<div class="progress"><div style="width:${h.percent}%"></div></div><span class="small muted">${h.percent}%</span>` : ''}</td></tr>`).join('');
  const OP = { available: 'ok', progressing: 'busy', failed: 'bad', degraded: 'warn' };
  const ops = det.operators.length && det.status !== 'installed' ? `<div class="ai-sub">Operators</div><div class="ai-ops">${det.operators.map(o =>
      `<span class="pill ${OP[o.status] || ''}" title="${esc(o.status_info || o.status || 'waiting')}">${OP[o.status] === 'busy' ? '<span class="dot"></span>' : ''}${esc(o.name)}: ${esc(o.status || 'waiting')}</span>`).join('')}</div>` : '';
  const all = S.installAllEvents;
  const evs = det.events.slice(0, all ? 20 : 6);
  const sev = { warning: 'warn', error: 'bad', critical: 'bad' };
  const events = evs.length ? `<div class="ai-sub">Latest events</div><div class="ai-events">${evs.map(e => `<div class="ai-ev ${sev[e.severity] || ''}">
      <span class="ai-ev-t" title="${esc(e.at || '')}">${e.at ? fmtAgo(isoSec(e.at)) : ''}</span><span>${esc(e.message || '')}</span></div>`).join('')}</div>
      ${det.events.length > 6 ? `<button class="link-btn" id="ai-more">${all ? 'Fewer' : `All ${det.events.length}`}</button>` : ''}` : '';

  if (det.status === 'installed' || det.status === 'adding-hosts') {
    el.innerHTML = cardHead('server', 'Cluster install', refresh) + `<div class="card-body">
      <div class="ai-top"><span class="pill ok">Installed</span><span class="small muted">OpenShift ${esc(det.version || '?')}${timing ? ` · ${timing}` : ''}${done ? ` · ${fmtAgo(done)}` : ''}</span></div>
      ${fold('install-details', '<b>Details</b>', `<div class="muted small">${det.api_ips.length ? `API on <span class="mono">${esc(det.api_ips.join(', '))}</span> · ` : ''}<span class="mono">${esc(r.name)}</span>${det.owner ? ` · owned by <span class="mono">${esc(det.owner)}</span> (aicli’s account)` : ''}</div>
        ${hosts ? `<div class="ai-sub">Hosts</div><table class="ai-hosts"><tbody>${hosts}</tbody></table>` : ''}${events}`)}</div>`;
    $('#ai-refresh').onclick = () => loadInstall(S.cur, true);
    $('#ai-more')?.addEventListener('click', () => { S.installAllEvents = !S.installAllEvents; renderInstall(); });
    keepFolds(el);
    return;
  }
  el.innerHTML = cardHead('server', 'Cluster install', refresh) + `<div class="card-body">
    <div class="ai-top"><span class="pill ${cls}">${cls === 'busy' ? '<span class="dot"></span>' : ''}${esc(label)}</span>
      <span>${esc(stage || '')}</span><span class="spacer"></span><span class="muted small">${timing}</span></div>
    ${det.percent != null && det.status !== 'installed' ? `<div class="progress ${det.status === 'error' ? 'failed' : ''}" style="margin:8px 0"><div style="width:${det.percent}%"></div></div>` : ''}
    <div class="muted small">OpenShift ${esc(det.version || '?')}${det.api_ips.length ? ` · API on <span class="mono">${esc(det.api_ips.join(', '))}</span>` : ''} · <span class="mono">${esc(r.name)}</span>${det.owner ? ` · owned by <span class="mono">${esc(det.owner)}</span>` : ''}</div>
    ${hosts ? `<div class="ai-sub">Hosts</div><table class="ai-hosts"><tbody>${hosts}</tbody></table>` : ''}
    ${ops}${events}</div>`;
  $('#ai-refresh').onclick = () => loadInstall(S.cur, true);
  const more = $('#ai-more');
  if (more) more.onclick = () => { S.installAllEvents = !S.installAllEvents; renderInstall(); };
}

async function forgetKube(kind) {
  const name = S.cur;
  try {
    const res = await api('DELETE', `/api/profiles/${encodeURIComponent(name)}/kubeconfigs/${kind}`);
    if (S.status[name]) S.status[name].local.kubeconfigs = res.kubeconfigs;
    toast('Deleted the old kubeconfig', 'ok');
    renderKube(); renderDeploy();
  } catch (e) { toast(e.message, 'bad'); }
}

async function fetchKube(kinds) {
  const name = S.cur;
  S.kubeBusy = { ...(S.kubeBusy || {}), [name]: kinds };
  renderKube();
  try {
    const res = await api('POST', `/api/profiles/${encodeURIComponent(name)}/kubeconfigs/fetch`, { kinds });
    if (S.status[name]) S.status[name].local.kubeconfigs = res.kubeconfigs;
    const failed = Object.entries(res.results).filter(([, r]) => !r.ok);
    if (failed.length) toast(failed.map(([k, r]) => `${res.kubeconfigs[k]?.label || k}: ${r.error}`).join(' · '), 'bad');
    else toast(kinds.length > 1 ? 'Kubeconfigs fetched' : 'Kubeconfig fetched', 'ok');
  } catch (e) {
    toast(e.message, 'bad');
  } finally {
    S.kubeBusy[name] = null;
    if (name === S.cur) { renderKube(); renderDeploy(); }
  }
}

/* ── Activity ─────────────────────────────────────────────────────────── */

document.addEventListener('click', e => {
  const b = e.target.closest('[data-open-job]');
  if (b) {
    const d = derive(S.cur);
    const meta = d?.jobs.find(j => j.id === b.dataset.openJob);
    if (meta) drawer.open(getJob(S.cur, meta));
    return;
  }
  const c = e.target.closest('[data-copy]');
  if (c) copyText(c.dataset.copy, `Copied: ${c.dataset.copy.length > 60 ? c.dataset.copy.slice(0, 57) + '…' : c.dataset.copy}`);
});

/* ── HBN subnets ─────────────────────────────────────────────────────── */

async function loadSubnets(refresh = false) {
  try { S.subnets = await api('GET', `/api/subnets${refresh ? '?refresh=1' : ''}`); }
  catch (e) { S.subnets = { error: e.message, subnets: [] }; }
  return S.subnets;
}

// The HBN allocations as a grid; slots you may use carry data-pick="<cidr>".
function slotGridHtml(d, cur) {
  const isMe = o => !!o && (d.me || []).includes(o);
  return `<div class="sn-grid">${d.subnets.map(sub => `
      <div class="sn-subnet"><div class="sn-head"><span>Subnet ${sub.id}</span><code>${esc(sub.cidr)}</code></div>
      ${sub.slots.map(slot => {
        const selected = cur === slot.cidr;
        const mine = isMe(slot.owner);
        const cls = `sn-slot ${slot.kind || 'free'} ${mine ? 'me' : ''} ${selected ? 'here' : ''} pickable`;
        const attrs = `data-pick="${esc(slot.cidr)}" data-pick-owner="${esc(slot.owner || '')}" title="Use ${esc(slot.cidr)}"`;
        const check = selected ? `<span class="sn-check">${icon('check', 'sm')}</span>` : '';
        if (slot.kind === 'user') {
          const u = d.users[slot.owner] || {};
          // The whole tile picks the slot; GitHub is the small icon in the corner.
          return `<div class="${cls}" ${attrs}>
            ${avatarHtml(u.avatar || `https://avatars.githubusercontent.com/${encodeURIComponent(slot.owner)}?s=96`)}
            <div class="sn-who"><div class="sn-name">${esc(u.name || slot.owner)}${isMe(slot.owner) ? '<span class="tag">you</span>' : ''}</div>
              <div class="sn-sub">@${esc(slot.owner)} · <span class="mono">${esc(slot.cidr)}</span></div></div>${check}
            ${ghLink(slot.owner)}</div>`;
        }
        return `<div class="${cls}" ${attrs}><span class="sn-free-icon">${icon('plus')}</span>
          <div class="sn-who"><div class="sn-name">Free</div><div class="sn-sub">${slot.description ? `${esc(slot.description)} · ` : ''}<span class="mono">${esc(slot.cidr)}</span></div></div>${check}</div>`;
      }).join('')}</div>`).join('')}</div>`;
}

// A small GitHub icon linking to a user, for the corner of a tile (the tile itself stays clickable).
function ghLink(login) {
  return `<a class="gh-link" href="https://github.com/${encodeURIComponent(login)}" target="_blank" rel="noopener" title="@${esc(login)} on GitHub">${icon('github', 'sm')}</a>`;
}

function avatarHtml(src, size = 28) {
  return `<img class="avatar" src="${esc(src)}" width="${size}" height="${size}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
}

/* ════════════════════════════════════════════════════════════════════════
   Actions
   ════════════════════════════════════════════════════════════════════════ */

async function runJob(stages, { fetchKubeconfigs = false, openLog = false, alsoFetchNow = false } = {}) {
  const name = S.cur;
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  try {
    const meta = await api('POST', `/api/profiles/${encodeURIComponent(name)}/jobs`, { stages, fetch_kubeconfigs: fetchKubeconfigs });
    S.plan[name] = {};
    const job = getJob(name, meta);
    S.live[name] = job;
    job.connect();
    if (openLog) drawer.open(job);
    toast(`Started: ${meta.title}`, 'ok');
    if (alsoFetchNow) fetchKube(['mgmt-noingress', 'mgmt', 'hcp']);
    renderMain();
    renderSidebar();
    setTimeout(() => refresh(name, { quiet: true }), 1500);
    return job;
  } catch (e) {
    toast(e.message, 'bad');
    refresh(name, { quiet: true });
  }
}

async function confirmAndRun(stages, fetchKubeconfigs, alsoFetchNow = false) {
  const d = derive(S.cur);
  const single = stages.length === 1;
  const openLog = single;
  if (!stages.some(s => CLEAN_PARTS[s])) {
    if (stages.includes('install') && d.fit === 'nofit') {
      return modal.confirm({
        title: 'Not enough memory?', danger: false, icon: 'alert',
        body: `<p>Your config needs <strong>${fmtKiB(d.needKiB)}</strong> but only about <strong>${fmtKiB(d.projected)}</strong> is available on ${esc(profileObj().host)}.</p><p>Start anyway?</p>`,
        ok: 'Start anyway',
      }).then(ok => ok && runJob(stages, { fetchKubeconfigs, openLog, alsoFetchNow }));
    }
    return runJob(stages, { fetchKubeconfigs, openLog, alsoFetchNow });
  }
  const cs = stages.find(s => CLEAN_PARTS[s]);
  const parts = CLEAN_PARTS[cs];
  if (parts.includes('workers') && !S.machines) await loadMachines();
  const after = stages.filter(s => s !== cs).map(s => STAGES[s].title.toLowerCase());
  const titles = {
    clean: single ? `Clean up ${d.clusterName}?` : `Redeploy ${d.clusterName}?`,
    'clean-workers': 'Power off physical workers?',
    'clean-vms': `Destroy the VMs of ${d.clusterName}?`,
    'clean-cluster': `Delete the cluster ${d.clusterName}?`,
  };
  const oks = { clean: single ? 'Destroy' : 'Destroy & redeploy', 'clean-workers': 'Power off', 'clean-vms': 'Destroy VMs', 'clean-cluster': 'Delete' };
  return modal.confirm({
    title: titles[cs], danger: true, icon: cs === 'clean-workers' ? 'stop' : 'trash',
    body: `<p>${cs === 'clean' ? 'This runs <code>make clean-all</code>' : 'This will'} on <strong>${esc(profileObj().host)}</strong>${cs === 'clean' ? ', which will' : ''}:</p>
      ${cleanEffectsHtml(d, parts)}
      ${after.length ? `<p>Then: ${esc(after.join(' → '))}${fetchKubeconfigs ? ' → fetch kubeconfigs' : ''}.</p>` : ''}
      <p class="muted small">Based on the <code>.env</code> currently on the hypervisor, which is what the job uses.</p>`,
    ok: oks[cs],
  }).then(ok => ok && runJob(stages, { fetchKubeconfigs, openLog, alsoFetchNow }));
}

// Which parts of `make clean-all` each clean stage runs, in clean-all's order.
const CLEAN_PARTS = {
  clean: ['workers', 'vms', 'cluster', 'verify'],
  'clean-workers': ['workers'],
  'clean-vms': ['vms', 'verify'],
  'clean-cluster': ['cluster'],
};

function cleanEffectsHtml(d, parts) {
  const me = (S.machines?.me || []).map(u => u.toLowerCase());
  const items = [];
  if (parts.includes('workers')) {
    const ws = d.workers;
    if (!ws) items.push(`<li><strong>Power off the physical workers</strong> listed in the hypervisor's <code>.env</code> over IPMI.</li>`);
    else if (!ws.length) items.push(`<li class="skip">Power off no physical workers (<code>WORKER_COUNT</code> is 0).</li>`);
    else items.push(`<li><strong>Power off ${ws.length} physical worker${ws.length > 1 ? 's' : ''}</strong> over IPMI: graceful shutdown, forced off after 2 minutes.
      <ul class="sub">${ws.map(w => {
        const m = findWorkerMachine(S.machines, w.name, w.bmc_ip);
        const others = (m?.users || []).filter(u => !me.includes(u.toLowerCase()));
        return `<li><span class="mono">${esc(w.name || `worker ${w.n}`)}</span>
          <span class="muted small">BMC ${esc(w.bmc_ip || '?')}</span>
          ${others.length ? `<span class="pill warn" title="From the lab machines list">${icon('alert', 'sm')}Allocated to ${others.map(u => '@' + esc(u)).join(', ')}</span>` : ''}</li>`;
      }).join('')}</ul></li>`);
  }
  if (parts.includes('vms')) {
    items.push(d.mine.length
      ? `<li><strong>Destroy ${d.mine.length} VM${d.mine.length > 1 ? 's' : ''}</strong> and their disks:
          <ul class="sub">${d.mine.map(v => `<li>${vmStateDot(v.state)}<span class="vmname">${esc(v.name)}</span></li>`).join('')}</ul></li>`
      : `<li class="skip">Destroy no VMs (none named ${esc(d.prefixes.map(p => p + '*').join(' or ') || 'with your prefix')} right now).</li>`);
  }
  if (parts.includes('cluster')) {
    items.push(`<li><strong>Delete the Assisted Installer cluster</strong> <span class="mono">${esc(d.clusterName)}</span> with its infra-envs and hosts.</li>`);
    items.push(`<li><strong>Delete the generated files</strong> and kubeconfigs in the automation dir.</li>`);
  }
  if (parts.includes('verify')) items.push('<li>Check that no VMs with your prefix remain.</li>');
  const wont = [
    !parts.includes('workers') && 'power off any physical machine',
    !parts.includes('vms') && 'destroy any VM',
    !parts.includes('cluster') && 'delete the Assisted Installer cluster or any files',
  ].filter(Boolean);
  return `<ul class="effects">${items.join('')}</ul>${wont.length ? `<p class="small">It won't ${wont.join(', ').replace(/, ([^,]*)$/, ' or $1')}.</p>` : ''}`;
}

function confirmStop(job) {
  modal.confirm({
    title: 'Stop this job?', danger: true, icon: 'stop',
    body: `<p>Sends SIGTERM to <strong>${esc(job.title)}</strong> and everything it started on the hypervisor.
      A half-finished <code>make all</code> usually needs a <code>make clean-all</code> afterwards.</p>`,
    ok: 'Stop job',
  }).then(async ok => {
    if (!ok) return;
    try {
      await api('POST', `/api/profiles/${encodeURIComponent(job.profile)}/jobs/${encodeURIComponent(job.id)}/cancel`);
      toast('Stopping…');
    } catch (e) { toast(e.message, 'bad'); }
  });
}

/* ════════════════════════════════════════════════════════════════════════
   Log drawer
   ════════════════════════════════════════════════════════════════════════ */

const drawer = {
  job: null,
  rendered: 0,
  unsub: null,
  errIdx: -1,

  open(job) {
    if (this.unsub) this.unsub();
    this.job = job;
    S.drawerJob = job;
    this.rendered = 0;
    this.errIdx = -1;
    $('#log').innerHTML = '';
    $('#log-follow').checked = true;
    $('#jump-bottom').hidden = true;
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#drawer-backdrop').hidden = false;
    if (!job.complete && !job.es) job.connect();
    this.update({ lines: true });
    $('#log').focus({ preventScroll: true });
  },

  close() {
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#drawer-backdrop').hidden = true;
    S.drawerJob = null;
    // Finished jobs we only opened for viewing don't need their stream.
    if (this.job && !this.job.running) this.job.disconnect();
    this.job = null;
  },

  get isOpen() { return !!this.job; },

  update() {
    const job = this.job;
    if (!job) return;
    const pill = { running: 'busy', succeeded: 'ok', failed: 'bad', cancelled: 'warn', lost: 'warn' }[job.status] || '';
    $('#drawer-status').className = `pill ${pill}`;
    $('#drawer-status').innerHTML = (job.running ? '<span class="dot"></span>' : '') + esc(job.status);
    $('#drawer-job-title').textContent = job.title;
    const dur = job.created ? fmtDur((job.ended || nowSec()) - job.created) : '';
    $('#drawer-job-sub').innerHTML = `${esc(job.profile)} · ${job.created ? fmtClock(job.created) : ''}${dur ? ` · <span ${job.running ? `data-since="${job.created}"` : ''}>${dur}</span>` : ''} · <span class="mono">${esc(job.id)}</span>`;
    $('#drawer-stop').hidden = !job.running;
    this.renderProgress();
    this.renderLines();
  },

  renderProgress() {
    const job = this.job;
    const ic = {
      pending: icon('circle'), running: '<span class="spinner"></span>', succeeded: icon('check'),
      failed: icon('x'), cancelled: icon('ban'), skipped: icon('minus'), lost: icon('alert'),
    };
    let html = `<div class="stage-row">${job.stageNames.map(s => {
      const st = job.stages[s] || { state: 'pending' };
      const dur = st.start ? ' · ' + fmtDur((st.end || nowSec()) - st.start) : '';
      return `<button class="stage-chip ${st.state}" data-goto-stage="${s}">${ic[st.state] || ''}${esc(STAGES[s]?.title || s)}<span class="muted">${dur}</span></button>`;
    }).join('')}</div>`;
    const pr = job.stepProgress();
    if (pr && job.stages.install && job.stages.install.state !== 'pending' && job.stages.install.state !== 'skipped') {
      const f = job.failedStep();
      html += `<div class="line small">${job.curStep ? `make step ${pr.cur + 1}/${pr.total}: <code>${esc(job.curStep)}</code>` : f ? `failed in <code>${esc(f)}</code>` : `${pr.done}/${pr.total} make steps done`}
        <div class="progress ${job.stages.install.state}" style="flex:1;margin-left:8px"><div style="width:${Math.max(pr.pct, 2)}%"></div></div></div>`;
    }
    $('#drawer-progress').innerHTML = html;
  },

  renderLines() {
    const job = this.job;
    const log = $('#log');
    if (!job.loaded && !job.lines.length) {
      if (!log.firstChild) log.innerHTML = '<div class="empty">Loading log…</div>';
      return;
    }
    if (this.rendered === 0) log.innerHTML = '';
    const showTrace = $('#log-trace').checked;
    const filter = $('#log-filter').value.trim().toLowerCase();
    const frag = document.createDocumentFragment();
    for (let i = this.rendered; i < job.lines.length; i++) {
      const l = job.lines[i];
      const div = document.createElement('div');
      div.className = `ln ${l.cls}`;
      div.dataset.i = i;
      if (l.stage) div.dataset.stage = l.stage;
      if (l.cls === 'trace' && !showTrace) div.hidden = true;
      if (filter && !l.text.toLowerCase().includes(filter)) div.classList.add('hidden-by-filter');
      div.innerHTML = l.html || '&nbsp;';
      frag.appendChild(div);
    }
    this.rendered = job.lines.length;
    if (!job.lines.length && !job.running) log.innerHTML = '<div class="empty">This job produced no output.</div>';
    log.appendChild(frag);
    if ($('#log-follow').checked) log.scrollTop = log.scrollHeight;
  },

  rerender() { this.rendered = 0; $('#log').innerHTML = ''; this.renderLines(); },
};

$('#drawer-close').onclick = () => drawer.close();
$('#drawer-backdrop').onclick = () => drawer.close();
$('#drawer-stop').onclick = () => drawer.job && confirmStop(drawer.job);
$('#log-trace').onchange = () => drawer.rerender();
let filterTimer;
$('#log-filter').oninput = () => { clearTimeout(filterTimer); filterTimer = setTimeout(() => drawer.rerender(), 150); };
$('#log-follow').onchange = e => { if (e.target.checked) { const l = $('#log'); l.scrollTop = l.scrollHeight; $('#jump-bottom').hidden = true; } };
$('#log').addEventListener('scroll', () => {
  const l = $('#log');
  const atBottom = l.scrollHeight - l.scrollTop - l.clientHeight < 40;
  if (!atBottom && $('#log-follow').checked) $('#log-follow').checked = false;
  if (atBottom && !$('#log-follow').checked && drawer.job?.running) $('#log-follow').checked = true;
  $('#jump-bottom').hidden = atBottom;
});
$('#jump-bottom').onclick = () => { const l = $('#log'); l.scrollTop = l.scrollHeight; $('#log-follow').checked = true; $('#jump-bottom').hidden = true; };
$('#log-copy').onclick = () => {
  if (!drawer.job) return;
  const showTrace = $('#log-trace').checked;
  copyText(drawer.job.lines.filter(l => showTrace || l.cls !== 'trace').map(l => l.text).join('\n'), 'Log copied');
};
$('#log-errors').onclick = () => {
  const errs = $$('#log .ln.err:not([hidden]):not(.hidden-by-filter)');
  if (!errs.length) return toast('No error lines');
  drawer.errIdx = (drawer.errIdx + 1) % errs.length;
  const el = errs[drawer.errIdx];
  $('#log-follow').checked = false;
  el.scrollIntoView({ block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 900);
};
$('#drawer-progress').addEventListener('click', e => {
  const b = e.target.closest('[data-goto-stage]');
  if (!b) return;
  const el = $(`#log .ln[data-stage="${b.dataset.gotoStage}"]`);
  if (el) { $('#log-follow').checked = false; el.scrollIntoView({ block: 'start' }); }
});

/* ════════════════════════════════════════════════════════════════════════
   Modals
   ════════════════════════════════════════════════════════════════════════ */

const modal = {
  resolve: null,
  onClose: null,

  ac: null,
  // Listeners added to #modal for the current content should pass { signal: modal.signal }.
  get signal() { return this.ac.signal; },

  show(html, { wide = false, size = '', onClose = null } = {}) {
    this.ac?.abort();
    this.ac = new AbortController();
    const m = $('#modal');
    if (!this.isOpen && !m.contains(document.activeElement)) this.opener = document.activeElement;
    m.className = `modal ${wide ? 'wide' : ''} ${size}`;
    m.innerHTML = html;
    $('#modal-backdrop').hidden = false;
    this.onClose = onClose;
    setTimeout(() => {
      const f = [...m.querySelectorAll('[autofocus], .btn.primary, .btn.danger.solid, input, textarea')].find(x => !x.disabled && x.offsetParent !== null);
      f?.focus();
    }, 30);
    // Tab and Shift+Tab cycle inside the dialog.
    document.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !this.isOpen) return;
      const f = [...m.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }, { signal: this.ac.signal });
    return m;
  },

  async close(result = false) {
    if (this.onClose && !(await this.onClose(result))) return;
    $('#modal-backdrop').hidden = true;
    $('#modal').innerHTML = '';
    this.ac?.abort();
    this.onClose = null;
    const r = this.resolve; this.resolve = null;
    r?.(result);
    if (!this.isOpen && this.opener?.isConnected) this.opener.focus();
    this.opener = null;
  },

  get isOpen() { return !$('#modal-backdrop').hidden; },

  confirm({ title, body, ok = 'OK', cancel = 'Cancel', danger = false, icon: ic = 'info' }) {
    return new Promise(resolve => {
      this.show(`
        <div class="modal-head"><div class="icon-wrap ${danger ? 'bad' : 'info'}">${icon(ic)}</div><div><h3>${esc(title)}</h3></div></div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">
          <button class="btn" data-m="cancel" ${danger ? 'autofocus' : ''}>${esc(cancel)}</button>
          <button class="btn ${danger ? 'danger solid' : 'primary'}" data-m="ok" ${danger ? '' : 'autofocus'}>${esc(ok)}</button>
        </div>`);
      this.resolve = resolve;
      $('#modal [data-m="cancel"]').onclick = () => this.close(false);
      $('#modal [data-m="ok"]').onclick = () => this.close(true);
    });
  },
};

$('#modal-backdrop').addEventListener('mousedown', e => { if (e.target.id === 'modal-backdrop') modal.close(false); });

/* ── Profile editor: cards, then the remaining settings ───────────────── */

const clone = o => JSON.parse(JSON.stringify(o));

async function openEditor(tab = 'overview', opts = {}) {
  const name = S.cur;
  let cfg;
  try { cfg = await api('GET', `/api/profiles/${encodeURIComponent(name)}/config`); }
  catch (e) { return toast(e.message, 'bad'); }

  const ed = {
    tab,
    // One layer: the profile's own values (`set`) over the repo defaults.
    layers: { set: clone(cfg.settings) },
    saved: { set: JSON.stringify(cfg.settings) },
    profile: { ...cfg.profile },
    savedProfile: JSON.stringify(cfg.profile),
  };
  const dirty = k => k === 'conn' ? JSON.stringify(ed.profile) !== ed.savedProfile : JSON.stringify(ed.layers[k]) !== ed.saved[k];
  // The hypervisor picked on the Hypervisor tab counts even before it's saved.
  const conn = () => ({ host: ed.profile.host || '', user: ed.profile.user || 'root', automation_dir: ed.profile.automation_dir || '' });
  const connQuery = () => `_host=${encodeURIComponent(conn().host)}&_user=${encodeURIComponent(conn().user)}&_dir=${encodeURIComponent(conn().automation_dir)}`;
  const profileUrl = path => `/api/profiles/${encodeURIComponent(name)}/${path}${path.includes('?') ? '&' : '?'}${connQuery()}`;
  const draftKey = () => JSON.stringify({ ...ed.layers, conn: conn() });
  const savedKey = () => JSON.stringify({ set: JSON.parse(ed.saved.set), conn: (({ host, user, automation_dir }) => ({ host: host || '', user: user || 'root', automation_dir: automation_dir || '' }))(JSON.parse(ed.savedProfile)) });

  if (!cfg.profile.host || !cfg.profile.automation_dir) tab = 'conn';
  ed.tab = tab;
  modal.show(`
    <div class="modal-head" style="padding-bottom:12px">
      <div class="icon-wrap info">${icon('file')}</div>
      <div style="flex:1"><h3 class="ed-title" id="ed-title"></h3>
        </div>
      <button class="icon-btn" data-m="close" title="Close (Esc)">${icon('x')}</button>
    </div>
    <div class="tabs" id="ed-tabs"></div>
    <div class="editor-shell full"><div class="editor-main" id="ed-main"></div></div>
    <div class="modal-foot" style="border-top:1px solid var(--border)">
      <span class="left muted small" id="ed-status"></span>
      <button class="btn" data-m="close">Close</button>

    </div>`, {
    wide: true,
    onClose: async () => { await flushSaves(); afterSaves(); loadAccounts(name, true); return true; },  // the pull secret may have changed
  });

  const TABS = [['overview', 'Settings'], ['conn', 'Hypervisor']];

  // The profile's name, plain text with ✎ until you edit it.
  function renderTitle(editingTitle = false) {
    const t = $('#ed-title');
    t.innerHTML = editingTitle
      ? `<input class="input ed-title-in" value="${esc(ed.profile.title || name)}" spellcheck="false">`
      : `<span>${esc(ed.profile.title || name)}</span><button class="vc-btn" title="Rename">${icon('edit', 'sm')}</button>`;
    const inp = t.querySelector('input');
    if (inp) {
      inp.focus(); inp.select();
      const done = async () => {
        const title = inp.value.trim();
        renderTitle();
        if (title === (JSON.parse(ed.savedProfile).title || '')) return;
        try {
          // The default VM prefix comes from the name. If VMs under the current one exist, keep
          // it, or make clean-all would stop finding them.
          const prefixRow = analysis?.rows.find(r => r.key === 'VM_PREFIX');
          const vms = Object.keys(analysis?.facts?.vms || {});
          if (prefixRow && !prefixRow.set && prefixRow.effective && vms.some(v => v.startsWith(prefixRow.effective))) {
            cardCtx().set({ VM_PREFIX: prefixRow.effective });
            await flushSaves();
            toast(`Kept the VM prefix ${prefixRow.effective}: VMs with that name exist`, 'ok');
          }
          const p = await api('PUT', `/api/profiles/${encodeURIComponent(name)}`, { ...JSON.parse(ed.savedProfile), title, name });
          ed.profile.title = p.title; ed.savedProfile = JSON.stringify({ ...JSON.parse(ed.savedProfile), title: p.title });
          S.profiles = await api('GET', '/api/profiles');
          renderSidebar(); renderTitle(); renderTabs();
          $('#main').dataset.profile = ''; renderMain();
          analysisFor = ''; runAnalysis(); // defaults derived from the name (VM prefix) change with it
          loadAnalysis(name);
        } catch (e) { toast(e.message, 'bad'); }
      };
      inp.onblur = done;
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } if (e.key === 'Escape') { e.stopPropagation(); inp.value = ed.profile.title || name; inp.blur(); } };
    } else t.querySelector('button').onclick = () => renderTitle(true);
  }
  renderTitle();

  function renderTabs() {
    if (!$('#ed-tabs')) return; // closed, but a save (e.g. from the rename's blur) may still be finishing
    $('#ed-tabs').innerHTML = TABS.map(([k, label]) =>
      `<button class="tab ${ed.tab === k ? 'active' : ''}" data-tab="${k}" ${ed.tab === k ? 'autofocus aria-selected="true"' : 'aria-selected="false"'} role="tab">${esc(label)}${k === 'overview' ? ovBadge() : ''}</button>`).join('');
    const pending = saving || Object.keys(saveTimers).length || dirty('set') || dirty('conn');
    $('#ed-status').innerHTML = saveError ? `<span class="ci-bad-text">Couldn’t save: ${esc(saveError)}</span>`
      : pending ? '<span class="spinner" style="width:10px;height:10px;vertical-align:-1px"></span> Saving…' : `${icon('check', 'sm')} All changes saved`;
  }

  /* ── Analysis (runs on the hypervisor against the draft) ── */
  let analysis = null, analysisFor = '', analyzing = false, analysisError = null, analyzeTimer = null;

  function ovBadge() {
    if (!analysis) return '';
    const c = analysis.counts;
    if (c.error) return `<span class="tab-count bad">${c.error}</span>`;
    if (c.warn) return `<span class="tab-count warn">${c.warn}</span>`;
    if (c.todo) return `<span class="tab-count todo">${c.todo}</span>`;
    return '';
  }

  function scheduleAnalysis(delay = 450) {
    clearTimeout(analyzeTimer);
    analyzing = true; // show "Checking…" right away so stale issues aren't mistaken for current ones
    analyzeTimer = setTimeout(runAnalysis, delay);
  }

  async function runAnalysis() {
    const key = draftKey();
    if (analysis && key === analysisFor) { analyzing = false; rerender(); return; }
    analyzing = true; analysisError = null;
    rerender();
    try {
      const r = await api('POST', profileUrl('config/analyze'), { settings: ed.layers.set });
      if (key !== draftKey()) { analyzing = false; return scheduleAnalysis(0); } // edited meanwhile
      analysis = r; analysisFor = key;
      // What follows from the hypervisor and the DPU hosts (the bridge, their subnet)
      if (Object.keys(r.autofill || {}).length) cardCtx().set(r.autofill);
      if (key === savedKey()) setAnalysis(name, r);
    } catch (e) {
      analysisError = e.message;
    }
    analyzing = false;
    renderTabs();
    rerender();
  }

  function rerender() {
    if (ed.tab === 'overview') renderOvList();
  }

  /* ── Editing the draft ── */
  let editing = null;      // {key, layer} of the value being edited inline
  let pickerOpen = false;  // HBN slot picker under VTEP_CIDR
  let editingNote = null;  // {key, layer}
  let addState = null; // {step: 'pick', q, idx} | {step: 'value', key, layer, value}
  const revealed = new Set();

  function setValue(layer, key, value) {
    const cur = ed.layers[layer][key];
    ed.layers[layer][key] = { ...(cur || {}), value };
    delete ed.layers[layer][key].off;
    changed();
  }
  function removeSetting(layer, key) { delete ed.layers[layer][key]; changed(); }
  function toggleOff(layer, key) {
    const e = ed.layers[layer][key];
    if (e.off) delete e.off; else e.off = true;
    changed();
  }
  function setNote(layer, key, note) {
    const e = ed.layers[layer][key];
    if (!e) return;
    if (note.trim()) e.note = note.trim(); else delete e.note;
    changed();
  }
  function changed() {
    scheduleSave('set');
    patchRows();
    renderTabs();
    rerender();
    scheduleAnalysis();
  }

  // Optimistically reflect draft edits in the rows until the hypervisor answers.
  function patchRows() {
    if (!analysis) return;
    const keys = new Set(Object.keys(ed.layers.set));
    for (const k of keys) {
      if (!analysis.rows.some(r => r.key === k)) {
        analysis.rows.push({ key: k, section: 'Not used by the repo', description: '', known: false, issues: [], default: null, source: 'ignored' });
      }
    }
    for (const r of analysis.rows) {
      const o = ed.layers.set[r.key];
      r.set = o || null;
      const on = e => e && !e.off;
      if (r.source !== 'ignored' || !on(o)) {
        r.source = on(o) ? 'set' : 'default';
        if (!r.known && r.source !== 'default') r.source = 'ignored';
      }
      r.effective = r.known ? (on(o) ? o.value : r.default) : null;
    }
    analysis.rows = analysis.rows.filter(r => r.known || r.set);
  }

  /* ── Settings: cards first, then every other setting as a row ── */
  // Opens where it says (or at the start), never where you last were.
  let ovFilter = opts.filter || 'changed';
  let ovQuery = '';
  const hasProblem = r => r.issues.some(i => i.level === 'error' || i.level === 'warn');
  const FILTERS = {
    changed: r => r.set || hasProblem(r),
    issues: r => r.issues.some(i => i.level !== 'ok'),
    all: () => true,
  };
  if (!FILTERS[ovFilter]) ovFilter = 'changed';
  let ovTab = opts.card || null;

  function overview() {
    loadSubnets();
    if (!S.machines) loadMachines().then(() => renderOvList());
    $('#ed-main').innerHTML = `
      <div class="ov-toolbar">
        <div class="log-search">${icon('search')}<input id="ov-q" type="search" placeholder="Find a setting…" spellcheck="false" value="${esc(ovQuery)}"></div>
        <button class="btn small" id="ov-add">${icon('plus')}Add setting</button>
        <span class="spacer"></span>
        <span id="ov-summary" class="small"></span>
      </div>
      <div class="ov-add-pop" id="ov-addpop" hidden></div>
      <div class="ov-list" id="ov-list"></div>`;
    let qt;
    $('#ov-q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { ovQuery = e.target.value.trim().toLowerCase(); renderOvList(); }, 120); };
    $('#ov-add').onclick = () => { addState = addState ? null : { step: 'pick', q: '', idx: 0 }; renderAdd(); };
    $('#ov-list').addEventListener('click', onOvClick);
    renderOvList();
    runAnalysis();
  }

  function renderOvList() {
    const list = $('#ov-list');
    if (!list) return;
    if (!conn().host || !conn().automation_dir) {
      list.classList.remove('tabbed');
      list.innerHTML = `<div class="ov-empty">${icon('server')}<div><strong>Pick a hypervisor first</strong>
        <div class="muted small">The settings are checked against the hypervisor and the automation repo checked out there.</div>
        <button class="btn small primary" style="margin-top:8px" data-tab="conn">${icon('server', 'sm')}Pick a hypervisor</button></div></div>`;
      list.querySelector('[data-tab="conn"]').onclick = () => show('conn');
      return;
    }
    if (!analysis) {
      list.innerHTML = analysisError
        ? `<div class="ov-empty">${icon('alert')}<div><strong>Couldn't check the settings against ${esc(ed.profile.title || name)}</strong><div class="muted small">${esc(analysisError)}</div>
           <button class="btn small" style="margin-top:8px" id="ov-retry">${icon('refresh')}Retry</button></div></div>`
        : `<div class="ov-empty"><span class="spinner"></span><div>Checking your settings against the automation repo and ${esc(ed.profile.title || name)}…</div></div>`;
      $('#ov-retry')?.addEventListener('click', () => { analysisFor = ''; runAnalysis(); });
      return;
    }
    if (analysis.no_clone) {
      list.classList.remove('tabbed');
      $('#ov-summary').innerHTML = '';
      list.innerHTML = `<div class="ov-empty">${icon('download')}<div><strong>No automation repo clone at <span class="mono">${esc(conn().automation_dir)}</span> yet</strong>
        <div class="muted small">The settings are checked against the automation repo, so clone it first.</div>
        <button class="btn small primary" style="margin-top:8px" data-tab="conn">${icon('download', 'sm')}Clone it</button></div></div>`;
      list.querySelector('[data-tab="conn"]').onclick = () => show('conn');
      return;
    }
    const a = analysis, c = a.counts;
    $('#ov-summary').innerHTML = (analyzing ? '<span class="spinner" style="width:12px;height:12px;vertical-align:-2px"></span> Checking… ' : '')
      + (c.error ? `<span class="pill bad">${c.error} error${c.error > 1 ? 's' : ''}</span> ` : '')
      + (c.todo ? `<span class="pill info">${c.todo} to fill in</span> ` : '')
      + (c.warn ? `<span class="pill warn">${c.warn} warning${c.warn > 1 ? 's' : ''}</span> ` : '')
      + (!c.error && !c.warn && !c.todo && !analyzing ? `<span class="pill ok">${icon('check', 'sm')}No problems</span>` : '');
    const q = ovQuery;
    const matchesQ = r => matchesWords(q, r.key, r.description, r.section, r.secret ? '' : String(r.effective ?? ''));
    const has = (rows, l) => rows.some(r => r.issues.some(i => i.level === l));
    const lvlOf = rows => has(rows, 'error') ? 'error' : has(rows, 'warn') ? 'warn' : has(rows, 'todo') ? 'todo' : '';

    // One tab per card, plus everything the cards don't cover; only the chosen tab is shown.
    const ctx = cardCtx();
    const cards = editorCards(ctx), inCard = new Set();
    for (const cd of cards) for (const k of cd.keys) inCard.add(k);
    const membersOf = cd => a.rows.filter(r => cd.keys.has(r.key));
    const otherPool = a.rows.filter(r => !inCard.has(r.key));
    const tabs = cards.map(cd => {
      const c2 = cardCtx(cd);
      return { id: cd.id, icon: cd.def.icon, title: cd.def.title(c2, cd), sub: cd.def.sub ? cd.def.sub(c2, cd) : '', lvl: lvlOf(membersOf(cd)),
        dim: cd.n && cd.n > c2.workerCount() };
    });
    const changedOther = otherPool.filter(r => r.set).length;
    tabs.push({ id: 'other', icon: 'sliders', title: 'Everything else', sub: changedOther ? `${changedOther} changed by you` : 'All at repo defaults', lvl: lvlOf(otherPool) });
    if (!tabs.some(t => t.id === ovTab)) ovTab = (opts.filter === 'issues' && tabs.find(t => t.lvl)?.id) || tabs[0].id;

    const head = `<div class="ov-head">
      <div>Setting</div>
      <div><span class="layer-dot default"></span>Repo default</div>
      <div><span class="layer-dot override"></span>This profile</div>
    </div>`;
    const rowsHtml = rows => {
      const sections = [], bySection = {};
      for (const r of rows) {
        if (!bySection[r.section]) { bySection[r.section] = []; sections.push(r.section); }
        bySection[r.section].push(r);
      }
      return head + sections.map(sec => `<div class="ov-section">${esc(sec)}</div>${bySection[sec].map(ovRow).join('')}`).join('');
    };
    const foot = `<div class="ov-foot muted small">The highlighted value is the one ${esc(ed.profile.title || name)} gets. Click any value to change it, or an empty cell to set it there.
      ${a.schema === 'repo' ? `<br>Descriptions and allowed values come from the automation repo's <code>ci/env.schema.yaml</code>.` : ''}</div>`;

    let pane;
    if (q) {
      // Searching looks through every setting, the ones in cards too.
      const rows = a.rows.filter(r => matchesQ(r) || (editing && editing.key === r.key));
      const hits = cards.filter(cd => matchesWords(q, tabs.find(t => t.id === cd.id).title) || membersOf(cd).some(matchesQ));
      pane = `<div class="ov-rows-head"><div><div class="ov-rows-title">${rows.length} matching setting${rows.length === 1 ? '' : 's'}</div>
          ${hits.length ? `<div class="ci-chips" style="margin-top:6px">${hits.map(cd => `<button class="ci-chip" data-tab-id="${esc(cd.id)}">${icon(cd.def.icon, 'sm')}${esc(tabs.find(t => t.id === cd.id).title)}</button>`).join('')}</div>` : ''}</div></div>
        ${rows.length ? rowsHtml(rows) : '<div class="ov-empty"><div>No matching settings</div></div>'}${foot}`;
    } else if (ovTab === 'other') {
      const rows = otherPool.filter(r => FILTERS[ovFilter](r) || (editing && editing.key === r.key));
      pane = `<div class="ov-rows-head"><div><div class="ov-rows-title">Everything else</div>
          <div class="muted small">The automation repo’s other settings, as plain env vars.</div></div><span class="spacer"></span>
          <div class="seg" id="ov-filter">${[['changed', 'Changed'], ['issues', 'With issues'], ['all', 'All']]
            .map(([k, l]) => `<button data-f="${k}" class="${ovFilter === k ? 'active' : ''}">${esc(l)}<span class="seg-count">${otherPool.filter(FILTERS[k]).length}</span></button>`).join('')}</div></div>
        ${rows.length ? rowsHtml(rows) : `<div class="ov-empty">${ovFilter === 'issues' ? `${icon('check')}<div>No issues</div>` : ovFilter === 'changed' ? '<div>You haven’t changed any of these</div>' : '<div>Nothing here</div>'}</div>`}${foot}`;
    } else {
      const cd = cards.find(x => x.id === ovTab);
      pane = cardHtml(cd, membersOf(cd));
    }

    const nav = tabs.map(t => `<button class="st-tab ${t.id === ovTab && !q ? 'active' : ''} ${t.dim ? 'dim' : ''}" data-tab-id="${esc(t.id)}" title="${esc(t.sub)}">
      <span class="st-icon">${icon(t.icon)}</span>
      <span class="st-text"><span class="st-title">${esc(t.title)}</span><span class="st-sub">${esc(t.sub)}</span></span>
      ${t.lvl ? `<span class="st-dot ${t.lvl}"></span>` : ''}</button>`).join('');
    const glob = a.global_issues.map(i => `<div class="banner bad" style="margin:12px 16px 0">${icon('alert')}<div class="b-body small">${esc(i.message)}</div></div>`).join('');

    const focus = captureFocus();
    const scroll = { nav: $('#st-nav')?.scrollTop || 0, pane: $('#st-pane')?.dataset.view === (q ? '?' : ovTab) ? $('#st-pane').scrollTop : 0 };
    list.classList.add('tabbed');
    const advToggle = `<label class="st-adv" title="More tabs for the repo’s other settings (Kata, operators, tests…)"><input type="checkbox" id="st-adv" ${cardUi.advTabs ? 'checked' : ''}>Advanced</label>`;
    list.innerHTML = `<div class="st-layout"><nav class="st-nav" id="st-nav">${nav}${advToggle}</nav>
      <div class="st-pane" id="st-pane" data-view="${esc(q ? '?' : ovTab)}">${glob}${pane}</div></div>`;
    $('#st-adv').onchange = e => { cardUi.advTabs = e.target.checked; store.set('advancedTabs', cardUi.advTabs); renderOvList(); };
    $('#st-nav').scrollTop = scroll.nav;
    $('#st-pane').scrollTop = scroll.pane;
    restoreFocus(focus);
    const inp = $('#ov-list .ov-edit');
    if (inp) { inp.focus(); inp.select?.(); }
    const ni = $('#ov-list .ov-note-input');
    if (ni) ni.focus();
  }

  /* ── Cards (see cards.js) ── */
  const cardUi = { raw: new Set(), adv: new Set(), reveal: new Set(), editing: new Set(), advTabs: store.get('advancedTabs', false) };
  const lazyData = {};
  const workerOf = r => r.known ? +((/^WORKER_(\d+)_/.exec(r.key) || [])[1] || 0) : 0;
  const workerSlots = () => [...new Set((analysis?.rows || []).map(workerOf).filter(Boolean))].sort((a, b) => a - b);
  const rowOf = key => analysis?.rows.find(r => r.key === key);


  function cardCtx(cd) {
    const ctx = {
      name,
      title: ed.profile.title || name,
      dir: conn().automation_dir,  // where relative paths in settings point
      url: profileUrl,            // profile-scoped API path, with the (maybe unsaved) hypervisor
      host: conn().host,
      row: rowOf,
      rows: () => analysis?.rows || [],
      eff: key => rowOf(key)?.effective,
      // Where the value comes from: 'set' (the profile's own) or 'default' (the repo's).
      src: key => { const r = rowOf(key); return r?.source === 'ignored' ? 'default' : r?.source || 'default'; },
      facts: analysis?.facts,
      hostSubnet: analysis?.dpu_host_cidr,
      machines: S.machines,
      subnets: S.subnets,
      ui: cardUi,
      adv: !!cd && cardUi.adv.has(cd.id),
      workerSlots,
      workerCount: () => parseInt(rowOf('WORKER_COUNT')?.effective || '0', 10) || 0,
      rerender: renderOvList,
      reanalyze: () => { analysisFor = ''; runAnalysis(); },
      lazy(id, fetch) {
        if (!lazyData[id]) {
          const entry = lazyData[id] = { loading: true };
          fetch().then(d => { entry.data = d; entry.onData?.(d); }, e => { entry.error = e.message; })
            .finally(() => { entry.loading = false; renderOvList(); });
        }
        return lazyData[id];
      },
      // Forget a lazy fetch so the next render asks again (a "Try again" button).
      relazy(id) { delete lazyData[id]; renderOvList(); },
      // Change several settings at once. Choosing the repo default drops your entry, so
      // picking the default really resets it (unless it carries a note).
      set(vals) {
        const L = ed.layers.set;
        let any = false;
        for (const [key, value] of Object.entries(vals)) {
          const entry = L[key];
          if (entry && value === (rowOf(key)?.default ?? '') && !entry.note) { delete L[key]; any = true; continue; }
          if (entry ? entry.value === value && !entry.off : value === (rowOf(key)?.effective ?? '')) continue;
          L[key] = { ...(entry || {}), value };
          delete L[key].off;
          any = true;
        }
        if (any) changed();
      },
      // The whole draft, e.g. to have the server change it and take the result back.
      draft: () => ed.layers.set,
      replace(settings) { ed.layers.set = settings; changed(); },
      // Back to the repo default.
      reset(...keys) {
        const had = keys.filter(k => k in ed.layers.set);
        for (const k of had) delete ed.layers.set[k];
        if (had.length) changed();
        else renderOvList();  // only closed an editor: nothing to save
      },
    };
    return ctx;
  }

  function cardHtml(cd, members) {
    const c = cardCtx(cd);
    const raw = cardUi.raw.has(cd.id);
    const issueIcon = { error: 'alert', warn: 'alert', info: 'info' };
    const issues = cd.def.ownsIssues ? [] : members.flatMap(r => r.issues.map((i, n) => ({ r, i, n }))).filter(x => x.i.level !== 'ok' && x.i.level !== 'todo');
    const lvl = issues.some(x => x.i.level === 'error') ? 'error' : issues.some(x => x.i.level === 'warn') ? 'warn' : '';
    let body;
    try { body = cd.def.render(c, cd); } catch (e) { console.error(e); body = `<div class="ov-issue error">${icon('alert', 'sm')}<span>${esc(e.message)}</span></div>`; }
    const sub = cd.def.sub ? cd.def.sub(c, cd) : '';
    const changedN = members.filter(r => r.set).length;
    return `<div class="cset ${lvl} ${c.adv ? 'adv' : ''}" data-card="${esc(cd.id)}">
      <div class="cset-head"><span class="cset-icon">${icon(cd.def.icon || 'layers')}</span>
        <div class="cset-title"><div>${esc(cd.def.title(c, cd))}</div>${sub ? `<div class="cset-sub">${esc(sub)}</div>` : ''}</div>
        <span class="spacer"></span>${cd.def.head ? cd.def.head(c, cd) : ''}
        <button class="icon-btn cset-more ${c.adv ? 'active' : ''}" data-cset-adv title="${c.adv ? 'Back to the simple view' : 'Custom values (for power users)'}">${icon(c.adv ? 'x' : 'more')}</button>
      </div>
      ${c.adv ? `<div class="cset-adv-bar">${icon('edit', 'sm')}<span>Custom values: you’re editing the settings directly.</span>
        <span class="spacer"></span>${changedN ? `<button class="link-btn" data-cset-reset>Reset all ${changedN} to repo defaults</button> · ` : ''}
        <button class="link-btn" data-cset-raw>${raw ? 'Hide' : 'Show'} the ${members.length} raw settings</button> · <button class="link-btn" data-cset-adv>Done</button></div>` : ''}
      <div class="cset-body">${body}</div>
      ${issues.length ? `<div class="cset-issues">${issues.map(({ r, i, n }) => `<div class="ov-issue ${i.level}">${icon(issueIcon[i.level] || 'info', 'sm')}
        <span>${issueText(i)} <code class="cset-ikey">${esc(r.key)}</code></span>${i.fix ? `<button class="btn small" data-cfix="${esc(r.key)}|${n}">${esc(i.fix.label)}</button>` : ''}</div>`).join('')}</div>` : ''}
      ${raw ? `<div class="cset-rows">${members.map(ovRow).join('')}</div>` : ''}
    </div>`;
  }

  const cardFor = el => {
    const id = el.closest('[data-card]')?.dataset.card;
    const cd = id && editorCards(cardCtx()).find(x => x.id === id);
    return cd ? [cd, cardCtx(cd)] : [null, null];
  };

  function onCardClick(e) {
    const [cd, c] = cardFor(e.target);
    if (!cd) return;
    const toggle = (set, id) => { set.has(id) ? set.delete(id) : set.add(id); renderOvList(); };
    if (e.target.closest('[data-cset-raw]')) return toggle(cardUi.raw, cd.id);
    if (e.target.closest('[data-cset-adv]')) { cardUi.raw.delete(cd.id); return toggle(cardUi.adv, cd.id); }
    if (e.target.closest('[data-cset-reset]')) return c.reset(...cd.keys);
    const rs = e.target.closest('[data-reset]');
    if (rs) {
      const keys = rs.dataset.reset.split(',');
      // Settings the card keeps in sync follow the reset (e.g. the hosted control-plane namespace).
      const follow = Object.assign({}, ...keys.map(k => cd.def.bind?.(k, rowOf(k)?.default ?? '', c) || {}));
      keys.forEach(k => cardUi.editing.delete(k));
      c.reset(...keys);
      if (Object.keys(follow).length) cardCtx(cd).set(follow);
      return;
    }
    const ve = e.target.closest('[data-vedit]');
    if (ve) {
      const key = ve.dataset.vedit;
      cardUi.editing.add(key);
      renderOvList();
      const inp = $(`#ov-list [data-card="${CSS.escape(cd.id)}"] [data-bind="${key}"]`);
      inp?.focus(); inp?.select();
      return;
    }
    const fixBtn = e.target.closest('[data-cfix]');
    if (fixBtn) { const [key, n] = fixBtn.dataset.cfix.split('|'); return applyFix(rowOf(key).issues[+n].fix); }
    const cp = e.target.closest('[data-copy]');
    if (cp) return copyText(cp.dataset.copy, 'Copied');
    const rv = e.target.closest('[data-reveal-key]');
    if (rv) { const k = rv.dataset.revealKey; cardUi.reveal.has(k) ? cardUi.reveal.delete(k) : cardUi.reveal.add(k); return renderOvList(); }
    const one = e.target.closest('[data-set]');
    if (one) {
      e.preventDefault();
      // Picking the default (e.g. its pill) is the same as not changing it: back to the plain view.
      if (one.dataset.val === (rowOf(one.dataset.set)?.default ?? '')) { cardUi.editing.delete(one.dataset.set); renderOvList(); }
      return c.set({ [one.dataset.set]: one.dataset.val });
    }
    const many = e.target.closest('[data-setmany]');
    if (many) return c.set(JSON.parse(many.dataset.setmany));
    if (e.target.closest('a')) return;
    cd.def.click?.(e, c, cd);
  }

  // Live editing inside cards: every keystroke updates the draft (and re-renders the card).
  $('#modal').addEventListener('input', e => {
    const el = e.target;
    if (!el.matches('.cset [data-bind]')) return;
    const [cd, c] = cardFor(el);
    if (!cd) return;
    const key = el.dataset.bind, scale = +el.dataset.scale || 0;
    cardUi.editing.add(key);
    let value = el.value.trim();
    if (scale && value !== '') { const f = parseFloat(value); if (!Number.isFinite(f)) return; value = String(Math.round(f * scale)); }
    c.set({ [key]: value, ...(cd.def.bind?.(key, value, c) || {}) });
  }, { signal: modal.signal });
  $('#modal').addEventListener('change', e => {
    const el = e.target;
    if (!el.closest('.cset')) return;
    const [cd, c] = cardFor(el);
    if (!cd) return;
    const key = el.dataset.bindCheck;
    if (key && !key.startsWith('__')) return c.set({ [key]: el.checked ? el.dataset.on : el.dataset.off });
    cd.def.change?.(e, c, cd);
  }, { signal: modal.signal });

  // Leaving a textbox that ended up at the default turns it back into plain text.
  $('#modal').addEventListener('focusout', e => {
    const key = e.target.dataset?.bind;
    if (!key || !e.target.closest('.cset') || !cardUi.editing.has(key)) return;
    setTimeout(() => {
      if (document.activeElement?.dataset?.bind === key) return;
      cardUi.editing.delete(key);
      if ((rowOf(key)?.source || 'default') === 'default') renderOvList();
    }, 150);
  }, { signal: modal.signal });

  // Re-rendering replaces the inputs; keep the caret (and what was typed, e.g. "62.") where it was.
  function captureFocus() {
    const el = document.activeElement;
    if (!el?.dataset?.bind || !el.closest('.cset')) return null;
    return { card: el.closest('[data-card]').dataset.card, key: el.dataset.bind, value: el.value, s: el.selectionStart, e: el.selectionEnd };
  }
  function restoreFocus(f) {
    if (!f) return;
    const el = $(`#ov-list [data-card="${CSS.escape(f.card)}"] [data-bind="${f.key}"]`);
    if (!el) return;
    el.value = f.value;
    el.focus();
    try { el.setSelectionRange(f.s, f.e); } catch { /* not a text input */ }
  }

  /* ── Add setting: pick a known setting, then a value that fits it ── */
  const candidates = () => (analysis?.rows || []).filter(r => r.known && !r.unused);
  const choicesOf = r => r.kind === 'bool' ? ['true', 'false'] : r.kind === 'enum' ? r.choices : null;

  function clientCheck(r, v) {
    if (v === '') return '';
    const ip = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
    switch (r.kind) {
      case 'int': return /^\d+$/.test(v) ? '' : 'Must be a whole number';
      case 'ipv4': return ip.test(v) ? '' : 'Must be an IPv4 address like 10.0.0.5';
      case 'cidr': { const [a, b] = v.split('/'); return ip.test(a || '') && /^\d+$/.test(b || '') && +b <= 32 ? '' : 'Must be a network like 10.0.0.0/24'; }
      case 'mac': return /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(v) ? '' : 'Must be a MAC address like aa:bb:cc:dd:ee:ff';
      case 'dns-label': return /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/.test(v) ? '' : 'Lowercase letters, digits and -';
      case 'k8s-name': return /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(v) ? '' : "Lowercase letters, digits, '-' and '.'";
      case 'domain': return /^([a-z0-9]([-a-z0-9]*[a-z0-9])?\.)+[a-z]{2,}$/.test(v) ? '' : 'Must be a domain like example.com';
      case 'url': return /^(https?|oci):\/\/\S+$/.test(v) ? '' : 'Must be an http(s):// or oci:// URL';
      default: return '';
    }
  }

  function renderAdd() {
    const pop = $('#ov-addpop');
    if (!pop) return;
    pop.hidden = !addState;
    $('#ov-add')?.classList.toggle('active', !!addState);
    if (!addState) { pop.innerHTML = ''; return; }
    if (!analysis) { pop.innerHTML = `<div class="ov-empty"><span class="spinner"></span>Loading settings…</div>`; return; }
    if (addState.step === 'pick') {
      pop.innerHTML = `
        <div class="add-search">${icon('search')}<input id="add-q" placeholder="Search settings by name or what they do…" spellcheck="false" autocomplete="off" value="${esc(addState.q)}">
          <button class="icon-btn" data-add-close title="Close (Esc)">${icon('x')}</button></div>
        <div class="add-results" id="add-results"></div>`;
      const q = $('#add-q');
      q.oninput = () => { addState.q = q.value; addState.idx = 0; renderAddResults(); };
      q.onkeydown = e => {
        const n = $$('#add-results .add-item').length;
        if (e.key === 'ArrowDown') { e.preventDefault(); addState.idx = Math.min(n - 1, addState.idx + 1); renderAddResults(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); addState.idx = Math.max(0, addState.idx - 1); renderAddResults(); }
        else if (e.key === 'Enter') { e.preventDefault(); $$('#add-results .add-item')[addState.idx]?.click(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); addState = null; renderAdd(); }
      };
      renderAddResults();
      q.focus();
      return;
    }
    // step: value
    const r = analysis.rows.find(x => x.key === addState.key);
    const choices = choicesOf(r);
    const existing = r[addState.layer]?.value;
    const err = clientCheck(r, addState.value);
    const fmt = v => v === '' ? '<span class="ov-emptyval">empty</span>' : r.secret ? '••••••••' : esc(v);
    let editor;
    if (choices) {
      editor = `<div class="add-choices">${choices.map(c => `<button class="add-choice ${addState.value === c ? 'active' : ''}" data-choice="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    } else if (r.key === 'VTEP_CIDR') {
      if (!S.subnets) loadSubnets().then(renderAdd);
      editor = `${S.subnets ? (S.subnets.error ? `<div class="ov-issue warn">${icon('alert', 'sm')}<span>${esc(S.subnets.error)}</span></div>` : slotGridHtml(S.subnets, addState.value)) : '<div class="muted small">Loading HBN slots…</div>'}`;
    } else {
      editor = `<div class="add-input"><input class="input mono" id="add-val" value="${esc(addState.value)}" spellcheck="false" autocomplete="off"
          placeholder="${esc(r.default || '')}" ${r.secret ? 'type="password"' : ''}>${r.unit ? `<span class="ov-unit">${esc(r.unit)}</span>` : ''}</div>
        ${err ? `<div class="ov-issue error">${icon('alert', 'sm')}<span>${esc(err)}</span></div>` : ''}`;
    }
    const canAdd = addState.value !== '' && !err && addState.value !== existing;
    pop.innerHTML = `
      <div class="add-detail">
        <div class="add-detail-head">
          <button class="icon-btn" data-add-back title="Back">${icon('down', 'sm')}</button>
          <div style="flex:1;min-width:0"><code class="add-key">${esc(r.key)}</code> <span class="muted small">${esc(r.section)}</span>
            ${r.description ? `<div class="ov-desc" style="-webkit-line-clamp:4">${esc(r.description)}</div>` : ''}</div>
          <button class="icon-btn" data-add-close title="Close (Esc)">${icon('x')}</button>
        </div>
        <div class="add-meta small muted">Repo default: <span class="mono">${fmt(r.default ?? '')}</span>${r.effective !== r.default && r.effective != null ? ` · ${esc(ed.profile.title || name)} currently uses <span class="mono">${fmt(r.effective)}</span>` : ''}</div>
        ${editor}
        <div class="add-foot">
          <span class="spacer"></span>
          <button class="btn ghost" data-add-close>Cancel</button>
          <button class="btn primary" data-add-ok ${canAdd ? '' : 'disabled'}>${existing != null ? 'Change' : 'Add'}</button>
        </div>
      </div>`;
    const val = $('#add-val');
    if (val) {
      val.oninput = () => { addState.value = val.value; const pos = val.selectionStart; renderAdd(); const v2 = $('#add-val'); v2.focus(); v2.setSelectionRange(pos, pos); };
      val.onkeydown = e => {
        if (e.key === 'Enter' && canAdd) { e.preventDefault(); commitAdd(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); addState = null; renderAdd(); }
      };
      if (document.activeElement?.id !== 'add-val') { val.focus(); val.select(); }
    }
  }

  function renderAddResults() {
    const box = $('#add-results');
    const q = addState.q.trim();
    const list = candidates()
      .filter(r => !q || matchesWords(q, r.key, r.description, r.section))
      .sort((a, b) => (b.important - a.important));
    if (!list.length) { box.innerHTML = '<div class="ov-empty" style="padding:24px">No matching settings</div>'; return; }
    box.innerHTML = list.map((r, i) => `
      <button class="add-item ${i === addState.idx ? 'active' : ''}" data-add-key="${esc(r.key)}">
        <div class="add-item-main"><code>${esc(r.key)}</code>${r.important ? '<span class="add-common">common</span>' : ''}${r.set ? '<span class="add-common">set</span>' : ''}
          <div class="ov-desc" style="-webkit-line-clamp:1">${esc(r.description || r.section)}</div></div>
        <span class="add-cur mono">${r.secret ? '' : esc(r.effective ?? '')}</span>
      </button>`).join('');
    box.querySelector('.add-item.active')?.scrollIntoView({ block: 'nearest' });
  }

  function pickSetting(key) {
    const r = analysis.rows.find(x => x.key === key);
    addState = { step: 'value', key, layer: 'set', value: r.set?.value ?? r.effective ?? r.default ?? '' };
    renderAdd();
  }

  function commitAdd() {
    const { key, layer, value } = addState;
    addState = null;
    renderAdd();
    setValue(layer, key, value);
    // make sure the new row is visible, then point at it
    const added = analysis.rows.find(x => x.key === key);
    if (!FILTERS[ovFilter](added) || [...editorCards(cardCtx())].some(cd => cd.keys.has(key))) { ovFilter = 'changed'; ovQuery = key.toLowerCase(); $('#ov-q').value = key; renderOvList(); }
    requestAnimationFrame(() => {
      const row = $(`.ov-row[data-key="${key}"]`);
      row?.scrollIntoView({ block: 'center' });
      row?.classList.add('flash');
      setTimeout(() => row?.classList.remove('flash'), 1200);
    });
  }

  $('#modal').addEventListener('click', e => {
    const pop = e.target.closest('#ov-addpop');
    if (!pop || !addState) return;
    if (e.target.closest('a')) return;
    if (e.target.closest('[data-add-close]')) { addState = null; return renderAdd(); }
    if (e.target.closest('[data-add-back]')) { addState = { step: 'pick', q: '', idx: 0 }; return renderAdd(); }
    const item = e.target.closest('[data-add-key]');
    if (item) return pickSetting(item.dataset.addKey);
    const ch = e.target.closest('[data-choice]');
    if (ch) { addState.value = ch.dataset.choice; return renderAdd(); }
    const pick = e.target.closest('[data-pick]');
    if (pick) { addState.value = pick.dataset.pick; return renderAdd(); }
    if (e.target.closest('[data-add-ok]')) commitAdd();
  }, { signal: modal.signal });

  // Issue message, with an optional {text, url} link turned into an anchor.
  function issueText(i) {
    const msg = esc(i.message);
    if (!i.link) return msg;
    const a = `<a href="${esc(i.link.url)}" target="_blank" rel="noopener" class="mono">${esc(i.link.text)}</a>`;
    return msg.includes(esc(i.link.text)) ? msg.replace(esc(i.link.text), a) : `${msg} (${a})`;
  }

  function fmtVal(r, v) {
    if (v === undefined || v === null) return null;
    if (v === '') return '<span class="ov-emptyval">empty</span>';
    if (r.secret && !revealed.has(r.key)) return '<span class="ov-secret">••••••••</span>';
    return esc(v);
  }

  function editorHtml(r, layer) {
    const cur = r[layer]?.value ?? r.effective ?? r.default ?? '';
    const choices = r.kind === 'bool' ? ['true', 'false'] : r.kind === 'enum' ? r.choices : null;
    if (choices) {
      const opts = [...new Set([...choices, ...(cur && !choices.includes(cur) ? [cur] : [])])];
      return `<select class="input ov-edit" data-layer="${layer}">${opts.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    }
    return `<input class="input mono ov-edit" data-layer="${layer}" value="${esc(cur)}" spellcheck="false" autocomplete="off" ${r.secret && !revealed.has(r.key) ? 'type="password"' : ''}>`;
  }

  function ovCell(r, layer) {
    if (editing && editing.key === r.key && editing.layer === layer) {
      return `<div class="ov-cell ${layer} editing">${editorHtml(r, layer)}</div>`;
    }
    const entry = layer === 'default' ? null : r[layer];
    const v = layer === 'default' ? r.default : entry?.value;
    const isSet = layer === 'default' ? r.known && v !== null && v !== undefined : !!entry;
    const order = { default: 0, set: 1 };
    const winner = r.source === 'ignored' ? null : r.source;
    let cls = `ov-cell ${layer}`, tags = '';
    if (winner === layer) cls += ' active';
    else if (isSet && winner && order[layer] < order[winner] && !entry?.off) cls += ' shadow';
    if (entry?.off) { cls += ' off'; tags += '<span class="ov-tag">off</span>'; }
    if (r.source === 'ignored' && entry && !entry.off) { cls += ' ignored'; tags += '<span class="ov-tag bad">no effect</span>'; }
    if (!isSet) {
      if (layer === 'default') return `<div class="${cls} unset"><span class="ov-dash">${r.known ? '—' : 'not in repo'}</span></div>`;
      return `<div class="${cls} unset" data-edit="${layer}" title="Set it for ${esc(ed.profile.title || name)}">
        <span class="ov-dash">—</span><span class="ov-hint">${icon('plus', 'sm')}Set</span></div>`;
    }
    if (layer === 'default') return `<div class="${cls}" title="${r.secret ? '' : esc(v)}"><span class="ov-val">${fmtVal(r, v)}</span></div>`;
    return `<div class="${cls}" data-edit="${layer}" title="${r.secret && !revealed.has(r.key) ? '' : esc(v)}">
      <span class="ov-val">${fmtVal(r, v)}</span>${tags}
      <span class="ov-cell-actions">
        <button class="ov-act" data-toggle="${layer}" title="${entry.off ? 'Switch back on' : 'Switch off (keep the value for later)'}">${icon(entry.off ? 'play' : 'ban', 'sm')}</button>
        <button class="ov-act" data-remove="${layer}" title="Back to the repo default">${icon('x', 'sm')}</button>
      </span></div>`;
  }

  function notesHtml(r) {
    const out = [];
    for (const layer of ['set']) {
      const e = r[layer];
      if (!e) continue;
      if (editingNote && editingNote.key === r.key && editingNote.layer === layer) {
        out.push(`<div class="ov-note editing"><span class="layer-dot override"></span><input class="input ov-note-input" data-layer="${layer}" value="${esc(e.note || '')}" placeholder="Why is this set? (Enter to save)"></div>`);
      } else if (e.note) {
        out.push(`<div class="ov-note" data-note="${layer}" title="Your note. Click to edit."><span class="layer-dot override"></span>${esc(e.note)}</div>`);
      }
    }
    return out.join('');
  }

  function ovRow(r) {
    const lvl = r.issues.some(i => i.level === 'error') ? 'error' : r.issues.some(i => i.level === 'warn') ? 'warn' : '';
    const issueIcon = { error: 'alert', warn: 'alert', info: 'info', ok: 'check', todo: 'edit' };
    return `<div class="ov-row ${lvl}" data-key="${esc(r.key)}">
      <div class="ov-key">
        <div class="ov-keyline"><code>${esc(r.key)}</code>
          ${r.unit ? `<span class="ov-unit">${esc(r.unit)}</span>` : ''}
          ${r.secret ? `<button class="ov-reveal" data-reveal title="${revealed.has(r.key) ? 'Hide' : 'Show'} value">${icon('eye', 'sm')}</button>` : ''}
          ${r.set && !r.set.note ? `<button class="ov-addnote" data-note="set" title="Add a note">${icon('edit', 'sm')}</button>` : ''}
        </div>
        ${r.description ? `<div class="ov-desc" title="${esc(r.description)}">${esc(r.description)}</div>` : ''}
        ${notesHtml(r)}
      </div>
      ${ovCell(r, 'default')}${ovCell(r, 'set')}
      ${r.issues.length ? `<div class="ov-issues">${r.issues.map((i, n) => `<div class="ov-issue ${i.level}">${icon(issueIcon[i.level] || 'info', 'sm')}<span>${issueText(i)}</span>
        ${i.fix ? `<button class="btn small" data-fix="${n}">${esc(i.fix.label)}</button>` : ''}</div>`).join('')}</div>` : ''}
      ${r.key === 'VTEP_CIDR' ? slotPicker(r) : ''}
    </div>`;
  }

  function slotPicker(r) {
    const d = S.subnets;
    const toggle = `<button class="link-btn sn-toggle" data-picker>${icon(pickerOpen ? 'minus' : 'layers', 'sm')}${pickerOpen ? 'Hide HBN slots' : 'Pick from HBN slots'}</button>`;
    if (!pickerOpen) return `<div class="sn-wrap">${toggle}</div>`;
    if (!d) { loadSubnets().then(() => renderOvList()); return `<div class="sn-wrap">${toggle}<div class="muted small"><span class="spinner" style="width:12px;height:12px"></span> Loading allocations…</div></div>`; }
    const me = d.me || [];
    const cur = r.effective;
        const srcLink = d.source_url ? `<a href="${esc(d.source_url)}" target="_blank" rel="noopener">${esc(d.source_label || 'source')}</a>` : '';
    const footer = d.error ? `<div class="ov-issue error">${icon('alert', 'sm')}<span>Couldn't load the allocations: ${esc(d.error)}</span></div>
      <div class="ci-line" style="gap:6px;align-items:center"><span class="muted small">API base URL:</span><input class="input mono" data-sn-base value="${esc(d.base_url || '')}" placeholder="https://nvidia-lab.okoyl.xyz" style="flex:1"><button class="btn small" data-sn-base-save>Save</button>${d.base_url && d.base_url !== 'https://nvidia-lab.okoyl.xyz' ? '<button class="link-btn" data-sn-base-reset>Reset</button>' : ''}</div>`
      : `<div class="sn-foot muted small">
          <span>${srcLink} · <button class="link-btn" data-sn-reload>reload</button></span>
          <span class="you-pick">You: ${me.length ? me.map(m => `<span class="you-chip">@${esc(m)}</span>`).join('') : '<span class="muted">unknown (pick from the sidebar)</span>'}</span>
        </div>`;
    const grid = d.error ? '' : slotGridHtml(d, cur);
    return `<div class="sn-wrap">${toggle}<div class="sn-panel">${grid}${footer}</div></div>`;
  }

  async function onPickerClick(e, r) {
    if (e.target.closest('a')) return false; // GitHub links open normally
    if (e.target.closest('[data-picker]')) { pickerOpen = !pickerOpen; renderOvList(); return true; }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const owner = pick.dataset.pickOwner;
      if (owner && !(d.me || []).includes(owner) && !window.confirm(`${pick.dataset.pick} is allocated to @${owner}. Use it anyway?`)) return true;
      setValue('set', r.key, pick.dataset.pick);
      return true;
    }
    if (e.target.closest('[data-sn-base-reset]')) {
      try { await api('PUT', '/api/subnets/base-url', { url: null }); S.subnets = null; await loadSubnets(true); analysisFor = ''; runAnalysis(); renderOvList(); toast('Reset to default', 'ok'); } catch (err) { toast(err.message, 'bad'); }
      return true;
    }
    if (e.target.closest('[data-sn-base-save]')) {
      const inp = e.target.closest('.ci-line')?.querySelector('[data-sn-base]');
      if (inp) { try { await api('PUT', '/api/subnets/base-url', { url: inp.value }); S.subnets = null; await loadSubnets(true); analysisFor = ''; runAnalysis(); renderOvList(); toast('Saved', 'ok'); } catch (err) { toast(err.message, 'bad'); } }
      return true;
    }
    if (e.target.closest('[data-sn-reload]')) { S.subnets = null; await loadSubnets(true); analysisFor = ''; runAnalysis(); renderOvList(); return true; }
    return e.target.closest('.sn-panel') !== null;
  }

  function commitEdit(el) {
    if (!editing) return;
    const { key, layer } = editing;
    editing = null;
    const r = analysis.rows.find(x => x.key === key);
    const before = r?.[layer]?.value;
    if (el && el.value !== before) setValue(layer, key, el.value);
    else renderOvList();
  }

  function applyFix(fix) {
    if (fix.op === 'remove') removeSetting(fix.layer, fix.key);
    else if (fix.op === 'rename') {
      const layer = ed.layers[fix.layer];
      layer[fix.to] = { ...layer[fix.key] };
      delete layer[fix.key];
      changed();
      toast(`Renamed to ${fix.to} (not saved yet)`, 'ok');
    } else if (fix.op === 'set') {
      setValue('set', fix.key, fix.value);
      toast(`${fix.key} = ${fix.value} (not saved yet)`, 'ok');
    }
  }

  function onOvClick(e) {
    const tab = e.target.closest('[data-tab-id]');
    if (tab) {
      ovTab = tab.dataset.tabId;
      if (ovQuery) { ovQuery = ''; $('#ov-q').value = ''; }
      return renderOvList();
    }
    if (e.target.closest('.cset') && !e.target.closest('.ov-row')) { onCardClick(e); return; }
    const f = e.target.closest('#ov-filter [data-f]');
    if (f) { ovFilter = f.dataset.f; return renderOvList(); }
    const row = e.target.closest('.ov-row');
    if (!row || !analysis) return;
    const r = analysis.rows.find(x => x.key === row.dataset.key);
    if (r.key === 'VTEP_CIDR' && e.target.closest('.sn-wrap')) { onPickerClick(e, r); return; }
    const fixBtn = e.target.closest('[data-fix]');
    if (fixBtn) return applyFix(r.issues[+fixBtn.dataset.fix].fix);
    if (e.target.closest('[data-reveal]')) { revealed.has(r.key) ? revealed.delete(r.key) : revealed.add(r.key); return renderOvList(); }
    const tog = e.target.closest('[data-toggle]');
    if (tog) return toggleOff(tog.dataset.toggle, r.key);
    const rm = e.target.closest('[data-remove]');
    if (rm) return removeSetting(rm.dataset.remove, r.key);
    const note = e.target.closest('[data-note]');
    if (note) {
      const layer = note.dataset.note;
      if (!ed.layers[layer][r.key]) return;
      editingNote = { key: r.key, layer };
      return renderOvList();
    }
    if (e.target.closest('.ov-edit, .ov-note-input')) return;
    const cell = e.target.closest('[data-edit]');
    if (cell) {
      editing = { key: r.key, layer: cell.dataset.edit };
      if (r.key === 'VTEP_CIDR') pickerOpen = true;
      renderOvList();
    }
  }

  // Inline editors: Enter/blur saves to the draft, Esc cancels.
  $('#modal').addEventListener('keydown', e => {
    const el = e.target;
    if (el.classList?.contains('ov-edit')) {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(el); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); editing = null; renderOvList(); }
    } else if (el.classList?.contains('ov-note-input')) {
      if (e.key === 'Enter') { e.preventDefault(); const { key, layer } = editingNote; editingNote = null; setNote(layer, key, el.value); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); editingNote = null; renderOvList(); }
    }
  }, { capture: true, signal: modal.signal });
  $('#modal').addEventListener('focusout', e => {
    const el = e.target;
    if (el.classList?.contains('ov-edit') && editing) setTimeout(() => commitEdit(el), 0);
    if (el.classList?.contains('ov-note-input') && editingNote) {
      const { key, layer } = editingNote; editingNote = null; setNote(layer, key, el.value);
    }
  }, { capture: false, signal: modal.signal });
  $('#modal').addEventListener('change', e => {
    if (e.target.matches('select.ov-edit')) commitEdit(e.target);
  }, { capture: false, signal: modal.signal });

  /* ── Connection ── */
  function connForm() {
    const p = ed.profile;
    $('#ed-main').innerHTML = `<div style="padding:18px 20px;overflow:auto">
      <div id="ed-where"></div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border);display:flex;gap:8px">
        <button class="btn" id="ed-dup">${icon('copy')}Duplicate this profile…</button>
        <button class="btn danger" id="ed-delete">${icon('trash')}Delete this profile…</button>
      </div>
    </div>`;
    ed.where ??= { host: p.host, user: p.user, dir: p.automation_dir, profile: name };
    ed.where.slug = profileSlug({ name, title: p.title });
    mountHostPicker($('#ed-where'), ed.where, st => {
      Object.assign(ed.profile, { host: st.host, user: st.user, automation_dir: st.dir });
      analysis = null; analysisFor = ''; // the Settings tab re-checks against the new choice
      scheduleSave('conn');
      renderTabs();
    }, async () => {
      await flushSaves();
      if (dirty('conn')) return null;
      try {
        const meta = await api('POST', `/api/profiles/${encodeURIComponent(name)}/jobs`, { stages: ['clone'] });
        const job = getJob(name, meta);
        S.live[name] = job;
        job.connect();
        job.on((j, ev) => { if (ev.finished) delete S.hostChecks; }); // the checkout exists now
        return job;
      } catch (e) { toast(e.message, 'bad'); return null; }
    }, {
      // The server deletes the saved dir, so save what's typed first.
      info: async () => {
        await flushSaves();
        if (dirty('conn')) throw new Error('Couldn’t save the folder first');
        return api('GET', `/api/profiles/${encodeURIComponent(name)}/clone`);
      },
      remove: async () => {
        await api('DELETE', `/api/profiles/${encodeURIComponent(name)}/clone`);
        delete S.hostChecks;
        refresh(name, { quiet: true });
      },
    });
    $('#ed-dup').onclick = async () => { await modal.close(); if (!modal.isOpen) newProfile(name); };
    $('#ed-delete').onclick = async () => {
      await modal.close();
      deleteProfile(name);
    };
  }

  async function show(t) {
    if (t === ed.tab && $('#ed-main').childElementCount) return;
    await flushSaves();
    ed.tab = t;
    editing = null; editingNote = null;
    renderTabs();
    if (t === 'overview') overview();
    else connForm();
  }

  // Every change saves itself: settings shortly after the last edit, the hypervisor a little
  // later (paths get typed). Each save records what it sent, so edits made meanwhile save next.
  let saveTimers = {}, saving = 0, saveError = null;
  function scheduleSave(part, delay = part === 'conn' ? 900 : 600) {
    clearTimeout(saveTimers[part]);
    saveTimers[part] = setTimeout(() => { delete saveTimers[part]; save(part); }, delay);
  }
  async function flushSaves() {
    for (const part of Object.keys(saveTimers)) { clearTimeout(saveTimers[part]); delete saveTimers[part]; }
    for (const part of ['set', 'conn']) if (dirty(part)) await save(part);
  }
  // What the rest of the app shows depends on the saved settings: refresh it when done here.
  let savedSomething = false;
  function afterSaves() {
    if (!savedSomething) return;
    refresh(name, { quiet: true });
    if (analysis && analysisFor === savedKey()) setAnalysis(name, analysis);
    else loadAnalysis(name);
  }

  async function save(part) {
    saving++; renderTabs();
    try {
      if (part === 'set' && dirty('set')) {
        const sent = JSON.stringify(ed.layers.set);
        await api('PUT', `/api/profiles/${encodeURIComponent(name)}/settings`, { settings: JSON.parse(sent) });
        ed.saved = { set: sent };
        loadMachines(); // the server remembered the DPU hosts' logins
      }
      if (part === 'conn' && dirty('conn')) {
        const sent = { ...ed.profile };
        const before = JSON.parse(ed.savedProfile);
        await api('PUT', `/api/profiles/${encodeURIComponent(name)}`, { ...sent, name });
        ed.savedProfile = JSON.stringify(sent);
        if (['host', 'user', 'automation_dir'].some(k => before[k] !== sent[k])) { analysis = null; analysisFor = ''; }
        S.profiles = await api('GET', '/api/profiles');
        renderSidebar();
        $('#main').dataset.profile = '';
        refresh(name, { quiet: true });
      }
      saveError = null;
      savedSomething = true;
      return true;
    } catch (e) {
      saveError = e.message;
      return false;
    } finally {
      saving--; renderTabs();
    }
  }

  $('#ed-tabs').onclick = e => { const t = e.target.closest('[data-tab]'); if (t) show(t.dataset.tab); };
  $$('#modal [data-m="close"]').forEach(b => b.onclick = () => modal.close());
  $('#modal').onkeydown = e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); flushSaves(); } // habit
  };
  show(tab === 'conn' ? 'conn' : 'overview');
}

/* ── New profile ─────────────────────────────────────────────────────── */

// Can you log in to `host` as `user`, and is `dir` an openshift-dpf checkout there (and with
// `profile`, can that profile have it)? Cached per session.
function hostCheck(host, user, dir, done, profile = '') {
  const key = `${user}@${host}:${dir}:${profile}`;
  S.hostChecks ??= {};
  let c = S.hostChecks[key];
  if (!c) {
    c = S.hostChecks[key] = { loading: true };
    api('POST', '/api/hosts/check', { host, user, automation_dir: dir, profile })
      .then(d => { c.data = d; }, e => { c.data = { login: false, error: e.message }; })
      .finally(() => { c.loading = false; if (c.data?.login === false) delete S.hostChecks[key]; done?.(); });
  }
  return c;
}

const shortHost = h => (h || '').split('.')[0];

// What's wrong with a host/dir choice, once we know ('' if fine or still checking).
function hostProblem(st) {
  if (!st.host) return 'No hypervisor picked';
  const c = S.hostChecks?.[`${st.user}@${st.host}:${st.dir}:${st.profile || ''}`];
  if (!c?.data) return '';
  if (!c.data.login) return `You can't log in to ${shortHost(st.host)} as ${st.user}`;
  if (c.data.dir === 'missing') return `${st.dir} doesn't exist on ${shortHost(st.host)}`;
  if (c.data.dir === 'notrepo') return `${st.dir} isn't an openshift-dpf checkout`;
  if (c.data.conflict) return conflictLine(c.data.conflict);
  return '';
}

// The lab's hypervisors (from lab-machines.yaml) as tiles, each saying whether you can log in.
function hypervisorTiles(host, user, refresh) {
  const d = S.machines;
  if (!d) return `<div class="muted small"><span class="spinner" style="width:12px;height:12px"></span> Loading lab machines…</div>`;
  const hvs = (d.sections || []).flatMap(s => s.machines).filter(m => m.type === 'Hypervisor');
  if (!hvs.length) return `<div class="muted small">No hypervisors in the lab machine list${d.error ? `: ${esc(d.error)}` : ''}.</div>`;
  const me = d.me || [];
  return `<div class="dpu-grid">${hvs.map(m => {
    const sel = host && (host === m.address || host === m.id || host.startsWith(m.id + '.'));
    const mine = m.users.some(u => me.includes(u));
    const c = hostCheck(m.address, user, '', refresh);
    const access = c.loading ? `<span class="spinner" style="width:10px;height:10px"></span> checking access…`
      : c.data?.login ? `<span class="ci-ok-text">${icon('check', 'sm')} you can log in as ${esc(user)}</span>`
      : `<span class="ci-bad-text" title="${esc(c.data?.error || '')}">${icon('ban', 'sm')} no access as ${esc(user)}</span>`;
    return `<div class="sn-slot dpu-slot hv-tile ${sel ? 'sel' : 'pickable'} ${mine ? 'me' : ''} ${c.data && !c.data.login ? 'noaccess' : ''}" ${sel ? '' : `data-hv="${esc(m.address)}"`} title="${esc(m.address)}">
      <span class="hv-radio"></span>
      <div class="sn-who"><div class="sn-name">${esc(m.id)}${mine ? '<span class="tag">you</span>' : ''}</div>
        <div class="sn-sub">${esc([m.purpose, ...(m.features || []).filter(f => f !== 'x86')].filter(Boolean).join(' · ') || m.address)}</div>
        <div class="sn-sub hv-access">${access}</div></div></div>`;
  }).join('')}</div>`;
}
const isLabHypervisor = host => (S.machines?.sections || []).flatMap(s => s.machines)
  .some(m => m.type === 'Hypervisor' && (host === m.address || host === m.id));

// Where a profile's clone goes: ~/user-envs/<your GitHub login>/<profile>/openshift-dpf on the
// hypervisor (as ops.clone_target; one clone per profile).
const profileSlug = p => (p?.title || p?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || p?.name;
const cloneTarget = (home, st) => S.me?.[0] && st.slug ? `${home || '/root'}/user-envs/${S.me[0].toLowerCase()}/${st.slug}/openshift-dpf` : null;

// Why a profile can't have a clone (config.describe_conflict, shorter).
function conflictLine(c) {
  const who = c.title || c.profile || 'another profile';
  return c.kind === 'shared' ? `${who} uses this clone; each profile needs its own`
    : c.kind === 'laptop' ? `This clone belongs to ${who} on ${c.laptop || 'another laptop'}`
    : `This clone belongs to ${who}${c.gone ? ' (no longer a profile here)' : ''}`;
}

// Whether the automation repo is where you say; if not, offer to clone it.
function dirStatusHtml(st, refresh) {
  if (!st.host) return '';
  const c = hostCheck(st.host, st.user, st.dir, refresh, st.profile), d = c.data;
  // Ask about the clone target at the same time, not after (each is a round trip to the hypervisor).
  const home = hostCheck(st.host, st.user, '', refresh).data?.home;
  const early = home && cloneTarget(home, st);
  if (early && early !== st.dir) hostCheck(st.host, st.user, early, refresh, st.profile);
  const where = esc(shortHost(st.host));
  if (c.loading) return `<div class="ci-status muted"><span class="spinner" style="width:10px;height:10px"></span> Checking on ${where}…</div>`;
  if (!d.login) return `<div class="ci-status">${icon('ban', 'sm')}<span class="ci-bad-text">Can't log in to ${where} as ${esc(st.user)}: ${esc(d.error || '')}</span></div>`;
  if (d.dir === 'repo' && !d.conflict) return `<div class="ci-status"><span class="ci-ok-text">${icon('check', 'sm')} openshift-dpf checkout${d.branch ? ` on <span class="mono">${esc(d.branch)}</span>` : ''}</span></div>`
    + (st.profile ? `<div class="ci-line">${deleteCloneHtml(st)}</div>` : '');
  const msg = !st.dir ? '' : d.conflict ? `${conflictLine(d.conflict)}.` : d.dir === 'missing' ? `Doesn't exist on ${where}.` : `Exists on ${where}, but isn't an openshift-dpf checkout.`;
  // Offer the clone only where there's nothing yet; an existing checkout there is offered as is.
  const target = cloneTarget(d.home, st);
  let clone;
  if (!target) clone = '<span class="muted small">Pick who you are (bottom of the sidebar) to clone one into ~/user-envs/&lt;you&gt;.</span>';
  else {
    const short = esc(target.replace(d.home || '/root', '~'));
    const t = target === st.dir ? c : hostCheck(st.host, st.user, target, refresh, st.profile);
    if (t.loading) clone = '<span class="spinner" style="width:10px;height:10px"></span>';
    else if (t.data?.conflict) clone = target === st.dir ? '' : `<span class="muted small"><span class="mono">${short}</span>: ${esc(conflictLine(t.data.conflict))}.</span>`;
    else if (t.data?.dir === 'repo') clone = `<button type="button" class="btn small" data-hp-dir="${esc(target)}">Use <span class="mono">${short}</span> instead (your checkout there)</button>`;
    else if (t.data?.dir === 'missing') clone = `<button type="button" class="btn small primary" data-hp-clone="${esc(target)}">${icon('download', 'sm')}Clone to <span class="mono">${short}</span></button>`;
    else clone = target === st.dir ? '' : `<span class="muted small"><span class="mono">${short}</span> exists but isn't an openshift-dpf checkout.</span>`;
  }
  return `${msg ? `<div class="ci-status">${icon('alert', 'sm')}<span class="ci-bad-text">${msg}</span></div>` : ''}<div class="ci-line">${clone}</div>`;
}

// What deleting a clone loses (GET /api/profiles/<name>/clone).
function cloneLossHtml(i) {
  const n = (k, one, many) => i[k] ? `<li><strong>${i[k]} ${i[k] === 1 ? one : many}</strong></li>` : '';
  const lost = [n('dirty', 'uncommitted change', 'uncommitted changes'), n('unpushed', 'commit that isn’t on any remote', 'commits that aren’t on any remote'),
    n('stashes', 'stash', 'stashes'),
    i.env || i.kubeconfigs.length ? `<li>the deployment’s ${[i.env && '.env', ...i.kubeconfigs].filter(Boolean).map(esc).join(', ')}: <code>make clean</code> can’t find what it deployed without them, so clean up first if it’s still deployed</li>` : ''].join('');
  return lost ? `You’d lose:<ul style="margin:4px 0 0 18px;padding:0">${lost}</ul>` : 'No local changes or unpushed commits in it.';
}

// Deleting the clone: a button, then (inline: this is already in a modal) what would be lost.
function deleteCloneHtml(st) {
  const del = st.deleting;
  if (!del) return `<button type="button" class="btn small danger ghost" data-hp-delete>${icon('trash', 'sm')}Delete this clone…</button>`;
  if (del.loading) return `<span class="muted small"><span class="spinner" style="width:10px;height:10px"></span> ${del.busy ? 'Deleting' : 'Looking at'} <span class="mono">${esc(st.dir)}</span>…</span>`;
  if (del.error) return `<span class="ci-bad-text small">${esc(del.error)}</span> <button type="button" class="link-btn small" data-hp-delete-cancel>OK</button>`;
  const i = del.info;
  return `<div class="banner bad" style="margin:4px 0 0">${icon('alert')}<div class="b-body">
      <div class="b-title">Delete <span class="mono">${esc(i.dir)}</span> on ${esc(shortHost(st.host))}?</div>
      <div class="small">${cloneLossHtml(i)} The profile keeps pointing here; clone again to use it.</div></div>
    <div class="b-actions"><button type="button" class="btn small" data-hp-delete-cancel>Cancel</button>
      <button type="button" class="btn small danger solid" data-hp-delete-ok>${icon('trash', 'sm')}Delete</button></div></div>`;
}

// Hypervisor, automation repo and SSH user, checked live. `st` = {host, user, dir};
// onChange(st) on edits, onClone(dir) when you ask for a fresh clone, onDelete
// {info(), remove()} to delete the profile's clone.
function mountHostPicker(el, st, onChange, onClone, onDelete) {
  const login = (S.me?.[0] || 'me').toLowerCase();
  st.custom ??= !!(st.host && S.machines && !isLabHypervisor(st.host));
  el.innerHTML = `<div class="field"><span>Hypervisor</span><div data-hp="tiles"></div></div>
    <div class="field"><span>Automation repo on the hypervisor</span>
      <input class="input mono" data-hp-f="dir" value="${esc(st.dir)}" placeholder="absolute path of your openshift-dpf clone" spellcheck="false" autocomplete="off">
      <div data-hp="dir"></div></div>
    <div class="field"><span>SSH user</span><div data-hp="user"></div></div>`;
  const tiles = () => {
    el.querySelector('[data-hp="tiles"]').innerHTML = st.custom
      ? `<input class="input mono" data-hp-f="host" value="${esc(st.host)}" placeholder="host.example.com" spellcheck="false">
         <button type="button" class="link-btn small" data-hp-list style="margin-top:6px">Pick from the lab list</button>`
      : `${hypervisorTiles(st.host, st.user, tiles)}<button type="button" class="link-btn small" data-hp-custom style="margin-top:6px">Another host…</button>`;
  };
  // While a clone runs, its output shows right under the field.
  const job = () => st.cloneJob;
  const paintLog = () => {
    const box = el.querySelector('[data-hp="log"]');
    if (!box || !job()) return;
    box.innerHTML = job().lines.slice(-300).map(l => `<div class="${l.cls || ''}">${l.html}</div>`).join('');
    box.scrollTop = box.scrollHeight;
  };
  const dir = () => {
    // Nothing typed yet and your checkout is already there: just use it.
    if (!st.dir && st.host) {
      const home = hostCheck(st.host, st.user, '', dir).data;
      const target = home?.login && cloneTarget(home.home, st);
      const t = target && hostCheck(st.host, st.user, target, dir, st.profile).data;
      if (t?.dir === 'repo' && !t.conflict) {
        st.dir = target;
        el.querySelector('[data-hp-f="dir"]').value = target;
        onChange?.(st);
      }
    }
    const j = job();
    const status = st.cloneStarting ? `<div class="ci-status muted"><span class="spinner" style="width:10px;height:10px"></span> Starting the clone into <span class="mono">${esc(st.dir)}</span>…</div>`
      : j?.running ? `<div class="ci-status muted"><span class="spinner" style="width:10px;height:10px"></span> Cloning into <span class="mono">${esc(st.dir)}</span>…</div>`
      : j && j.status !== 'succeeded' ? `<div class="ci-status">${icon('alert', 'sm')}<span class="ci-bad-text">The clone ${esc(j.status)}${j.rc != null ? ` (exit ${j.rc})` : ''}.</span></div>${dirStatusHtml(st, dir)}`
      : dirStatusHtml(st, dir);
    // The output matters while it runs and when it fails; after a clean clone the ✓ says it all.
    el.querySelector('[data-hp="dir"]').innerHTML = status + (j && j.status !== 'succeeded' ? `<div class="mini-log" data-hp="log"></div>` : '');
    paintLog();
  };
  const follow = j => { st.cloneJob = j; j.on((_, ev) => { if (ev.finished) dir(); else if (ev.lines) paintLog(); }); dir(); };
  // root unless you change it: plain text with ✎, a textbox once it's yours
  const user = (editing = st.user !== 'root') => {
    el.querySelector('[data-hp="user"]').innerHTML = editing
      ? `<span class="vc"><input class="input mono ci-user" data-hp-f="user" value="${esc(st.user)}" spellcheck="false" autocomplete="off">
         <button type="button" class="vc-btn" data-hp-user-reset title="Back to root">${icon('undo', 'sm')}</button></span>`
      : `<span class="vc def"><span class="mono">${esc(st.user)}</span><button type="button" class="vc-btn" data-hp-user-edit title="Change">${icon('edit', 'sm')}</button></span>`;
  };
  tiles(); dir(); user();
  if (st.cloneJob) follow(st.cloneJob); // back on this tab while a clone runs
  if (!S.machines) loadMachines().then(() => { st.custom = !!(st.host && !isLabHypervisor(st.host)); tiles(); });
  let timer;
  el.addEventListener('input', e => {
    const f = e.target.dataset.hpF;
    if (!f) return;
    st[f] = e.target.value.trim();
    st.deleting = null; // it was about the previous dir
    onChange?.(st);
    clearTimeout(timer);
    timer = setTimeout(() => { if (f === 'user') tiles(); dir(); }, 500);
  });
  el.addEventListener('click', e => {
    const h = e.target.closest('[data-hv]');
    if (h) { st.host = h.dataset.hv; onChange?.(st); tiles(); dir(); return; }
    if (e.target.closest('[data-hp-custom]')) { st.custom = true; tiles(); el.querySelector('[data-hp-f="host"]').focus(); return; }
    if (e.target.closest('[data-hp-list]')) { st.custom = false; tiles(); return; }
    if (e.target.closest('[data-hp-user-edit]')) { user(true); const i = el.querySelector('[data-hp-f="user"]'); i.focus(); i.select(); return; }
    if (e.target.closest('[data-hp-user-reset]')) { st.user = 'root'; onChange?.(st); user(false); tiles(); dir(); return; }
    const use = e.target.closest('[data-hp-dir]');
    if (use) { st.dir = use.dataset.hpDir; el.querySelector('[data-hp-f="dir"]').value = st.dir; onChange?.(st); dir(); return; }
    if (e.target.closest('[data-hp-delete]') && onDelete) {
      st.deleting = { loading: true }; dir();
      onDelete.info().then(info => { st.deleting = { info }; }, err => { st.deleting = { error: err.message }; }).finally(dir);
      return;
    }
    if (e.target.closest('[data-hp-delete-cancel]')) { st.deleting = null; dir(); return; }
    if (e.target.closest('[data-hp-delete-ok]')) {
      st.deleting = { loading: true, busy: true }; dir();
      onDelete.remove().then(() => { st.deleting = null; toast(`Deleted ${st.dir}`, 'ok'); },
        err => { st.deleting = { error: err.message }; }).finally(dir);
      return;
    }
    const cl = e.target.closest('[data-hp-clone]');
    if (cl) {
      st.dir = cl.dataset.hpClone; el.querySelector('[data-hp-f="dir"]').value = st.dir; onChange?.(st);
      st.cloneStarting = true; dir(); // saving and starting it takes a moment; don't show the old dir's verdict meanwhile
      Promise.resolve(onClone?.(st.dir)).then(j => { st.cloneStarting = false; if (j) follow(j); else dir(); });
    }
  });
}

// New profiles are created right away ("New profile (n)") and opened for editing; duplicating
// copies the hypervisor and settings.
// A new profile (or a copy of `from`): named first, since the name says which deployment it is
// and its VM prefix, cluster name and clone folder are made from it.
async function newProfile(from = null) {
  const src = from ? profileObj(from) : null;
  modal.show(`
    <div class="modal-head"><div class="icon-wrap info">${icon(src ? 'copy' : 'plus')}</div>
      <div style="flex:1"><h3>${src ? `Duplicate ${esc(ptitle(src))}` : 'New profile'}</h3>
        <div class="muted small">${src ? 'Same hypervisor and settings, its own clone of the automation repo.' : 'One deployment: a hypervisor, its DPU hosts and settings.'}</div></div></div>
    <form class="modal-body" id="np-form">
      <label class="field"><span>Name</span>
        <input class="input" id="np-name" placeholder="e.g. DPF demo, upgrade tests" value="${src ? esc(`${ptitle(src)} copy`) : ''}" spellcheck="false" autocomplete="off" required></label>
      <div class="muted small" id="np-hint">Its VMs and clone folder are named after it.</div>
    </form>
    <div class="modal-foot"><button class="btn" data-m="cancel">Cancel</button>
      <button class="btn primary" id="np-create" disabled>${icon('plus')}Create</button></div>`, { size: 'mid' });
  const input = $('#np-name'), create = $('#np-create');
  input.focus(); input.select();
  const valid = () => /[a-z0-9]/i.test(input.value);
  create.disabled = !valid();
  input.addEventListener('input', () => { create.disabled = !valid(); }, { signal: modal.signal });
  $('#modal [data-m="cancel"]').onclick = () => modal.close();
  const go = async e => {
    e?.preventDefault();
    if (!valid() || create.disabled) return;
    create.disabled = true;
    try {
      const p = await api('POST', '/api/profiles', src
        // Same hypervisor, but not the same clone: each profile has its own.
        ? { host: src.host, user: src.user, title: input.value.trim(), copy_settings_from: from }
        : { title: input.value.trim() });
      await modal.close();
      S.profiles = await api('GET', '/api/profiles');
      selectProfile(p.name);
      openEditor('conn');
    } catch (err) { $('#np-hint').innerHTML = `<span class="ci-bad-text">${esc(err.message)}</span>`; create.disabled = false; }
  };
  $('#np-form').addEventListener('submit', go, { signal: modal.signal });
  create.onclick = go;
}

/* ── Lab machines ────────────────────────────────────────────────────── */

async function loadMachines(refresh = false) {
  try { S.machines = await api('GET', `/api/machines${refresh ? '?refresh=1' : ''}`); }
  catch (e) { S.machines = { error: e.message, sections: [] }; }
  return S.machines;
}

/* ── Who you are: pick your GitHub logins from everyone the lab files know ── */

function renderIdentityBtn(me) {
  $('#identity').innerHTML = me.length
    ? `${avatarHtml(`https://avatars.githubusercontent.com/${encodeURIComponent(me[0])}?s=48`, 18)}<span>@${esc(me[0])}</span>`
    : `${icon('circle')}<span>Who are you?</span>`;
}

function applyIdentity(me) {
  S.me = me;
  if (S.machines) S.machines.me = me;
  if (S.subnets) S.subnets.me = me;
  renderIdentityBtn(me);
}

async function loadIdentity() {
  const d = await api('GET', '/api/identity');
  applyIdentity(d.me ? [d.me] : []);
  if (!d.chosen) openIdentity();
}

async function openIdentity(d) {
  if (!d) {
    try { d = await api('GET', '/api/identity?full=1'); } catch (e) { return toast(e.message, 'bad'); }
  }
  const people = d.me && !d.known.some(p => p.login === d.me) ? [...d.known, { login: d.me }] : d.known;
  modal.show(`
    <div class="modal-head">
      <div style="flex:1"><h3>Who are you?</h3></div>
      ${d.chosen ? `<button class="icon-btn" data-m="close" title="Close (Esc)">${icon('x')}</button>` : ''}
    </div>
    <div class="modal-body">
      <div class="id-grid">${people.map(p => `
        <button class="id-tile ${p.login === d.me ? 'on' : ''}" data-login="${esc(p.login)}" title="@${esc(p.login)}">
          ${avatarHtml(`https://avatars.githubusercontent.com/${encodeURIComponent(p.login)}?s=192`, 96)}
          <span class="id-name">${esc(p.name || p.login)}</span>
        </button>`).join('')}</div>
    </div>
    <div class="modal-foot">
      ${d.request_url ? `<a class="btn small" href="${esc(d.request_url)}" target="_blank" rel="noopener" title="Opens the HBN slot allocations on GitHub; saving your edit there opens a pull request">${icon('github', 'sm')}Not on the list? Request a slot</a>${infoTip('Everyone with an HBN slot or a lab machine is on this list. Add yourself to a free slot in the allocations file and open the pull request; once it’s merged, you’re here.')}` : ''}
      <span class="spacer"></span>${d.chosen && d.request_url ? '' : `<button class="link-btn" data-login="">${d.request_url ? 'Skip for now' : 'I’m not on the list'}</button>`}</div>`, { size: 'mid' });
  $('#modal [data-m="close"]')?.addEventListener('click', () => modal.close(), { signal: modal.signal });
  $('#modal').addEventListener('click', async e => {
    const b = e.target.closest('[data-login]');
    if (!b) return;
    try {
      const r = await api('PUT', '/api/identity', { me: b.dataset.login || null });
      applyIdentity(r.me ? [r.me] : []);
      modal.close();
      S.analysis = {}; // its "allocated to someone else" checks depend on who you are
      if (S.cur) loadAnalysis(S.cur);
    } catch (err) { toast(err.message, 'bad'); }
  }, { signal: modal.signal });
  var needNames = people.filter(function(p) { return !p.name; }).map(function(p) { return p.login; });
  if (needNames.length) {
    api('POST', '/api/identity/profiles', { logins: needNames }).then(function(profiles) {
      var btns = document.querySelectorAll('#modal .id-tile[data-login]');
      for (var i = 0; i < btns.length; i++) {
        var login = btns[i].dataset.login;
        var info = profiles[login];
        if (info && info.name) btns[i].querySelector('.id-name').textContent = info.name;
      }
    }).catch(function() {});
  }
}

/* ════════════════════════════════════════════════════════════════════════
   Global wiring
   ════════════════════════════════════════════════════════════════════════ */

function applyTheme() {
  const t = store.get('theme', 'auto');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  $('#theme-label').textContent = `Theme: ${t}`;
}
$('#theme-toggle').onclick = () => {
  const order = ['auto', 'light', 'dark'];
  store.set('theme', order[(order.indexOf(store.get('theme', 'auto')) + 1) % 3]);
  applyTheme();
};
$('#new-profile').onclick = () => newProfile();
$('#identity').onclick = () => openIdentity();

// Feedback bubble: shown until dismissed; the avatar toggles it back.
const FEEDBACK_LOGIN = 'omertuc';
$('#fb-avatar').title = `Feedback for @${FEEDBACK_LOGIN}`;
$('#fb-avatar').innerHTML = avatarHtml(`https://avatars.githubusercontent.com/${FEEDBACK_LOGIN}?s=112`, 56);
const showFeedback = on => { $('#fb').classList.toggle('collapsed', !on); store.set('feedbackDismissed', !on); };
showFeedback(!store.get('feedbackDismissed', false));
$('#fb-close').onclick = () => showFeedback(false);
$('#fb-avatar').onclick = () => showFeedback($('#fb').classList.contains('collapsed'));

// Feedback: a mailto link with a template. It opens in a new tab (target=_blank) so a webmail
// handler doesn't replace the app the user is writing about.
$('#feedback').addEventListener('click', e => {
  const subject = 'DPF Dev GUI feedback';
  const body = [
    'What were you trying to do?',
    '',
    '',
    'What happened (or what would you like to see)?',
    '',
    '',
    '---',
    `Browser: ${navigator.userAgent}`,
  ].join('\r\n');
  e.currentTarget.href = `mailto:omer@redhat.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('#menu')) { closeMenu(); return; }
    if (modal.isOpen) { e.preventDefault(); modal.close(false); }
    else if (drawer.isOpen) drawer.close();
    return;
  }
  const t = e.target;
  if (e.ctrlKey || e.metaKey || e.altKey || modal.isOpen) return;
  if (t.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'r') refresh(S.cur, { fetch: true });
  else if (e.key === 'l') {
    if (drawer.isOpen) drawer.close();
    else if (S.live[S.cur]) drawer.open(S.live[S.cur]);
    else toast('No job yet');
  } else if (e.key === 'e') openEditor();
});

window.addEventListener('hashchange', () => {
  const n = location.hash.slice(1);
  if (n && n !== S.cur && S.profiles.some(p => p.name === n)) selectProfile(n);
});

// Tick relative times/durations once a second without re-rendering everything.
setInterval(() => {
  $$('[data-since]').forEach(el => { el.textContent = fmtDur(nowSec() - +el.dataset.since); });
  $$('[data-stage-dur]').forEach(el => {
    const job = S.live[S.cur];
    const st = job?.stages[el.dataset.stageDur];
    if (st?.state === 'running' && st.start) el.textContent = fmtDur(nowSec() - st.start);
  });
  const u = $('#updated');
  const st = S.status[S.cur];
  if (u && st?.at) u.textContent = 'Updated ' + fmtAgo(st.at) + (st.remote?.latency_ms ? ` · ${st.remote.latency_ms} ms` : '');
  if (drawer.job?.running) drawer.renderProgress();
  if (S.install?.[S.cur]?.at) loadInstall();  // re-asks when it's due
  const live = S.live[S.cur];
  document.title = live?.running ? `● ${live.stepProgress()?.pct ?? 0}% · DPF Dev` : 'DPF Dev';
}, 1000);

hydrateIcons();
applyTheme();
loadProfiles().catch(e => toast(e.message, 'bad'));
loadIdentity().catch(e => toast(e.message, 'bad'));

/* ════════════════════════════════════════════════════════════════════════
   Keyboard: everything clickable is a Tab stop, and focus survives re-renders
   ════════════════════════════════════════════════════════════════════════ */

// Clickable things that aren't buttons or links (tiles, table cells, copyable text).
const CLICKABLE = '[data-set]:not(button), [data-hv], .sn-slot[data-pick], [data-dpu-pick], .ov-cell[data-edit], .ov-note[data-note], [data-copy]:not(button)';

function makeFocusable(root) {
  if (root.nodeType !== 1) return;
  const els = root.matches?.(CLICKABLE) ? [root, ...root.querySelectorAll(CLICKABLE)] : root.querySelectorAll(CLICKABLE);
  for (const el of els) {
    if (el.hasAttribute('tabindex')) continue;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
  }
}

// How to find "the same control" again after its container was re-rendered.
const FOCUS_ATTRS = ['data-bind', 'data-vedit', 'data-reset', 'data-tab-id', 'data-tab', 'data-profile', 'data-profile-menu', 'data-hv',
  'data-pick', 'data-dpu-pick', 'data-dh', 'data-dh-n', 'data-domain', 'data-f', 'data-cset-adv', 'data-cset-raw', 'data-free-ips',
  'data-nic-toggle', 'data-reveal-key', 'data-cfix', 'data-fix', 'data-edit', 'data-note', 'data-toggle', 'data-remove', 'data-set',
  'data-setmany', 'data-copy', 'data-hp-f', 'data-hp-clone', 'data-hp-dir', 'data-hp-custom', 'data-hp-list', 'data-hp-user-edit',
  'data-hp-user-reset', 'data-edit-hv', 'data-open-issues', 'data-open-job', 'id'];
const IN_ROW = new Set(['data-edit', 'data-fix', 'data-toggle', 'data-remove', 'data-note']);

function focusSelectors(el) {
  const attr = FOCUS_ATTRS.find(a => el.hasAttribute(a));
  if (!attr) return [];
  const v = el.getAttribute(attr);
  let scope = '';
  const card = el.closest('[data-card]'), row = el.closest('.ov-row[data-key]');
  if (card) scope += `[data-card="${CSS.escape(card.dataset.card)}"] `;
  if (row && IN_ROW.has(attr)) scope += `[data-key="${CSS.escape(row.dataset.key)}"] `;
  const out = [scope + `[${attr}="${CSS.escape(v)}"]` + (attr === 'data-set' ? `[data-val="${CSS.escape(el.dataset.val || '')}"]` : '')];
  // A value's controls replace each other: ✎ becomes a textbox, ↺ brings back the ✎.
  if (['data-bind', 'data-vedit', 'data-reset'].includes(attr)) {
    for (const k of v.split(',')) out.push(...['data-bind', 'data-vedit', 'data-reset'].map(a => scope + `[${a}="${CSS.escape(k)}"]`));
  }
  return out;
}

let lastFocus = null; // {el, selectors}
document.addEventListener('focusin', e => {
  if (e.target === document.body) return;
  lastFocus = { el: e.target, selectors: focusSelectors(e.target) };
});

new MutationObserver(muts => {
  for (const m of muts) m.addedNodes.forEach(makeFocusable);
  // The focused control was replaced by a re-render: focus its replacement.
  if (lastFocus && !lastFocus.el.isConnected && (document.activeElement === document.body || !document.activeElement)) {
    const root = modal.isOpen ? $('#modal') : document;
    const next = lastFocus.selectors.map(s => { try { return root.querySelector(s); } catch { return null; } })
      .find(x => x && x.offsetParent !== null && !x.disabled)
      || (modal.isOpen ? $('#modal .st-tab.active') : null);
    if (next) next.focus({ preventScroll: true });
    else lastFocus = null;
  }
}).observe(document.body, { childList: true, subtree: true });
makeFocusable(document.body);

// Escape in a field leaves the field; only the next Escape closes the dialog.
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !modal.isOpen) return;
  const el = e.target;
  if (el.matches?.('.cset input, .cset select, [data-hp-f], #ov-q') && !el.matches('.ov-edit, .ov-note-input')) {
    e.stopImmediatePropagation();
    // Land on the field's own ↺/✎ (the focus keeper follows it if the field turns back into text).
    const btn = el.closest('.vc')?.querySelector('.vc-btn');
    if (btn) btn.focus({ preventScroll: true }); else el.blur();
  }
}, true);

document.addEventListener('keydown', e => {
  const el = e.target;
  // Enter/Space on a clickable tile works like on a button.
  if ((e.key === 'Enter' || e.key === ' ') && el.getAttribute?.('role') === 'button' && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
    e.preventDefault();
    el.click();
    return;
  }
  // Arrow keys move between tabs (the settings' card list and the editor's top tabs).
  const tab = el.closest?.('.st-tab, #ed-tabs .tab');
  if (tab && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    const all = [...tab.parentElement.querySelectorAll(tab.classList.contains('st-tab') ? '.st-tab' : '.tab')];
    const i = all.indexOf(tab);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 1) + all.length) % all.length;
    e.preventDefault();
    all[j].focus();
    all[j].click();
  }
});
