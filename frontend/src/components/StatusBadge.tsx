import { RequestStatus } from '../api/client';

const CONFIG: Record<RequestStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Entwurf', className: 'bg-gray-100 text-gray-700 ring-gray-200' },
  SUBMITTED: { label: 'Eingereicht', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  IN_WAREHOUSE: { label: 'Im Lager', className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  UNPACKING: { label: 'Auspacken', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  CONFIGURING: { label: 'Konfiguration', className: 'bg-purple-50 text-purple-700 ring-purple-200' },
  DONE: { label: 'Fertig', className: 'bg-green-50 text-green-700 ring-green-200' },
};

export const STATUS_LABELS = Object.fromEntries(
  Object.entries(CONFIG).map(([k, v]) => [k, v.label])
) as Record<RequestStatus, string>;

interface Props {
  status: RequestStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const { label, className } = CONFIG[status];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center font-medium rounded-full ring-1 ${className} ${sizeClass}`}>
      {label}
    </span>
  );
}
