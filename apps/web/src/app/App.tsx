import { useCallback, useEffect, useState } from 'react';
import type { TokenResponse } from '@ufmg/shared';
import { ApiError, requestJoinToken } from '../lib/api/client.js';
import {
  loadLastCall,
  loadRoomOwnerCredential,
  markLastCallInactive,
  saveLastCall,
} from '../lib/storage.js';
import { CallPage } from '../pages/CallPage.js';
import { HomePage } from '../pages/HomePage.js';
import { LobbyPage, type JoinPreferences } from '../pages/LobbyPage.js';

interface CallSession {
  token: TokenResponse;
  preferences: JoinPreferences;
}

export function App() {
  const match = window.location.pathname.match(/^\/join\/([A-Za-z0-9_-]{4,64})\/?$/);
  const roomId = match?.[1];
  const [session, setSession] = useState<CallSession | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | undefined>();
  const [approvalPending, setApprovalPending] = useState<JoinPreferences>();

  const join = useCallback(
    async (preferences: JoinPreferences, background = false) => {
      if (!roomId) return;
      if (!background) setJoining(true);
      setJoinError(undefined);

      const previous = loadLastCall();
      const matchingPrevious = previous?.roomId === roomId ? previous : undefined;
      const identity =
        matchingPrevious?.participantIdentity ?? `guest_${crypto.randomUUID().replaceAll('-', '')}`;

      try {
        const ownerCredential = loadRoomOwnerCredential(roomId);
        const resumeCredential = matchingPrevious?.resumeCredential;

        const token = await requestJoinToken({
          roomName: roomId,
          participantName: preferences.name,
          participantIdentity: identity,
          ...(ownerCredential ? { ownerCredential } : {}),
          ...(resumeCredential ? { resumeCredential } : {}),
        });

        saveLastCall({
          roomId,
          participantIdentity: identity,
          resumeCredential: token.resumeCredential,
          preferences,
          active: true,
          updatedAt: Date.now(),
        });
        setApprovalPending(undefined);
        setSession({ token, preferences });

      } catch (error) {
        if (error instanceof ApiError && error.code === 'ADMISSION_PENDING') {
          saveLastCall({
            roomId,
            participantIdentity: identity,
            resumeCredential: matchingPrevious?.resumeCredential ?? '',
            preferences,
            active: true,
            updatedAt: Date.now(),
          });
          setApprovalPending(preferences);
          setJoinError(undefined);

        } else {
          if (error instanceof ApiError && error.code === 'ADMISSION_DENIED') {
            setApprovalPending(undefined);
            markLastCallInactive(roomId);

          }
          setJoinError(error instanceof Error ? error.message : 'Não foi possível entrar na sala.');
        }
      } finally {
        if (!background) setJoining(false);
      }
    },
    [roomId],
  );

  useEffect(() => {
    if (!roomId) return;
    const previous = loadLastCall();

    if (previous?.active && previous.roomId === roomId) {
      const timer = window.setTimeout(() => void join(previous.preferences), 0);
      return () => window.clearTimeout(timer);
    }

  }, [join, roomId]);

  useEffect(() => {
    if (!approvalPending) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      await join(approvalPending, true);
      if (!cancelled) timer = window.setTimeout(() => void poll(), 3_000);
    };

    timer = window.setTimeout(() => void poll(), 2_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    
  }, [approvalPending, join]);

  if (!roomId) return <HomePage />;
  if (session)
    return (
      <CallPage
        session={session.token}
        roomId={roomId}
        preferences={session.preferences}
        onLeave={() => {
          markLastCallInactive(roomId);
          setSession(null);
        }}
      />
    );
  const validRoomId = roomId;

  return (
    <LobbyPage
      roomId={validRoomId}
      joining={joining}
      approvalPending={Boolean(approvalPending)}
      joinError={joinError}
      onJoin={join}
    />
  );
}
