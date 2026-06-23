// ── Status Transition Queue (für Offline-Statuswechsel) ──────────────────────

export type QueuedTransition = {
  id: string;
  requestId: string;
  toStatus: string;
  machineSerialNumber?: string;
  accessories?: { id: string; serialNumber: string }[];
  comment?: string;
  queuedAt: number;
};

const TRANSITION_KEY = 'av_offline_queue';

export function enqueueTransition(action: Omit<QueuedTransition, 'id' | 'queuedAt'>): string {
  const queue = getQueue();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  queue.push({ ...action, id, queuedAt: Date.now() });
  localStorage.setItem(TRANSITION_KEY, JSON.stringify(queue));
  return id;
}

export function getQueue(): QueuedTransition[] {
  try { return JSON.parse(localStorage.getItem(TRANSITION_KEY) || '[]'); }
  catch { return []; }
}

export function removeFromQueue(id: string) {
  localStorage.setItem(TRANSITION_KEY, JSON.stringify(getQueue().filter((a) => a.id !== id)));
}

export function clearQueue() {
  localStorage.removeItem(TRANSITION_KEY);
}

// ── New Order Queue (für Offline-Auftragsanlage) ──────────────────────────────

export type QueuedOrder = {
  id: string;
  queuedAt: number;
  customerId: string;
  siteId: string;
  machines: {
    modelId: string;
    modelName: string;
    accessories: { accessoryId: string; quantity: number }[];
    notes: string;
  }[];
  globalNotes: string;
  asDraft: boolean;
};

const ORDER_KEY = 'av_order_queue';

export function enqueueOrder(order: Omit<QueuedOrder, 'id' | 'queuedAt'>): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const queue = getOrderQueue();
  queue.push({ ...order, id, queuedAt: Date.now() });
  localStorage.setItem(ORDER_KEY, JSON.stringify(queue));
  return id;
}

export function getOrderQueue(): QueuedOrder[] {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]'); }
  catch { return []; }
}

export function removeOrderFromQueue(id: string) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(getOrderQueue().filter((o) => o.id !== id)));
}

export function getPendingCount(): number {
  return getQueue().length + getOrderQueue().length;
}
