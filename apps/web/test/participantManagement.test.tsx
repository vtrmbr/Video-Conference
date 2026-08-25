import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParticipantManagement } from '../src/components/call/ParticipantManagement.js';

describe('ParticipantManagement', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('exposes moderation and admin delegation with confirmation for destructive actions', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const onAdmission = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <ParticipantManagement
        participants={[{ identity: 'guest_remote1', name: 'Bruno', isAdmin: false }]}
        pendingAdmissions={[
          {
            participantIdentity: 'guest_waiting1',
            participantName: 'Carla',
            requestedAt: 123,
          },
        ]}
        onClose={vi.fn()}
        onAction={onAction}
        onAdmission={onAdmission}
      />,
    );

    expect(screen.getByRole('button', { name: 'Silenciar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Desligar câmera' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Tornar admin' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Banir' }));

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        { identity: 'guest_remote1', name: 'Bruno', isAdmin: false },
        'ban',
      ),
    );
    expect(window.confirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar Carla' }));
    await waitFor(() =>
      expect(onAdmission).toHaveBeenCalledWith(
        {
          participantIdentity: 'guest_waiting1',
          participantName: 'Carla',
          requestedAt: 123,
        },
        'approve',
      ),
    );
  });
});
