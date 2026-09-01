import { act, renderHook } from '@testing-library/react';
import { ConnectionState, RoomEvent, type Room } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';
import { useCallConnection } from '../src/hooks/useCallConnection.js';

class FakeRoom {
  state = ConnectionState.Connecting;
  private readonly listeners = new Map<string, Set<() => void>>();

  on(event: string, listener: () => void) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  off(event: string, listener: () => void) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string) {
    this.listeners.get(event)?.forEach((listener) => listener());
  }
}

describe('useCallConnection', () => {
  it('keeps reconnecting and restored states driven by native LiveKit events', () => {
    vi.useFakeTimers();
    const fake = new FakeRoom();
    const room = fake as unknown as Room;
    const { result, unmount } = renderHook(() => useCallConnection(room));

    act(() => fake.emit(RoomEvent.Reconnecting));
    expect(result.current.status).toBe('reconnecting');

    act(() => fake.emit(RoomEvent.Reconnected));
    expect(result.current.status).toBe('reconnected');

    act(() => {
      void vi.advanceTimersByTime(3_000);
    });
    expect(result.current.status).toBe('connected');
    unmount();
    vi.useRealTimers();
  });

  it('does not treat the initial disconnected state as an ended call', () => {
    const fake = new FakeRoom();
    fake.state = ConnectionState.Disconnected;

    const room = fake as unknown as Room;
    const { result } = renderHook(() => useCallConnection(room));

    expect(result.current.status).toBe('connecting');

    act(() => {
      fake.state = ConnectionState.Connected;
      fake.emit(RoomEvent.ConnectionStateChanged);
    });

    expect(result.current.status).toBe('connected');

    act(() => {
      fake.state = ConnectionState.Disconnected;
      fake.emit(RoomEvent.Disconnected);
    });

    expect(result.current.status).toBe('disconnected');
  });
});
