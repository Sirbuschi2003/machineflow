import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { getQueue, removeFromQueue } from '../services/offline';
import { api } from '../api/client';

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [queueLen, setQueueLen] = useState(getQueue().length);

  useEffect(() => {
    const onOnline = async () => {
      setOnline(true);
      const queue = getQueue();
      if (queue.length === 0) return;
      setSyncing(true);
      for (const action of queue) {
        try {
          await api.machineRequests.transition(action.requestId, {
            toStatus: action.toStatus as Parameters<typeof api.machineRequests.transition>[1]['toStatus'],
            comment: action.comment,
            machineSerialNumber: action.machineSerialNumber,
            accessories: action.accessories,
          });
          removeFromQueue(action.id);
        } catch {
          // keep in queue for next sync
        }
      }
      setQueueLen(getQueue().length);
      setSyncing(false);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  if (online && queueLen === 0) return null;

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium text-white transition-all ${
      online ? 'bg-green-600' : 'bg-amber-600'
    }`}>
      {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      {!online && 'Offline — Eingaben werden zwischengespeichert'}
      {online && syncing && 'Synchronisiere offline Einträge…'}
      {online && !syncing && queueLen > 0 && `${queueLen} Einträge synchronisiert`}
    </div>
  );
}
