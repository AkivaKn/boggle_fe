export type RunCommand = (
  label: string,
  action: () => Promise<unknown>,
) => Promise<boolean>;

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed";
