const TEST_TONE =
  'data:audio/wav;base64,UklGRjQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRA' +
  'GAAAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

export async function playSpeakerTest(deviceId: string) {
  const audio = new Audio(TEST_TONE);
  if (deviceId && 'setSinkId' in audio) await audio.setSinkId(deviceId);
  audio.volume = 0.5;
  try {
    await audio.play();
  } catch {
    // Some engines reject the tiny embedded WAV. Web Audio is a reliable fallback
    // after this user gesture, but cannot target a selected sink everywhere.
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 440;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
    window.setTimeout(() => void context.close(), 500);
  }
}
