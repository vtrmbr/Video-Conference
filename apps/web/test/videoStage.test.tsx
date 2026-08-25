import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const participants = vi.hoisted(() => ({
  local: { identity: 'local', name: 'Carlos', isLocal: true },
  remote: { identity: 'remote', name: 'Ana', isLocal: false },
}));

vi.mock('@livekit/components-react', () => ({
  isTrackReference: () => false,
  useTracks: (sources: Array<string | { source: string }>) => {
    const source = typeof sources[0] === 'object' ? sources[0]?.source : sources[0];
    return source === 'camera'
      ? [
          { participant: participants.local, source: 'camera' },
          { participant: participants.remote, source: 'camera' },
        ]
      : [];
  },
}));

vi.mock('../src/components/call/ParticipantVideo.js', () => ({
  ParticipantVideo: ({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) => (
    <div data-testid="participant-tile">{trackRef.participant.name}</div>
  ),
}));

import { VideoStage } from '../src/components/call/VideoStage.js';

describe('VideoStage', () => {
  afterEach(cleanup);

  it('keeps participants without camera tracks visible and allows changing focus', () => {
    render(<VideoStage layout={{ position: 'bottom', size: 'medium', overlay: true }} />);

    const tiles = screen.getAllByTestId('participant-tile');
    expect(tiles[0]).toHaveTextContent('Ana');
    expect(tiles[1]).toHaveTextContent('Carlos');

    fireEvent.click(screen.getByRole('button', { name: 'Colocar Carlos em foco' }));
    const updatedTiles = screen.getAllByTestId('participant-tile');
    expect(updatedTiles[0]).toHaveTextContent('Carlos');
    expect(screen.getByRole('button', { name: 'Colocar Ana em foco' })).toBeInTheDocument();
  });

  it('can collapse thumbnails into a small restore bar', () => {
    render(<VideoStage layout={{ position: 'right', size: 'small', overlay: false }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar miniaturas' }));
    expect(
      screen.queryByRole('button', { name: 'Colocar Carlos em foco' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar 1 miniaturas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar 1 miniaturas' })).toHaveClass(
      'right-3',
      'top-3',
    );
  });

  it('keeps an overlay rail transparent and lays horizontal thumbnails from the right', () => {
    render(<VideoStage layout={{ position: 'top', size: 'medium', overlay: true }} />);
    const rail = screen.getByRole('complementary', {
      name: 'Outros participantes e compartilhamentos',
    });
    expect(rail).toHaveClass('bg-transparent', 'flex-row-reverse');
    expect(rail).not.toHaveClass('glass');
  });
});
