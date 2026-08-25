import { render, screen } from '@testing-library/react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@livekit/components-react', () => ({
  isTrackReference: (reference: object) => 'publication' in reference,
  useIsSpeaking: () => true,
  useTrackVolume: () => 0.2,
  VideoTrack: () => <video data-testid="video-track" />,
}));

import { ParticipantVideo } from '../src/components/call/ParticipantVideo.js';

const microphone = { isMuted: true };
const participant = {
  identity: 'local',
  name: 'Carlos',
  isLocal: true,
  getTrackPublication: (source: Track.Source) =>
    source === Track.Source.Microphone ? microphone : undefined,
};

describe('ParticipantVideo', () => {
  it('shows camera and microphone states next to the participant name without a redundant label', () => {
    const placeholder = {
      participant,
      source: Track.Source.Camera,
    } as unknown as TrackReferenceOrPlaceholder;
    render(<ParticipantVideo trackRef={placeholder} compact />);

    expect(screen.getByRole('img', { name: 'Câmera desligada' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Microfone desligado' })).toBeInTheDocument();
    expect(screen.queryByText('Câmera desligada')).not.toBeInTheDocument();
  });

  it('draws the speaking frame only on the camera tile, never on screen share', () => {
    microphone.isMuted = false;
    const publication = { isMuted: false, track: {} };
    const trackRef = {
      participant,
      publication,
      source: Track.Source.Camera,
    } as unknown as TrackReferenceOrPlaceholder;
    const { container, rerender } = render(<ParticipantVideo trackRef={trackRef} />);
    expect(container.querySelector('[data-speaking="true"]')).toBeInTheDocument();

    rerender(<ParticipantVideo trackRef={trackRef} screenShare />);
    expect(container.querySelector('[data-speaking="true"]')).not.toBeInTheDocument();
    microphone.isMuted = true;
  });
});
