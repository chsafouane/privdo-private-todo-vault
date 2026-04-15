import type { SyncStatus } from '@/hooks/useSyncEngine';
import { CloudCheck, CloudSlash, CloudArrowUp, Warning } from '@phosphor-icons/react';

interface SyncStatusIconProps {
  status: SyncStatus;
  onClick: () => void;
}

export function SyncStatusIcon({ status, onClick }: SyncStatusIconProps) {
  const iconClass = 'h-5 w-5';

  const iconMap: Record<SyncStatus, { icon: React.ReactNode; title: string }> = {
    idle: {
      icon: <CloudCheck className={`${iconClass} text-green-500`} />,
      title: 'Synced',
    },
    syncing: {
      icon: <CloudArrowUp className={`${iconClass} text-blue-500 animate-pulse`} />,
      title: 'Syncing...',
    },
    error: {
      icon: <Warning className={`${iconClass} text-destructive`} />,
      title: 'Sync error',
    },
    offline: {
      icon: <CloudSlash className={`${iconClass} text-muted-foreground`} />,
      title: 'Offline — changes will sync when back online',
    },
    disabled: {
      icon: <CloudSlash className={`${iconClass} text-muted-foreground opacity-50`} />,
      title: 'Sync not configured',
    },
  };

  const { icon, title } = iconMap[status];

  return (
    <button
      onClick={onClick}
      className="p-2 rounded-md hover:bg-accent transition-colors"
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );
}
