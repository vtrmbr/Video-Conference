import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionNotice } from '../src/components/call/ConnectionNotice.js';
import { PreflightChecklist } from '../src/components/lobby/PreflightChecklist.js';

describe('critical connection UI', () => {
  it('keeps a visible reconnection state', () => {
    render(<ConnectionNotice status="reconnecting" />);
    expect(screen.getByText('Reconectando…')).toBeVisible();
    expect(screen.getByText('Tentando restaurar a chamada.')).toBeVisible();
  });

  it('explains which preflight metrics are unavailable before WebRTC', () => {
    render(
      <PreflightChecklist
        cameraOk
        microphoneOk
        speakerOk={false}
        speakerSupported={false}
        browserOk
        secure
        backendReachable
        livekitConfigured
        networkRunning={false}
        networkQuality="good"
        httpRttMs={80}
      />,
    );
    expect(screen.getByText(/Jitter, perda de pacotes, upload/)).toBeVisible();
    expect(screen.getByText('RTT HTTP ~80 ms')).toBeVisible();
  });

  it('does not report the network as unstable when the backend is unavailable', () => {
    render(
      <PreflightChecklist
        cameraOk
        microphoneOk
        speakerOk={false}
        speakerSupported
        browserOk
        secure
        backendReachable={false}
        livekitConfigured={false}
        networkRunning={false}
        networkQuality="unknown"
        httpRttMs={undefined}
      />,
    );
    expect(screen.getByText('Aguardando servidor')).toBeVisible();
    expect(screen.getByText('Teste indisponível')).toBeVisible();
  });
});
