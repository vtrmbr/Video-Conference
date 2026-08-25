import {
  isTrackReference,
  useIsSpeaking,
  useTrackVolume,
  VideoTrack,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { CameraOff, MicOff, MonitorUp } from 'lucide-react';
import { Track, type Participant } from 'livekit-client';

interface ParticipantVideoProps {
  trackRef: TrackReferenceOrPlaceholder;
  mirror?: boolean;
  contain?: boolean;
  compact?: boolean;
  screenShare?: boolean;
}

export function ParticipantVideo({
  trackRef,
  mirror,
  contain,
  compact,
  screenShare,
}: ParticipantVideoProps) {
  const participant = trackRef.participant;
  const microphone = participant.getTrackPublication(Track.Source.Microphone);
  const hasPlayableVideo =
    isTrackReference(trackRef) &&
    Boolean(trackRef.publication.track) &&
    !trackRef.publication.isMuted;
  const displayName = participant.name || (participant.isLocal ? 'Você' : 'Convidado');

  return (
    <div
      data-participant-id={participant.identity}
      className={`relative h-full w-full overflow-hidden bg-zinc-950 ${compact ? 'rounded-2xl' : ''}`}
    >
      {hasPlayableVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={`h-full w-full ${contain ? 'object-contain' : 'object-cover'} ${mirror ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-400">
          <div
            className={`flex items-center justify-center rounded-full bg-zinc-800 font-semibold text-zinc-200 shadow-inner ${compact ? 'h-14 w-14 text-lg' : 'h-24 w-24 text-3xl'}`}
            aria-hidden="true"
          >
            {initials(displayName)}
          </div>
        </div>
      )}
      {!screenShare && <SpeakingFrame participant={participant} />}
      <div className="absolute bottom-3 left-3 z-30 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur">
        {!hasPlayableVideo && (
          <span role="img" aria-label="Câmera desligada" className="shrink-0 text-zinc-300">
            <CameraOff size={13} />
          </span>
        )}
        {(!microphone || microphone.isMuted) && (
          <span role="img" aria-label="Microfone desligado" className="shrink-0 text-red-300">
            <MicOff size={13} />
          </span>
        )}
        {screenShare && (
          <span role="img" aria-label="Compartilhando tela" className="shrink-0 text-blue-300">
            <MonitorUp size={13} />
          </span>
        )}
        <span className="truncate">{displayName}</span>
        {participant.isLocal && !compact && <span className="text-zinc-400">(você)</span>}
      </div>
    </div>
  );
}

function SpeakingFrame({ participant }: { participant: Participant }) {
  const nativeSpeaking = useIsSpeaking(participant);
  const microphone = participant.getTrackPublication(Track.Source.Microphone);
  if (participant.isLocal) {
    return (
      <LocalSpeakingFrame
        participant={participant}
        nativeSpeaking={nativeSpeaking}
        microphoneMuted={!microphone || microphone.isMuted}
      />
    );
  }
  return (
    <SpeakingBorder isSpeaking={Boolean(microphone && !microphone.isMuted && nativeSpeaking)} />
  );
}

function LocalSpeakingFrame({
  participant,
  nativeSpeaking,
  microphoneMuted,
}: {
  participant: Participant;
  nativeSpeaking: boolean;
  microphoneMuted: boolean;
}) {
  const microphone = participant.getTrackPublication(Track.Source.Microphone);
  const microphoneRef: TrackReference | undefined = microphone
    ? { participant, publication: microphone, source: Track.Source.Microphone }
    : undefined;
  const localVolume = useTrackVolume(microphoneRef);
  return (
    <SpeakingBorder isSpeaking={!microphoneMuted && (nativeSpeaking || localVolume >= 0.035)} />
  );
}

function SpeakingBorder({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-speaking={isSpeaking || undefined}
      className={`pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-[3px] transition-[border-color,box-shadow] duration-150 ${
        isSpeaking
          ? 'border-positive shadow-[inset_0_0_0_1px_rgba(53,201,130,0.35)]'
          : 'border-transparent'
      }`}
    />
  );
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}
