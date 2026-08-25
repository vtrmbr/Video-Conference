import { useEffect, useRef, useState } from 'react';
import { MEDIA_DEFAULTS } from '@ufmg/config';
import { classifyNetworkQuality } from '@ufmg/shared';
import type { Room } from 'livekit-client';
import type { DiagnosticsSnapshot } from '../types/diagnostics.js';
import { parseRtcStats } from '../lib/webrtc/stats.js';

interface StatsTrack {
  getRTCStatsReport(): Promise<RTCStatsReport | undefined>;
}

export function useNetworkStats(room: Room) {
  const previous = useRef(new Map<string, { bytes: number; timestamp: number }>());
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot>({
    capturedAt: 0,
    connectionState: room.state,
    quality: 'unknown',
    network: {},
    audio: {},
    video: {},
  });

  useEffect(() => {
    let collecting = false;
    const collect = async () => {
      if (collecting) return;
      collecting = true;
      try {
        const publications = [
          ...room.localParticipant.trackPublications.values(),
          ...[...room.remoteParticipants.values()].flatMap((participant) => [
            ...participant.trackPublications.values(),
          ]),
        ];
        const tracks = publications
          .map((publication) => publication.track)
          .filter((track): track is typeof track & StatsTrack =>
            Boolean(track && 'getRTCStatsReport' in track),
          );
        const reports = (
          await Promise.all(tracks.map((track) => track.getRTCStatsReport()))
        ).filter((report): report is RTCStatsReport => Boolean(report));
        const parsed = parseRtcStats(reports, previous.current);
        const liveKitQuality = room.localParticipant.connectionQuality;
        const network = { ...parsed.network, liveKitQuality };
        setSnapshot({
          capturedAt: Date.now(),
          connectionState: room.state,
          quality: classifyNetworkQuality(network),
          network,
          audio: parsed.audio,
          video: parsed.video,
          ...(parsed.transport ? { transport: parsed.transport } : {}),
          ...(parsed.iceState ? { iceState: parsed.iceState } : {}),
        });
      } finally {
        collecting = false;
      }
    };
    void collect();
    const timer = window.setInterval(() => void collect(), MEDIA_DEFAULTS.statsIntervalMs);
    return () => window.clearInterval(timer);
  }, [room]);

  return snapshot;
}
