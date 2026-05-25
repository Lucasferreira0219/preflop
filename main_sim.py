import webview
import os
from simulator_api import SimulatorApi

HTML_PATH = os.path.join(os.path.dirname(__file__), "ui", "simulator.html")

if __name__ == "__main__":
    api = SimulatorApi()
    window = webview.create_window(
        title="Simulador Preflop — MTT",
        url=f"file:///{HTML_PATH.replace(os.sep, '/')}",
        js_api=api,
        width=900,
        height=640,
        min_size=(700, 520),
        background_color="#0f0f1a",
    )
    webview.start(debug=False)
