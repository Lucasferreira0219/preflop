import webview
import os
from simulator_api import SimulatorApi
from api import Api
import api as api_module
import simulator_engine

_base = os.path.dirname(os.path.abspath(__file__))

def _url(filename):
    path = os.path.join(_base, 'ui', filename)
    return 'file:///' + path.replace(os.sep, '/')


class AppApi:
    def __init__(self):
        self._sim  = SimulatorApi()
        self._main = Api()

    # ── Navegação ──────────────────────────────────────────────────────────────
    def navigate(self, mode):
        w = webview.windows[0]
        if mode == 'sim':
            w.load_url(_url('simulator.html'))
            w.resize(920, 660)
            w.set_title('Simulador Preflop — MTT')
        elif mode == 'main':
            w.load_url(_url('index.html'))
            w.resize(760, 720)
            w.set_title('Preflop Ranges — MTT')
        elif mode == 'launcher':
            w.load_url(_url('launcher.html'))
            w.resize(620, 400)
            w.set_title('Preflop MTT')

    # ── Simulador ──────────────────────────────────────────────────────────────
    def new_question(self, player_count=9, stack_bb=None):
        return self._sim.new_question(player_count, stack_bb)

    def submit_answer(self, user_action):
        return self._sim.submit_answer(user_action)

    def get_stats(self):
        return self._sim.get_stats()

    def get_analytics(self, from_ts=None, to_ts=None):
        return self._sim.get_analytics(from_ts, to_ts)

    def get_improvement(self, window_days=7):
        return self._sim.get_improvement(window_days)

    def reset_stats(self):
        return self._sim.reset_stats()

    # ── Consulta ───────────────────────────────────────────────────────────────
    def get_range(self, pos, scenario, stack_bb):
        return self._main.get_range(pos, scenario, stack_bb)


if __name__ == '__main__':
    # Pré-carrega ranges em memória — evita IO durante o gameplay
    loaded_main = api_module.warm_cache()
    loaded_sim  = simulator_engine.warm_cache()
    print(f"[startup] Ranges cache: consulta={loaded_main} simulador={loaded_sim}")

    webview.create_window(
        title='Preflop MTT',
        url=_url('launcher.html'),
        js_api=AppApi(),
        width=620,
        height=400,
        min_size=(620, 400),
        resizable=True,
        background_color='#0d0d1a',
    )
    webview.start()
