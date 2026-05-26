'use strict';

function launch(target) {
  const card = document.querySelector(target === 'sim' ? '.mode-sim' : '.mode-main');
  if (card) {
    card.style.transition = 'all .1s ease';
    card.style.transform  = 'scale(0.96)';
    card.style.opacity    = '0.5';
  }
  PreflopAPI.ready(() => PreflopAPI.navigate(target));
}

// ── Toggle MTT / SnG ─────────────────────────────────────────────────────────
function setupModeToggle() {
  const toggle = document.getElementById('modeToggle');
  const logoTitle = document.getElementById('logoTitle');
  const headerName = document.querySelector('.header-name');
  if (!toggle) return;

  function render(mode) {
    toggle.querySelectorAll('.mode-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    if (logoTitle)  logoTitle.textContent  = 'PREFLOP ' + mode.toUpperCase();
    if (headerName) headerName.textContent = 'PREFLOP ' + mode.toUpperCase();
  }

  render(PreflopAPI.getMode());

  toggle.addEventListener('click', e => {
    const btn = e.target.closest('.mode-tab');
    if (!btn) return;
    const m = btn.dataset.mode;
    PreflopAPI.setMode(m);
    render(m);
  });
}

PreflopAPI.ready(setupModeToggle);
