import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show on Android (not iOS, not already installed)
    const isAndroid = /android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!isAndroid || isStandalone) return;

    const dismissed = sessionStorage.getItem("pwa-dismissed");
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferredPrompt) return null;

  const handleInstall = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("pwa-dismissed", "1");
    setVisible(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 1000,
        background: "#17212B",
        borderTop: "1px solid #263241",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: 22 }}>♠</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#F4F7FA" }}>
          Instalar Preflop Trainer
        </div>
        <div style={{ fontSize: 11, color: "#9AA7B4" }}>
          Adicionar à tela inicial para acesso rápido
        </div>
      </div>
      <button
        onClick={handleDismiss}
        style={{
          background: "transparent", border: "none",
          color: "#9AA7B4", fontSize: 18, cursor: "pointer",
          padding: "4px 8px", lineHeight: 1,
        }}
      >
        ✕
      </button>
      <button
        onClick={handleInstall}
        style={{
          background: "#D6A84F", border: "none",
          color: "#0B0F14", fontSize: 13, fontWeight: 800,
          borderRadius: 6, padding: "8px 16px", cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Instalar
      </button>
    </div>
  );
}
