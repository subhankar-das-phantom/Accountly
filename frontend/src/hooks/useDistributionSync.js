import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useDistributionSync
 * Manages the real-time Server-Sent Events (SSE) connection for Counter Mode.
 * Handles auto-reconnect, visibility changes (background tab/phone wake-up),
 * online/offline recovery, and targeted callbacks.
 */
export const useDistributionSync = ({
  campaignId,
  orgId,
  token,
  onEvent,
  onReconnect
}) => {
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED'); // 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const wasDisconnectedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);

  // Keep callback refs fresh
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  const connect = useCallback(() => {
    if (!campaignId || !token) {
      setConnectionStatus('DISCONNECTED');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
    const orgParam = orgId ? `&orgId=${encodeURIComponent(orgId)}` : '';
    const sseUrl = `${baseUrl}/distributions/campaigns/${campaignId}/events?token=${encodeURIComponent(token)}${orgParam}`;

    try {
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnectionStatus('CONNECTED');
        if (wasDisconnectedRef.current) {
          wasDisconnectedRef.current = false;
          if (onReconnectRef.current) {
            onReconnectRef.current();
          }
        }
      };

      es.onmessage = (e) => {
        try {
          if (!e.data || e.data.trim() === '') return;
          const data = JSON.parse(e.data);
          if (data.type === 'DISTRIBUTION_UPDATED') {
            if (onEventRef.current) {
              onEventRef.current(data);
            }
          }
        } catch (err) {
          console.error('[useDistributionSync] Error parsing event message:', err);
        }
      };

      es.onerror = () => {
        wasDisconnectedRef.current = true;
        setConnectionStatus('RECONNECTING');
        es.close();

        // Retry connection after a short backoff
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (err) {
      console.error('[useDistributionSync] Failed to initialize EventSource:', err);
      setConnectionStatus('DISCONNECTED');
    }
  }, [campaignId, orgId, token]);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  // Handle visibility change (e.g. mobile lock/unlock or switching tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          connect();
        }
        // Authoritative reconciliation when tab becomes active
        if (onReconnectRef.current) {
          onReconnectRef.current();
        }
      }
    };

    const handleOnline = () => {
      connect();
      if (onReconnectRef.current) {
        onReconnectRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [connect]);

  // Periodic fallback revalidation every 45s while Counter Mode is open
  useEffect(() => {
    if (!campaignId) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && onReconnectRef.current) {
        onReconnectRef.current();
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [campaignId]);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'CONNECTED'
  };
};

export default useDistributionSync;
