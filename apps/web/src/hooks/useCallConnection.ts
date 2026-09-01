import { useEffect, useRef, useState } from 'react';
import { ConnectionState, RoomEvent, type Room } from 'livekit-client';

export type CallConnectionStatus =
  'connecting' | 'connected' | 'reconnecting' | 'reconnected' | 'disconnected' | 'failed';

export function useCallConnection(room: Room) {
  const [status, setStatus] = useState<CallConnectionStatus>('connecting');
  const restoredTimer = useRef<number | undefined>(undefined);
  const hasConnected = useRef(false);

  useEffect(() => {
    const sync = () => {
      if (room.state === ConnectionState.Connected) {
        hasConnected.current = true;
        setStatus('connected');
      } else if (room.state === ConnectionState.Reconnecting) setStatus('reconnecting');
      else if (room.state === ConnectionState.Disconnected)
        setStatus(hasConnected.current ? 'disconnected' : 'connecting');
      else setStatus('connecting');
    };

    const onReconnecting = () => setStatus('reconnecting');

    const onReconnected = () => {
      hasConnected.current = true;
      setStatus('reconnected');

      window.clearTimeout(restoredTimer.current);
      restoredTimer.current = window.setTimeout(() => setStatus('connected'), 3_000);
    };

    const onDisconnected = () => setStatus(hasConnected ? 'disconnected' : 'connecting');

    room.on(RoomEvent.ConnectionStateChanged, sync);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    sync();
    return () => {
      window.clearTimeout(restoredTimer.current);
      room.off(RoomEvent.ConnectionStateChanged, sync);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);

  return { status, markFailed: () => setStatus('failed') };
}
