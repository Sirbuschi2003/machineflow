export type QueuedTransition = {
  id: string;
  requestId: string;
  toStatus: string;
  machineSerialNumber?: string;
  accessories?: { id: string; serialNumber: string }[];
  comment?: string;
  queuedAt: number;
};

const QUEUE_KEY = 'av_offline_queue';

export function enqueueTransition(action: Omit<QueuedTransition, 'id' | 'queuedAt'>): string {
  const queue = getQueue();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  queue.push({ ...action, id, queuedAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return id;
}

export function getQueue(): QueuedTransition[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

export function removeFromQueue(id: string) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(getQueue().filter((a) => a.id !== id)));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}
