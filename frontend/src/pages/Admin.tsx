import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { api, User, MachineModel, Accessory, Customer, Role } from '../api/client';

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
          <div>
            <label className="label">Modellname</label>
            <input className="input" value={editing.modelName || ''} onChange={(e) => setEditing((p) => ({ ...p, modelName: e.target.value }))} />
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Zubehör</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{item.modelName}</td>
                <td className="px-4 py-3 text-gray-500">{item.description || '—'}</td>
                <td className="px-4 py-3">
                  {(item.compatibleAccessories ?? []).length === 0 ? (
                    <span className="text-xs text-gray-400 italic">keines</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(item.compatibleAccessories ?? []).map((a) => (
                        <span key={a.id} className="text-xs bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full">{a.name}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button className="text-gray-400 hover:text-brand-600 transition-colors p-1" onClick={() => openEdit(item)}>
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Passt an</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">S/N</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                </td>
                <td className="px-4 py-3">
                  {(item.compatibleModels ?? []).length === 0 ? (
                    <span className="text-xs text-gray-400 italic">alle / keine Einschränkung</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(item.compatibleModels ?? []).map((m) => (
                        <span key={m.id} className="text-xs bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full">{m.modelName}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.hasSerialNumber
                    ? <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">Ja</span>
                    : <span className="text-xs text-gray-400">Nein</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button className="text-gray-400 hover:text-brand-600 transition-colors p-1" onClick={() => openEdit(item)}>
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

// ─── PDF Import Tab ───────────────────────────────────────────────────────────
interface ParsedItem { code: string; articleNumber: string; name: string; selected: boolean }
interface ParsedModel { name: string; selected: boolean; existsAlready: boolean }

function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedModels, setParsedModels] = useState<ParsedModel[] | null>(null);
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
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Schritt 2 — Erkannte Maschinenmodelle ({selectedModCount} von {parsedModels.length} ausgewählt)
            </h3>
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

// ─── Customers Tab ────────────────────────────────────────────────────────────
function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
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

  const del = async (id: string) => {
    try { await api.customers.delete(id); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setDeleteId(null); }
  };

  return (
    <div className="space-y-4">
      {deleteId && (
        <ConfirmDialog
          message="Kunden wirklich löschen? Nur möglich wenn keine Aufträge vorhanden sind."
          onConfirm={() => del(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
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
            <button className="btn-secondary" onClick={() => { setEditing(null); setError(''); }}><X className="w-4 h-4" /> Abbrechen</button>
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
              <th className="w-20" />
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
                  <div className="flex items-center gap-1 justify-end">
                    <button className="text-gray-400 hover:text-brand-600 transition-colors p-1" onClick={() => { setEditing({ ...c }); setIsNew(false); setError(''); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button className="text-gray-400 hover:text-red-500 transition-colors p-1" onClick={() => setDeleteId(c.id)}>
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
