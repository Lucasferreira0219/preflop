'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  PreflopAPI — camada que funciona em pywebview (desktop) E browser (web)
// ─────────────────────────────────────────────────────────────────────────────
//
//  Use sempre window.PreflopAPI.<method>(...) em vez de window.pywebview.api,
//  e PreflopAPI.ready(cb) em vez de pywebviewready.
//
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const isDesktop = typeof window.pywebview !== 'undefined'
                 || navigator.userAgent.includes('pywebview');
  // Pode haver delay até window.pywebview existir mesmo no desktop, então
  // ouvimos o evento pywebviewready. Em fallback, depois de 400ms assumimos web.
  const readyCbs = [];
  let ready = false;
  let mode = null; // 'desktop' | 'web'

  function fireReady(m) {
    if (ready) return;
    mode = m;
    ready = true;
    readyCbs.splice(0).forEach(cb => { try { cb(m); } catch (e) { console.error(e); } });
  }

  window.addEventListener('pywebviewready', () => fireReady('desktop'));

  // Fallback: se pywebview não inicializou em 500ms, considera web
  setTimeout(() => {
    if (!ready) {
      if (typeof window.pywebview !== 'undefined' && window.pywebview.api) {
        fireReady('desktop');
      } else {
        fireReady('web');
      }
    }
  }, 500);

  const _ROOT = (typeof window._BASE !== 'undefined') ? window._BASE : '';

  async function _callWeb(method, args) {
    const res = await fetch(_ROOT + '/api/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || []),
    });
    if (!res.ok) {
      throw new Error(`API ${method} HTTP ${res.status}`);
    }
    return await res.json();
  }

  function _callDesktop(method, args) {
    const fn = window.pywebview && window.pywebview.api && window.pywebview.api[method];
    if (typeof fn !== 'function') {
      return Promise.reject(new Error(`pywebview.api.${method} not found`));
    }
    return fn(...(args || []));
  }

  function call(method, ...args) {
    if (!ready) {
      // Buffer: espera ready, depois chama
      return new Promise((resolve, reject) => {
        readyCbs.push(() => {
          call(method, ...args).then(resolve, reject);
        });
      });
    }
    if (mode === 'desktop') return _callDesktop(method, args);
    return _callWeb(method, args);
  }

  // ── Modo: MTT ou SnG (persistido em localStorage) ──────────────────────────
  const MODE_KEY    = 'preflop_mode';
  const VALID_MODES = ['mtt', 'sng'];
  const STACKS_BY_MODE = { mtt: [20, 35, 50, 100], sng: [10, 15, 30, 75] };

  function getMode() {
    let m = null;
    try { m = localStorage.getItem(MODE_KEY); } catch (e) {}
    return VALID_MODES.includes(m) ? m : 'mtt';
  }
  function setMode(m) {
    if (!VALID_MODES.includes(m)) return;
    try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
  }
  function stacksForMode(m) {
    return STACKS_BY_MODE[m] || STACKS_BY_MODE.mtt;
  }

  // ── Navegação ──────────────────────────────────────────────────────────────
  function navigate(target) {
    if (mode === 'desktop') {
      return _callDesktop('navigate', [target]);
    }
    // Web: muda URL
    const paths = { launcher: _ROOT + '/', main: _ROOT + '/consulta', sim: _ROOT + '/sim' };
    window.location.href = paths[target] || (_ROOT + '/');
  }

  // ── API pública ────────────────────────────────────────────────────────────
  window.PreflopAPI = {
    ready(cb) {
      if (ready) cb(mode);
      else readyCbs.push(cb);
    },
    get mode() { return mode; },
    get isDesktop() { return mode === 'desktop'; },
    get isWeb()     { return mode === 'web'; },

    navigate,

    // Modo MTT/SnG
    getMode, setMode, stacksForMode,

    // Simulador
    new_question:    (...a) => call('new_question',    ...a),
    submit_answer:   (...a) => call('submit_answer',   ...a),
    get_stats:       (...a) => call('get_stats',       ...a),
    reset_stats:     (...a) => call('reset_stats',     ...a),
    get_analytics:   (...a) => call('get_analytics',   ...a),
    get_improvement: (...a) => call('get_improvement', ...a),

    // Consulta
    get_range:       (...a) => call('get_range',       ...a),
    list_villains:   (...a) => call('list_villains',   ...a),
    get_insights:    (...a) => call('get_insights',    ...a),
  };
})();
