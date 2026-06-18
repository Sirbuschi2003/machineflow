import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { api, User, MachineModel, Accessory, Customer, Role } from '../api/client';

type Tab = 'users' | 'models' | 'accessories' | 'customers';

const ROLE_LABELS: Record<Role, string> = {
  SALES: 'Vertrieb',
  WAREHOUSE: 'Lager',
  TECHNICIAN: 'Techniker',
  ADMIN: 'Administrator',
  MANAGEMENT: 'Leitung',
};

// ─── Generic Confirm Dialog ─────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
        <p className="text-sm text-gray-700 mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onCancel}>Abbrechen</button>
          <button className="btn-danger" onClick={onConfirm}>Löschen</button>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<(User & { createdAt: string })[]>([]);
  const [editing, setEditing] = useState<Partial<User> & { password?: string } | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.salesReps.getAll().then(setUsers), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setError('');
    try {
      if (isNew) {
        await api.salesReps.create({
          name: editing.name!,
          email: editing.email!,
          password: editing.password!,
          role: editing.role!,
        });
      } else {
        await api.salesReps.update(editing.id!, editing);
      }
      setEditing(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    }
  };

  const del = async (id: string) => {
    try {
      await api.salesReps.delete(id);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      {deleteId && (
        <ConfirmDialog
          message="Benutzer wirklich löschen?"
          onConfirm={() => del(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}

      <div className="flex justify-end">
        <button
          className="btn-primary"
          onClick={() => { setEditing({ role: 'SALES' }); setIsNew(true); setError(''); }}
        >
          <Plus className="w-4 h-4" /> Benutzer hinzufügen
        </button>
      </div>

      {editing && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">{isNew ? 'Neuer Benutzer' : 'Benutzer bearbeiten'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" value={editing.name || ''} onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">E-Mail</label>
              <input className="input" type="email" value={editing.email || ''} onChange={(e) => setEditing((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Passwort {!isNew && '(leer = unverändert)'}</label>
              <input className="input" type="password" value={editing.password || ''} onChange={(e) => setEditing((p) => ({ ...p, password: e.target.value }))} />
            </div>
            <div>
              <label className="label">Rolle</label>
              <select className="input" value={editing.role || 'SALES'} onChange={(e) => setEditing((p) => ({ ...p, role: e.target.value as Role }))}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary" onClick={() => { setEditing(null); setError(''); }}><X className="w-4 h-4" /> Abbrechen</button>
            <button className="btn-primary" onClick={save}><Check className="w-4 h-4" /> Speichern</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">E-Mail</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rolle</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      className="text-gray-400 hover:text-brand-600 transition-colors p-1"
                      onClick={() => { setEditing({ ...u }); setIsNew(false); setError(''); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      onClick={() => setDeleteId(u.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Machine Models Tab ──────────────────────────────────────────────────────
function ModelsTab() {
  const [items, setItems] = useState<MachineModel[]>([]);
  const [editing, setEditing] = useState<Partial<MachineModel> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.machineModels.getAll().then(setItems), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setError('');
    try {
      if (isNew) {
        await api.machineModels.create(editing);
      } else {
        await api.machineModels.update(editing.id!, editing);
      }
      setEditing(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    }
  };

  const del = async (id: string) => {
    try { await api.machineModels.delete(id); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setDeleteId(null); }
  };

  return (
    <div className="space-y-4">
      {deleteId && <ConfirmDialog message="Modell wirklich löschen?" onConfirm={() => del(deleteId)} onCancel={() => setDeleteId(null)} />}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setEditing({}); setIsNew(true); setError(''); }}>
          <Plus className="w-4 h-4" /> Modell hinzufügen
        </button>
      </div>
      {editing && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">{isNew ? 'Neues Modell' : 'Modell bearbeiten'}</h3>
          <div>
            <label className="label">Modellname</label>
            <input className="input" value={editing.modelName || ''} onChange={(e) => setEditing((p) => ({ ...p, modelName: e.target.value }))} />
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <input className="input" value={editing.description || ''} onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary" onClick={() => setEditing(null)}><X className="w-4 h-4" /> Abbrechen</button>
            <button className="btn-primary" onClick={save}><Check className="w-4 h-4" /> Speichern</button>
          </div>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Modellname</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Beschreibung</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{item.modelName}</td>
                <td className="px-4 py-3 text-gray-500">{item.description || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button className="text-gray-400 hover:text-brand-600 transition-colors p-1" onClick={() => { setEditing({ ...item }); setIsNew(false); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button className="text-gray-400 hover:text-red-500 transition-colors p-1" onClick={() => setDeleteId(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Accessories Tab ─────────────────────────────────────────────────────────
function AccessoriesTab() {
  const [items, setItems] = useState<Accessory[]>([]);
  const [editing, setEditing] = useState<Partial<Accessory> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.accessories.getAll().then(setItems), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setError('');
    try {
      if (isNew) { await api.accessories.create(editing); }
      else { await api.accessories.update(editing.id!, editing); }
      setEditing(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    }
  };

  const del = async (id: string) => {
    try { await api.accessories.delete(id); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setDeleteId(null); }
  };

  return (
    <div className="space-y-4">
      {deleteId && <ConfirmDialog message="Zubehör wirklich löschen?" onConfirm={() => del(deleteId)} onCancel={() => setDeleteId(null)} />}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setEditing({ hasSerialNumber: false }); setIsNew(true); setError(''); }}>
          <Plus className="w-4 h-4" /> Zubehör hinzufügen
        </button>
      </div>
      {editing && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">{isNew ? 'Neues Zubehör' : 'Zubehör bearbeiten'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" value={editing.name || ''} onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Beschreibung</label>
              <input className="input" value={editing.description || ''} onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hasSn"
              checked={editing.hasSerialNumber || false}
              onChange={(e) => setEditing((p) => ({ ...p, hasSerialNumber: e.target.checked }))}
              className="w-4 h-4 text-brand-600 rounded border-gray-300"
            />
            <label htmlFor="hasSn" className="text-sm text-gray-700">Seriennummer erforderlich</label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary" onClick={() => setEditing(null)}><X className="w-4 h-4" /> Abbrechen</button>
            <button className="btn-primary" onClick={save}><Check className="w-4 h-4" /> Speichern</button>
          </div>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Beschreibung</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">S/N</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                <td className="px-4 py-3 text-gray-500">{item.description || '—'}</td>
                <td className="px-4 py-3">
                  {item.hasSerialNumber
                    ? <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">Ja</span>
                    : <span className="text-xs text-gray-400">Nein</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button className="text-gray-400 hover:text-brand-600 transition-colors p-1" onClick={() => { setEditing({ ...item }); setIsNew(false); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button className="text-gray-400 hover:text-red-500 transition-colors p-1" onClick={() => setDeleteId(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────
function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => api.customers.getAll().then(setCustomers), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setError('');
    try {
      if (isNew) {
        await api.customers.create({
          customerNumber: editing.customerNumber!,
          companyName: editing.companyName!,
          phone: editing.phone,
          email: editing.email,
        });
      } else {
        await api.customers.update(editing.id!, editing);
      }
      setEditing(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setEditing({}); setIsNew(true); setError(''); }}>
          <Plus className="w-4 h-4" /> Kunden hinzufügen
        </button>
      </div>
      {editing && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">{isNew ? 'Neuer Kunde' : 'Kunde bearbeiten'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kundennummer</label>
              <input className="input" value={editing.customerNumber || ''} onChange={(e) => setEditing((p) => ({ ...p, customerNumber: e.target.value }))} disabled={!isNew} />
            </div>
            <div>
              <label className="label">Firmenname</label>
              <input className="input" value={editing.companyName || ''} onChange={(e) => setEditing((p) => ({ ...p, companyName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={editing.phone || ''} onChange={(e) => setEditing((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">E-Mail</label>
              <input className="input" type="email" value={editing.email || ''} onChange={(e) => setEditing((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary" onClick={() => setEditing(null)}><X className="w-4 h-4" /> Abbrechen</button>
            <button className="btn-primary" onClick={save}><Check className="w-4 h-4" /> Speichern</button>
          </div>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kundennr.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Firma</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Standorte</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kontakt</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600">{c.customerNumber}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{c.companyName}</td>
                <td className="px-4 py-3 text-gray-500">{c.sites.length} Standort{c.sites.length !== 1 ? 'e' : ''}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {c.phone && <p>{c.phone}</p>}
                  {c.email && <p>{c.email}</p>}
                </td>
                <td className="px-4 py-3">
                  <button
                    className="text-gray-400 hover:text-brand-600 transition-colors p-1"
                    onClick={() => { setEditing({ ...c }); setIsNew(false); }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Admin Page ─────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Benutzer' },
  { id: 'models', label: 'Maschinenmodelle' },
  { id: 'accessories', label: 'Zubehör' },
  { id: 'customers', label: 'Kunden' },
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('users');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verwaltung</h1>
        <p className="text-sm text-gray-500 mt-0.5">Stammdaten und Benutzerverwaltung</p>
      </div>

      {/* Tab nav */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'models' && <ModelsTab />}
      {activeTab === 'accessories' && <AccessoriesTab />}
      {activeTab === 'customers' && <CustomersTab />}
    </div>
  );
}
