import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, Clock, Package, Wrench, AlertTriangle,
  ChevronRight, ExternalLink, Trash2,
} from 'lucide-react';
import { api, MachineRequest, RequestStatus, RequestAccessory } from '../api/client';
import { StatusBadge, STATUS_LABELS } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { enqueueTransition } from '../services/offline';

function Timeline({ request }: { request: MachineRequest }) {
  const logs = request.statusLogs || [];
  return (
    <div className="space-y-3">
      {logs.map((log, i) => (
        <div key={log.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-brand-50 border-2 border-brand-200 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-brand-600" />
            </div>
            {i < logs.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
          </div>
          <div className="pb-3 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={log.toStatus} size="sm" />
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(log.changedAt).toLocaleString('de-DE', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              von <span className="font-medium">{log.changedBy.name}</span>
            </p>
            {log.comment && (
              <p className="text-xs text-gray-500 mt-1 italic">„{log.comment}"</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ActionPanelProps {
  request: MachineRequest;
  onUpdate: (updated: MachineRequest) => void;
}

function ActionPanel({ request, onUpdate }: ActionPanelProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [serialNumber, setSerialNumber] = useState(request.machineSerialNumber || '');
  const [accSerials, setAccSerials] = useState<Record<string, string>>(
    Object.fromEntries(request.accessories.map((a) => [a.id, a.serialNumber || '']))
  );

  // Sort order for barcode scanning: MR → KD → MY → rest
  const CODE_ORDER: Record<string, number> = { MR: 0, KD: 1, MY: 2 };
  const sortedAccessories = [...request.accessories].sort((a, b) => {
    const pa = CODE_ORDER[(a.accessory.code ?? '').split('-')[0].toUpperCase()] ?? 10;
    const pb = CODE_ORDER[(b.accessory.code ?? '').split('-')[0].toUpperCase()] ?? 10;
    return pa - pb;
  });
  const snItems = sortedAccessories.filter((a) => a.accessory.hasSerialNumber);
  const noSnItems = sortedAccessories.filter((a) => !a.accessory.hasSerialNumber);

  const [confirmed, setConfirmed] = useState<Record<string, boolean>>(
    Object.fromEntries(request.accessories.filter((a) => !a.accessory.hasSerialNumber).map((a) => [a.id, false]))
  );
  const snRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const machineSnRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const transition = async (toStatus: RequestStatus, extra?: Record<string, unknown>) => {
    setLoading(true);
    setError('');
    try {
      const updated = await api.machineRequests.transition(request.id, {
        toStatus,
        comment: comment || undefined,
        ...extra,
      });
      onUpdate(updated);
      setComment('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    } finally {
      setLoading(false);
    }
  };

  const allSnFilled = !!serialNumber.trim() && snItems.every((a) => accSerials[a.id]?.trim());
  const allConfirmed = noSnItems.every((a) => confirmed[a.id]);
  const canSubmitWarehouse = allSnFilled && allConfirmed;

  // SALES: can submit a DRAFT
  if (request.status === 'DRAFT' && (user.role === 'SALES' || user.role === 'ADMIN')) {
    return (
      <div className="space-y-3">
        <textarea
          className="input resize-none"
          rows={2}
          placeholder="Kommentar (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="btn-primary w-full justify-center"
          onClick={() => transition('SUBMITTED')}
          disabled={loading}
        >
          Anfrage einreichen
        </button>
      </div>
    );
  }

  // MANAGEMENT: can approve SUBMITTED
  if (request.status === 'SUBMITTED' && (user.role === 'MANAGEMENT' || user.role === 'ADMIN')) {
    return (
      <div className="space-y-3">
        <textarea
          className="input resize-none"
          rows={2}
          placeholder="Kommentar (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="btn-primary w-full justify-center"
          onClick={() => transition('IN_WAREHOUSE')}
          disabled={loading}
        >
          Genehmigen → Ins Lager
        </button>
      </div>
    );
  }

  // WAREHOUSE: scan SNs and confirm non-SN accessories → UNPACKING
  if (request.status === 'IN_WAREHOUSE' && (user.role === 'WAREHOUSE' || user.role === 'ADMIN')) {
    const focusNext = (currentId: string) => {
      const ids = snItems.map((a) => a.id);
      const idx = ids.indexOf(currentId);
      if (idx >= 0 && idx < ids.length - 1) snRefs.current[ids[idx + 1]]?.focus();
    };

    const doneCount = snItems.filter((a) => accSerials[a.id]?.trim()).length + noSnItems.filter((a) => confirmed[a.id]).length;
    const totalCount = snItems.length + noSnItems.length;

    return (
      <div className="space-y-3">
        {/* Progress */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Fortschritt</span>
          <span className="font-semibold">{doneCount + (serialNumber.trim() ? 1 : 0)} / {totalCount + 1}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
          <div
            className="bg-brand-500 h-1.5 rounded-full transition-all"
            style={{ width: `${Math.round(((doneCount + (serialNumber.trim() ? 1 : 0)) / (totalCount + 1)) * 100)}%` }}
          />
        </div>

        {/* Machine SN */}
        <div className={`p-3 rounded-xl border-2 transition-colors ${serialNumber.trim() ? 'border-green-300 bg-green-50' : 'border-brand-300 bg-brand-50'}`}>
          <label className="label text-xs font-semibold text-gray-700 mb-1">
            Maschine — {request.machineModel.modelName} *
          </label>
          <input
            ref={machineSnRef}
            autoFocus
            className="input font-mono"
            placeholder="Maschinen-Barcode scannen…"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && snItems[0]) snRefs.current[snItems[0].id]?.focus(); }}
          />
          {serialNumber.trim() && (
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <CheckCircle className="w-3 h-3" /> Gescannt
            </p>
          )}
        </div>

        {/* SN-required accessories */}
        {snItems.map((acc, idx) => {
          const filled = !!accSerials[acc.id]?.trim();
          return (
            <div key={acc.id} className={`p-3 rounded-xl border-2 transition-colors ${filled ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
              <label className="label text-xs font-semibold text-gray-700 mb-1">
                {acc.accessory.code && (
                  <span className="font-mono bg-gray-200 text-gray-700 px-1 py-0.5 rounded mr-1.5 text-xs">{acc.accessory.code}</span>
                )}
                {acc.accessory.name} *
              </label>
              <input
                ref={(el) => { snRefs.current[acc.id] = el; }}
                className="input font-mono"
                placeholder="Barcode scannen…"
                value={accSerials[acc.id] || ''}
                onChange={(e) => setAccSerials((p) => ({ ...p, [acc.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') focusNext(acc.id); }}
              />
              {filled && (
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3" /> Gescannt
                </p>
              )}
            </div>
          );
        })}

        {/* Non-SN accessories — confirm with checkbox */}
        {noSnItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">Kein Barcode — bitte bestätigen</p>
            {noSnItems.map((acc) => (
              <label
                key={acc.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                  confirmed[acc.id] ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={confirmed[acc.id] || false}
                  onChange={(e) => setConfirmed((p) => ({ ...p, [acc.id]: e.target.checked }))}
                  className="w-5 h-5 text-green-600 rounded border-gray-300 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  {acc.accessory.code && (
                    <span className="font-mono bg-gray-200 text-gray-700 px-1 py-0.5 rounded mr-1.5 text-xs">{acc.accessory.code}</span>
                  )}
                  <span className="text-sm text-gray-800">{acc.accessory.name}</span>
                  <span className="text-xs text-gray-400 ml-1.5">× {acc.quantity}</span>
                </div>
                {confirmed[acc.id] && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
              </label>
            ))}
          </div>
        )}

        <textarea
          className="input resize-none mt-2"
          rows={2}
          placeholder="Kommentar (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="btn-primary w-full justify-center"
          disabled={loading || !canSubmitWarehouse}
          onClick={async () => {
            if (!navigator.onLine) {
              enqueueTransition({
                requestId: request.id,
                toStatus: 'UNPACKING',
                machineSerialNumber: serialNumber,
                accessories: snItems.map((a) => ({ id: a.id, serialNumber: accSerials[a.id] })),
              });
              return;
            }
            transition('UNPACKING', {
              machineSerialNumber: serialNumber,
              accessories: snItems.map((a) => ({ id: a.id, serialNumber: accSerials[a.id] })),
            });
          }}
        >
          <Package className="w-4 h-4" />
          Auspacken beginnen
        </button>
        {!canSubmitWarehouse && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {!allSnFilled ? 'Alle Seriennummern scannen' : 'Alle Artikel bestätigen'}, um fortzufahren.
          </p>
        )}
      </div>
    );
  }

  // TECHNICIAN: take UNPACKING → CONFIGURING
  if (request.status === 'UNPACKING' && (user.role === 'TECHNICIAN' || user.role === 'ADMIN')) {
    return (
      <div className="space-y-3">
        <textarea
          className="input resize-none"
          rows={2}
          placeholder="Kommentar (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="btn-primary w-full justify-center"
          onClick={() => transition('CONFIGURING')}
          disabled={loading}
        >
          <Wrench className="w-4 h-4" />
          Konfiguration beginnen
        </button>
      </div>
    );
  }

  // TECHNICIAN: finish CONFIGURING → DONE
  if (request.status === 'CONFIGURING' && (user.role === 'TECHNICIAN' || user.role === 'ADMIN')) {
    return (
      <div className="space-y-3">
        <textarea
          className="input resize-none"
          rows={2}
          placeholder="Kommentar (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="btn-primary w-full justify-center"
          onClick={() => transition('DONE')}
          disabled={loading}
        >
          <CheckCircle className="w-4 h-4" />
          Als fertig markieren
        </button>
      </div>
    );
  }

  // DONE
  if (request.status === 'DONE') {
    return (
      <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Lieferschein erstellen</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Lieferschein bitte im externen System erstellen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [request, setRequest] = useState<MachineRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api.machineRequests.getById(id);
      setRequest(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!request) return;
    setDeleting(true);
    try {
      await api.machineRequests.delete(request.id);
      navigate('/');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600">{error || 'Anfrage nicht gefunden.'}</div>
      </div>
    );
  }

  const canDelete = user && (user.role === 'ADMIN' || (request.status === 'DRAFT' && request.salesRep.id === user.id));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <p className="text-sm font-semibold text-gray-900 mb-1">Auftrag löschen?</p>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-mono font-bold text-brand-600">{request.requestNumber}</span> wird unwiderruflich gelöscht.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>Abbrechen</button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Lösche…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg">
              {request.requestNumber}
            </span>
            <StatusBadge status={request.status} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{request.customer.companyName}</h1>
          <p className="text-sm text-gray-500">{request.machineModel.modelName}</p>
        </div>
        <div className="flex items-start gap-3">
          {canDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-400 hover:text-red-500 transition-colors p-1 mt-0.5"
              title="Auftrag löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <div className="text-right text-xs text-gray-400">
            <p>Erstellt {new Date(request.createdAt).toLocaleDateString('de-DE')}</p>
            <p>von {request.salesRep.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer & Site */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Lieferadresse</h2>
            </div>
            <div className="card-body grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Kunde</p>
                <p className="text-sm font-semibold text-gray-900">{request.customer.companyName}</p>
                <p className="text-xs text-gray-500">{request.customer.customerNumber}</p>
                {request.customer.phone && <p className="text-xs text-gray-500 mt-0.5">{request.customer.phone}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Standort</p>
                <p className="text-sm font-semibold text-gray-900">{request.customerSite.siteName}</p>
                <p className="text-xs text-gray-500">{request.customerSite.street}</p>
                <p className="text-xs text-gray-500">
                  {request.customerSite.zip} {request.customerSite.city}
                </p>
              </div>
            </div>
          </div>

          {/* Machine */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-gray-900">Maschine</h2>
            </div>
            <div className="card-body grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Modell</p>
                <p className="text-sm font-semibold text-gray-900">{request.machineModel.modelName}</p>
                {request.machineModel.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{request.machineModel.description}</p>
                )}
              </div>
              {request.machineSerialNumber && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Seriennummer</p>
                  <p className="text-sm font-mono font-semibold text-gray-900">{request.machineSerialNumber}</p>
                </div>
              )}
            </div>
          </div>

          {/* Accessories */}
          {request.accessories.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-gray-900">Zubehör</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {request.accessories.map((acc: RequestAccessory) => (
                  <div key={acc.id} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                      {acc.accessory.imagePath && (
                        <img src={acc.accessory.imagePath} alt="" className="w-10 h-10 object-contain rounded flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {acc.accessory.code && <span className="font-mono text-xs text-gray-400 mr-1.5">{acc.accessory.code}</span>}
                          {acc.accessory.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">× {acc.quantity}</span>
                          {acc.accessory.hasSerialNumber && (
                            <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">S/N</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {acc.serialNumber && (
                      <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">
                        {acc.serialNumber}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {request.notes && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-gray-900">Notizen</h2>
              </div>
              <div className="card-body">
                <p className="text-sm text-gray-700">{request.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Action panel */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-gray-900">Aktionen</h2>
            </div>
            <div className="card-body">
              <ActionPanel request={request} onUpdate={setRequest} />
            </div>
          </div>

          {/* Status pipeline */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-gray-900">Statusverlauf</h2>
            </div>
            <div className="card-body">
              <Timeline request={request} />
            </div>
          </div>

          {/* Status pipeline visual */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-gray-900">Pipeline</h2>
            </div>
            <div className="card-body space-y-1.5">
              {(['DRAFT', 'SUBMITTED', 'IN_WAREHOUSE', 'UNPACKING', 'CONFIGURING', 'DONE'] as RequestStatus[]).map((s, i, arr) => {
                const current = s === request.status;
                const past = arr.indexOf(request.status) > i;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        past ? 'bg-green-500' : current ? 'bg-brand-600' : 'bg-gray-100'
                      }`}
                    >
                      {past ? (
                        <CheckCircle className="w-3 h-3 text-white" />
                      ) : current ? (
                        <ChevronRight className="w-3 h-3 text-white" />
                      ) : null}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        past ? 'text-green-600' : current ? 'text-brand-700 font-semibold' : 'text-gray-400'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
