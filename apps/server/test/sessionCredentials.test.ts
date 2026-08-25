import { describe, expect, it } from 'vitest';
import { SessionCredentialService } from '../src/services/sessionCredentials.js';

describe('SessionCredentialService', () => {
  const credentials = new SessionCredentialService('test-secret-value-at-least-32-bytes');

  it('binds owner and resume credentials to their room and identity', () => {
    const created = credentials.createRoom(true);
    expect(created.approvalRequired).toBe(true);
    expect(credentials.verifyOwner(created.ownerCredential, created.roomName)).toBe(true);
    expect(credentials.readOwnerOptions(created.ownerCredential, created.roomName)).toEqual({
      approvalRequired: true,
    });
    expect(credentials.verifyOwner(created.ownerCredential, 'OTHER123')).toBe(false);

    const resume = credentials.createResumeCredential(created.roomName, 'guest_12345678');
    expect(credentials.verifyResume(resume, created.roomName, 'guest_12345678')).toBe(
      'guest_12345678',
    );
    expect(credentials.verifyResume(resume, created.roomName, 'guest_other123')).toBeUndefined();
  });

  it('rejects tampered credentials', () => {
    const created = credentials.createRoom();
    expect(
      credentials.verifyOwner(`${created.ownerCredential.slice(0, -1)}x`, created.roomName),
    ).toBe(false);
  });
});
