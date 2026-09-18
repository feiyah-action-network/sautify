/* Feiyah Action Network homepage behavior.
   Vanilla JS only, no dependencies, loaded with defer. */

(function () {
  'use strict';

  /* ---------- Scroll-reveal ---------- */

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealEls = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* ---------- Donation module (UI only) ---------- */

  var form = document.getElementById('donation-form');
  if (form) {
    var tierButtons = form.querySelectorAll('.tier-btn');
    var impactEl = document.getElementById('tier-impact');
    var submitBtn = document.getElementById('donate-submit');
    var selectedAmount = 50;

    tierButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tierButtons.forEach(function (other) {
          other.setAttribute('aria-pressed', 'false');
        });
        btn.setAttribute('aria-pressed', 'true');
        selectedAmount = parseInt(btn.dataset.amount, 10);
        impactEl.textContent = btn.dataset.impact;
        submitBtn.textContent = 'Donate $' + selectedAmount;
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      handleDonationSubmit(selectedAmount);
    });
  }

  /**
   * STUB: payment processing is not wired up yet.
   *
   * INTEGRATION POINT (do not implement until the processor is confirmed):
   * once Stripe or Donorbox is chosen, this function should POST
   * `{ amount }` to a Netlify Function (e.g. /.netlify/functions/create-checkout)
   * that creates the checkout session server-side. All secret keys live in
   * Netlify environment variables, never in this file or any client code.
   * This form must never gain data-netlify attributes: payment data must not
   * pass through Netlify Forms.
   */
  function handleDonationSubmit(amount) {
    window.alert(
      'Thank you. Card checkout is not live on this page yet, so your $' +
        amount +
        ' gift cannot be processed here today. Please write to info@feiyahactionnetwork.org and FAN will send M-Pesa details or another way to give.'
    );
  }

  /* ---------- Mobile sticky donate bar ---------- */

  var bar = document.getElementById('mobile-donate-bar');
  var donateSection = document.getElementById('donate');

  if (bar && donateSection && 'IntersectionObserver' in window) {
    var barObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          // Slide the bar out of the way while the full donation module is
          // visible, so it never covers its own checkout button.
          bar.classList.toggle('translate-y-full', entry.isIntersecting);
        });
      },
      { threshold: 0.15 }
    );
    barObserver.observe(donateSection);
  }
})();
