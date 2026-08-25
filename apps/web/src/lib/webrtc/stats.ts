import type { NetworkMetrics } from '@ufmg/shared';
import type { MediaDiagnostics } from '../../types/diagnostics.js';

interface StatsRecord {
  id?: string;
  type?: string;
  kind?: string;
  mediaType?: string;
  timestamp?: number;
  bytesReceived?: number;
  bytesSent?: number;
  packetsLost?: number;
  packetsReceived?: number;
  jitter?: number;
  codecId?: string;
  mimeType?: string;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  currentRoundTripTime?: number;
  availableOutgoingBitrate?: number;
  state?: string;
  nominated?: boolean;
  selected?: boolean;
  localCandidateId?: string;
  remoteCandidateId?: string;
  candidateType?: string;
  protocol?: string;
}

interface ByteSample {
  bytes: number;
  timestamp: number;
}

export interface ParsedStats {
  network: NetworkMetrics;
  audio: MediaDiagnostics;
  video: MediaDiagnostics;
  transport?: string;
  iceState?: string;
}

export function parseRtcStats(
  reports: readonly RTCStatsReport[],
  previous: Map<string, ByteSample>,
): ParsedStats {
  const records: StatsRecord[] = [];
  for (const report of reports) {
    report.forEach((value) => records.push(value as StatsRecord));
  }
  const byId = new Map(
    records.flatMap((record) => (record.id ? [[record.id, record] as const] : [])),
  );
  const network: NetworkMetrics = {};
  const audioSamples: MediaDiagnostics[] = [];
  const videoSamples: MediaDiagnostics[] = [];
  let transport: string | undefined;
  let iceState: string | undefined;

  for (const record of records) {
    if (
      record.type === 'candidate-pair' &&
      (record.selected || record.nominated) &&
      record.state === 'succeeded'
    ) {
      if (finite(record.currentRoundTripTime)) network.rttMs = record.currentRoundTripTime * 1_000;
      if (finite(record.availableOutgoingBitrate))
        network.availableOutgoingBitrateKbps = record.availableOutgoingBitrate / 1_000;
      iceState = record.state;
      const local = record.localCandidateId ? byId.get(record.localCandidateId) : undefined;
      const remote = record.remoteCandidateId ? byId.get(record.remoteCandidateId) : undefined;
      const protocol = local?.protocol ?? remote?.protocol;
      const relay = local?.candidateType === 'relay' || remote?.candidateType === 'relay';
      transport = `${relay ? 'TURN' : 'ICE'}${protocol ? ` / ${protocol.toUpperCase()}` : ''}`;
    }

    if (record.type !== 'inbound-rtp' && record.type !== 'outbound-rtp') continue;
    const kind = record.kind ?? record.mediaType;
    if (kind !== 'audio' && kind !== 'video') continue;
    const codec = record.codecId
      ? byId.get(record.codecId)?.mimeType?.split('/')[1]?.toUpperCase()
      : undefined;
    const bytes = record.bytesReceived ?? record.bytesSent;
    let bitrateKbps: number | undefined;
    if (record.id && finite(bytes) && finite(record.timestamp)) {
      const old = previous.get(record.id);
      if (old && record.timestamp > old.timestamp && bytes >= old.bytes) {
        bitrateKbps = ((bytes - old.bytes) * 8) / (record.timestamp - old.timestamp);
      }
      previous.set(record.id, { bytes, timestamp: record.timestamp });
    }
    const totalPackets = (record.packetsReceived ?? 0) + Math.max(0, record.packetsLost ?? 0);
    const sample: MediaDiagnostics = {
      ...(codec ? { codec } : {}),
      ...(finite(bitrateKbps) ? { bitrateKbps } : {}),
      ...(totalPackets > 0 && finite(record.packetsLost)
        ? { packetLossPercent: (Math.max(0, record.packetsLost) / totalPackets) * 100 }
        : {}),
      ...(finite(record.jitter) ? { jitterMs: record.jitter * 1_000 } : {}),
      ...(finite(record.frameWidth) ? { width: record.frameWidth } : {}),
      ...(finite(record.frameHeight) ? { height: record.frameHeight } : {}),
      ...(finite(record.framesPerSecond) ? { fps: record.framesPerSecond } : {}),
    };
    (kind === 'audio' ? audioSamples : videoSamples).push(sample);
  }

  const audio = combineMedia(audioSamples);
  const video = combineMedia(videoSamples);
  if (audio.packetLossPercent !== undefined || video.packetLossPercent !== undefined) {
    network.packetLossPercent = Math.max(
      audio.packetLossPercent ?? 0,
      video.packetLossPercent ?? 0,
    );
  }
  if (audio.jitterMs !== undefined || video.jitterMs !== undefined) {
    network.jitterMs = Math.max(audio.jitterMs ?? 0, video.jitterMs ?? 0);
  }
  return {
    network,
    audio,
    video,
    ...(transport ? { transport } : {}),
    ...(iceState ? { iceState } : {}),
  };
}

function combineMedia(samples: readonly MediaDiagnostics[]): MediaDiagnostics {
  if (samples.length === 0) return {};
  const numbers = (key: keyof MediaDiagnostics): number[] =>
    samples
      .map((sample) => sample[key])
      .filter((value): value is number => typeof value === 'number');
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const bitrates = numbers('bitrateKbps');
  const losses = numbers('packetLossPercent');
  const jitters = numbers('jitterMs');
  const widths = numbers('width');
  const heights = numbers('height');
  const fps = numbers('fps');
  const codec = samples.find((sample) => sample.codec)?.codec;
  return {
    ...(codec ? { codec } : {}),
    ...(bitrates.length ? { bitrateKbps: sum(bitrates) } : {}),
    ...(losses.length ? { packetLossPercent: Math.max(...losses) } : {}),
    ...(jitters.length ? { jitterMs: Math.max(...jitters) } : {}),
    ...(widths.length ? { width: Math.max(...widths) } : {}),
    ...(heights.length ? { height: Math.max(...heights) } : {}),
    ...(fps.length ? { fps: Math.max(...fps) } : {}),
  };
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
