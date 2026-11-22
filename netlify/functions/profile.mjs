// Lagrer Oscars prøvefremdrift og resultater (Netlify Blobs). Én blob per prøve: "t/<id>".
// Ingen innlogging: «Er du Oscar?» på sidene styrer bare om nettleseren synkroniserer hit.
import { getStore } from "@netlify/blobs";

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

export function cleanState(s) {
  if (s === null || s === undefined) return null;
  if (typeof s !== "object" || s.v !== 1) throw new Error("state");
  const t = s.t === undefined ? 0 : s.t; // eldre lagret fremdrift har ikke tidsstempel
  if (!Number.isFinite(t) || !int(s.i, 0, 200) || !int(s.total, 1, 200)) throw new Error("state");
  if (s.sel !== null && !int(s.sel, 0, 9)) throw new Error("state");
  if (!Array.isArray(s.results) || s.results.length > 200) throw new Error("state");
  if (!Array.isArray(s.perm) || s.perm.length > 200) throw new Error("state");
  const out = {
    v: 1, t, i: s.i, total: s.total, sel: s.sel,
    results: s.results.map((r) => {
      if (!int(r.n, 1, 200) || typeof r.g !== "string" || r.g.length > 20 || typeof r.ok !== "boolean") throw new Error("state");
      return { n: r.n, g: r.g, ok: r.ok };
    }),
    perm: s.perm.map((p) => {
      if (!Array.isArray(p) || p.length > 10 || !p.every((k) => int(k, 0, 9))) throw new Error("state");
      return p;
    }),
  };
  if (s.fin !== undefined) {
    if (!Number.isFinite(s.fin)) throw new Error("state");
    out.fin = s.fin;
  }
  return out;
}

export function cleanAttempts(list) {
  if (!Array.isArray(list) || list.length > 100) throw new Error("attempts");
  return list.map((a) => {
    if (!Number.isFinite(a.ts) || !int(a.score, 0, 200) || !int(a.total, 1, 200)) throw new Error("attempts");
    const by = {};
    const keys = Object.keys(a.by || {});
    if (keys.length > 30) throw new Error("attempts");
    for (const k of keys) {
      const v = a.by[k];
      if (k.length > 20 || !v || !int(v.t, 0, 200) || !int(v.ok, 0, 200)) throw new Error("attempts");
      by[k] = { t: v.t, ok: v.ok };
    }
    return { ts: a.ts, score: a.score, total: a.total, by };
  });
}

export function merge(old, state, attempts) {
  const o = old || { state: null, attempts: [] };
  let st = o.state || null;
  if (state && (!st || state.t >= st.t)) st = state;
  const map = new Map();
  for (const a of [...(o.attempts || []), ...attempts]) map.set(a.ts, a);
  const att = [...map.values()].sort((a, b) => a.ts - b.ts).slice(-50);
  return { state: st, attempts: att, updated: Date.now() };
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export function makeHandler(getStoreFn) {
  return async (req) => {
    const url = new URL(req.url);
    const origin = req.headers.get("origin");
    if (origin) {
      let ok = false;
      try { ok = new URL(origin).host === url.host; } catch {}
      if (!ok) return json({ error: "origin" }, 403);
    }
    const store = getStoreFn();

    if (req.method === "GET") {
      const { blobs } = await store.list({ prefix: "t/" });
      const tests = {};
      await Promise.all(
        blobs.map(async (b) => {
          const v = await store.get(b.key, { type: "json" });
          if (v) tests[b.key.slice(2)] = v;
        })
      );
      return json({ tests });
    }

    if (req.method === "POST") {
      const text = await req.text();
      if (text.length > 40000) return json({ error: "too large" }, 413);
      let body, state, attempts;
      try {
        body = JSON.parse(text);
        if (typeof body.id !== "string" || !ID.test(body.id)) throw new Error("id");
        state = cleanState(body.state);
        attempts = cleanAttempts(body.attempts || []);
      } catch (e) {
        return json({ error: "bad request" }, 400);
      }
      const key = "t/" + body.id;
      const old = await store.get(key, { type: "json" });
      const merged = merge(old, state, attempts);
      await store.setJSON(key, merged);
      return json({ ok: true, updated: merged.updated });
    }

    return json({ error: "method" }, 405);
  };
}

export default makeHandler(() => getStore({ name: "oscar", consistency: "strong" }));
export const config = { path: "/api/profile" };
