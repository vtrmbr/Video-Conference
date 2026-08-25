import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CreateRoomResponse } from '@ufmg/shared';

interface CredentialPayload {
  version: 1;
  kind: 'owner' | 'resume';
  roomName: string;
  participantIdentity?: string;
  approvalRequired?: boolean;
  expiresAt: number;
}

export class SessionCredentialService {
  constructor(private readonly secret: string) {}

  createRoom(approvalRequired = false): CreateRoomResponse {
    const roomName = randomBytes(6).toString('hex').slice(0, 8).toUpperCase();
    return {
      roomName,
      approvalRequired,
      ownerCredential: this.sign({
        version: 1,
        kind: 'owner',
        roomName,
        approvalRequired,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1_000,
      }),
    };
  }

  createResumeCredential(roomName: string, participantIdentity: string) {
    return this.sign({
      version: 1,
      kind: 'resume',
      roomName,
      participantIdentity,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1_000,
    });
  }

  verifyOwner(credential: string | undefined, roomName: string) {
    const payload = this.verify(credential);
    return payload?.kind === 'owner' && payload.roomName === roomName;
  }

  readOwnerOptions(credential: string | undefined, roomName: string) {
    const payload = this.verify(credential);
    if (payload?.kind !== 'owner' || payload.roomName !== roomName) return undefined;
    return { approvalRequired: payload.approvalRequired === true };
  }

  verifyResume(credential: string | undefined, roomName: string, participantIdentity?: string) {
    const payload = this.verify(credential);
    if (
      payload?.kind !== 'resume' ||
      payload.roomName !== roomName ||
      !payload.participantIdentity ||
      (participantIdentity && payload.participantIdentity !== participantIdentity)
    ) {
      return undefined;
    }
    return payload.participantIdentity;
  }

  private sign(payload: CredentialPayload) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.signature(encoded);
    return `${encoded}.${signature}`;
  }

  private verify(credential: string | undefined): CredentialPayload | undefined {
    if (!credential || !this.secret) return undefined;
    const [encoded, receivedSignature, extra] = credential.split('.');
    if (!encoded || !receivedSignature || extra) return undefined;
    const expectedSignature = this.signature(encoded);
    const received = Buffer.from(receivedSignature);
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length || !timingSafeEqual(received, expected))
      return undefined;
    try {
      const value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown;
      if (!isCredentialPayload(value) || value.expiresAt <= Date.now()) return undefined;
      return value;
    } catch {
      return undefined;
    }
  }

  private signature(encoded: string) {
    return createHmac('sha256', this.secret)
      .update(`ufmg-video-conference:${encoded}`)
      .digest('base64url');
  }
}

function isCredentialPayload(value: unknown): value is CredentialPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CredentialPayload>;
  return (
    candidate.version === 1 &&
    (candidate.kind === 'owner' || candidate.kind === 'resume') &&
    typeof candidate.roomName === 'string' &&
    typeof candidate.expiresAt === 'number' &&
    (candidate.participantIdentity === undefined ||
      typeof candidate.participantIdentity === 'string') &&
    (candidate.approvalRequired === undefined || typeof candidate.approvalRequired === 'boolean')
  );
}
