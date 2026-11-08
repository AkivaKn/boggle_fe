let context: AudioContext | null = null;
let resumePromise: Promise<AudioContext | null> | null = null;

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const createContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const audioWindow = window as AudioWindow;
  const Constructor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : audioWindow.webkitAudioContext;
  if (!Constructor) return null;
  try {
    context = new Constructor();
    return context;
  } catch {
    return null;
  }
};

const ensureRunning = (): Promise<AudioContext | null> => {
  const audio = context ?? createContext();
  if (!audio) return Promise.resolve(null);
  if (audio.state === "running") return Promise.resolve(audio);
  if (audio.state === "closed") return Promise.resolve(null);
  if (!resumePromise) {
    resumePromise = audio
      .resume()
      .then(() => (audio.state === "running" ? audio : null))
      .catch(() => null)
      .finally(() => {
        resumePromise = null;
      });
  }
  return resumePromise;
};

export const unlockAudio = (): void => {
  void ensureRunning();
};

const tone = (
  frequency: number,
  durationMs: number,
  volume = 0.88,
  delayMs = 0,
  type: OscillatorType = "triangle",
  endFrequency?: number,
): void => {
  void ensureRunning()
    .then((audio) => {
      if (!audio) return;
      try {
        const startAt = audio.currentTime + 0.015 + delayMs / 1000;
        const duration = durationMs / 1000;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startAt);
        if (endFrequency) {
          oscillator.frequency.exponentialRampToValueAtTime(
            endFrequency,
            startAt + duration,
          );
        }
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.03);
      } catch {
        return;
      }
    })
    .catch(() => undefined);
};

export const playCorrect = (): void => {
  tone(880, 80, 0.9);
  tone(1320, 140, 0.92, 90);
};

export const playPass = (): void => {
  tone(220, 220, 0.92, 0, "square", 140);
};

export const playCountdown = (step: number): void => {
  if (step <= 0) {
    tone(880, 90, 0.85);
    tone(1320, 180, 0.9, 100);
    return;
  }
  tone(step === 1 ? 660 : 440, step === 1 ? 140 : 90, 0.72);
};

export const playTick = (): void => tone(520, 65, 0.42);

export const playEnd = (): void => {
  tone(440, 200, 0.75);
  tone(330, 340, 0.75, 180);
};
