import { describe, expect, it } from 'vitest';
import { parseRtcStats } from '../src/lib/webrtc/stats.js';

function report(records: readonly Record<string, unknown>[]) {
  return new Map(
    records.map((record, index) => [
      typeof record.id === 'string' ? record.id : String(index),
      record,
    ]),
  ) as unknown as RTCStatsReport;
}

describe('parseRtcStats', () => {
  it('derives only metrics exposed by standards-based RTCStatsReport', () => {
    const previous = new Map<string, { bytes: number; timestamp: number }>();
    const first = report([
      { id: 'codec-a', type: 'codec', mimeType: 'audio/opus' },
      {
        id: 'a1',
        type: 'inbound-rtp',
        kind: 'audio',
        codecId: 'codec-a',
        bytesReceived: 10_000,
        timestamp: 1_000,
        packetsReceived: 990,
        packetsLost: 10,
        jitter: 0.008,
      },
      { id: 'local', type: 'local-candidate', candidateType: 'relay', protocol: 'udp' },
      { id: 'remote', type: 'remote-candidate', candidateType: 'srflx', protocol: 'udp' },
      {
        id: 'pair',
        type: 'candidate-pair',
        selected: true,
        nominated: true,
        state: 'succeeded',
        localCandidateId: 'local',
        remoteCandidateId: 'remote',
        currentRoundTripTime: 0.087,
        availableOutgoingBitrate: 1_500_000,
      },
    ]);
    parseRtcStats([first], previous);
    const second = report([
      { id: 'codec-a', type: 'codec', mimeType: 'audio/opus' },
      {
        id: 'a1',
        type: 'inbound-rtp',
        kind: 'audio',
        codecId: 'codec-a',
        bytesReceived: 16_000,
        timestamp: 2_000,
        packetsReceived: 990,
        packetsLost: 10,
        jitter: 0.008,
      },
      { id: 'local', type: 'local-candidate', candidateType: 'relay', protocol: 'udp' },
      {
        id: 'pair',
        type: 'candidate-pair',
        selected: true,
        state: 'succeeded',
        localCandidateId: 'local',
        currentRoundTripTime: 0.087,
        availableOutgoingBitrate: 1_500_000,
      },
    ]);
    const parsed = parseRtcStats([second], previous);

    expect(parsed.transport).toBe('TURN / UDP');
    expect(parsed.network.rttMs).toBe(87);
    expect(parsed.network.availableOutgoingBitrateKbps).toBe(1_500);
    expect(parsed.audio).toMatchObject({
      codec: 'OPUS',
      bitrateKbps: 48,
      jitterMs: 8,
      packetLossPercent: 1,
    });
  });
});
