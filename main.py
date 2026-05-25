import webview
import os
from api import Api

HTML_PATH = os.path.join(os.path.dirname(__file__), "ui", "index.html")

if __name__ == "__main__":
    api = Api()
    window = webview.create_window(
        title="Preflop Ranges — MTT",
        url=f"file:///{HTML_PATH.replace(os.sep, '/')}",
        js_api=api,
        width=1100,
        height=720,
        min_size=(900, 600),
        background_color="#1a1a2e",
    )
    webview.start(debug=False)
