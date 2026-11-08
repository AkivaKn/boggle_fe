import { useCallback, useEffect, useRef, useState } from "react";
import type { TiltGesture, TiltPermission } from "./types";

const CALIBRATION_MS = 700;
const CALIBRATION_TIMEOUT_MS = 1300;
const GESTURE_DEG = 32;
const NEUTRAL_DEG = 14;
const COOLDOWN_MS = 650;

export type TiltController = {
  permission: TiltPermission;
  calibrating: boolean;
  ready: boolean;
  requestPermission: () => Promise<TiltPermission>;
};

const normalize = (degrees: number): number =>
  (((degrees % 360) + 540) % 360) - 180;

const initialPermission = (): TiltPermission =>
  typeof window !== "undefined" && "DeviceOrientationEvent" in window
    ? "unknown"
    : "unsupported";

export function useTilt(options: {
  enabled: boolean;
  onGesture: (gesture: TiltGesture) => void;
}): TiltController {
  const [permission, setPermission] =
    useState<TiltPermission>(initialPermission);
  const [calibrating, setCalibrating] = useState(false);
  const [ready, setReady] = useState(false);
  const onGestureRef = useRef(options.onGesture);

  useEffect(() => {
    onGestureRef.current = options.onGesture;
  }, [options.onGesture]);

  const requestPermission = useCallback(async (): Promise<TiltPermission> => {
    if (
      typeof window === "undefined" ||
      !("DeviceOrientationEvent" in window)
    ) {
      setPermission("unsupported");
      setCalibrating(false);
      setReady(false);
      return "unsupported";
    }
    const constructor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof constructor.requestPermission !== "function") {
      setPermission("granted");
      setCalibrating(true);
      setReady(false);
      return "granted";
    }
    try {
      const result = await constructor.requestPermission();
      const next: TiltPermission = result === "granted" ? "granted" : "denied";
      setPermission(next);
      setCalibrating(next === "granted");
      setReady(false);
      return next;
    } catch {
      setPermission("denied");
      setCalibrating(false);
      setReady(false);
      return "denied";
    }
  }, []);

  useEffect(() => {
    if (!options.enabled || permission !== "granted") return;

    let baseline: number | null = null;
    const samples: number[] = [];
    let startedAt = performance.now();
    let armed = false;
    let lastFireAt = 0;
    let disposed = false;

    const finishCalibration = (fallback: number | null) => {
      if (baseline !== null) return;
      if (samples.length > 0) {
        baseline = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      } else if (fallback !== null) {
        baseline = fallback;
      } else {
        return;
      }
      setCalibrating(false);
      setReady(true);
    };

    const handle = (event: DeviceOrientationEvent) => {
      if (disposed) return;
      const beta = event.beta;
      if (beta === null || Number.isNaN(beta)) return;

      const now = performance.now();
      if (now - startedAt < CALIBRATION_MS) {
        samples.push(beta);
        return;
      }
      if (baseline === null) {
        finishCalibration(beta);
      }
      const delta = normalize(beta - (baseline ?? beta));

      if (!armed) {
        if (Math.abs(delta) <= NEUTRAL_DEG) armed = true;
        return;
      }
      if (now - lastFireAt < COOLDOWN_MS) return;

      if (delta >= GESTURE_DEG) {
        lastFireAt = now;
        armed = false;
        onGestureRef.current("correct");
      } else if (delta <= -GESTURE_DEG) {
        lastFireAt = now;
        armed = false;
        onGestureRef.current("pass");
      }
    };

    window.addEventListener("deviceorientation", handle);

    const resetCalibration = () => {
      baseline = null;
      samples.length = 0;
      startedAt = performance.now() - CALIBRATION_MS;
      armed = false;
    };
    const onVisibility = () => {
      if (!document.hidden) resetCalibration();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("orientationchange", resetCalibration);

    const timeout = window.setTimeout(() => {
      if (baseline === null) {
        setCalibrating(false);
        setReady(false);
      }
    }, CALIBRATION_TIMEOUT_MS);

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      window.removeEventListener("deviceorientation", handle);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("orientationchange", resetCalibration);
    };
  }, [options.enabled, permission]);

  const active = options.enabled && permission === "granted";
  return {
    permission,
    calibrating: active && calibrating,
    ready: active && ready,
    requestPermission,
  };
}
