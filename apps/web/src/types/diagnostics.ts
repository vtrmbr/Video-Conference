import type { NetworkMetrics, NetworkQuality } from '@ufmg/shared';

export interface MediaDiagnostics {
  codec?: string;
  bitrateKbps?: number;
  packetLossPercent?: number;
  jitterMs?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export interface DiagnosticsSnapshot {
  capturedAt: number;
  connectionState: string;
  quality: NetworkQuality;
  network: NetworkMetrics;
  transport?: string;
  iceState?: string;
  audio: MediaDiagnostics;
  video: MediaDiagnostics;
}
