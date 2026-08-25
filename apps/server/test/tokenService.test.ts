import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { LiveKitTokenIssuer } from '../src/services/tokenService.js';
import { SessionCredentialService } from '../src/services/sessionCredentials.js';

const config = loadConfig({
  NODE_ENV: 'test',
  LIVEKIT_URL: 'wss://test.livekit.cloud',
  LIVEKIT_API_KEY: 'test-key',
  LIVEKIT_API_SECRET: 'test-secret-value-at-least-32-bytes',
  WEB_ORIGIN: 'http://localhost:5173',
  TOKEN_TTL_SECONDS: '300',
});

describe('LiveKitTokenIssuer', () => {
  it('generates a least-privilege, expiring room token', async () => {
    const issuer = new LiveKitTokenIssuer(config, { listParticipants: () => Promise.resolve([]) });
    const result = await issuer.issue({
      roomName: 'ABCD1234',
      participantName: 'Guest',
      participantIdentity: 'guest_12345678',
    });
    const claims = decodeJwt(result.participantToken);
    const video = claims.video as Record<string, unknown>;
    expect(claims.sub).toBe('guest_12345678');
    expect(video).toMatchObject({
      room: 'ABCD1234',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    expect(video.roomAdmin).not.toBe(true);
    expect((claims.exp ?? 0) - (claims.nbf ?? 0)).toBe(300);
  });

  it('rejects active duplicate identities', async () => {
    const issuer = new LiveKitTokenIssuer(config, {
      listParticipants: () => Promise.resolve([{ identity: 'guest_12345678' }]),
    });
    await expect(
      issuer.issue({
        roomName: 'ABCD1234',
        participantName: 'Guest',
        participantIdentity: 'guest_12345678',
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_IDENTITY', statusCode: 409 });
  });

  it('does not count a connected participant twice while enforcing capacity', async () => {
    const limitedConfig = loadConfig({
      NODE_ENV: 'test',
      LIVEKIT_URL: 'wss://test.livekit.cloud',
      LIVEKIT_API_KEY: 'test-key',
      LIVEKIT_API_SECRET: 'test-secret-value-at-least-32-bytes',
      WEB_ORIGIN: 'http://localhost:5173',
      MAX_PARTICIPANTS: '2',
    });
    let participants: { identity: string }[] = [];
    const issuer = new LiveKitTokenIssuer(limitedConfig, {
      listParticipants: () => Promise.resolve(participants),
    });
    await issuer.issue({
      roomName: 'ABCD1234',
      participantName: 'First',
      participantIdentity: 'guest_first_1234',
    });
    participants = [{ identity: 'guest_first_1234' }];

    await expect(
      issuer.issue({
        roomName: 'ABCD1234',
        participantName: 'Second',
        participantIdentity: 'guest_second_123',
      }),
    ).resolves.toMatchObject({ expiresIn: 600 });
  });

  it('allows a duplicate identity only with its signed resume credential', async () => {
    const resumeConfig = loadConfig({
      NODE_ENV: 'test',
      LIVEKIT_URL: 'wss://test.livekit.cloud',
      LIVEKIT_API_KEY: 'test-key',
      LIVEKIT_API_SECRET: 'test-secret-value-at-least-32-bytes',
      WEB_ORIGIN: 'http://localhost:5173',
      MAX_PARTICIPANTS: '2',
    });
    const credentials = new SessionCredentialService(resumeConfig.livekitApiSecret);
    let participants: { identity: string }[] = [];
    const issuer = new LiveKitTokenIssuer(
      resumeConfig,
      { listParticipants: () => Promise.resolve(participants) },
      credentials,
    );
    const first = await issuer.issue({
      roomName: 'ABCD1234',
      participantName: 'Guest',
      participantIdentity: 'guest_resume123',
    });
    participants = [{ identity: 'guest_resume123' }, { identity: 'guest_other123' }];

    await expect(
      issuer.issue({
        roomName: 'ABCD1234',
        participantName: 'Guest',
        participantIdentity: 'guest_resume123',
        resumeCredential: first.resumeCredential,
      }),
    ).resolves.toMatchObject({ role: 'participant' });
    await expect(
      issuer.issue({
        roomName: 'ABCD1234',
        participantName: 'Guest',
        participantIdentity: 'guest_resume123',
        resumeCredential: `${first.resumeCredential}tampered`,
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_IDENTITY' });
  });

  it('marks a verified room owner as admin without exposing roomAdmin grants', async () => {
    const credentials = new SessionCredentialService(config.livekitApiSecret);
    const created = credentials.createRoom();
    const issuer = new LiveKitTokenIssuer(
      config,
      {
        listParticipants: () => Promise.resolve([]),
        resolveRole: (_room, _identity, ownerCredential) =>
          Promise.resolve(ownerCredential === created.ownerCredential ? 'admin' : 'participant'),
      },
      credentials,
    );
    const result = await issuer.issue({
      roomName: created.roomName,
      participantName: 'Owner',
      participantIdentity: 'guest_owner123',
      ownerCredential: created.ownerCredential,
    });
    const claims = decodeJwt(result.participantToken);
    expect(result.role).toBe('admin');
    expect(claims.attributes).toMatchObject({ 'ufmg.role': 'admin' });
    expect((claims.video as Record<string, unknown>).roomAdmin).not.toBe(true);
  });
});
