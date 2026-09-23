"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installation remains available even if registration is temporarily blocked.
    });
  }, []);

  return null;
}

export function NetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return <span className={online ? "online" : "online offline"}><i />{online ? "Online" : "Offline"}</span>;
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setInstalled(window.matchMedia("(display-mode: standalone)").matches);
      setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    });

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setShowIosHelp(false);
    };

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (installed) {
    return <div className="install-card installed"><span aria-hidden="true">✓</span><div><strong>Installed</strong><small>Opens like an app</small></div></div>;
  }

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setPrompt(null);
      return;
    }
    setShowIosHelp(true);
  };

  return <div className="install-card">
    <span className="install-icon" aria-hidden="true">↓</span>
    <div><strong>Install on this device</strong><small>Fast access from your home screen</small></div>
    <button type="button" onClick={install}>{isIos ? "How" : "Install"}</button>
    {showIosHelp && <p className="install-help">{isIos ? <>Open this page in Safari, tap Share, then choose <strong>Add to Home Screen</strong>.</> : <>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to home screen</strong>.</>}</p>}
  </div>;
}
