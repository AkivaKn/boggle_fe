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
  volume = 0.16,
  delayMs = 0,
): void => {
  void ensureRunning()
    .then((audio) => {
      if (!audio) return;
      try {
        const startAt = audio.currentTime + 0.015 + delayMs / 1000;
        const duration = durationMs / 1000;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.008);
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

export const playCorrect = (): void => tone(720, 110);
export const playPass = (): void => tone(300, 110, 0.14);
export const playCountdown = (final: boolean): void =>
  tone(final ? 880 : 440, final ? 220 : 100, 0.15);
export const playTick = (): void => tone(520, 65, 0.07);
export const playEnd = (): void => {
  tone(440, 200, 0.18);
  tone(330, 340, 0.18, 180);
};
