import { useEffect } from "react";

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (disposed) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.onrelease = () => {
          if (sentinel === lock) sentinel = null;
        };
      } catch {
        return;
      }
    };

    void request();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && sentinel === null) {
        void request();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel) void sentinel.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
}
