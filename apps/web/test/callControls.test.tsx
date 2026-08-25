import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const media = vi.hoisted(() => ({
  setCameraEnabled: vi.fn(),
  setMicrophoneEnabled: vi.fn(),
  setScreenShareEnabled: vi.fn(),
  screenShareEnabled: false,
}));

vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({
    localParticipant: media,
    isMicrophoneEnabled: false,
    isCameraEnabled: false,
    isScreenShareEnabled: media.screenShareEnabled,
  }),
}));

import { CallControls } from '../src/components/call/CallControls.js';

describe('CallControls', () => {
  it('immediately shows a pending state while the camera is starting', async () => {
    let finish!: () => void;
    media.setCameraEnabled.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
    render(
      <CallControls
        screenShareSupported
        onSettings={vi.fn()}
        onDiagnostics={vi.fn()}
        onLeave={vi.fn()}
        onError={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ligar câmera' }));
    const pending = screen.getByRole('button', { name: 'Ligando câmera…' });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute('aria-busy', 'true');

    await act(async () => {
      finish();
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Ligar câmera' })).not.toHaveAttribute('aria-busy');
  });

  it('uses an explicit stop-sharing action while screen share is active', () => {
    media.screenShareEnabled = true;
    media.setScreenShareEnabled.mockResolvedValueOnce(undefined);
    render(
      <CallControls
        screenShareSupported
        onSettings={vi.fn()}
        onDiagnostics={vi.fn()}
        onLeave={vi.fn()}
        onError={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Parar de compartilhar sua tela' }));
    expect(media.setScreenShareEnabled).toHaveBeenCalledWith(false);
    media.screenShareEnabled = false;
  });
});
