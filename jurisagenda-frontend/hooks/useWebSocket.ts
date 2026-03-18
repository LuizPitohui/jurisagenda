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
    onMessage,
    onConnect,
    onDisconnect,
    requireAuth  = false,
    reconnectMs  = 3000,
    maxRetries   = 10,
  } = opts;

  const wsRef   = useRef<WebSocket | null>(null);
  const retries = useRef(0);
  const timer   = useRef<ReturnType<typeof setTimeout>>();

  const [connected, setConnected] = useState(false);

  const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 
    (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}` : '');

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

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
      onConnect?.();
    };

    ws.onmessage = (e) => {
      try {
        onMessage?.(JSON.parse(e.data) as WSMessage);
      } catch {
        // ignora mensagens malformadas
      }
    };

    ws.onclose = () => {
      setConnected(false);
      onDisconnect?.();
      wsRef.current = null;

      if (retries.current < maxRetries) {
        retries.current++;
        // backoff exponencial: 3s, 6s, 9s, 12s (máximo)
        const delay = reconnectMs * Math.min(retries.current, 4);
        timer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => ws.close();
  }, [path, requireAuth, onMessage, onConnect, onDisconnect, reconnectMs, maxRetries, WS_BASE]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(timer.current);
      wsRef.current?.close();
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