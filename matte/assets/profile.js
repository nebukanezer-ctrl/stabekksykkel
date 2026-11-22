/* Hvem er du? + synkronisering av Oscars fremdrift og resultater.
   Oscar: lagres lokalt (prove:<id>) og synkes til /api/profile, så alle enheter ser det samme.
   Gjest: lagres bare lokalt på denne enheten (gjest:<id>), og blandes aldri inn i Oscars profil. */
(function () {
  if (window.Prove) return;

  var WHO = "provemeta:who", DIRTY = "provemeta:dirty";
  var ID = /^prove:([a-z0-9][a-z0-9-]{0,39})$/;

  function lg(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ls(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ld(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function rj(k) { try { return JSON.parse(lg(k)); } catch (e) { return null; } }

  var who = lg(WHO);
  if (who !== "oscar" && who !== "gjest") who = null;
  var status = "idle";

  function ns() { return who === "oscar" ? "prove" : "gjest"; }
  function key(id) { return ns() + ":" + id; }

  function dirty() { var d = rj(DIRTY); return Array.isArray(d) ? d : []; }
  function markDirty(id) {
    if (who !== "oscar") return;
    var d = dirty();
    if (d.indexOf(id) < 0) { d.push(id); ls(DIRTY, JSON.stringify(d)); }
  }
  function clearDirty(id) {
    ls(DIRTY, JSON.stringify(dirty().filter(function (x) { return x !== id; })));
  }

  function fetchT(url, opts, ms) {
    var c = typeof AbortController === "function" ? new AbortController() : null;
    var t = setTimeout(function () { if (c) c.abort(); }, ms);
    opts = opts || {};
    if (c) opts.signal = c.signal;
    return fetch(url, opts).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }

  function union(a, b) {
    var m = {};
    (a || []).concat(b || []).forEach(function (x) { m[x.ts] = x; });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) { return x.ts - y.ts; });
  }

  var P = (window.Prove = {
    who: function () { return who; },
    state: function (id) { return rj(key(id)); },
    attempts: function (id) { var a = rj(key(id) + ":att"); return Array.isArray(a) ? a : []; },
    save: function (id, st) {
      st.t = Date.now();
      ls(key(id), JSON.stringify(st));
      markDirty(id);
      schedule();
    },
    addAttempt: function (id, att) {
      var u = union(P.attempts(id), [att]);
      ls(key(id) + ":att", JSON.stringify(u));
      markDirty(id);
      schedule();
    },
    flush: flush,
    setWho: function (w) { ls(WHO, w); location.reload(); },
    ready: null
  });

  /* ---------- server ---------- */
  function post(id) {
    var body = JSON.stringify({ id: id, state: rj("prove:" + id), attempts: rj("prove:" + id + ":att") || [] });
    return fetchT("/api/profile", {
      method: "POST", headers: { "content-type": "application/json" }, body: body,
      keepalive: body.length < 60000
    }, 8000).then(function (r) {
      if (r.status === 400) { clearDirty(id); return; } // ugyldig lokal data: ikke prøv for alltid
      if (!r.ok) throw new Error("http " + r.status);
      clearDirty(id);
    });
  }

  function flush() {
    if (who !== "oscar") return Promise.resolve();
    var ids = dirty();
    if (!ids.length) { setStatus("ok"); return Promise.resolve(); }
    setStatus("sync");
    return ids.reduce(function (p, id) { return p.then(function () { return post(id); }); }, Promise.resolve())
      .then(function () { setStatus(dirty().length ? "err" : "ok"); }, function () { setStatus("err"); });
  }

  var timer;
  function schedule() {
    if (who !== "oscar") return;
    setStatus("sync");
    clearTimeout(timer);
    timer = setTimeout(flush, 500);
  }

  function sync() {
    setStatus("sync");
    return fetchT("/api/profile", { cache: "no-store" }, 6000)
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (srv) {
        var tests = (srv && srv.tests) || {};
        Object.keys(tests).forEach(function (id) {
          var s = tests[id], loc = rj("prove:" + id);
          if (s.state && (!loc || s.state.t > (loc.t || 0))) ls("prove:" + id, JSON.stringify(s.state));
          else if (loc && (!s.state || (loc.t || 0) > s.state.t)) markDirty(id);
          var la = rj("prove:" + id + ":att") || [];
          var u = union(la, s.attempts);
          if (u.length !== la.length) ls("prove:" + id + ":att", JSON.stringify(u));
          if (u.length !== (s.attempts || []).length) markDirty(id);
        });
        try {
          for (var i = 0; i < localStorage.length; i++) {
            var m = ID.exec(localStorage.key(i));
            if (m && !tests[m[1]]) markDirty(m[1]);
          }
        } catch (e) {}
        return flush();
      });
  }

  /* ---------- UI ---------- */
  var CSS =
    ".pv-chip{position:fixed;left:12px;bottom:12px;z-index:50;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);" +
    "padding:6px 8px 6px 12px;border-radius:999px;background:var(--paper,#fff);color:var(--muted,#5d6678);border:1px solid var(--line,#d5dbe6);" +
    "font:600 .8rem/1.2 var(--body,system-ui,sans-serif);box-shadow:0 2px 8px rgba(0,0,0,.12)}" +
    ".pv-chip i{width:9px;height:9px;border-radius:50%;background:#9aa4b8;flex:none}" +
    ".pv-chip.ok i{background:#1f8a4c}.pv-chip.sync i{background:#e0a800}.pv-chip.err i{background:#c23a3a}.pv-chip.gjest i{background:#2f5fb3}" +
    ".pv-chip button{font:inherit;color:var(--accent,#2f5fb3);background:transparent;border:1px solid var(--line,#d5dbe6);border-radius:999px;padding:3px 10px;cursor:pointer}" +
    ".pv-chip button:focus-visible,.pv-ov button:focus-visible{outline:3px solid var(--accent,#2f5fb3);outline-offset:2px}" +
    ".pv-ov{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:16px;background:rgba(10,15,25,.6)}" +
    ".pv-box{width:min(420px,100%);background:var(--paper,#fff);color:var(--fg,#1d2433);border:1px solid var(--line,#d5dbe6);border-radius:16px;padding:24px;" +
    "font-family:var(--body,system-ui,sans-serif)}" +
    ".pv-box h2{font:800 1.5rem/1.15 var(--display,system-ui,sans-serif);margin:0 0 6px}" +
    ".pv-box p{margin:0 0 16px;color:var(--muted,#5d6678);font-size:.95rem}" +
    ".pv-box .pv-btns{display:grid;gap:10px}" +
    ".pv-box button{font:800 1rem var(--display,system-ui,sans-serif);padding:13px 16px;border-radius:12px;cursor:pointer;border:2px solid var(--accent,#2f5fb3);" +
    "background:var(--accent,#2f5fb3);color:#fff}" +
    ".pv-box button.alt{background:transparent;color:var(--accent,#2f5fb3)}" +
    "@media (prefers-color-scheme:dark){.pv-box button:not(.alt){color:#10151f}}";

  function style() {
    if (document.getElementById("pv-css")) return;
    var s = document.createElement("style");
    s.id = "pv-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function setStatus(s) {
    status = s;
    var c = document.getElementById("pv-chip");
    if (!c) return;
    var txt = who === "gjest" ? "Gjest · lagres ikke på Oscars profil"
      : s === "sync" ? "Oscar · lagrer …"
      : s === "err" ? "Oscar · ikke lagret på nett ennå"
      : "Oscar · lagret";
    c.className = "pv-chip " + (who === "gjest" ? "gjest" : s === "idle" ? "ok" : s);
    c.querySelector("span").textContent = txt;
  }

  function chip() {
    if (!who || document.getElementById("pv-chip")) return;
    style();
    var c = document.createElement("div");
    c.id = "pv-chip";
    c.innerHTML = '<i></i><span></span><button type="button">Bytt</button>';
    c.querySelector("button").addEventListener("click", function () { ask(true); });
    document.body.appendChild(c);
    setStatus(status);
  }

  function ask(change) {
    return new Promise(function (resolve) {
      style();
      var ov = document.createElement("div");
      ov.className = "pv-ov";
      ov.innerHTML =
        '<div class="pv-box" role="dialog" aria-modal="true" aria-labelledby="pv-h">' +
        '<h2 id="pv-h">Er du Oscar?</h2>' +
        "<p>Som Oscar lagres fremdrift og alle resultater, så du kan fortsette senere og på andre enheter.</p>" +
        '<div class="pv-btns"><button type="button" id="pv-yes">Ja, jeg er Oscar</button>' +
        '<button type="button" class="alt" id="pv-no">Nei, noen andre</button>' +
        (change ? '<button type="button" class="alt" id="pv-x">Avbryt</button>' : "") +
        "</div></div>";
      document.body.appendChild(ov);
      var yes = ov.querySelector("#pv-yes");
      yes.focus();
      function pick(w) {
        if (change && w === who) { ov.remove(); return; }
        ls(WHO, w);
        if (change) { location.reload(); return; }
        who = w;
        ov.remove();
        resolve();
      }
      yes.addEventListener("click", function () { pick("oscar"); });
      ov.querySelector("#pv-no").addEventListener("click", function () { pick("gjest"); });
      var x = ov.querySelector("#pv-x");
      if (x) x.addEventListener("click", function () { ov.remove(); });
    });
  }

  function init() {
    var chosen = who ? Promise.resolve() : ask(false);
    return chosen.then(function () {
      chip();
      if (who === "oscar") return sync().catch(function () { setStatus("err"); });
    });
  }

  P.ready = new Promise(function (res) {
    if (document.body) res(); else document.addEventListener("DOMContentLoaded", res);
  }).then(init);

  window.addEventListener("online", function () { if (who === "oscar") flush(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && who === "oscar" && dirty().length) flush();
  });
})();
