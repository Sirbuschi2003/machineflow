import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import {
  getQueue, removeFromQueue,
  getOrderQueue, removeOrderFromQueue, getPendingCount,
} from '../services/offline';
import { api } from '../api/client';

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(getPendingCount);

  useEffect(() => {
    const onOnline = async () => {
      setOnline(true);
      const transitions = getQueue();
      const orders = getOrderQueue();
      if (transitions.length === 0 && orders.length === 0) return;

      setSyncing(true);
      let synced = 0;

      // Process status transitions
      for (const action of transitions) {
        try {
          await api.machineRequests.transition(action.requestId, {
            toStatus: action.toStatus as Parameters<typeof api.machineRequests.transition>[1]['toStatus'],
            comment: action.comment,
            machineSerialNumber: action.machineSerialNumber,
            accessories: action.accessories,
          });
          removeFromQueue(action.id);
          synced++;
        } catch {
          // keep in queue for next sync
        }
      }

      // Process queued new orders
      for (const order of orders) {
        try {
          for (const m of order.machines) {
            const req = await api.machineRequests.create({
              customerId: order.customerId,
              customerSiteId: order.siteId,
              machineModelId: m.modelId,
              notes: m.notes || order.globalNotes || undefined,
              accessories: m.accessories,
            });
            if (!order.asDraft) {
              await api.machineRequests.transition(req.id, { toStatus: 'SUBMITTED' });
            }
          }
          removeOrderFromQueue(order.id);
          synced++;
        } catch {
          // keep in queue for next sync
        }
      }

      setSyncedCount(synced);
      setPendingCount(getPendingCount());
      setSyncing(false);

      // Reset synced message after 4 seconds
      if (synced > 0) setTimeout(() => setSyncedCount(0), 4000);
    };

    const onOffline = () => { setOnline(false); setPendingCount(getPendingCount()); };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const invisible = online && pendingCount === 0 && syncedCount === 0;
  if (invisible) return null;

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium text-white transition-all ${
      online ? (syncing ? 'bg-blue-600' : 'bg-green-600') : 'bg-amber-600'
    }`}>
      {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      {!online && (
        pendingCount > 0
          ? `Offline — ${pendingCount} ${pendingCount === 1 ? 'Eintrag' : 'Einträge'} zwischengespeichert`
          : 'Offline — Eingaben werden zwischengespeichert'
      )}
      {online && syncing && 'Synchronisiere…'}
      {online && !syncing && syncedCount > 0 && `${syncedCount} ${syncedCount === 1 ? 'Eintrag' : 'Einträge'} synchronisiert ✓`}
    </div>
  );
}
