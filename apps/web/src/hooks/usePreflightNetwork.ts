import { useCallback, useEffect, useState } from 'react';
import type { NetworkQuality } from '@ufmg/shared';
import { fetchHealth, fetchPublicConfig } from '../lib/api/client.js';

export interface PreflightNetworkState {
  running: boolean;
  backendReachable: boolean;
  livekitConfigured: boolean;
  httpRttMs: number | undefined;
  quality: NetworkQuality;
  error: string | undefined;
}

export function usePreflightNetwork() {
  const [state, setState] = useState<PreflightNetworkState>({
    running: true,
    backendReachable: false,
    livekitConfigured: false,
    httpRttMs: undefined,
    quality: 'unknown',
    error: undefined,
  });

  const run = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve();
    if (signal?.aborted) return;
    setState((current) => ({ ...current, running: true, error: undefined }));
    try {
      const samples: number[] = [];
      for (let index = 0; index < 3; index += 1) {
        const started = performance.now();
        await fetchHealth(signal);
        samples.push(performance.now() - started);
      }
      const config = await fetchPublicConfig(signal);
      const httpRttMs = Math.round(
        samples.reduce((sum, sample) => sum + sample, 0) / samples.length,
      );
      setState({
        running: false,
        backendReachable: true,
        livekitConfigured: config.livekitConfigured,
        httpRttMs,
        quality:
          httpRttMs <= 180
            ? 'excellent'
            : httpRttMs <= 350
              ? 'good'
              : httpRttMs <= 650
                ? 'fair'
                : 'poor',
        error: undefined,
      });
    } catch (error) {
      if (signal?.aborted) return;
      setState({
        running: false,
        backendReachable: false,
        livekitConfigured: false,
        httpRttMs: undefined,
        quality: 'unknown',
        error: error instanceof Error ? error.message : 'O teste de conexão falhou.',
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void run(controller.signal));
    return () => controller.abort();
  }, [run]);

  return { ...state, rerun: () => void run() };
}
