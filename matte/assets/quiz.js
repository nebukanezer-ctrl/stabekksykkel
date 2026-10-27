/* Felles quiz-motor for Prøvehjørnet. Bruk: quiz({title, sub, back, goals:{nøkkel:"tekst"}, figs:{navn:"<svg…>"}, questions:[{t, g, q, o:[…], a:0, e, fig}]})
   Riktig svar står alltid først i o (a = 0). Motoren blander rekkefølgen for hver runde. */
(function () {
  var CSS = `
:root{
  --bg:#f6f8fb; --paper:#ffffff; --fg:#1d2433; --muted:#5d6678; --line:#d5dbe6;
  --accent:#2f5fb3; --accent-soft:#e3ebfa; --good:#1f8a4c; --good-soft:#dff4e6; --bad:#c23a3a; --bad-soft:#fbe3e3;
  --display:"Nunito",system-ui,sans-serif; --body:"Source Sans 3",system-ui,sans-serif;
}
@media (prefers-color-scheme: dark){:root{
  --bg:#141922; --paper:#1d2431; --fg:#eef1f6; --muted:#9aa4b8; --line:#333c4d;
  --accent:#7ea4ea; --accent-soft:#23324d; --good:#5fcf8c; --good-soft:#1c3a2a; --bad:#f08080; --bad-soft:#44232a; color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--body);font-size:17px;line-height:1.5;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:24px}
.wrap{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
h1{font-family:var(--display);font-weight:800;font-size:1.6rem;margin:0;text-wrap:balance}
.sub{color:var(--muted);font-size:.95rem;margin:0}
.tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.back{color:var(--muted);font-size:.9rem}
.progress{height:8px;background:var(--line);border-radius:4px;overflow:hidden}
.progress>div{height:100%;background:var(--accent);width:0;transition:width .3s}
.card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:22px}
.eyebrow{font-family:var(--display);font-weight:800;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:0 0 6px}
.q{font-size:1.15rem;margin:0 0 16px;font-weight:600}
.opts{display:grid;gap:10px;margin:0;padding:0;list-style:none}
.opt{display:flex;align-items:center;gap:12px;width:100%;text-align:left;font:inherit;color:var(--fg);background:var(--paper);
  border:2px solid var(--line);border-radius:10px;padding:12px 14px;cursor:pointer}
.opt:hover{border-color:var(--accent)}
.opt:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.opt .k{font-family:var(--display);font-weight:800;color:var(--accent);background:var(--accent-soft);border-radius:6px;min-width:28px;height:28px;display:grid;place-items:center;flex:none}
.opt.correct{border-color:var(--good);background:var(--good-soft)}
.opt.wrong{border-color:var(--bad);background:var(--bad-soft)}
.opt[disabled]{cursor:default}
.feedback{margin-top:16px;padding:12px 14px;border-radius:10px;display:none}
.feedback.show{display:block}
.feedback.ok{background:var(--good-soft)}
.feedback.no{background:var(--bad-soft)}
.feedback b{font-family:var(--display)}
.actions{display:flex;justify-content:flex-end;margin-top:16px}
.btn{font-family:var(--display);font-weight:800;font-size:1rem;color:#fff;background:var(--accent);border:0;border-radius:10px;padding:11px 20px;cursor:pointer}
.btn:focus-visible{outline:3px solid var(--fg);outline-offset:2px}
.btn.ghost{background:transparent;color:var(--accent);border:2px solid var(--accent)}
.btn.small{padding:6px 12px;font-size:.85rem}
.frac{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;line-height:1.05;margin:0 3px;font-variant-numeric:tabular-nums}
.frac span:first-child{border-bottom:1.5px solid currentColor;padding:0 3px}
.frac span:last-child{padding:0 3px}
figure{margin:0 0 16px}
svg{max-width:100%;height:auto;display:block}
.big{font-family:var(--display);font-weight:800;font-size:3rem;line-height:1;color:var(--accent);font-variant-numeric:tabular-nums}
.review{display:grid;gap:8px;margin:16px 0 0;padding:0;list-style:none}
.review li{display:flex;gap:10px;align-items:baseline;padding:8px 0;border-top:1px solid var(--line)}
.review .dot{flex:none;width:10px;height:10px;border-radius:50%;background:var(--good);margin-top:6px}
.review .dot.no{background:var(--bad)}
.review .sc{margin-left:auto;font-family:var(--display);font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.missed{color:var(--muted);font-size:.95rem;margin:14px 0 0}
pre{font-size:.9rem;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow-x:auto;margin:0 0 14px}
.excerpt{margin:0 0 16px;padding:12px 16px;border-left:4px solid var(--accent);background:var(--bg);border-radius:0 10px 10px 0;font-style:italic}
sup{font-size:.7em;line-height:0}
@media (prefers-reduced-motion:reduce){.progress>div{transition:none}}
`;

  var st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);
  var lk = document.createElement("link");
  lk.rel = "stylesheet";
  lk.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@600;800&family=Source+Sans+3:wght@400;600&display=swap";
  document.head.appendChild(lk);

  window.F = function (n, d) {
    return '<span class="frac"><span>' + n + "</span><span>" + d + "</span></span>";
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  window.quiz = function (cfg) {
    var app = document.getElementById("app");
    app.innerHTML =
      '<div class="wrap"><header><div><h1>' + cfg.title + '</h1><p class="sub">' + cfg.sub + "</p></div>" +
      '<div class="tools"><p class="sub" id="counter"></p>' +
      '<button class="btn ghost small" id="reset" type="button">Start på nytt</button>' +
      '<a class="back" href="' + (cfg.back || "../") + '">Til oversikten</a></div></header>' +
      '<div class="progress"><div id="bar"></div></div><div class="card" id="card"></div></div>';

    var card = document.getElementById("card"),
      bar = document.getElementById("bar"),
      counter = document.getElementById("counter");
    var order, i, results;

    function start() {
      order = cfg.questions.map(function (q) {
        var idx = shuffle(q.o.map(function (_, k) { return k; }));
        return Object.assign({}, q, {
          opts: idx.map(function (k) { return q.o[k]; }),
          ans: idx.indexOf(q.a || 0)
        });
      });
      i = 0; results = [];
      render();
    }

    function render() {
      bar.style.width = (i / order.length * 100) + "%";
      if (i >= order.length) return finish();
      var q = order[i];
      counter.textContent = "Spørsmål " + (i + 1) + " av " + order.length;
      var fig = q.fig && cfg.figs ? cfg.figs[q.fig] : "";
      card.innerHTML =
        '<p class="eyebrow">Oppgave ' + (i + 1) + (q.t ? " · " + q.t : "") + "</p>" + fig +
        '<p class="q">' + q.q + "</p>" +
        '<ul class="opts">' + q.opts.map(function (o, k) {
          return '<li><button class="opt" data-k="' + k + '" id="opt' + i + "-" + k + '"><span class="k">' + "ABCD"[k] + "</span><span>" + o + "</span></button></li>";
        }).join("") + "</ul>" +
        '<div class="feedback" id="fb"></div><div class="actions"><button class="btn" id="next" hidden>Neste</button></div>';
      card.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () { answer(+b.dataset.k); });
      });
      document.getElementById("next").addEventListener("click", function () { i++; render(); });
    }

    function answer(k) {
      var q = order[i], btns = card.querySelectorAll(".opt"), ok = k === q.ans;
      btns.forEach(function (b, j) {
        b.disabled = true;
        if (j === q.ans) b.classList.add("correct");
        else if (j === k) b.classList.add("wrong");
      });
      var fb = document.getElementById("fb");
      fb.className = "feedback show " + (ok ? "ok" : "no");
      fb.innerHTML = "<b>" + (ok ? "Riktig!" : "Ikke helt.") + "</b> " + q.e;
      results.push({ n: i + 1, g: q.g, ok: ok });
      var next = document.getElementById("next");
      next.hidden = false;
      next.textContent = i === order.length - 1 ? "Se resultat" : "Neste";
      next.focus();
    }

    function finish() {
      var n = results.filter(function (r) { return r.ok; }).length;
      counter.textContent = "Ferdig";
      var by = {};
      results.forEach(function (r) {
        by[r.g] = by[r.g] || { t: 0, ok: 0 };
        by[r.g].t++;
        if (r.ok) by[r.g].ok++;
      });
      var rows = Object.keys(cfg.goals).filter(function (g) { return by[g]; }).map(function (g) {
        var s = by[g];
        return '<li><span class="dot ' + (s.ok === s.t ? "" : "no") + '"></span><span>' + cfg.goals[g] + '</span><span class="sc">' + s.ok + "/" + s.t + "</span></li>";
      }).join("");
      var missed = results.filter(function (r) { return !r.ok; }).map(function (r) { return r.n; });
      var msg = n === order.length ? "Alt riktig – fantastisk!" :
        n >= order.length * 0.7 ? "Bra jobba! Se over det du bommet på." :
        "Øv litt til på det som er rødt, så prøver du igjen.";
      card.innerHTML =
        '<p class="eyebrow">Resultat</p><div class="big">' + n + " / " + order.length + "</div><p>" + msg + "</p>" +
        '<p class="eyebrow" style="margin-top:18px">Resultat per kompetansemål</p><ul class="review">' + rows + "</ul>" +
        (missed.length ? '<p class="missed">Bommet på oppgave: ' + missed.join(", ") + ".</p>" : "") +
        '<div class="actions"><button class="btn" id="again">Prøv igjen</button></div>';
      document.getElementById("again").addEventListener("click", start);
    }

    document.getElementById("reset").addEventListener("click", start);
    start();
  };
})();
