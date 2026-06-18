import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle, AlertCircle, ArrowLeft, Plus, Minus, UserPlus } from 'lucide-react';
import { api, Customer, MachineModel, Accessory, CustomerSite } from '../api/client';

interface AccessorySelection {
  accessoryId: string;
  name: string;
  hasSerialNumber: boolean;
  quantity: number;
  selected: boolean;
}

type Step = 'customer' | 'machine' | 'confirm';

export default function NewRequest() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('customer');

  // Customer lookup
  const [customerNumber, setCustomerNumber] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [editedSite, setEditedSite] = useState<Partial<CustomerSite>>({});
  const [editingAddress, setEditingAddress] = useState(false);

  // Inline customer creation
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    companyName: '', phone: '', email: '',
    street: '', zip: '', city: '',
  });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Machine & accessories
  const [models, setModels] = useState<MachineModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [accessorySelections, setAccessorySelections] = useState<AccessorySelection[]>([]);
  const [notes, setNotes] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.machineModels.getAll().then(setModels);
  }, []);

  // Update accessory list whenever selected model changes
  useEffect(() => {
    if (!selectedModelId) {
      setAccessorySelections([]);
      return;
    }
    const model = models.find((m) => m.id === selectedModelId);
    const accs: Accessory[] = model?.compatibleAccessories ?? [];
    setAccessorySelections(
      accs.map((a) => ({ accessoryId: a.id, name: a.name, hasSerialNumber: a.hasSerialNumber, quantity: 1, selected: false }))
    );
  }, [selectedModelId, models]);

  const handleLookup = async () => {
    if (!customerNumber.trim()) return;
    setLookupError('');
    setCreatingCustomer(false);
    setLookupLoading(true);
    try {
      const c = await api.customers.lookup(customerNumber.trim());
      setCustomer(c);
      const primary = c.sites.find((s) => s.isPrimary) || c.sites[0];
      if (primary) { setSelectedSiteId(primary.id); setEditedSite({ ...primary }); }
    } catch {
      setLookupError('Kundennummer nicht gefunden.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.companyName || !newCustomer.street || !newCustomer.zip || !newCustomer.city) {
      setCreateError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setCreateError('');
    setCreateLoading(true);
    try {
      const c = await api.customers.create({
        customerNumber: customerNumber.trim(),
        companyName: newCustomer.companyName,
        phone: newCustomer.phone || undefined,
        email: newCustomer.email || undefined,
        sites: [{
          siteName: 'Hauptsitz',
          street: newCustomer.street,
          zip: newCustomer.zip,
          city: newCustomer.city,
          country: 'Deutschland',
          isPrimary: true,
        }],
      });
      setCustomer(c);
      setSelectedSiteId(c.sites[0].id);
      setEditedSite({ ...c.sites[0] });
      setCreatingCustomer(false);
      setLookupError('');
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Fehler beim Anlegen.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSiteSelect = (siteId: string) => {
    setSelectedSiteId(siteId);
    const site = customer?.sites.find((s) => s.id === siteId);
    if (site) setEditedSite({ ...site });
    setEditingAddress(false);
  };

  const toggleAccessory = (idx: number) => {
    setAccessorySelections((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, selected: !a.selected } : a))
    );
  };

  const changeQty = (idx: number, delta: number) => {
    setAccessorySelections((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, quantity: Math.max(1, a.quantity + delta) } : a))
    );
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!customer || !selectedSiteId || !selectedModelId) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const siteId =
        editingAddress && editedSite.id
          ? (await api.customers.updateSite(editedSite.id, editedSite)).id
          : selectedSiteId;

      const req = await api.machineRequests.create({
        customerId: customer.id,
        customerSiteId: siteId,
        machineModelId: selectedModelId,
        notes,
        accessories: accessorySelections
          .filter((a) => a.selected)
          .map((a) => ({ accessoryId: a.accessoryId, quantity: a.quantity })),
      });

      if (!asDraft) {
        await api.machineRequests.transition(req.id, { toStatus: 'SUBMITTED' });
      }

      navigate(`/requests/${req.id}`);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Speichern.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedModel = models.find((m) => m.id === selectedModelId);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Neue Maschinenanfrage</h1>
          <p className="text-sm text-gray-500">
            Schritt {step === 'customer' ? 1 : step === 'machine' ? 2 : 3} von 3
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['customer', 'machine', 'confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step === s
                  ? 'bg-brand-600 text-white'
                  : i < (['customer', 'machine', 'confirm'] as Step[]).indexOf(step)
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < (['customer', 'machine', 'confirm'] as Step[]).indexOf(step) ? '✓' : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:block ${step === s ? 'text-gray-900' : 'text-gray-400'}`}>
              {s === 'customer' ? 'Kunde' : s === 'machine' ? 'Maschine' : 'Bestätigung'}
            </span>
            {i < 2 && <div className="w-8 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Customer ─────────────────────────────────────────────── */}
      {step === 'customer' && (
        <div className="card space-y-0">
          <div className="card-header">
            <h2 className="text-base font-semibold text-gray-900">Kundendaten</h2>
          </div>
          <div className="card-body space-y-4">
            {/* Lookup */}
            <div>
              <label className="label">Kundennummer</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="z.B. K-10001"
                  value={customerNumber}
                  onChange={(e) => { setCustomerNumber(e.target.value); setCustomer(null); setLookupError(''); setCreatingCustomer(false); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                />
                <button onClick={handleLookup} disabled={lookupLoading} className="btn-primary px-5 whitespace-nowrap">
                  {lookupLoading
                    ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    : <Search className="w-4 h-4" />}
                  Suchen
                </button>
              </div>

              {/* Not found → offer to create */}
              {lookupError && !creatingCustomer && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start justify-between gap-3">
                  <p className="text-sm text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Kunde <span className="font-mono font-semibold">{customerNumber}</span> nicht gefunden.
                  </p>
                  <button
                    className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap flex items-center gap-1"
                    onClick={() => setCreatingCustomer(true)}
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Neu anlegen
                  </button>
                </div>
              )}
            </div>

            {/* Inline customer creation form */}
            {creatingCustomer && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                <p className="text-sm font-semibold text-blue-900">
                  Neuen Kunden anlegen — Nr. <span className="font-mono">{customerNumber}</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Firmenname *</label>
                    <input className="input" placeholder="Muster GmbH" value={newCustomer.companyName}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, companyName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Telefon</label>
                    <input className="input" placeholder="+49 211 …" value={newCustomer.phone}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">E-Mail</label>
                    <input className="input" type="email" value={newCustomer.email}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Straße & Hausnummer * (Hauptsitz)</label>
                    <input className="input" placeholder="Musterstraße 1" value={newCustomer.street}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, street: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">PLZ *</label>
                    <input className="input" placeholder="40213" value={newCustomer.zip}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, zip: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Stadt *</label>
                    <input className="input" placeholder="Düsseldorf" value={newCustomer.city}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, city: e.target.value }))} />
                  </div>
                </div>
                {createError && <p className="text-sm text-red-600">{createError}</p>}
                <div className="flex gap-2 justify-end">
                  <button className="btn-secondary" onClick={() => setCreatingCustomer(false)}>Abbrechen</button>
                  <button className="btn-primary" onClick={handleCreateCustomer} disabled={createLoading}>
                    {createLoading ? 'Speichere…' : 'Kunden anlegen'}
                  </button>
                </div>
              </div>
            )}

            {/* Found customer */}
            {customer && (
              <>
                <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-900">{customer.companyName}</p>
                      <p className="text-xs text-green-600">{customer.customerNumber}</p>
                      {customer.phone && <p className="text-xs text-green-600 mt-0.5">{customer.phone}</p>}
                    </div>
                  </div>
                </div>

                {customer.sites.length > 1 && (
                  <div>
                    <label className="label">Lieferstandort</label>
                    <select className="input" value={selectedSiteId} onChange={(e) => handleSiteSelect(e.target.value)}>
                      {customer.sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.siteName} – {site.city} {site.isPrimary ? '(Hauptsitz)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-sm font-semibold text-amber-900 mb-2">Ist die Lieferadresse noch aktuell?</p>
                  {!editingAddress ? (
                    <>
                      <p className="text-sm text-amber-800">
                        {editedSite.street}, {editedSite.zip} {editedSite.city}, {editedSite.country}
                      </p>
                      <button className="mt-2 text-xs text-amber-700 underline hover:no-underline" onClick={() => setEditingAddress(true)}>
                        Adresse bearbeiten
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <input className="input text-sm" placeholder="Straße & Hausnummer" value={editedSite.street || ''}
                        onChange={(e) => setEditedSite((p) => ({ ...p, street: e.target.value }))} />
                      <div className="flex gap-2">
                        <input className="input text-sm w-24" placeholder="PLZ" value={editedSite.zip || ''}
                          onChange={(e) => setEditedSite((p) => ({ ...p, zip: e.target.value }))} />
                        <input className="input text-sm flex-1" placeholder="Stadt" value={editedSite.city || ''}
                          onChange={(e) => setEditedSite((p) => ({ ...p, city: e.target.value }))} />
                      </div>
                      <button className="text-xs text-amber-700 underline hover:no-underline" onClick={() => setEditingAddress(false)}>
                        Abbrechen
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button className="btn-primary" onClick={() => setStep('machine')} disabled={!selectedSiteId}>
                    Weiter →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Machine & Accessories ──────────────────────────────── */}
      {step === 'machine' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <h2 className="text-base font-semibold text-gray-900">Maschinenmodell</h2>
            </div>
            <div className="card-body">
              <select className="input" value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)}>
                <option value="">Modell auswählen…</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.modelName}</option>
                ))}
              </select>
              {selectedModel?.description && (
                <p className="mt-2 text-sm text-gray-500">{selectedModel.description}</p>
              )}
            </div>
          </div>

          {selectedModelId && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-base font-semibold text-gray-900">Zubehör</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Nur kompatibles Zubehör für <span className="font-medium">{selectedModel?.modelName}</span>
                </p>
              </div>
              <div className="card-body space-y-2">
                {accessorySelections.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    Für dieses Modell ist kein Zubehör hinterlegt.
                  </p>
                ) : (
                  accessorySelections.map((acc, idx) => (
                    <div
                      key={acc.accessoryId}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        acc.selected ? 'bg-brand-50 border-brand-200' : 'bg-white border-gray-100 hover:border-gray-200'
                      }`}
                      onClick={() => toggleAccessory(idx)}
                    >
                      <input
                        type="checkbox"
                        checked={acc.selected}
                        onChange={() => toggleAccessory(idx)}
                        className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="flex-1 text-sm text-gray-800">{acc.name}</span>
                      {acc.hasSerialNumber && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">S/N erforderlich</span>
                      )}
                      {acc.selected && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => changeQty(idx, -1)}
                            className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{acc.quantity}</span>
                          <button onClick={() => changeQty(idx, 1)}
                            className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h2 className="text-base font-semibold text-gray-900">Notizen</h2>
            </div>
            <div className="card-body">
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Optionale Hinweise oder Anmerkungen…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep('customer')}>← Zurück</button>
            <button className="btn-primary" onClick={() => setStep('confirm')} disabled={!selectedModelId}>
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm ─────────────────────────────────────────────── */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <h2 className="text-base font-semibold text-gray-900">Zusammenfassung</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Kunde</p>
                  <p className="text-sm font-semibold text-gray-900">{customer?.companyName}</p>
                  <p className="text-xs text-gray-500">{customer?.customerNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Lieferort</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {editedSite.siteName || customer?.sites.find((s) => s.id === selectedSiteId)?.siteName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {editedSite.street}, {editedSite.zip} {editedSite.city}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Maschinenmodell</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedModel?.modelName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Zubehör</p>
                  {accessorySelections.filter((a) => a.selected).length === 0 ? (
                    <p className="text-sm text-gray-400">Kein Zubehör</p>
                  ) : (
                    accessorySelections.filter((a) => a.selected).map((a) => (
                      <p key={a.accessoryId} className="text-sm text-gray-900">{a.name} × {a.quantity}</p>
                    ))
                  )}
                </div>
              </div>
              {notes && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notizen</p>
                  <p className="text-sm text-gray-700">{notes}</p>
                </div>
              )}
            </div>
          </div>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{submitError}</div>
          )}

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep('machine')}>← Zurück</button>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => handleSubmit(true)} disabled={submitting}>
                Als Entwurf speichern
              </button>
              <button className="btn-primary" onClick={() => handleSubmit(false)} disabled={submitting}>
                {submitting ? 'Speichere…' : 'Einreichen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
