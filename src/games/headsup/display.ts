type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

export const lockLandscape = async (): Promise<void> => {
  if (typeof screen === "undefined") return;
  const orientation = screen.orientation as LockableOrientation | undefined;
  if (!orientation?.lock) return;
  try {
    await orientation.lock("landscape");
  } catch {
    return;
  }
};

export const unlockLandscape = (): void => {
  if (typeof screen === "undefined") return;
  try {
    screen.orientation?.unlock();
  } catch {
    return;
  }
};

export const enterPlayDisplay = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!document.fullscreenElement && root.requestFullscreen) {
    try {
      await root.requestFullscreen();
    } catch {
      return;
    }
  }
  await lockLandscape();
};

export const exitPlayDisplay = (): void => {
  unlockLandscape();
  if (typeof document === "undefined" || !document.fullscreenElement) return;
  void document.exitFullscreen().catch(() => undefined);
};
