import { STORAGE_KEYS } from '@ufmg/config';

export interface DevicePreferences {
  cameraId: string;
  microphoneId: string;
  speakerId: string;
  preferredVideoQuality: '720p' | '1080p';
}

export interface StoredJoinPreferences {
  name: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
}

export interface StoredCallSession {
  roomId: string;
  participantIdentity: string;
  resumeCredential: string;
  preferences: StoredJoinPreferences & {
    cameraId: string;
    microphoneId: string;
    speakerId: string;
  };
  active: boolean;
  updatedAt: number;
}

export type ThumbnailPosition = 'bottom' | 'top' | 'left' | 'right';
export type ThumbnailSize = 'small' | 'medium' | 'large';

export interface ThumbnailLayoutPreferences {
  position: ThumbnailPosition;
  size: ThumbnailSize;
  overlay: boolean;
}

export const DEFAULT_THUMBNAIL_LAYOUT: ThumbnailLayoutPreferences = {
  position: 'bottom',
  size: 'medium',
  overlay: true,
};

export function loadDevicePreferences(): DevicePreferences {
  return {
    cameraId: read(STORAGE_KEYS.cameraId),
    microphoneId: read(STORAGE_KEYS.microphoneId),
    speakerId: read(STORAGE_KEYS.speakerId),
    preferredVideoQuality: read(STORAGE_KEYS.preferredVideoQuality) === '1080p' ? '1080p' : '720p',
  };
}

export function saveDevicePreference(key: keyof typeof STORAGE_KEYS, value: string) {
  try {
    localStorage.setItem(STORAGE_KEYS[key], value);
  } catch {
    // Preferences are non-critical; private browsing can reject localStorage.
  }
}

export function loadThumbnailLayoutPreferences(): ThumbnailLayoutPreferences {
  const position = read(STORAGE_KEYS.thumbnailPosition);
  const size = read(STORAGE_KEYS.thumbnailSize);
  return {
    position: isThumbnailPosition(position) ? position : DEFAULT_THUMBNAIL_LAYOUT.position,
    size: isThumbnailSize(size) ? size : DEFAULT_THUMBNAIL_LAYOUT.size,
    overlay: read(STORAGE_KEYS.thumbnailOverlay) !== 'false',
  };
}

export function saveThumbnailLayoutPreferences(preferences: ThumbnailLayoutPreferences) {
  saveDevicePreference('thumbnailPosition', preferences.position);
  saveDevicePreference('thumbnailSize', preferences.size);
  saveDevicePreference('thumbnailOverlay', String(preferences.overlay));
}

export function loadJoinPreferences(): StoredJoinPreferences {
  const value = readJson(STORAGE_KEYS.joinPreferences);
  if (!isRecord(value)) return { name: '', cameraEnabled: true, microphoneEnabled: true };
  return {
    name: typeof value.name === 'string' ? value.name.slice(0, 60) : '',
    cameraEnabled: typeof value.cameraEnabled === 'boolean' ? value.cameraEnabled : true,
    microphoneEnabled:
      typeof value.microphoneEnabled === 'boolean' ? value.microphoneEnabled : true,
  };
}

export function saveJoinPreferences(preferences: StoredJoinPreferences) {
  writeJson(STORAGE_KEYS.joinPreferences, preferences);
}

export function loadLastCall(): StoredCallSession | undefined {
  const value = readJson(STORAGE_KEYS.lastCall);
  if (!isRecord(value) || !isRecord(value.preferences)) return undefined;
  const preferences = value.preferences;
  if (
    typeof value.roomId !== 'string' ||
    !/^[A-Za-z0-9_-]{4,64}$/.test(value.roomId) ||
    typeof value.participantIdentity !== 'string' ||
    typeof value.resumeCredential !== 'string' ||
    typeof value.active !== 'boolean' ||
    typeof value.updatedAt !== 'number' ||
    typeof preferences.name !== 'string' ||
    typeof preferences.cameraId !== 'string' ||
    typeof preferences.microphoneId !== 'string' ||
    typeof preferences.speakerId !== 'string' ||
    typeof preferences.cameraEnabled !== 'boolean' ||
    typeof preferences.microphoneEnabled !== 'boolean'
  ) {
    return undefined;
  }
  return value as unknown as StoredCallSession;
}

export function saveLastCall(session: StoredCallSession) {
  writeJson(STORAGE_KEYS.lastCall, session);
}

export function markLastCallInactive(roomId: string) {
  const session = loadLastCall();
  if (!session || session.roomId !== roomId) return;
  saveLastCall({ ...session, active: false, updatedAt: Date.now() });
}

export function saveRoomOwnerCredential(roomId: string, credential: string) {
  try {
    localStorage.setItem(ownerCredentialKey(roomId), credential);
  } catch {
    // The call still works without administrative recovery in private browsing.
  }
}

export function loadRoomOwnerCredential(roomId: string) {
  return read(ownerCredentialKey(roomId));
}

function read(key: string) {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function readJson(key: string): unknown {
  const value = read(key);
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session recovery is best effort when storage is unavailable.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function ownerCredentialKey(roomId: string) {
  return `ufmg.ownerCredential.${roomId}`;
}

function isThumbnailPosition(value: string): value is ThumbnailPosition {
  return value === 'bottom' || value === 'top' || value === 'left' || value === 'right';
}

function isThumbnailSize(value: string): value is ThumbnailSize {
  return value === 'small' || value === 'medium' || value === 'large';
}
