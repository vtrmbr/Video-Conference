import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import type { TokenRequest, TokenResponse } from '@ufmg/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveLastCall } from '../src/lib/storage.js';

interface TestPreferences {
  name: string;
  cameraId: string;
  microphoneId: string;
  speakerId: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
}

const requestJoinToken = vi.hoisted(() =>
  vi.fn<(request: TokenRequest) => Promise<TokenResponse>>(),
);
const ApiError = vi.hoisted(
  () =>
    class extends Error {
      constructor(
        message: string,
        readonly status: number,
        readonly code: string,
      ) {
        super(message);
      }
    },
);

vi.mock('../src/lib/api/client.js', () => ({ ApiError, requestJoinToken }));
vi.mock('../src/pages/HomePage.js', () => ({ HomePage: () => <div>home</div> }));
vi.mock('../src/pages/LobbyPage.js', () => ({
  LobbyPage: ({
    approvalPending,
    onJoin,
  }: {
    approvalPending: boolean;
    onJoin(preferences: TestPreferences): Promise<void>;
  }) => (
    <div>
      lobby:{approvalPending ? 'pending' : 'ready'}
      <button type="button" onClick={() => void onJoin(preferences)}>
        request join
      </button>
    </div>
  ),
}));
vi.mock('../src/pages/CallPage.js', () => ({
  CallPage: ({ roomId }: { roomId: string }) => <div>call:{roomId}</div>,
}));

import { App } from '../src/app/App.js';

const preferences: TestPreferences = {
  name: 'Ana',
  cameraId: 'camera-1',
  microphoneId: 'microphone-1',
  speakerId: 'speaker-1',
  cameraEnabled: false,
  microphoneEnabled: true,
};

describe('call recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    requestJoinToken.mockReset();
    window.history.replaceState({}, '', '/join/ROOM1234');
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
  });

  it('reissues a token with the persisted identity and credential after a reload', async () => {
    saveLastCall({
      roomId: 'ROOM1234',
      participantIdentity: 'guest_12345678',
      resumeCredential: 'old-resume-credential',
      preferences,
      active: true,
      updatedAt: Date.now(),
    });
    requestJoinToken.mockResolvedValue({
      serverUrl: 'wss://test.livekit.cloud',
      participantToken: 'new-token',
      expiresIn: 600,
      resumeCredential: 'new-resume-credential',
      role: 'participant',
    });

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText('call:ROOM1234')).toBeInTheDocument());
    expect(requestJoinToken).toHaveBeenCalledWith({
      roomName: 'ROOM1234',
      participantName: 'Ana',
      participantIdentity: 'guest_12345678',
      resumeCredential: 'old-resume-credential',
    });
  });

  it('does not autojoin after an explicit leave marked the call inactive', async () => {
    saveLastCall({
      roomId: 'ROOM1234',
      participantIdentity: 'guest_12345678',
      resumeCredential: 'resume-credential',
      preferences,
      active: false,
      updatedAt: Date.now(),
    });

    render(<App />);
    expect(screen.getByText(/lobby:ready/)).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    expect(requestJoinToken).not.toHaveBeenCalled();
  });

  it('keeps the same identity while an admission request is pending', async () => {
    requestJoinToken.mockRejectedValue(
      new ApiError('Aguardando aprovação.', 403, 'ADMISSION_PENDING'),
    );
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'request join' }));
    await waitFor(() => expect(screen.getByText(/lobby:pending/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'request join' }));
    await waitFor(() => expect(requestJoinToken).toHaveBeenCalledTimes(2));

    const firstIdentity = requestJoinToken.mock.calls[0]?.[0].participantIdentity;
    const secondIdentity = requestJoinToken.mock.calls[1]?.[0].participantIdentity;
    expect(firstIdentity).toMatch(/^guest_[a-f0-9]{32}$/);
    expect(secondIdentity).toBe(firstIdentity);
  });
});
