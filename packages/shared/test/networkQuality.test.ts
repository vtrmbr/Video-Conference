import { describe, expect, it } from 'vitest';
import { classifyNetworkQuality } from '../src/index.js';

describe('classifyNetworkQuality', () => {
  it('returns unknown without honest measurements', () => {
    expect(classifyNetworkQuality({})).toBe('unknown');
  });

  it('classifies a healthy call as excellent', () => {
    expect(
      classifyNetworkQuality({
        rttMs: 70,
        jitterMs: 8,
        packetLossPercent: 0.4,
        availableOutgoingBitrateKbps: 3_500,
        liveKitQuality: 'excellent',
      }),
    ).toBe('excellent');
  });

  it('does not hide severe loss behind good bitrate', () => {
    expect(
      classifyNetworkQuality({
        rttMs: 80,
        jitterMs: 10,
        packetLossPercent: 12,
        availableOutgoingBitrateKbps: 5_000,
        liveKitQuality: 'excellent',
      }),
    ).toBe('fair');
  });

  it('classifies widespread degradation as poor', () => {
    expect(
      classifyNetworkQuality({
        rttMs: 900,
        jitterMs: 120,
        packetLossPercent: 15,
        availableOutgoingBitrateKbps: 150,
        liveKitQuality: 'poor',
      }),
    ).toBe('poor');
  });
});
