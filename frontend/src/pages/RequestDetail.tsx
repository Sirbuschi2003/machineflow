import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, Clock, Package, Wrench, AlertTriangle,
  ChevronRight, ExternalLink,
} from 'lucide-react';
import { api, MachineRequest, RequestStatus, RequestAccessory } from '../api/client';
import { StatusBadge, STATUS_LABELS } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';

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

  const snRequired = request.accessories.filter((a) => a.accessory.hasSerialNumber);
  const allSnFilled =
    !serialNumber.trim() === false &&
    snRequired.every((a) => accSerials[a.id]?.trim());

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

  // WAREHOUSE: enter SNs and mark as UNPACKING
  if (request.status === 'IN_WAREHOUSE' && (user.role === 'WAREHOUSE' || user.role === 'ADMIN')) {
    return (
      <div className="space-y-3">
        <div>
          <label className="label">Maschinen-Seriennummer *</label>
          <input
            className="input"
            placeholder="z.B. CP3000-SN-88203"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
        </div>
        {snRequired.map((acc) => (
          <div key={acc.id}>
            <label className="label">{acc.accessory.name} – Seriennummer *</label>
            <input
              className="input"
              placeholder="Seriennummer eingeben"
              value={accSerials[acc.id] || ''}
              onChange={(e) => setAccSerials((p) => ({ ...p, [acc.id]: e.target.value }))}
            />
          </div>
        ))}
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
          disabled={loading || !allSnFilled}
          onClick={() =>
            transition('UNPACKING', {
              machineSerialNumber: serialNumber,
              accessories: snRequired.map((a) => ({ id: a.id, serialNumber: accSerials[a.id] })),
            })
          }
        >
          <Package className="w-4 h-4" />
          Auspacken beginnen
        </button>
        {!allSnFilled && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Alle Seriennummern ausfüllen, um fortzufahren.
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
  const [request, setRequest] = useState<MachineRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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
        <div className="text-right text-xs text-gray-400">
          <p>Erstellt {new Date(request.createdAt).toLocaleDateString('de-DE')}</p>
          <p>von {request.salesRep.name}</p>
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
                    <div>
                      <p className="text-sm font-medium text-gray-900">{acc.accessory.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">× {acc.quantity}</span>
                        {acc.accessory.hasSerialNumber && (
                          <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">S/N</span>
                        )}
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
