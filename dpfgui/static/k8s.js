/* Live Kubernetes views for the dashboard, through the app's read-only API access (k8s.py).
   Like the OpenShift console, the page never holds cluster credentials: it asks the app, and
   the app asks the cluster. A live list is listed, then watched, by the app, which sends the
   changes over one WebSocket, so it stays current. Lists are shared between everything that
   shows them, and stop half a minute after nothing does. One-off reads (K8s.get) are plain
   HTTP requests. */

const K8s = (() => {
  const base = (profile, cluster) => `/api/profiles/${encodeURIComponent(profile)}/k8s/${encodeURIComponent(cluster)}`;
  const qs = params => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '') u.append(k, v);
    const s = u.toString();
    return s ? `?${s}` : '';
  };
  const url = (profile, cluster, path, params) => `${base(profile, cluster)}/${path.replace(/^\//, '')}${qs(params)}`;

  async function get(profile, cluster, path, params, opts = {}) {
    const r = await fetch(url(profile, cluster, path, params), opts);
    let body = {};
    try { body = await r.json(); } catch { /* not JSON */ }
    if (!r.ok) {
      const e = new Error(body.message || `HTTP ${r.status}`);
      e.status = r.status;
      throw e;
    }
    return body;
  }

  // All live lists of a profile share one WebSocket to the app (a browser allows only a few open
  // HTTP connections per site, and every watch would hold one). The app lists and watches each
  // resource and sends the events; after a reconnect it lists everything again.
  const sockets = new Map();  // profile -> { ws, open, lists: Map(id -> LiveList), delay }
  let nextId = 1;
  function socketFor(profile) {
    let s = sockets.get(profile);
    if (s) return s;
    s = { lists: new Map(), delay: 1000, open: false };
    sockets.set(profile, s);
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = s.ws = new WebSocket(`${proto}://${location.host}/api/profiles/${encodeURIComponent(profile)}/k8s-live`);
      ws.onopen = () => {
        s.open = s.everOpened = true;
        s.failures = 0;
        s.delay = 1000;
        for (const [id, l] of s.lists) ws.send(JSON.stringify({ op: 'watch', id, cluster: l.cluster, path: l.path, params: l.params }));
      };
      ws.onmessage = e => { const m = JSON.parse(e.data); s.lists.get(m.id)?.apply(m); };
      ws.onclose = () => {
        if (!s.open) s.failures = (s.failures || 0) + 1;
        s.open = false;
        // Not the lists' fault: they keep what they last knew, marked stale, until the app is back.
        for (const l of s.lists.values()) l.apply({ type: 'DISCONNECTED' });
        if (!s.lists.size) { sockets.delete(profile); return; }
        setTimeout(connect, s.delay);
        s.delay = Math.min(s.delay * 2, 15000);
      };
    };
    connect();
    return s;
  }

  class LiveList {
    constructor(profile, cluster, path, params) {
      Object.assign(this, { profile, cluster, path, params: params || {} });
      this.items = new Map();  // uid -> object
      this.subs = new Set();
      this.synced = false;
      this.error = null;
      this.missing = false;    // the resource doesn't exist on this cluster (yet)
    }

    get list() { return [...this.items.values()]; }

    subscribe(fn) {
      this.subs.add(fn);
      clearTimeout(this.stopTimer);
      if (!this.id) this.start();
      return () => {
        this.subs.delete(fn);
        if (!this.subs.size) this.stopTimer = setTimeout(() => this.stop(), 30000);
      };
    }

    // Many events come in bursts; tell subscribers at most every 150ms.
    notify() {
      if (this.pending) return;
      this.pending = setTimeout(() => { this.pending = null; for (const f of this.subs) f(this); }, 150);
    }

    start() {
      this.id = nextId++;
      const s = socketFor(this.profile);
      s.lists.set(this.id, this);
      if (s.open) s.ws.send(JSON.stringify({ op: 'watch', id: this.id, cluster: this.cluster, path: this.path, params: this.params }));
    }

    stop() {
      const s = sockets.get(this.profile);
      if (s && this.id) {
        s.lists.delete(this.id);
        if (s.open) s.ws.send(JSON.stringify({ op: 'cancel', id: this.id }));
      }
      this.id = null;
      lists.delete(this.key);
    }

    apply(m) {
      if (m.type === 'LIST') {
        this.items = new Map((m.items || []).map(o => [o.metadata.uid, o]));
        Object.assign(this, { synced: true, error: null, missing: false, stale: false });
      } else if (m.type === 'DISCONNECTED') {
        this.stale = true;
      } else if (m.type === 'ERROR') {
        Object.assign(this, { synced: false, error: m.message, missing: m.status === 404 });
      } else if (m.object?.metadata?.uid) {
        if (m.type === 'DELETED') this.items.delete(m.object.metadata.uid);
        else this.items.set(m.object.metadata.uid, m.object);
      }
      this.notify();
    }
  }

  const lists = new Map();
  // The shared live list of a resource (path: e.g. "api/v1/nodes"; params: labelSelector, _meta=1…).
  function live(profile, cluster, path, params) {
    const key = JSON.stringify([profile, cluster, path, params || {}]);
    if (!lists.has(key)) lists.set(key, Object.assign(new LiveList(profile, cluster, path, params), { key }));
    return lists.get(key);
  }

  // The listable, watchable resources of the API groups named (or ending with) one of `groups`:
  // [{group, version, prefix, plural, kind, namespaced}].
  async function discover(profile, cluster, groups) {
    const all = await get(profile, cluster, 'apis');
    const want = (all.groups || []).filter(g => groups.some(x => g.name === x || g.name.endsWith(`.${x}`)));
    const res = await Promise.all(want.map(async g => {
      const v = g.preferredVersion?.version || g.versions?.[0]?.version;
      const l = await get(profile, cluster, `apis/${g.name}/${v}`).catch(() => ({ resources: [] }));
      return (l.resources || []).filter(r => !r.name.includes('/') && r.verbs?.includes('list') && r.verbs?.includes('watch'))
        .map(r => ({ group: g.name, version: v, prefix: `apis/${g.name}/${v}`, plural: r.name, kind: r.kind, namespaced: r.namespaced }));
    }));
    return res.flat().sort((a, b) => a.group.localeCompare(b.group) || a.kind.localeCompare(b.kind));
  }

  // Where one object lives, for reading it (res: {prefix, plural, namespaced}).
  const objectPath = (res, o) => res.namespaced && o.metadata?.namespace
    ? `${res.prefix}/namespaces/${o.metadata.namespace}/${res.plural}/${o.metadata.name}`
    : `${res.prefix}/${res.plural}/${o.metadata.name}`;

  // The state of a profile's live connection: {open, everOpened, failures}, or null before any list.
  const connection = profile => sockets.get(profile) || null;

  return { get, live, discover, objectPath, connection };
})();
