import { useCallback, useEffect, useRef, useState } from "react";
import { roomSocketUrl, type RoomState } from "./api";
import {
  clearSession,
  loadSessionForCode,
  saveName,
  saveSession,
  type Session,
} from "./storage";
import type { ConnectionStatus } from "./types";

const PING_INTERVAL_MS = 20_000;
const MAX_RETRIES = 6;

export function useRoomSocket(code: string) {
  const [session, setSession] = useState<Session | null>(() =>
    loadSessionForCode(code),
  );
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    loadSessionForCode(code) ? "connecting" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const codeRef = useRef(code);
  const tokenRef = useRef<string | null>(session?.token ?? null);
  const nameRef = useRef<string | null>(session?.name ?? null);
  const adultRef = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const intentionalRef = useRef(false);
  const mountedRef = useRef(true);
  const openSocketRef = useRef<() => void>(() => {});

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const clearTimers = useCallback(() => {
    if (pingRef.current !== null) {
      window.clearInterval(pingRef.current);
      pingRef.current = null;
    }
    if (retryRef.current !== null) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  const openSocket = useCallback(() => {
    if (!mountedRef.current) return;
    const roomCode = codeRef.current;
    const token = tokenRef.current;
    const name = nameRef.current;
    if (!token && !name) return;

    clearTimers();
    intentionalRef.current = false;
    const previous = socketRef.current;
    if (previous) {
      socketRef.current = null;
      try {
        previous.close(1000, "reconnecting");
      } catch {
        // already closed
      }
    }

    setStatus(attemptsRef.current > 0 ? "reconnecting" : "connecting");
    setError(null);

    const socket = new WebSocket(
      roomSocketUrl(roomCode, {
        token: token || undefined,
        name: name || undefined,
        adultConfirmed: adultRef.current,
      }),
    );
    socketRef.current = socket;

    socket.onopen = () => {
      if (socketRef.current !== socket) return;
      attemptsRef.current = 0;
      setStatus("open");
      if (pingRef.current !== null) window.clearInterval(pingRef.current);
      pingRef.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ event: "ping" }));
        }
      }, PING_INTERVAL_MS);
    };

    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return;
      let payload: unknown;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!payload || typeof payload !== "object") return;
      const record = payload as { event?: string; message?: string };
      if (record.event === "room_state") {
        const next = payload as RoomState;
        setState(next);
        setStatus("open");
        setError(null);
        if (next.self?.token) {
          const nextSession: Session = {
            code: roomCode,
            token: next.self.token,
            name: next.self.name,
          };
          tokenRef.current = nextSession.token;
          nameRef.current = nextSession.name;
          saveSession(nextSession);
          setSession(nextSession);
        }
      } else if (record.event === "error") {
        setError(record.message || "Could not join the room.");
      }
    };

    socket.onclose = (event) => {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      if (pingRef.current !== null) {
        window.clearInterval(pingRef.current);
        pingRef.current = null;
      }

      if (event.code === 4500) {
        intentionalRef.current = true;
        setStatus("closed");
        setError("This room was opened in another tab.");
        return;
      }
      if (intentionalRef.current) {
        setStatus("closed");
        return;
      }
      if (event.code === 4400) {
        setStatus("closed");
        setError((current) => current || "Could not join this room.");
        if (tokenRef.current) {
          tokenRef.current = null;
          clearSession();
          setSession(null);
        }
        return;
      }
      if (tokenRef.current && attemptsRef.current < MAX_RETRIES) {
        attemptsRef.current += 1;
        setStatus("reconnecting");
        const delay = Math.min(500 * attemptsRef.current, 4_000);
        retryRef.current = window.setTimeout(() => {
          retryRef.current = null;
          openSocketRef.current();
        }, delay);
        return;
      }
      setStatus("closed");
      if (!event.wasClean) setError("Connection lost. Tap retry.");
    };

    socket.onerror = () => {
      // The close event carries the actionable state.
    };
  }, [clearTimers]);

  useEffect(() => {
    openSocketRef.current = openSocket;
  }, [openSocket]);

  useEffect(() => {
    mountedRef.current = true;
    const stored = loadSessionForCode(code);
    attemptsRef.current = 0;
    if (stored) {
      tokenRef.current = stored.token;
      nameRef.current = stored.name;
      openSocketRef.current();
    }

    return () => {
      mountedRef.current = false;
      intentionalRef.current = true;
      clearTimers();
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) {
        try {
          socket.close(1000, "leaving");
        } catch {
          // already closed
        }
      }
    };
  }, [code, clearTimers]);

  const join = useCallback((name: string, adultConfirmed: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    clearTimers();
    saveName(trimmed);
    clearSession();
    setSession(null);
    setState(null);
    setError(null);
    tokenRef.current = null;
    nameRef.current = trimmed;
    adultRef.current = adultConfirmed;
    attemptsRef.current = 0;
    openSocketRef.current();
  }, [clearTimers]);

  const retry = useCallback(() => {
    attemptsRef.current = 0;
    openSocketRef.current();
  }, []);

  const forget = useCallback(() => {
    intentionalRef.current = true;
    clearTimers();
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      try {
        socket.close(1000, "forgetting seat");
      } catch {
        // already closed
      }
    }
    clearSession();
    tokenRef.current = null;
    setSession(null);
    setState(null);
    setError(null);
    setStatus("idle");
  }, [clearTimers]);

  const clearError = useCallback(() => setError(null), []);

  return {
    state,
    session,
    status,
    error,
    join,
    retry,
    forget,
    clearError,
  };
}
