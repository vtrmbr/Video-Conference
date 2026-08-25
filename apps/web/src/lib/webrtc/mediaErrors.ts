export function friendlyMediaError(error: unknown, kind: 'camera' | 'microphone' | 'devices') {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return `Permissão de ${kind === 'camera' ? 'câmera' : 'microfone'} bloqueada. Libere o acesso nas configurações do navegador.`;
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return `Nenhum dispositivo de ${kind === 'camera' ? 'câmera' : 'áudio'} foi encontrado.`;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return `O dispositivo está em uso por outro aplicativo. Feche o outro aplicativo e tente novamente.`;
  }
  if (name === 'OverconstrainedError') {
    return 'O dispositivo selecionado não está mais disponível.';
  }
  return 'Não foi possível acessar os dispositivos de mídia.';
}
