import { act, render } from '@testing-library/react';
import type { Room } from 'livekit-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallToast } from '../src/components/call/CallToast.js';
import { isScreenShareCancellation, restorePreviousDevice } from '../src/lib/webrtc/callMedia.js';

describe('call experience feedback', () => {
  afterEach(() => vi.useRealTimers());

  it('dismisses neutral notifications automatically', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <CallToast
        toast={{ id: 1, message: 'Permission denied by user', tone: 'neutral' }}
        onClose={onClose}
      />,
    );

    await act(async () => vi.advanceTimersByTimeAsync(4_999));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('recognizes browser screen-share cancellation without treating unrelated errors as cancel', () => {
    expect(
      isScreenShareCancellation(new DOMException('Permission denied', 'NotAllowedError')),
    ).toBe(true);
    expect(isScreenShareCancellation(new Error('Permission denied by user'))).toBe(true);
    expect(isScreenShareCancellation(new Error('Screen encoder crashed'))).toBe(false);
  });

  it('restores the previous camera and republishes it after a failed switch', async () => {
    const switchActiveDevice = vi.fn().mockResolvedValue(true);
    const setCameraEnabled = vi.fn().mockResolvedValue(undefined);
    const room = {
      switchActiveDevice,
      localParticipant: {
        isCameraEnabled: false,
        isMicrophoneEnabled: true,
        setCameraEnabled,
        setMicrophoneEnabled: vi.fn(),
      },
    } as unknown as Room;

    await expect(
      restorePreviousDevice(room, 'videoinput', 'working-camera', true, true),
    ).resolves.toBe(true);
    expect(switchActiveDevice).toHaveBeenCalledWith('videoinput', 'working-camera', true);
    expect(setCameraEnabled).toHaveBeenCalledWith(true, { deviceId: 'working-camera' });
  });

  it('reports restoration failure when there is no previous device', async () => {
    const room = { localParticipant: {} } as unknown as Room;
    await expect(restorePreviousDevice(room, 'videoinput', undefined, true, true)).resolves.toBe(
      false,
    );
  });
});
