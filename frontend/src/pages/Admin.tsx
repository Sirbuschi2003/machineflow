import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { api, User, MachineModel, Accessory, Customer, CustomerSite, Role } from '../api/client';

type Tab = 'users' | 'models' | 'accessories' | 'customers' | 'import';

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
      const e = editing as any;
      if (isNew) {
        await api.salesReps.create({
          username: e.username,
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          password: e.password,
          role: e.role,
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
      {error && !editing && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
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
              <label className="label">Vorname</label>
              <input className="input" value={(editing as any).firstName || ''} onChange={(e) => setEditing((p) => ({ ...p, firstName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Nachname</label>
              <input className="input" value={(editing as any).lastName || ''} onChange={(e) => setEditing((p) => ({ ...p, lastName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Benutzername (Login)</label>
              <input className="input" value={(editing as any).username || ''} onChange={(e) => setEditing((p) => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="label">E-Mail (optional)</label>
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Benutzername</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">E-Mail</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rolle</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{(u as any).firstName} {(u as any).lastName}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{(u as any).username}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.email || '—'}</td>
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
  const [allAccessories, setAllAccessories] = useState<Accessory[]>([]);
  const [editing, setEditing] = useState<Partial<MachineModel> | null>(null);
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<string[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.machineModels.getAll().then(setItems), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.accessories.getAll().then(setAllAccessories); }, []);

  const openNew = () => {
    setEditing({});
    setSelectedAccessoryIds([]);
    setIsNew(true);
    setError('');
  };

  const openEdit = (item: MachineModel) => {
    setEditing({ ...item });
    setSelectedAccessoryIds((item.compatibleAccessories ?? []).map((a) => a.id));
    setIsNew(false);
    setError('');
  };

  const toggleAcc = (id: string) => {
    setSelectedAccessoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const save = async () => {
    if (!editing) return;
    setError('');
    try {
      if (isNew) {
        await api.machineModels.create({ ...editing, accessoryIds: selectedAccessoryIds });
      } else {
        await api.machineModels.update(editing.id!, { ...editing, accessoryIds: selectedAccessoryIds });
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
        <button className="btn-primary" onClick={openNew}>
          <Plus className="w-4 h-4" /> Modell hinzufügen
        </button>
      </div>
      {editing && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">{isNew ? 'Neues Modell' : 'Modell bearbeiten'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hersteller</label>
              <input className="input" placeholder="z.B. Toshiba, Ricoh…" value={(editing as any).manufacturer || ''} onChange={(e) => setEditing((p) => ({ ...p, manufacturer: e.target.value }))} />
            </div>
            <div>
              <label className="label">Modellname</label>
              <input className="input" value={editing.modelName || ''} onChange={(e) => setEditing((p) => ({ ...p, modelName: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <input className="input" value={editing.description || ''} onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} />
          </div>

          {/* Compatible accessories */}
          <div>
            <label className="label">Kompatibles Zubehör</label>
            {allAccessories.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Noch kein Zubehör angelegt.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-1">
                {allAccessories.map((acc) => (
                  <label
                    key={acc.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedAccessoryIds.includes(acc.id)
                        ? 'bg-brand-50 border-brand-200'
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccessoryIds.includes(acc.id)}
                      onChange={() => toggleAcc(acc.id)}
                      className="w-4 h-4 text-brand-600 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-800 leading-tight">{acc.name}</span>
                    {acc.hasSerialNumber && (
                      <span className="ml-auto text-xs text-purple-500 bg-purple-50 px-1 py-0.5 rounded flex-shrink-0">S/N</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Image uploads — only shown when editing existing model */}
          {!isNew && editing.id && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Produktbild</label>
                {editing.imagePath && (
                  <img src={editing.imagePath} alt="" className="w-24 h-24 object-contain rounded-lg border mb-2" />
                )}
                <input type="file" accept="image/*" className="text-sm text-gray-600" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !editing.id) return;
                  try {
                    const { imagePath } = await api.uploads.machineModel(editing.id, file);
                    setEditing((p) => p ? { ...p, imagePath } : p);
                    load();
                  } catch {}
                }} />
              </div>
              <div>
                <label className="label">Hersteller-Logo</label>
                {(editing as any).manufacturerLogoPath && (
                  <img src={(editing as any).manufacturerLogoPath} alt="" className="h-10 object-contain rounded-lg border mb-2" />
                )}
                <input type="file" accept="image/*" className="text-sm text-gray-600" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !editing.id) return;
                  try {
                    const { manufacturerLogoPath } = await api.uploads.machineModelLogo(editing.id, file);
                    setEditing((p) => p ? { ...p, manufacturerLogoPath } : p);
                    load();
                  } catch {}
                }} />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary" onClick={() => setEditing(null)}><X className="w-4 h-4" /> Abbrechen</button>
            <button className="btn-primary" onClick={save}><Check className="w-4 h-4" /> Speichern</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.id} className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow relative">
            {/* Manufacturer logo top-right */}
            {item.manufacturerLogoPath && (
              <img src={item.manufacturerLogoPath} alt="" className="absolute top-3 right-3 h-5 object-contain opacity-70" />
            )}
            {/* Product image */}
            <div className="flex items-center justify-center h-24 bg-gray-50 rounded-lg">
              {item.imagePath
                ? <img src={item.imagePath} alt={item.modelName} className="h-20 w-full object-contain" />
                : <div className="text-gray-200 text-3xl font-bold select-none">{(item.manufacturer || item.modelName).charAt(0)}</div>}
            </div>
            {/* Text */}
            <div className="min-w-0 flex-1">
              {item.manufacturer && <p className="text-xs text-gray-400 font-medium truncate">{item.manufacturer}</p>}
              <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{item.modelName}</p>
              {item.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>}
              {(item.compatibleAccessories ?? []).length > 0 && (
                <p className="text-xs text-brand-600 mt-1">{(item.compatibleAccessories ?? []).length} Zubehör</p>
              )}
            </div>
            {/* Actions */}
            <div className="flex gap-1 justify-end border-t border-gray-100 pt-2">
              <button className="text-gray-400 hover:text-brand-600 transition-colors p-1" onClick={() => openEdit(item)} title="Bearbeiten">
                <Pencil className="w-4 h-4" />
              </button>
              <button className="text-gray-400 hover:text-red-500 transition-colors p-1" onClick={() => setDeleteId(item.id)} title="Löschen">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center py-10 text-sm text-gray-400 italic">Noch keine Maschinenmodelle angelegt.</div>
        )}
      </div>
    </div>
  );
}

// ─── Accessories Tab ─────────────────────────────────────────────────────────
function AccessoriesTab() {
  const [items, setItems] = useState<Accessory[]>([]);
  const [allModels, setAllModels] = useState<MachineModel[]>([]);
  const [editing, setEditing] = useState<Partial<Accessory> | null>(null);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.accessories.getAll().then(setItems), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.machineModels.getAll().then(setAllModels); }, []);

  const openNew = () => {
    setEditing({ hasSerialNumber: false });
    setSelectedModelIds([]);
    setIsNew(true);
    setError('');
  };

  const openEdit = (item: Accessory) => {
    setEditing({ ...item });
    setSelectedModelIds((item.compatibleModels ?? []).map((m) => m.id));
    setIsNew(false);
    setError('');
  };

  const toggleModel = (id: string) =>
    setSelectedModelIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const save = async () => {
    if (!editing) return;
    setError('');
    try {
      if (isNew) { await api.accessories.create({ ...editing, machineModelIds: selectedModelIds }); }
      else { await api.accessories.update(editing.id!, { ...editing, machineModelIds: selectedModelIds }); }
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
      {error && !editing && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={openNew}>
          <Plus className="w-4 h-4" /> Zubehör hinzufügen
        </button>
      </div>
      {editing && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">{isNew ? 'Neues Zubehör' : 'Zubehör bearbeiten'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Bezeichnung (z.B. DESK-5005)</label>
              <input className="input font-mono" placeholder="z.B. MR-3033" value={editing.code || ''} onChange={(e) => setEditing((p) => ({ ...p, code: e.target.value }))} />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input" value={editing.name || ''} onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Beschreibung / Art.-Nr.</label>
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

          {/* Compatible machine models */}
          <div>
            <label className="label">Passt an folgende Maschinenmodelle</label>
            {allModels.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Noch keine Maschinenmodelle angelegt.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-1">
                {allModels.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedModelIds.includes(m.id) ? 'bg-brand-50 border-brand-200' : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModelIds.includes(m.id)}
                      onChange={() => toggleModel(m.id)}
                      className="w-4 h-4 text-brand-600 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-800">{m.modelName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Image upload — only shown when editing existing item */}
          {!isNew && editing.id && (
            <div>
              <label className="label">Produktbild</label>
              {editing.imagePath && (
                <img src={editing.imagePath} alt="" className="w-24 h-24 object-contain rounded-lg border mb-2" />
              )}
              <input type="file" accept="image/*" className="text-sm text-gray-600" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !editing.id) return;
                try {
                  const { imagePath } = await api.uploads.accessory(editing.id, file);
                  setEditing((p) => p ? { ...p, imagePath } : p);
                  load();
                } catch {}
              }} />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary" onClick={() => setEditing(null)}><X className="w-4 h-4" /> Abbrechen</button>
            <button className="btn-primary" onClick={save}><Check className="w-4 h-4" /> Speichern</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.id} className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
            {/* Product image */}
            <div className="flex items-center justify-center h-20 bg-gray-50 rounded-lg">
              {item.imagePath
                ? <img src={item.imagePath} alt={item.name} className="h-16 w-full object-contain" />
                : <div className="text-gray-200 text-3xl font-bold select-none">{item.name.charAt(0)}</div>}
            </div>
            {/* Text */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start gap-1.5 flex-wrap">
                {item.code && (
                  <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{item.code}</span>
                )}
                {item.hasSerialNumber && (
                  <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium shrink-0">S/N</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{item.name}</p>
              {item.description && <p className="text-xs text-gray-400 line-clamp-2">{item.description}</p>}
              {(item.compatibleModels ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(item.compatibleModels ?? []).slice(0, 2).map((m) => (
                    <span key={m.id} className="text-xs bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full truncate max-w-[100px]">{m.modelName}</span>
                  ))}
                  {(item.compatibleModels ?? []).length > 2 && (
                    <span className="text-xs text-gray-400">+{(item.compatibleModels ?? []).length - 2}</span>
                  )}
                </div>
              )}
              {(item.compatibleModels ?? []).length === 0 && (
                <p className="text-xs text-gray-400 italic">Universell</p>
              )}
            </div>
            {/* Actions */}
            <div className="flex gap-1 justify-end border-t border-gray-100 pt-2">
              <button className="text-gray-400 hover:text-brand-600 transition-colors p-1" onClick={() => openEdit(item)} title="Bearbeiten">
                <Pencil className="w-4 h-4" />
              </button>
              <button className="text-gray-400 hover:text-red-500 transition-colors p-1" onClick={() => setDeleteId(item.id)} title="Löschen">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center py-10 text-sm text-gray-400 italic">Noch kein Zubehör angelegt.</div>
        )}
      </div>
    </div>
  );
}

// ─── PDF Import Tab ───────────────────────────────────────────────────────────
interface ParsedItem { code: string; articleNumber: string; name: string; selected: boolean }
interface ParsedModel { name: string; manufacturer: string; selected: boolean; existsAlready: boolean }

function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedModels, setParsedModels] = useState<ParsedModel[] | null>(null);
  const [detectedManufacturer, setDetectedManufacturer] = useState('');
  const [items, setItems] = useState<ParsedItem[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const toggleModel = (idx: number) =>
    setParsedModels((prev) => prev ? prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m) : null);

  const toggleItem = (idx: number) =>
    setItems((prev) => prev ? prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it) : null);

  const editName = (idx: number, name: string) =>
    setItems((prev) => prev ? prev.map((it, i) => i === idx ? { ...it, name } : it) : null);

  const parsePdf = async () => {
    if (!file) return;
    setParsing(true);
    setError('');
    setResult('');
    setItems(null);
    setParsedModels(null);
    try {
      const data = await api.import.parsePdf(file);
      setDetectedManufacturer(data.manufacturer);
      setParsedModels(data.machineModels);
      setItems(data.accessories);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Lesen.');
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!items || !parsedModels) return;
    setImporting(true);
    setError('');
    try {
      const res = await api.import.confirm({ accessories: items, machineModels: parsedModels });
      setResult(res.message);
      setItems(null);
      setParsedModels(null);
      setFile(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Importieren.');
    } finally {
      setImporting(false);
    }
  };

  const selectedAccCount = items?.filter((i) => i.selected).length ?? 0;
  const selectedModCount = parsedModels?.filter((m) => m.selected).length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Hersteller-PDF importieren</h2>
        <p className="text-xs text-gray-500 mt-0.5">Maschinenmodelle und Zubehör werden automatisch aus dem Konfigurationsdokument ausgelesen. Verbrauchsmaterialien (Toner, Entwickler, Trommel) werden übersprungen.</p>
      </div>

      {result && (
        <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-800 font-medium">{result}</div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {/* Step 1: upload PDF */}
      <div className="card p-5 space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Schritt 1 — PDF hochladen</h3>
        <div className="flex gap-3 items-center">
          <label className="flex-1">
            <input type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setItems(null); setParsedModels(null); setResult(''); }} />
            <div className="input cursor-pointer text-gray-500 truncate">
              {file ? file.name : 'PDF-Datei auswählen…'}
            </div>
          </label>
          <button className="btn-primary whitespace-nowrap" onClick={parsePdf} disabled={!file || parsing}>
            {parsing ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block mr-1" /> : null}
            {parsing ? 'Lese…' : 'PDF auslesen'}
          </button>
        </div>
      </div>

      {/* Step 2 + 3: preview after parsing */}
      {parsedModels && items && (
        <div className="space-y-4">
          {/* Machine models preview */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1">
                Schritt 2 — Erkannte Maschinenmodelle ({selectedModCount} von {parsedModels.length} ausgewählt)
              </h3>
              {detectedManufacturer && (
                <span className="text-xs font-semibold bg-brand-50 text-brand-700 px-2 py-1 rounded-full">
                  Hersteller: {detectedManufacturer}
                </span>
              )}
            </div>
            {parsedModels.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Keine Maschinenmodelle im PDF erkannt.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {parsedModels.map((m, idx) => (
                  <label key={idx} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    m.selected ? 'bg-brand-50 border-brand-200' : 'bg-gray-50 border-gray-100 opacity-50'
                  }`}>
                    <input type="checkbox" checked={m.selected} onChange={() => toggleModel(idx)}
                      className="w-4 h-4 text-brand-600 rounded border-gray-300" />
                    <span className="text-sm text-gray-800 flex-1">{m.name}</span>
                    {m.existsAlready
                      ? <span className="text-xs text-gray-400 italic">vorhanden</span>
                      : <span className="text-xs text-green-600 font-medium">neu</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Accessories preview */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Schritt 3 — Erkanntes Zubehör ({selectedAccCount} von {items.length} ausgewählt)
              </h3>
              <button className="btn-primary" onClick={doImport} disabled={importing || (selectedAccCount === 0 && selectedModCount === 0)}>
                {importing ? 'Importiere…' : 'Importieren'}
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1">
            {items.map((item, idx) => (
              <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                item.selected ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-50'
              }`}>
                <input type="checkbox" checked={item.selected} onChange={() => toggleItem(idx)}
                  className="w-4 h-4 text-brand-600 rounded border-gray-300 flex-shrink-0" />
                <span className="text-xs font-mono text-gray-400 w-24 flex-shrink-0">{item.code}</span>
                <input
                  className="flex-1 text-sm text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand-400 focus:outline-none px-1"
                  value={item.name}
                  onChange={(e) => editName(idx, e.target.value)}
                  disabled={!item.selected}
                />
                <span className="text-xs text-gray-400 flex-shrink-0">{item.articleNumber}</span>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Site Form ───────────────────────────────────────────────────────────────
const EMPTY_SITE: Partial<CustomerSite> = { siteName: '', street: '', zip: '', city: '', country: 'Deutschland', contactPerson: '', notes: '', isPrimary: false };

function SiteForm({ site, onSave, onCancel }: {
  site: Partial<CustomerSite>;
  onSave: (data: Partial<CustomerSite>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<CustomerSite>>(site);
  const [error, setError] = useState('');
  const set = (k: keyof CustomerSite, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.siteName?.trim() || !form.street?.trim() || !form.zip?.trim() || !form.city?.trim()) {
      setError('Standortname, Straße, PLZ und Ort sind Pflichtfelder.');
      return;
    }
    setError('');
    try { await onSave(form); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Fehler.'); }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Standortname *</label>
          <input className="input" placeholder="z.B. Hauptsitz, Filiale Nord …" value={form.siteName || ''} onChange={(e) => set('siteName', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Straße *</label>
          <input className="input" placeholder="Musterstraße 1" value={form.street || ''} onChange={(e) => set('street', e.target.value)} />
        </div>
        <div>
          <label className="label">PLZ *</label>
          <input className="input" placeholder="12345" value={form.zip || ''} onChange={(e) => set('zip', e.target.value)} />
        </div>
        <div>
          <label className="label">Ort *</label>
          <input className="input" placeholder="Musterstadt" value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div>
          <label className="label">Ansprechpartner</label>
          <input className="input" placeholder="Max Mustermann" value={form.contactPerson || ''} onChange={(e) => set('contactPerson', e.target.value)} />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.isPrimary} onChange={(e) => set('isPrimary', e.target.checked)} className="w-4 h-4 rounded accent-brand-600" />
            <span className="text-sm text-gray-700">Hauptstandort</span>
          </label>
        </div>
        <div className="col-span-2">
          <label className="label">Weitere Notizen</label>
          <textarea className="input" rows={2} placeholder="Anfahrt, Öffnungszeiten, besondere Hinweise …" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button className="btn-secondary" onClick={onCancel}><X className="w-4 h-4" /> Abbrechen</button>
        <button className="btn-primary" onClick={submit}><Check className="w-4 h-4" /> Speichern</button>
      </div>
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────
function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingSite, setAddingSite] = useState(false);
  const [editingSite, setEditingSite] = useState<CustomerSite | null>(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [deleteSiteId, setDeleteSiteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.customers.getAll().then(setCustomers), []);
  useEffect(() => { load(); }, [load]);

  const saveCustomer = async () => {
    if (!editingCustomer) return;
    setError('');
    try {
      if (isNew) {
        const created = await api.customers.create({
          customerNumber: editingCustomer.customerNumber!,
          companyName: editingCustomer.companyName!,
          phone: editingCustomer.phone,
          email: editingCustomer.email,
        });
        setEditingCustomer(null);
        await load();
        setExpandedId(created.id);
        setAddingSite(true);
      } else {
        await api.customers.update(editingCustomer.id!, editingCustomer);
        setEditingCustomer(null);
        load();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    }
  };

  const delCustomer = async (id: string) => {
    try { await api.customers.delete(id); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setDeleteCustomerId(null); }
  };

  const saveSite = async (customerId: string, data: Partial<CustomerSite>) => {
    await api.customers.createSite(customerId, data);
    setAddingSite(false);
    load();
  };

  const updateSite = async (siteId: string, data: Partial<CustomerSite>) => {
    await api.customers.updateSite(siteId, data);
    setEditingSite(null);
    load();
  };

  const delSite = async (siteId: string) => {
    try { await api.customers.deleteSite(siteId); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setDeleteSiteId(null); }
  };

  const expanded = customers.find((c) => c.id === expandedId);

  return (
    <div className="space-y-4">
      {deleteCustomerId && (
        <ConfirmDialog
          message="Kunden wirklich löschen? Nur möglich wenn keine Aufträge vorhanden sind."
          onConfirm={() => delCustomer(deleteCustomerId)}
          onCancel={() => setDeleteCustomerId(null)}
        />
      )}
      {deleteSiteId && (
        <ConfirmDialog
          message="Standort wirklich löschen? Nur möglich wenn keine Aufträge für diesen Standort vorhanden sind."
          onConfirm={() => delSite(deleteSiteId)}
          onCancel={() => setDeleteSiteId(null)}
        />
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setEditingCustomer({}); setIsNew(true); setError(''); setExpandedId(null); }}>
          <Plus className="w-4 h-4" /> Kunden hinzufügen
        </button>
      </div>

      {/* New customer form */}
      {editingCustomer && isNew && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Neuer Kunde</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kundennummer *</label>
              <input className="input" value={editingCustomer.customerNumber || ''} onChange={(e) => setEditingCustomer((p) => ({ ...p, customerNumber: e.target.value }))} />
            </div>
            <div>
              <label className="label">Firmenname *</label>
              <input className="input" value={editingCustomer.companyName || ''} onChange={(e) => setEditingCustomer((p) => ({ ...p, companyName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={editingCustomer.phone || ''} onChange={(e) => setEditingCustomer((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">E-Mail</label>
              <input className="input" type="email" value={editingCustomer.email || ''} onChange={(e) => setEditingCustomer((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary" onClick={() => { setEditingCustomer(null); setError(''); }}><X className="w-4 h-4" /> Abbrechen</button>
            <button className="btn-primary" onClick={saveCustomer}><Check className="w-4 h-4" /> Speichern & Standort hinzufügen</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8" />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kundennr.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Firma</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kontakt</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <>
                <tr key={c.id} className="hover:bg-gray-50 border-t border-gray-100">
                  <td className="pl-3">
                    <button
                      className="text-gray-400 hover:text-brand-600 transition-colors p-1"
                      onClick={() => { setExpandedId(expandedId === c.id ? null : c.id); setAddingSite(false); setEditingSite(null); setEditingCustomer(null); }}
                      title="Standorte anzeigen"
                    >
                      {expandedId === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600">{c.customerNumber}</td>
                  <td className="px-4 py-3">
                    {editingCustomer && !isNew && editingCustomer.id === c.id ? (
                      <div className="flex gap-2 items-center flex-wrap">
                        <input className="input py-1 text-sm w-40" placeholder="Firma" value={editingCustomer.companyName || ''} onChange={(e) => setEditingCustomer((p) => ({ ...p, companyName: e.target.value }))} />
                        <input className="input py-1 text-sm w-32" placeholder="Telefon" value={editingCustomer.phone || ''} onChange={(e) => setEditingCustomer((p) => ({ ...p, phone: e.target.value }))} />
                        <input className="input py-1 text-sm w-40" placeholder="E-Mail" value={editingCustomer.email || ''} onChange={(e) => setEditingCustomer((p) => ({ ...p, email: e.target.value }))} />
                        <button className="btn-primary py-1 px-2 text-xs" onClick={saveCustomer}><Check className="w-3 h-3" /></button>
                        <button className="btn-secondary py-1 px-2 text-xs" onClick={() => setEditingCustomer(null)}><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <span className="font-medium text-gray-900">{c.companyName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {c.phone && <p>{c.phone}</p>}
                    {c.email && <p>{c.email}</p>}
                    <p className="text-gray-400">{c.sites.length} Standort{c.sites.length !== 1 ? 'e' : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button className="text-gray-400 hover:text-brand-600 transition-colors p-1" title="Kundendaten bearbeiten" onClick={() => { setEditingCustomer({ ...c }); setIsNew(false); setError(''); }}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button className="text-gray-400 hover:text-red-500 transition-colors p-1" onClick={() => setDeleteCustomerId(c.id)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded sites panel */}
                {expandedId === c.id && (
                  <tr key={`${c.id}-sites`}>
                    <td colSpan={5} className="bg-blue-50/40 px-6 pb-4 pt-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3" /> Standorte</span>
                          {!addingSite && !editingSite && (
                            <button className="btn-primary py-1 px-2 text-xs" onClick={() => { setAddingSite(true); setEditingSite(null); }}>
                              <Plus className="w-3 h-3" /> Standort hinzufügen
                            </button>
                          )}
                        </div>

                        {c.sites.map((s) => (
                          <div key={s.id}>
                            {editingSite?.id === s.id ? (
                              <SiteForm
                                site={editingSite}
                                onSave={(data) => updateSite(s.id, data)}
                                onCancel={() => setEditingSite(null)}
                              />
                            ) : (
                              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-start justify-between gap-4">
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 text-sm">{s.siteName}</span>
                                    {s.isPrimary && <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-medium">Hauptstandort</span>}
                                  </div>
                                  <p className="text-xs text-gray-600">{s.street}, {s.zip} {s.city}</p>
                                  {s.contactPerson && <p className="text-xs text-gray-500">Ansprechpartner: {s.contactPerson}</p>}
                                  {s.notes && <p className="text-xs text-gray-400 italic">{s.notes}</p>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button className="text-gray-400 hover:text-brand-600 transition-colors p-1" onClick={() => { setEditingSite(s); setAddingSite(false); }}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button className="text-gray-400 hover:text-red-500 transition-colors p-1" onClick={() => setDeleteSiteId(s.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {c.sites.length === 0 && !addingSite && (
                          <p className="text-xs text-gray-400 italic text-center py-2">Noch keine Standorte vorhanden.</p>
                        )}

                        {addingSite && (
                          <SiteForm
                            site={{ ...EMPTY_SITE, isPrimary: c.sites.length === 0 }}
                            onSave={(data) => saveSite(c.id, data)}
                            onCancel={() => setAddingSite(false)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
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
  { id: 'import', label: 'PDF-Import' },
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
      {activeTab === 'import' && <ImportTab />}
    </div>
  );
}
