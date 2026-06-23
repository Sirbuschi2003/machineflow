import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, CheckCircle, AlertCircle, ArrowLeft, Plus, Minus,
  UserPlus, Cpu, Check, X, Trash2, Package, WifiOff, Pencil, MapPin,
} from 'lucide-react';
import { api, Customer, MachineModel, Accessory, CustomerSite } from '../api/client';
import { enqueueOrder } from '../services/offline';

// ── Types ────────────────────────────────────────────────────────────────────

interface AccSelection {
  accessoryId: string;
  code?: string;
  name: string;
  imagePath?: string;
  hasSerialNumber: boolean;
  quantity: number;
}

interface MachineEntry {
  localId: string;
  model: MachineModel;
  accessories: AccSelection[];
  notes: string;
}

type WizardStep = 'customer' | 'machines' | 'confirm';
const STEPS: WizardStep[] = ['customer', 'machines', 'confirm'];
const STEP_LABELS: Record<WizardStep, string> = {
  customer: 'Kunde & Standort',
  machines: 'Maschinen',
  confirm: 'Bestätigung',
};

// ── Accessory Modal ───────────────────────────────────────────────────────────

interface AccModalProps {
  model: MachineModel;
  initialSelections: AccSelection[];
  onConfirm: (accs: AccSelection[]) => void;
  onClose: () => void;
}

function AccessoryModal({ model, initialSelections, onConfirm, onClose }: AccModalProps) {
  const baseAccs: Accessory[] = model.compatibleAccessories ?? [];
  const [extraAccs, setExtraAccs] = useState<Accessory[]>([]);
  const allAccs = useMemo(() => [...baseAccs, ...extraAccs], [baseAccs, extraAccs]);

  const initMap = new Map(initialSelections.map((s) => [s.accessoryId, s]));

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelections.map((s) => s.accessoryId))
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    for (const a of baseAccs) q[a.id] = initMap.get(a.id)?.quantity ?? 1;
    return q;
  });

  const [search, setSearch] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState('');

  const toggle = (id: string) =>
    setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const changeQty = (id: string, delta: number) =>
    setQuantities((p) => ({ ...p, [id]: Math.max(1, (p[id] ?? 1) + delta) }));

  const handleCreateCustom = async () => {
    if (!customName.trim()) { setCustomError('Bezeichnung ist erforderlich.'); return; }
    if (!navigator.onLine) { setCustomError('Internetverbindung erforderlich um neues Zubehör anzulegen.'); return; }
    setCustomError('');
    setCustomLoading(true);
    try {
      const acc = await api.accessories.create({
        code: customCode.trim() || undefined,
        name: customName.trim(),
        hasSerialNumber: false,
        machineModelIds: [model.id],
      });
      setExtraAccs((p) => [...p, acc]);
      setSelectedIds((p) => new Set([...p, acc.id]));
      setQuantities((p) => ({ ...p, [acc.id]: 1 }));
      setCustomCode('');
      setCustomName('');
    } catch (e) {
      setCustomError(e instanceof Error ? e.message : 'Fehler beim Anlegen.');
    } finally {
      setCustomLoading(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(
      allAccs
        .filter((a) => selectedIds.has(a.id))
        .map((a) => ({
          accessoryId: a.id,
          code: a.code,
          name: a.name,
          imagePath: a.imagePath,
          hasSerialNumber: a.hasSerialNumber,
          quantity: quantities[a.id] ?? 1,
        }))
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allAccs;
    return allAccs.filter((a) => a.name.toLowerCase().includes(q) || (a.code ?? '').toLowerCase().includes(q));
  }, [allAccs, search]);

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] border-t sm:border border-gray-100 dark:border-slate-700">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {model.imagePath
              ? <img src={model.imagePath} alt="" className="h-10 w-10 object-contain rounded-lg bg-gray-50 dark:bg-slate-700 p-1 shrink-0" />
              : <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0"><Cpu className="w-5 h-5 text-gray-300 dark:text-slate-500" /></div>}
            <div className="min-w-0">
              {model.manufacturer && <p className="text-xs text-gray-400 dark:text-slate-500">{model.manufacturer}</p>}
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 leading-tight truncate">{model.modelName}</h3>
              <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
                {selectedIds.size > 0 ? `${selectedIds.size} Zubehör ausgewählt` : 'Kein Zubehör ausgewählt'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {allAccs.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input className="input pl-9" placeholder="Zubehör suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}

          {filtered.length === 0 && !search && (
            <div className="text-center py-6 text-sm text-gray-400 dark:text-slate-500 italic">
              Für dieses Modell ist noch kein Zubehör hinterlegt.<br />
              Trage unten eigenes Zubehör ein.
            </div>
          )}
          {filtered.length === 0 && search && (
            <p className="text-sm text-gray-400 dark:text-slate-500 italic text-center py-2">Kein Treffer.</p>
          )}

          {filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((acc) => {
                const sel = selectedIds.has(acc.id);
                const qty = quantities[acc.id] ?? 1;
                return (
                  <div
                    key={acc.id}
                    onClick={() => toggle(acc.id)}
                    className={`relative cursor-pointer rounded-xl border-2 p-3 transition-all select-none ${
                      sel
                        ? 'border-brand-500 dark:border-brand-400 bg-brand-50 dark:bg-brand-600/15 shadow-sm'
                        : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-700/40 hover:border-gray-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {sel && (
                      <div className="absolute top-2 left-2 w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center z-10">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="flex items-center justify-center h-14 mb-2">
                      {acc.imagePath
                        ? <img src={acc.imagePath} alt={acc.name} className="max-h-14 max-w-full object-contain" />
                        : <div className="w-10 h-10 bg-gray-100 dark:bg-slate-600 rounded-lg flex items-center justify-center"><Package className="w-5 h-5 text-gray-300 dark:text-slate-500" /></div>}
                    </div>
                    {acc.code && <p className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 text-center mb-0.5">{acc.code}</p>}
                    <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 text-center leading-tight">{acc.name}</p>
                    {acc.hasSerialNumber && <p className="text-xs text-purple-500 dark:text-purple-400 text-center mt-0.5">S/N</p>}
                    {sel && (
                      <div className="flex items-center justify-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => changeQty(acc.id, -1)} className="w-6 h-6 rounded-md bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-500">
                          <Minus className="w-3 h-3 text-gray-700 dark:text-slate-200" />
                        </button>
                        <span className="text-sm font-bold w-5 text-center text-gray-900 dark:text-slate-100">{qty}</span>
                        <button onClick={() => changeQty(acc.id, 1)} className="w-6 h-6 rounded-md bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-500">
                          <Plus className="w-3 h-3 text-gray-700 dark:text-slate-200" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom accessory */}
          <div className="border-t border-dashed border-gray-200 dark:border-slate-600 pt-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Fehlendes Zubehör eintragen & anlegen
            </p>
            <div className="flex gap-2 flex-col sm:flex-row">
              <input
                className="input sm:w-32 font-mono shrink-0"
                placeholder="Code (opt.)"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
              />
              <input
                className="input flex-1"
                placeholder="Bezeichnung *"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCustom()}
              />
              <button
                className="btn-primary shrink-0"
                onClick={handleCreateCustom}
                disabled={customLoading || !customName.trim()}
              >
                {customLoading
                  ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  : <Plus className="w-4 h-4" />}
                Anlegen
              </button>
            </div>
            {customError && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{customError}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex-shrink-0 bg-gray-50/80 dark:bg-slate-800 rounded-b-2xl">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {selectedIds.size > 0 ? `${selectedIds.size} Zubehör gewählt` : 'Kein Zubehör'}
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>Abbrechen</button>
            <button className="btn-primary" onClick={handleConfirm}>
              <Check className="w-4 h-4" /> Übernehmen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NewRequest() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('customer');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Online status
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── Customer state ──────────────────────────────────────────────────────────
  const [customerNumber, setCustomerNumber] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');

  // Customer creation
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ companyName: '', phone: '', email: '', street: '', zip: '', city: '' });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Site addition
  const [addingSite, setAddingSite] = useState(false);
  const [newSiteForm, setNewSiteForm] = useState({ siteName: '', street: '', zip: '', city: '', contactPerson: '', notes: '' });
  const [addSiteError, setAddSiteError] = useState('');
  const [addSiteLoading, setAddSiteLoading] = useState(false);

  // Auto-open site form when customer has no sites, prefill with customer address
  useEffect(() => {
    if (customer && customer.sites.length === 0) {
      setAddingSite(true);
      setNewSiteForm({
        siteName: 'Hauptsitz',
        street: newCustomerForm.street,
        zip: newCustomerForm.zip,
        city: newCustomerForm.city,
        contactPerson: '',
        notes: '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  // ── Machine state ────────────────────────────────────────────────────────────
  const [models, setModels] = useState<MachineModel[]>([]);
  const [machines, setMachines] = useState<MachineEntry[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [accModal, setAccModal] = useState<{ model: MachineModel; editLocalId: string | null } | null>(null);
  const [globalNotes, setGlobalNotes] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => { api.machineModels.getAll().then(setModels); }, []);

  // ── Customer handlers ────────────────────────────────────────────────────────

  const handleLookup = async () => {
    if (!customerNumber.trim()) return;
    setLookupError('');
    setCreatingCustomer(false);
    setCustomer(null);
    setSelectedSiteId('');
    setAddingSite(false);
    setLookupLoading(true);
    try {
      const c = await api.customers.lookup(customerNumber.trim());
      setCustomer(c);
      const primary = c.sites.find((s) => s.isPrimary) ?? c.sites[0];
      if (primary) setSelectedSiteId(primary.id);
    } catch {
      setLookupError('not_found');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerForm.companyName || !newCustomerForm.street || !newCustomerForm.zip || !newCustomerForm.city) {
      setCreateError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setCreateError('');
    setCreateLoading(true);
    try {
      const c = await api.customers.create({
        customerNumber: customerNumber.trim(),
        companyName: newCustomerForm.companyName,
        phone: newCustomerForm.phone || undefined,
        email: newCustomerForm.email || undefined,
        sites: [{
          siteName: 'Hauptsitz',
          street: newCustomerForm.street,
          zip: newCustomerForm.zip,
          city: newCustomerForm.city,
          country: 'Deutschland',
          isPrimary: true,
        }],
      });
      setCustomer(c);
      setSelectedSiteId(c.sites[0]?.id ?? '');
      setCreatingCustomer(false);
      setLookupError('');
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Fehler beim Anlegen.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAddSite = async () => {
    if (!customer) return;
    if (!newSiteForm.siteName.trim() || !newSiteForm.street.trim() || !newSiteForm.zip.trim() || !newSiteForm.city.trim()) {
      setAddSiteError('Standortname, Straße, PLZ und Ort sind Pflichtfelder.');
      return;
    }
    setAddSiteError('');
    setAddSiteLoading(true);
    try {
      const site = await api.customers.createSite(customer.id, {
        ...newSiteForm,
        country: 'Deutschland',
        isPrimary: customer.sites.length === 0,
      });
      const refreshed = await api.customers.lookup(customer.customerNumber);
      setCustomer(refreshed);
      setSelectedSiteId(site.id);
      setAddingSite(false);
      setNewSiteForm({ siteName: '', street: '', zip: '', city: '', contactPerson: '', notes: '' });
    } catch (e: unknown) {
      setAddSiteError(e instanceof Error ? e.message : 'Fehler beim Anlegen.');
    } finally {
      setAddSiteLoading(false);
    }
  };

  // ── Machine handlers ─────────────────────────────────────────────────────────

  const openAccModal = (model: MachineModel, editLocalId: string | null = null) => {
    setAccModal({ model, editLocalId });
  };

  const handleAccConfirm = (accs: AccSelection[]) => {
    if (!accModal) return;
    if (accModal.editLocalId) {
      setMachines((p) => p.map((m) => m.localId === accModal.editLocalId ? { ...m, accessories: accs } : m));
    } else {
      const entry: MachineEntry = {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        model: accModal.model,
        accessories: accs,
        notes: '',
      };
      setMachines((p) => [...p, entry]);
    }
    setAccModal(null);
  };

  const removeMachine = (localId: string) => {
    setMachines((p) => p.filter((m) => m.localId !== localId));
  };

  const updateMachineNotes = (localId: string, notes: string) => {
    setMachines((p) => p.map((m) => m.localId === localId ? { ...m, notes } : m));
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (asDraft: boolean) => {
    if (!customer || !selectedSiteId || machines.length === 0) return;
    setSubmitting(true);
    setSubmitError('');

    const orderPayload = {
      customerId: customer.id,
      siteId: selectedSiteId,
      machines: machines.map((m) => ({
        modelId: m.model.id,
        modelName: m.model.modelName,
        accessories: m.accessories.map((a) => ({ accessoryId: a.accessoryId, quantity: a.quantity })),
        notes: m.notes,
      })),
      globalNotes,
      asDraft,
    };

    if (!navigator.onLine) {
      enqueueOrder(orderPayload);
      navigate('/', { state: { offlineQueued: machines.length } });
      return;
    }

    try {
      const createdIds: string[] = [];
      for (const m of machines) {
        const req = await api.machineRequests.create({
          customerId: customer.id,
          customerSiteId: selectedSiteId,
          machineModelId: m.model.id,
          notes: m.notes || globalNotes || undefined,
          accessories: m.accessories.map((a) => ({ accessoryId: a.accessoryId, quantity: a.quantity })),
        });
        if (!asDraft) {
          await api.machineRequests.transition(req.id, { toStatus: 'SUBMITTED' });
        }
        createdIds.push(req.id);
      }
      navigate(createdIds.length === 1 ? `/requests/${createdIds[0]}` : '/');
    } catch (e: unknown) {
      if (!navigator.onLine) {
        enqueueOrder(orderPayload);
        navigate('/', { state: { offlineQueued: machines.length } });
      } else {
        setSubmitError(e instanceof Error ? e.message : 'Fehler beim Speichern.');
        setSubmitting(false);
      }
    }
  };

  // ── Derived state ────────────────────────────────────────────────────────────

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) =>
      m.modelName.toLowerCase().includes(q) ||
      (m.manufacturer ?? '').toLowerCase().includes(q) ||
      (m.description ?? '').toLowerCase().includes(q)
    );
  }, [models, modelSearch]);

  const stepIdx = STEPS.indexOf(step);
  const selectedSite = customer?.sites.find((s) => s.id === selectedSiteId);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-24">

      {/* AccessoryModal */}
      {accModal && (
        <AccessoryModal
          model={accModal.model}
          initialSelections={accModal.editLocalId
            ? (machines.find((m) => m.localId === accModal.editLocalId)?.accessories ?? [])
            : []}
          onConfirm={handleAccConfirm}
          onClose={() => setAccModal(null)}
        />
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium shadow">
          <WifiOff className="w-4 h-4 shrink-0" />
          Offline — Aufträge werden zwischengespeichert und übertragen sobald du wieder online bist.
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">Neue Maschinenanfrage</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Schritt {stepIdx + 1} von {STEPS.length}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                step === s
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/40'
                  : i < stepIdx
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
              }`}>
                {i < stepIdx ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs sm:text-sm font-medium hidden sm:block ${step === s ? 'text-gray-900 dark:text-slate-100' : 'text-gray-400 dark:text-slate-500'}`}>
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700 mx-2 sm:mx-3" />}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1: Kunde & Standort
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'customer' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Kundennummer</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="z.B. K-10001"
                  value={customerNumber}
                  onChange={(e) => { setCustomerNumber(e.target.value); setCustomer(null); setLookupError(''); setCreatingCustomer(false); setSelectedSiteId(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  autoFocus
                />
                <button className="btn-primary whitespace-nowrap" onClick={handleLookup} disabled={lookupLoading || !customerNumber.trim()}>
                  {lookupLoading
                    ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    : <Search className="w-4 h-4" />}
                  Suchen
                </button>
              </div>

              {/* Not found */}
              {lookupError === 'not_found' && !creatingCustomer && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-xl flex items-start justify-between gap-3">
                  <p className="text-sm text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Kunde <span className="font-mono font-semibold">{customerNumber}</span> nicht gefunden.
                  </p>
                  <button className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap shrink-0" onClick={() => setCreatingCustomer(true)}>
                    <UserPlus className="w-3.5 h-3.5" /> Neu anlegen
                  </button>
                </div>
              )}

              {/* Create customer form */}
              {creatingCustomer && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl space-y-3">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                    Neuen Kunden anlegen — Nr. <span className="font-mono">{customerNumber}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="label">Firmenname *</label>
                      <input className="input" placeholder="Muster GmbH" value={newCustomerForm.companyName}
                        onChange={(e) => setNewCustomerForm((p) => ({ ...p, companyName: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Telefon</label>
                      <input className="input" placeholder="+49 211 …" value={newCustomerForm.phone}
                        onChange={(e) => setNewCustomerForm((p) => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">E-Mail</label>
                      <input className="input" type="email" value={newCustomerForm.email}
                        onChange={(e) => setNewCustomerForm((p) => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="col-span-2 pt-1 border-t border-blue-100 dark:border-blue-800">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> Hauptsitz-Adresse *</p>
                    </div>
                    <div className="col-span-2">
                      <label className="label">Straße & Hausnummer *</label>
                      <input className="input" placeholder="Musterstraße 1" value={newCustomerForm.street}
                        onChange={(e) => setNewCustomerForm((p) => ({ ...p, street: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">PLZ *</label>
                      <input className="input" placeholder="40213" value={newCustomerForm.zip}
                        onChange={(e) => setNewCustomerForm((p) => ({ ...p, zip: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Stadt *</label>
                      <input className="input" placeholder="Düsseldorf" value={newCustomerForm.city}
                        onChange={(e) => setNewCustomerForm((p) => ({ ...p, city: e.target.value }))} />
                    </div>
                  </div>
                  {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button className="btn-secondary" onClick={() => setCreatingCustomer(false)}>Abbrechen</button>
                    <button className="btn-primary" onClick={handleCreateCustomer} disabled={createLoading}>
                      {createLoading ? 'Speichere…' : 'Kunden anlegen'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Found customer */}
          {customer && (
            <>
              {/* Customer info */}
              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-900 dark:text-green-300">{customer.companyName}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">{customer.customerNumber}</p>
                  {customer.phone && <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">{customer.phone}</p>}
                </div>
              </div>

              {/* Sites */}
              <div className="card">
                <div className="card-header flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-brand-500" />
                    Lieferstandort
                  </h2>
                  {customer.sites.length > 0 && !addingSite && (
                    <button className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                      onClick={() => { setAddingSite(true); setNewSiteForm({ siteName: '', street: '', zip: '', city: '', contactPerson: '', notes: '' }); }}>
                      <Plus className="w-3 h-3" /> Weiterer Standort
                    </button>
                  )}
                </div>
                <div className="card-body space-y-3">

                  {/* No sites message */}
                  {customer.sites.length === 0 && !addingSite && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-300">Noch kein Standort angelegt. Bitte einen Standort hinzufügen.</p>
                    </div>
                  )}

                  {/* Site cards */}
                  {customer.sites.map((site) => (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => setSelectedSiteId(site.id)}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                        selectedSiteId === site.id
                          ? 'border-brand-500 dark:border-brand-400 bg-brand-50 dark:bg-brand-600/15'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700/30 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{site.siteName}</span>
                            {site.isPrimary && <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full">Hauptstandort</span>}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{site.street}, {site.zip} {site.city}</p>
                          {site.contactPerson && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Ansprechpartner: {site.contactPerson}</p>}
                          {site.notes && <p className="text-xs text-gray-400 dark:text-slate-500 italic mt-0.5 line-clamp-1">{site.notes}</p>}
                        </div>
                        {selectedSiteId === site.id && <CheckCircle className="w-5 h-5 text-brand-500 dark:text-brand-400 shrink-0 mt-0.5" />}
                      </div>
                    </button>
                  ))}

                  {/* Add site form */}
                  {addingSite && (
                    <div className="p-4 bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-600 rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                        {customer.sites.length === 0 ? 'Ersten Standort anlegen' : 'Neuen Standort anlegen'}
                      </p>
                      <input className="input text-sm" placeholder="Standortname * (z.B. Hauptsitz, Filiale Nord)" value={newSiteForm.siteName}
                        onChange={(e) => setNewSiteForm((p) => ({ ...p, siteName: e.target.value }))} />
                      <input className="input text-sm" placeholder="Straße & Hausnummer *" value={newSiteForm.street}
                        onChange={(e) => setNewSiteForm((p) => ({ ...p, street: e.target.value }))} />
                      <div className="flex gap-2">
                        <input className="input text-sm w-24 shrink-0" placeholder="PLZ *" value={newSiteForm.zip}
                          onChange={(e) => setNewSiteForm((p) => ({ ...p, zip: e.target.value }))} />
                        <input className="input text-sm flex-1" placeholder="Ort *" value={newSiteForm.city}
                          onChange={(e) => setNewSiteForm((p) => ({ ...p, city: e.target.value }))} />
                      </div>
                      <input className="input text-sm" placeholder="Ansprechpartner" value={newSiteForm.contactPerson}
                        onChange={(e) => setNewSiteForm((p) => ({ ...p, contactPerson: e.target.value }))} />
                      <textarea className="input text-sm" rows={2} placeholder="Notizen (Anfahrt, Öffnungszeiten …)" value={newSiteForm.notes}
                        onChange={(e) => setNewSiteForm((p) => ({ ...p, notes: e.target.value }))} />
                      {addSiteError && <p className="text-xs text-red-600 dark:text-red-400">{addSiteError}</p>}
                      <div className="flex gap-2 justify-end">
                        {customer.sites.length > 0 && (
                          <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => { setAddingSite(false); setAddSiteError(''); }}>Abbrechen</button>
                        )}
                        <button className="btn-primary text-xs py-1.5 px-3" onClick={handleAddSite} disabled={addSiteLoading}>
                          {addSiteLoading ? 'Speichere…' : 'Standort anlegen'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button className="btn-primary" onClick={() => setStep('machines')} disabled={!selectedSiteId}>
                  Weiter →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2: Maschinen
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'machines' && (
        <div className="space-y-5">
          {/* Machine picker */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Maschine auswählen</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Klicke auf eine Maschine um sie hinzuzufügen und Zubehör auszuwählen.</p>
            </div>
            <div className="card-body space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input className="input pl-9" placeholder="Modell oder Hersteller suchen…" value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} />
              </div>

              {filteredModels.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-slate-500 italic py-4 text-center">Keine Modelle gefunden.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredModels.map((m) => {
                    const addedCount = machines.filter((e) => e.model.id === m.id).length;
                    return (
                      <div
                        key={m.id}
                        onClick={() => openAccModal(m)}
                        className="relative cursor-pointer rounded-xl border-2 border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-700/40 hover:border-brand-300 dark:hover:border-brand-500 hover:shadow-md dark:hover:shadow-slate-900/40 p-3 transition-all select-none group"
                      >
                        {addedCount > 0 && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center z-10">
                            <span className="text-xs font-bold text-white leading-none">{addedCount}</span>
                          </div>
                        )}
                        {m.manufacturerLogoPath && (
                          <img src={m.manufacturerLogoPath} alt="" className="absolute top-2 left-2 h-4 object-contain max-w-[50px] opacity-50 dark:opacity-30" />
                        )}
                        <div className="flex items-center justify-center h-20 mb-2 mt-1">
                          {m.imagePath
                            ? <img src={m.imagePath} alt={m.modelName} className="max-h-20 max-w-full object-contain" />
                            : <div className="w-12 h-12 bg-gray-100 dark:bg-slate-600 rounded-xl flex items-center justify-center"><Cpu className="w-6 h-6 text-gray-300 dark:text-slate-500" /></div>}
                        </div>
                        {m.manufacturer && <p className="text-xs text-gray-400 dark:text-slate-500 text-center mb-0.5">{m.manufacturer}</p>}
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 text-center leading-tight">{m.modelName}</p>
                        <p className="text-xs text-brand-500 dark:text-brand-400 text-center mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          + Hinzufügen
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Added machines */}
          {machines.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                  Hinzugefügte Maschinen
                  <span className="ml-2 text-xs font-normal text-gray-400 dark:text-slate-500">({machines.length})</span>
                </h2>
              </div>
              <div className="card-body space-y-3">
                {machines.map((entry, idx) => (
                  <div key={entry.localId} className="p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/30 space-y-2">
                    <div className="flex items-start gap-3">
                      {/* Image */}
                      <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 flex items-center justify-center shrink-0 p-1">
                        {entry.model.imagePath
                          ? <img src={entry.model.imagePath} alt="" className="w-full h-full object-contain" />
                          : <Cpu className="w-6 h-6 text-gray-300 dark:text-slate-500" />}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">#{idx + 1}</span>
                          {entry.model.manufacturer && <span className="text-xs text-gray-400 dark:text-slate-500">{entry.model.manufacturer}</span>}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{entry.model.modelName}</p>
                        {entry.accessories.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.accessories.map((a) => (
                              <span key={a.accessoryId} className="text-xs bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-slate-300 px-1.5 py-0.5 rounded-md">
                                {a.code ? <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{a.code} </span> : null}
                                {a.name}{a.quantity > 1 ? ` ×${a.quantity}` : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-slate-500 italic mt-0.5">Kein Zubehör</p>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          className="text-gray-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15 transition-colors"
                          onClick={() => openAccModal(entry.model, entry.localId)}
                          title="Zubehör bearbeiten"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="text-gray-400 dark:text-slate-500 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          onClick={() => removeMachine(entry.localId)}
                          title="Entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* Per-machine notes */}
                    <input
                      className="input text-sm"
                      placeholder={`Notizen für Maschine #${idx + 1} (optional)`}
                      value={entry.notes}
                      onChange={(e) => updateMachineNotes(entry.localId, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep('customer')}>← Zurück</button>
            <button className="btn-primary" onClick={() => setStep('confirm')} disabled={machines.length === 0}>
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 3: Bestätigung
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Zusammenfassung</h2>
            </div>
            <div className="card-body space-y-5">
              {/* Customer & Site */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Kunde</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{customer?.companyName}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{customer?.customerNumber}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Lieferstandort</p>
                  {selectedSite && (
                    <>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{selectedSite.siteName}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{selectedSite.street}, {selectedSite.zip} {selectedSite.city}</p>
                      {selectedSite.contactPerson && <p className="text-xs text-gray-400 dark:text-slate-500">Ansprechpartner: {selectedSite.contactPerson}</p>}
                    </>
                  )}
                </div>
              </div>

              {/* Machines */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Maschinen ({machines.length})
                </p>
                <div className="space-y-2">
                  {machines.map((entry, idx) => (
                    <div key={entry.localId} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border border-gray-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">#{idx + 1}</span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{entry.model.modelName}</p>
                        {entry.model.manufacturer && <p className="text-xs text-gray-400 dark:text-slate-500">({entry.model.manufacturer})</p>}
                      </div>
                      {entry.accessories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.accessories.map((a) => (
                            <span key={a.accessoryId} className="text-xs bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                              {a.code && <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{a.code} </span>}
                              {a.name}{a.quantity > 1 ? ` ×${a.quantity}` : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-slate-500 italic">Kein Zubehör</p>
                      )}
                      {entry.notes && <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5 italic">{entry.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Global notes */}
              <div>
                <label className="label">Allgemeine Notizen (optional)</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Optionale Hinweise zum gesamten Auftrag…"
                  value={globalNotes}
                  onChange={(e) => setGlobalNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {!isOnline && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-xl text-sm text-amber-800 dark:text-amber-400">
              <WifiOff className="w-4 h-4 shrink-0" />
              Du bist offline. Der Auftrag wird lokal gespeichert und automatisch übertragen sobald du wieder online bist.
            </div>
          )}

          {submitError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400">{submitError}</div>
          )}

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep('machines')}>← Zurück</button>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => handleSubmit(true)} disabled={submitting}>
                Als Entwurf
              </button>
              <button className="btn-primary" onClick={() => handleSubmit(false)} disabled={submitting}>
                {submitting
                  ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  : null}
                {isOnline ? 'Einreichen' : 'Speichern & senden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
