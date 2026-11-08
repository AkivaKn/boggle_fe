import { useCallback, useEffect, useRef, useState } from "react";
import type { TiltGesture, TiltPermission } from "./types";

const CALIBRATION_MS = 700;
const CALIBRATION_TIMEOUT_MS = 1300;
const GESTURE_DEG = 32;
const NEUTRAL_DEG = 14;
const COOLDOWN_MS = 650;

type Quaternion = {
  w: number;
  x: number;
  y: number;
  z: number;
};

export type TiltController = {
  permission: TiltPermission;
  calibrating: boolean;
  ready: boolean;
  requestPermission: () => Promise<TiltPermission>;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const axisQuaternion = (
  x: number,
  y: number,
  z: number,
  degrees: number,
): Quaternion => {
  const half = toRadians(degrees) / 2;
  const sine = Math.sin(half);
  return {
    w: Math.cos(half),
    x: x * sine,
    y: y * sine,
    z: z * sine,
  };
};

const multiply = (a: Quaternion, b: Quaternion): Quaternion => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});

const conjugate = (q: Quaternion): Quaternion => ({
  w: q.w,
  x: -q.x,
  y: -q.y,
  z: -q.z,
});

const normalize = (q: Quaternion): Quaternion => {
  const length = Math.hypot(q.w, q.x, q.y, q.z);
  if (length === 0) return { w: 1, x: 0, y: 0, z: 0 };
  return {
    w: q.w / length,
    x: q.x / length,
    y: q.y / length,
    z: q.z / length,
  };
};

const dot = (a: Quaternion, b: Quaternion): number =>
  a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;

const average = (samples: Quaternion[]): Quaternion => {
  const first = samples[0];
  const total = { w: 0, x: 0, y: 0, z: 0 };
  for (const sample of samples) {
    const aligned = dot(first, sample) < 0
      ? { w: -sample.w, x: -sample.x, y: -sample.y, z: -sample.z }
      : sample;
    total.w += aligned.w;
    total.x += aligned.x;
    total.y += aligned.y;
    total.z += aligned.z;
  }
  return normalize(total);
};

const orientationQuaternion = (
  alpha: number,
  beta: number,
  gamma: number,
): Quaternion =>
  multiply(
    multiply(
      axisQuaternion(0, 0, 1, alpha),
      axisQuaternion(1, 0, 0, beta),
    ),
    axisQuaternion(0, 1, 0, gamma),
  );

const tiltAroundScreenAxis = (
  current: Quaternion,
  baseline: Quaternion,
): number => {
  const relative = normalize(multiply(conjugate(baseline), current));
  const degrees = (2 * Math.atan2(relative.y, relative.w) * 180) / Math.PI;
  return ((degrees + 540) % 360) - 180;
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

    let baseline: Quaternion | null = null;
    const samples: Quaternion[] = [];
    let startedAt = performance.now();
    let armed = false;
    let lastFireAt = 0;
    let disposed = false;

    const finishCalibration = (fallback: Quaternion | null) => {
      if (baseline !== null) return;
      if (samples.length > 0) {
        baseline = average(samples);
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
      const gamma = event.gamma;
      if (
        beta === null ||
        gamma === null ||
        Number.isNaN(beta) ||
        Number.isNaN(gamma)
      ) {
        return;
      }

      const current = orientationQuaternion(event.alpha ?? 0, beta, gamma);
      const now = performance.now();
      if (now - startedAt < CALIBRATION_MS) {
        samples.push(current);
        return;
      }
      if (baseline === null) {
        finishCalibration(current);
      }
      const delta = tiltAroundScreenAxis(current, baseline ?? current);

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
  };
}
