'use strict';

function launch(mode) {
  const card = document.querySelector(mode === 'sim' ? '.mode-sim' : '.mode-main');
  if (card) {
    card.style.transition = 'all .1s ease';
    card.style.transform  = 'scale(0.96)';
    card.style.opacity    = '0.5';
  }
  PreflopAPI.ready(() => PreflopAPI.navigate(mode));
}
