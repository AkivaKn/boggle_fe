import { useCallback, useEffect, useRef, useState } from "react";
import type { TiltGesture, TiltPermission } from "./types";

const CALIBRATION_MS = 700;
const CALIBRATION_TIMEOUT_MS = 1300;
const GESTURE_DEG = 32;
const NEUTRAL_DEG = 14;
const COOLDOWN_MS = 650;

export type TiltDebugInfo = {
  angle: number;
  axis: "beta" | "gamma";
  sign: 1 | -1;
  raw: number | null;
  delta: number | null;
  hasReading: boolean;
};

export type TiltController = {
  permission: TiltPermission;
  calibrating: boolean;
  ready: boolean;
  requestPermission: () => Promise<TiltPermission>;
  debug: TiltDebugInfo | null;
};

const normalize = (degrees: number): number =>
  (((degrees % 360) + 540) % 360) - 180;

const screenAngle = (): number => {
  if (typeof screen !== "undefined" && typeof screen.orientation?.angle === "number") {
    return screen.orientation.angle;
  }
  const legacy = (window as Window & { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
};

const axisForAngle = (
  angle: number,
): { axis: "beta" | "gamma"; sign: 1 | -1 } => {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized === 90) return { axis: "gamma", sign: -1 };
  if (normalized === 270) return { axis: "gamma", sign: 1 };
  if (normalized === 180) return { axis: "beta", sign: -1 };
  return { axis: "beta", sign: 1 };
};

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
  const [debug, setDebug] = useState<TiltDebugInfo | null>(null);
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
      const angle = screenAngle();
      const mapping = axisForAngle(angle);
      const rawValue = mapping.axis === "beta" ? event.beta : event.gamma;
      const raw = rawValue !== null && !Number.isNaN(rawValue) ? rawValue : null;

      if (raw === null) {
        setDebug({
          angle,
          axis: mapping.axis,
          sign: mapping.sign,
          raw: null,
          delta: null,
          hasReading: false,
        });
        return;
      }

      const now = performance.now();
      if (now - startedAt < CALIBRATION_MS) {
        samples.push(raw);
        setDebug({
          angle,
          axis: mapping.axis,
          sign: mapping.sign,
          raw,
          delta: null,
          hasReading: true,
        });
        return;
      }
      if (baseline === null) {
        finishCalibration(raw);
      }
      const delta = normalize((raw - (baseline ?? raw)) * mapping.sign);

      setDebug({
        angle,
        axis: mapping.axis,
        sign: mapping.sign,
        raw,
        delta,
        hasReading: true,
      });

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
      setCalibrating(true);
      setReady(false);
    };
    const onVisibility = () => {
      if (!document.hidden) resetCalibration();
    };
    document.addEventListener("visibilitychange", onVisibility);

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
    };
  }, [options.enabled, permission]);

  const active = options.enabled && permission === "granted";
  return {
    permission,
    calibrating: active && calibrating,
    ready: active && ready,
    requestPermission,
    debug: active ? debug : null,
  };
}
