// Sautify Awards vote form + share buttons. Plain JS, no libraries (~3 KB).
(function () {
  var f = document.getElementById("voteform");
  var base = "/awards/api/";

  // Share: copy link
  var copy = document.getElementById("copylink");
  if (copy) copy.addEventListener("click", function () {
    var url = copy.getAttribute("data-url");
    var done = function () { copy.textContent = "Link copied"; setTimeout(function () { copy.textContent = "Copy link"; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt("Copy this link:", url); });
    else prompt("Copy this link:", url);
  });

  if (!f) return;
  var price = Number(f.getAttribute("data-price"));
  var nominee = f.getAttribute("data-nominee");
  var votesIn = f.querySelector("[name=votes]");
  var phoneIn = f.querySelector("[name=phone]");
  var totalEl = document.getElementById("total");
  var errEl = document.getElementById("err");
  var btn = f.querySelector("button[type=submit]");
  var out = document.getElementById("votestatus");
  var presets = f.querySelectorAll(".presets button");

  function fmt(n) { return "KES " + n.toLocaleString("en-KE"); }
  function setVotes(n) {
    votesIn.value = n; update();
    for (var i = 0; i < presets.length; i++) presets[i].setAttribute("aria-pressed", String(Number(presets[i].value) === Number(n)));
  }
  function update() {
    var n = Math.floor(Number(votesIn.value));
    totalEl.textContent = n >= 1 ? n.toLocaleString("en-KE") + (n === 1 ? " vote = " : " votes = ") + fmt(n * price) : "Choose your votes";
    for (var i = 0; i < presets.length; i++) presets[i].setAttribute("aria-pressed", String(Number(presets[i].value) === n));
  }
  for (var i = 0; i < presets.length; i++) presets[i].addEventListener("click", function (e) { e.preventDefault(); setVotes(this.value); });
  votesIn.addEventListener("input", update);
  update();

  function show(cls, title, text, spin) {
    out.hidden = false;
    out.className = "status " + cls;
    out.innerHTML = "<h3>" + (spin ? '<span class="spin" aria-hidden="true"></span>' : "") + title + "</h3><p></p>";
    out.querySelector("p").textContent = text;
    out.focus();
  }

  f.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.textContent = "";
    var n = Math.floor(Number(votesIn.value));
    var phone = phoneIn.value.replace(/\s+/g, "");
    if (!(n >= 1 && n <= 10000)) { errEl.textContent = "Choose between 1 and 10,000 votes."; return; }
    if (!/^(?:\+?254|0)[17]\d{8}$/.test(phone)) { errEl.textContent = "Enter a Safaricom number like 0712 345 678."; return; }
    btn.disabled = true; btn.textContent = "Sending prompt...";
    fetch(base + "vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nominee_id: nominee, votes: n, phone: phone }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || "Something went wrong.");
        f.hidden = true;
        show("", "Check your phone", "Enter your M-Pesa PIN on " + res.d.phone_masked + " to pay " + fmt(res.d.amount) + ". Keep this page open.", true);
        poll(res.d.order_id, 0);
      })
      .catch(function (err) { errEl.textContent = err.message; btn.disabled = false; btn.textContent = "Piga kura"; });
  });

  function poll(id, n) {
    if (n > 60) { // ~3 minutes
      show("", "Still waiting for M-Pesa", "If you paid, your votes will still be counted automatically within 10 minutes. You do not need to pay again.", false);
      return again();
    }
    setTimeout(function () {
      fetch(base + "vote-status?order=" + id + "&n=" + n, { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.done) return poll(id, n + 1);
          if (d.state === "COMPLETE" && d.votes_counted > 0) {
            var t = d.votes_counted.toLocaleString("en-KE") + (d.votes_counted === 1 ? " vote" : " votes") + " counted. Asante!";
            if (d.votes_counted < d.votes_requested) t += " You paid " + fmt(d.paid) + ", which covers " + d.votes_counted + " of the " + d.votes_requested + " votes you chose.";
            show("ok", "Payment received", t, false);
          } else if (d.state === "COMPLETE") {
            show("bad", "Payment too small", "We received " + fmt(d.paid || 0) + ", which is less than one vote. Contact us for a refund.", false);
          } else {
            show("bad", "Payment not completed", (d.reason || "The payment did not go through.") + " No money was taken for this attempt.", false);
          }
          again();
        })
        .catch(function () { poll(id, n + 1); });
    }, n < 5 ? 3000 : 4000);
  }

  function again() {
    var b = document.createElement("button");
    b.className = "btn ink"; b.style.marginTop = "14px"; b.textContent = "Vote again";
    b.onclick = function () { out.hidden = true; f.hidden = false; btn.disabled = false; btn.textContent = "Piga kura"; votesIn.focus(); };
    out.appendChild(b);
  }
})();
