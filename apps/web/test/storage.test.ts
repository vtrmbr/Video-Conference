import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadJoinPreferences,
  loadLastCall,
  loadThumbnailLayoutPreferences,
  markLastCallInactive,
  saveJoinPreferences,
  saveLastCall,
  saveThumbnailLayoutPreferences,
} from '../src/lib/storage.js';

describe('thumbnail layout preferences', () => {
  beforeEach(() => localStorage.clear());

  it('persists a customized non-overlay layout', () => {
    saveThumbnailLayoutPreferences({ position: 'left', size: 'large', overlay: false });
    expect(loadThumbnailLayoutPreferences()).toEqual({
      position: 'left',
      size: 'large',
      overlay: false,
    });
  });

  it('falls back safely when stored values are invalid', () => {
    localStorage.setItem('ufmg.thumbnailPosition', 'diagonal');
    localStorage.setItem('ufmg.thumbnailSize', 'giant');
    expect(loadThumbnailLayoutPreferences()).toEqual({
      position: 'bottom',
      size: 'medium',
      overlay: true,
    });
  });

  it('persists media choices and a recoverable active call', () => {
    saveJoinPreferences({ name: 'Ana', cameraEnabled: false, microphoneEnabled: true });
    saveLastCall({
      roomId: 'ROOM1234',
      participantIdentity: 'guest_12345678',
      resumeCredential: 'signed-resume',
      preferences: {
        name: 'Ana',
        cameraId: 'camera-1',
        microphoneId: 'microphone-1',
        speakerId: 'speaker-1',
        cameraEnabled: false,
        microphoneEnabled: true,
      },
      active: true,
      updatedAt: 123,
    });

    expect(loadJoinPreferences()).toEqual({
      name: 'Ana',
      cameraEnabled: false,
      microphoneEnabled: true,
    });
    expect(loadLastCall()).toMatchObject({ roomId: 'ROOM1234', active: true });
    markLastCallInactive('ROOM1234');
    expect(loadLastCall()).toMatchObject({ roomId: 'ROOM1234', active: false });
  });

  it('ignores malformed recovery data instead of crashing startup', () => {
    localStorage.setItem('ufmg.lastCall', '{broken');
    localStorage.setItem('ufmg.joinPreferences', JSON.stringify({ name: 123 }));
    expect(loadLastCall()).toBeUndefined();
    expect(loadJoinPreferences()).toEqual({
      name: '',
      cameraEnabled: true,
      microphoneEnabled: true,
    });
  });
});
