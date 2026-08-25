interface DeviceSelectProps {
  label: string;
  kind: MediaDeviceKind;
  devices: MediaDeviceInfo[];
  value: string;
  disabled?: boolean;
  unsupportedMessage?: string;
  onChange: (kind: MediaDeviceKind, deviceId: string) => void;
}

export function DeviceSelect({
  label,
  kind,
  devices,
  value,
  disabled,
  unsupportedMessage,
  onChange,
}: DeviceSelectProps) {
  const selectedDeviceIsMissing =
    Boolean(value) && !devices.some((device) => device.deviceId === value);
  return (
    <label className="grid gap-2 text-sm text-zinc-300">
      <span>{label}</span>
      <select
        className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 disabled:opacity-50"
        value={value}
        disabled={disabled || devices.length === 0}
        onChange={(event) => onChange(kind, event.target.value)}
      >
        {devices.length === 0 ? (
          <option value="">{unsupportedMessage ?? 'Nenhum dispositivo encontrado'}</option>
        ) : (
          <>
            {selectedDeviceIsMissing && (
              <option value={value} disabled>
                Dispositivo desconectado — escolha outro
              </option>
            )}
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `${label} ${index + 1}`}
              </option>
            ))}
          </>
        )}
      </select>
    </label>
  );
}
