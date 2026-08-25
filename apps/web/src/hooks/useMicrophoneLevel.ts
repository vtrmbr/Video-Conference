import { useEffect, useState } from 'react';

export function useMicrophoneLevel(stream: MediaStream | null) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!stream || !track) {
      return;
    }

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    const source = context.createMediaStreamSource(new MediaStream([track]));
    source.connect(analyser);
    const samples = new Uint8Array(analyser.frequencyBinCount);

    const timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(
        samples.reduce((sum, sample) => {
          const normalized = (sample - 128) / 128;
          return sum + normalized * normalized;
        }, 0) / samples.length,
      );
      setLevel(Math.min(1, rms * 4.5));
    }, 100);

    return () => {
      window.clearInterval(timer);
      source.disconnect();
      void context.close();
    };
  }, [stream]);

  return stream ? level : 0;
}
