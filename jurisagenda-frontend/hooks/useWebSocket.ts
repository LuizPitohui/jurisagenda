'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { getAccess } from '@/lib/api';
import type { WSMessage } from '@/types';

interface Options {
  onMessage?:    (m: WSMessage) => void;
  onConnect?:    () => void;
  onDisconnect?: () => void;
  requireAuth?:  boolean;
  reconnectMs?:  number;
  maxRetries?:   number;
}

export function useWebSocket(path: string, opts: Options = {}) {
  const {
    requireAuth  = false,
    reconnectMs  = 3000,
    maxRetries   = 5,
  } = opts;

  const wsRef      = useRef<WebSocket | null>(null);
  const retries    = useRef(0);
  const timer      = useRef<ReturnType<typeof setTimeout>>();
  const optsRef    = useRef(opts);
  const [connected, setConnected] = useState(false);

  // Mantém opts atualizado sem recriar connect
  useEffect(() => {
    optsRef.current = opts;
  });

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Fecha conexão anterior se existir
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const WS_BASE = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
    let url = `${WS_BASE}${path}`;

    if (requireAuth) {
      const token = getAccess();
      if (!token) return;
      url += `?token=${token}`;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retries.current = 0;
      setConnected(true);
      optsRef.current.onConnect?.();
    };

    ws.onmessage = (e) => {
      try {
        optsRef.current.onMessage?.(JSON.parse(e.data) as WSMessage);
      } catch {
        // ignora mensagens malformadas
      }
    };

    ws.onclose = () => {
      setConnected(false);
      optsRef.current.onDisconnect?.();
      wsRef.current = null;

      if (retries.current < maxRetries) {
        retries.current++;
        const delay = reconnectMs * Math.min(retries.current, 4);
        timer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => ws.close();

  }, [path, requireAuth, reconnectMs, maxRetries]); // opts fora das deps

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(timer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // evita reconexão no unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return {
    connected,
    send,
    ping: () => send({ type: 'ping' }),
  };
}