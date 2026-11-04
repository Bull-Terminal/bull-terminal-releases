/* Bull Terminal waitlist - the only two things to change are these constants (see site/README.md).
   While a value is still in [brackets] the page shows a friendly "coming soon" instead of failing. */
const WAITLIST_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScQDoO2mDGrKcNXEl_aw5egiQfIZWJhrzcy0MOfUYrkcQAeEA/formResponse";
const DISCORD_URL = "https://discord.gg/88fmCavj9e";

/* Launch counter under the first sign-up box: set it to the real number of sign-ups (Google Sheet rows + Whop waitlist),
   e.g. 47 -> "Launching at 100 sign-ups - we're at 47". null hides it. Never round it up. */
const WAITLIST_COUNT = null;
const LAUNCH_AT = 100;

/* Only for a Google Form: the form's "entry.<number>" names for each question (README explains how to find them).
   Leave a name empty to not send that field. Formspree and most other services need nothing here. */
const GOOGLE_FORM_FIELDS = { email: "entry.1145894272", ref: "entry.1655066740", ref_code: "entry.35413757" };

/* Ready-to-post text for the referral box. {link} becomes the visitor's own link. */
const POSTS = {
  x: "I just joined the waitlist for Bull Terminal - a crypto + stock scanner that scores every setup and grades its own picks, losses included. Free to join: {link}",
  tiktok: "Free crypto + stock scanner waitlist 👇 {link}",
  discord: "Found a scanner that keeps score of its own picks (wins AND losses) - Bull Terminal. Free waitlist, join with my link: {link}"
};

(function () {
  "use strict";
  const isSet = (v) => /^https:\/\//i.test(v) && !/[\[\]]/.test(v);
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const store = {             // browser storage is a convenience only - the page works without it
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode etc. */ } }
  };

  /* ---------- ?ref=CODE from a friend's link -> hidden field on both forms ---------- */
  const REF_RX = /^[a-z0-9]{4,16}$/;
  let inRef = (new URLSearchParams(location.search).get("ref") || "").trim().toLowerCase();
  if (REF_RX.test(inRef)) store.set("bt_in_ref", inRef); else inRef = store.get("bt_in_ref") || "";
  if (REF_RX.test(inRef)) $$("[data-ref]").forEach((i) => { i.value = inRef; });

  /* ---------- the visitor's own short code: from a hash of the email, never the email itself ---------- */
  const B32 = "abcdefghijkmnpqrstuvwxyz23456789";   // no 0/1/l/o - easy to read out loud
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
  async function refCode(email) {
    const text = "bull-terminal-waitlist:" + email.trim().toLowerCase();
    let bytes;
    try {
      bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
    } catch (e) {                                     // very old browsers / insecure context: a weaker hash still works
      const a = fnv(text), b = fnv(text + "#");
      bytes = new Uint8Array([a >>> 24, a >>> 16, a >>> 8, a, b >>> 24, b >>> 16, b >>> 8, b].map((x) => x & 255));
    }
    let bits = 0, val = 0, out = "";
    for (const byte of bytes) {
      val = (val << 8) | byte; bits += 8;
      while (bits >= 5 && out.length < 8) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
      if (out.length >= 8) break;
    }
    return out;
  }
  const pageUrl = () => location.origin + location.pathname.replace(/index\.html$/, "");

  function showReferral(code, focus) {
    const link = pageUrl() + "?ref=" + code;
    $("[data-ref-link]").value = link;
    $$("[data-post]").forEach((t) => { t.value = (POSTS[t.dataset.post] || "").replace("{link}", link); });
    const box = $("#refer");
    box.hidden = false;
    $$("[data-post]").forEach((t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; });   // show all of it
    if (focus) { box.scrollIntoView({ behavior: "smooth", block: "start" }); box.focus({ preventScroll: true }); }
  }

  /* copy buttons */
  $$("[data-copy]").forEach((btn) => btn.addEventListener("click", async () => {
    const field = document.getElementById(btn.dataset.copy);
    const label = btn.textContent;
    let ok = false;
    try { await navigator.clipboard.writeText(field.value); ok = true; } catch (e) {
      field.select(); try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
    }
    btn.textContent = ok ? "Copied ✓" : "Press Ctrl+C";
    setTimeout(() => { btn.textContent = label; }, 1800);
  }));

  /* ---------- sign-up forms ---------- */
  const formUrlSet = isSet(WAITLIST_FORM_URL);
  const isGoogle = /docs\.google\.com\/forms\//i.test(WAITLIST_FORM_URL);
  const isWhop = /(^|\.)whop\.com\//i.test(WAITLIST_FORM_URL.replace(/^https:\/\//i, ""));

  $$("[data-waitlist]").forEach((form) => {
    if (formUrlSet && !isWhop) { form.action = WAITLIST_FORM_URL; form.method = "post"; }
    const msg = $("[data-msg]", form);
    const btn = $("button[type=submit]", form);
    const say = (text, kind) => { msg.textContent = text; msg.className = "msg " + (kind || ""); };

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const email = $("input[type=email]", form);
      if (!email.checkValidity()) { say("Please enter a valid email address.", "err"); email.focus(); return; }
      const addr = email.value.trim();
      const code = await refCode(addr);

      if (!formUrlSet) {
        say("Sign-ups open very soon - thanks for your patience!", "info");
        return;
      }
      if (isWhop) {                                    // a Whop page can't take a form post: open it instead
        store.set("bt_my_ref", code);
        window.location.href = WAITLIST_FORM_URL;
        return;
      }

      btn.disabled = true;
      say("Joining…", "info");
      const data = new FormData(form);
      data.set("email", addr);
      data.set("ref_code", code);                      // the visitor's own code, so shares can be matched later
      try {
        if (isGoogle) {
          // Google Forms doesn't allow reading the reply from another site; the post still lands ("opaque" response)
          const g = new URLSearchParams();
          for (const [k, name] of Object.entries(GOOGLE_FORM_FIELDS)) if (name && data.get(k)) g.set(name, data.get(k));
          await fetch(WAITLIST_FORM_URL, { method: "POST", mode: "no-cors", body: g });
        } else {
          const r = await fetch(WAITLIST_FORM_URL, { method: "POST", body: data, headers: { Accept: "application/json" } });
          if (!r.ok) throw new Error("HTTP " + r.status);
        }
        store.set("bt_my_ref", code);
        form.reset();
        $$("[data-ref]").forEach((i) => { i.value = REF_RX.test(inRef) ? inRef : ""; });
        say("You're on the list! Thanks for joining.", "ok");
        showReferral(code, true);
      } catch (e) {
        // CORS or network trouble: fall back to a normal form post, which works with any form service
        form.submit();
      } finally {
        btn.disabled = false;
      }
    });
  });

  // returning visitor who already signed up on this device: show their link again
  const mine = store.get("bt_my_ref");
  if (mine && REF_RX.test(mine)) showReferral(mine, false);

  /* ---------- launch counter ---------- */
  const cnt = $("[data-count]");
  if (cnt && Number.isInteger(WAITLIST_COUNT) && WAITLIST_COUNT >= 0) {
    const n = Math.min(WAITLIST_COUNT, LAUNCH_AT);
    $("[data-count-text]", cnt).textContent = WAITLIST_COUNT >= LAUNCH_AT
      ? `We hit ${LAUNCH_AT} - launching now.` : `Launching at ${LAUNCH_AT} sign-ups - we're at ${WAITLIST_COUNT}.`;
    const bar = $("[data-count-bar]", cnt);
    bar.style.width = (100 * n / LAUNCH_AT).toFixed(1) + "%";
    bar.parentElement.setAttribute("aria-valuenow", String(n));
    cnt.hidden = false;
  }

  /* ---------- Discord button ---------- */
  const dc = $("[data-discord]");
  if (dc) {
    if (isSet(DISCORD_URL)) {
      dc.href = DISCORD_URL; dc.target = "_blank"; dc.rel = "noopener";
    } else {
      dc.setAttribute("aria-disabled", "true");
      $("[data-discord-label]", dc).textContent = "Discord opens soon";
      dc.addEventListener("click", (e) => e.preventDefault());
    }
  }
})();
