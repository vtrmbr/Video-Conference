import { isBrowserSupported, supportsAdaptiveStream, supportsDynacast } from 'livekit-client';

export interface BrowserCapabilities {
  browserSupported: boolean;
  secureContext: boolean;
  mediaDevices: boolean;
  screenShare: boolean;
  speakerSelection: boolean;
  adaptiveStream: boolean;
  dynacast: boolean;
}

export function detectCapabilities(): BrowserCapabilities {
  const mediaDevices =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const mediaElement =
    typeof HTMLMediaElement === 'undefined' ? undefined : HTMLMediaElement.prototype;
  return {
    browserSupported: isBrowserSupported(),
    secureContext: window.isSecureContext,
    mediaDevices,
    screenShare: mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function',
    speakerSelection: Boolean(mediaElement && 'setSinkId' in mediaElement),
    adaptiveStream: supportsAdaptiveStream(),
    dynacast: supportsDynacast(),
  };
}
