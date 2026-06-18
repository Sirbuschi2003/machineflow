export type Role = 'SALES' | 'WAREHOUSE' | 'TECHNICIAN' | 'ADMIN' | 'MANAGEMENT';
export type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'IN_WAREHOUSE' | 'UNPACKING' | 'CONFIGURING' | 'DONE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface CustomerSite {
  id: string;
  customerId: string;
  siteName: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  isPrimary: boolean;
}

export interface Customer {
  id: string;
  customerNumber: string;
  companyName: string;
  phone?: string;
  email?: string;
  sites: CustomerSite[];
}

export interface MachineModel {
  id: string;
  modelName: string;
  description?: string;
  compatibleAccessories?: Accessory[];
}

export interface Accessory {
  id: string;
  name: string;
  description?: string;
  hasSerialNumber: boolean;
}

export interface RequestAccessory {
  id: string;
  accessoryId: string;
  accessory: Accessory;
  serialNumber?: string;
  quantity: number;
}

export interface StatusLog {
  id: string;
  fromStatus?: RequestStatus;
  toStatus: RequestStatus;
  changedBy: { id: string; name: string; role: Role };
  changedAt: string;
  comment?: string;
}

export interface MachineRequest {
  id: string;
  requestNumber: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  salesRep: { id: string; name: string; role: Role };
  customer: Customer;
  customerSite: CustomerSite;
  machineModel: MachineModel;
  machineSerialNumber?: string;
  notes?: string;
  accessories: RequestAccessory[];
  statusLogs?: StatusLog[];
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Fehler beim Laden der Daten.' }));
    throw new Error(err.message || 'Unbekannter Fehler.');
  }
  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: () => request<User>('/auth/me'),
  },

  customers: {
    lookup: (customerNumber: string) => request<Customer>(`/customers/lookup/${customerNumber}`),
    getAll: () => request<Customer[]>('/customers'),
    create: (data: Partial<Customer> & { sites?: Partial<CustomerSite>[] }) =>
      request<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Customer>) =>
      request<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    createSite: (customerId: string, data: Partial<CustomerSite>) =>
      request<CustomerSite>(`/customers/${customerId}/sites`, { method: 'POST', body: JSON.stringify(data) }),
    updateSite: (siteId: string, data: Partial<CustomerSite>) =>
      request<CustomerSite>(`/customers/sites/${siteId}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  machineModels: {
    getAll: () => request<MachineModel[]>('/machine-models'),
    create: (data: Partial<MachineModel> & { accessoryIds?: string[] }) =>
      request<MachineModel>('/machine-models', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<MachineModel> & { accessoryIds?: string[] }) =>
      request<MachineModel>(`/machine-models/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/machine-models/${id}`, { method: 'DELETE' }),
  },

  accessories: {
    getAll: () => request<Accessory[]>('/accessories'),
    create: (data: Partial<Accessory>) =>
      request<Accessory>('/accessories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Accessory>) =>
      request<Accessory>(`/accessories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/accessories/${id}`, { method: 'DELETE' }),
  },

  machineRequests: {
    getAll: (status?: RequestStatus) =>
      request<MachineRequest[]>(`/machine-requests${status ? `?status=${status}` : ''}`),
    getById: (id: string) => request<MachineRequest>(`/machine-requests/${id}`),
    create: (data: {
      customerId: string;
      customerSiteId: string;
      machineModelId: string;
      notes?: string;
      accessories: { accessoryId: string; quantity: number }[];
    }) => request<MachineRequest>('/machine-requests', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<MachineRequest>(`/machine-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    transition: (
      id: string,
      data: {
        toStatus: RequestStatus;
        comment?: string;
        machineSerialNumber?: string;
        accessories?: { id: string; serialNumber: string }[];
      }
    ) => request<MachineRequest>(`/machine-requests/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),
  },

  salesReps: {
    getAll: () => request<(User & { createdAt: string })[]>('/sales-reps'),
    create: (data: { name: string; email: string; password: string; role: Role }) =>
      request<User>('/sales-reps', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<User> & { password?: string }) =>
      request<User>(`/sales-reps/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/sales-reps/${id}`, { method: 'DELETE' }),
  },

  statistics: {
    machinesByYear: (params?: { modelId?: string }) => {
      const qs = params?.modelId ? `?modelId=${params.modelId}` : '';
      return request<{ year: number; modelId: string; modelName: string; count: number }[]>(
        `/statistics/machines-by-year${qs}`
      );
    },
    salesByRep: (params?: { year?: number }) => {
      const qs = params?.year ? `?year=${params.year}` : '';
      return request<{ repId: string; repName: string; count: number }[]>(`/statistics/sales-by-rep${qs}`);
    },
    summary: () => request<Record<string, number>>('/statistics/summary'),
  },
};
