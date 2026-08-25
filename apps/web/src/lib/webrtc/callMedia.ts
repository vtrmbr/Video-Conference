import type { Room } from 'livekit-client';

export function isScreenShareCancellation(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return (
    name === 'NotAllowedError' ||
    /permission denied by user|permission denied|request was cancelled|request was canceled|user cancelled|user canceled/i.test(
      message,
    )
  );
}

export async function restorePreviousDevice(
  room: Room,
  kind: MediaDeviceKind,
  previousDeviceId: string | undefined,
  cameraWasEnabled: boolean,
  microphoneWasEnabled: boolean,
) {
  if (!previousDeviceId) return false;
  try {
    const restored = await room.switchActiveDevice(kind, previousDeviceId, true);
    if (!restored) return false;
    if (kind === 'videoinput' && cameraWasEnabled && !room.localParticipant.isCameraEnabled) {
      await room.localParticipant.setCameraEnabled(true, { deviceId: previousDeviceId });
    }
    if (
      kind === 'audioinput' &&
      microphoneWasEnabled &&
      !room.localParticipant.isMicrophoneEnabled
    ) {
      await room.localParticipant.setMicrophoneEnabled(true, { deviceId: previousDeviceId });
    }
    return true;
  } catch {
    return false;
  }
}
