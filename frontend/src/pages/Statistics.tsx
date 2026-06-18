import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { api, MachineModel } from '../api/client';
import { TrendingUp, Users } from 'lucide-react';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

export default function Statistics() {
  const [models, setModels] = useState<MachineModel[]>([]);
  const [filterModelId, setFilterModelId] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const [byYear, setByYear] = useState<{ year: number; modelId: string; modelName: string; count: number }[]>([]);
  const [byRep, setByRep] = useState<{ repId: string; repName: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.machineModels.getAll().then(setModels);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.statistics.machinesByYear(filterModelId ? { modelId: filterModelId } : undefined),
      api.statistics.salesByRep(filterYear ? { year: parseInt(filterYear) } : undefined),
    ])
      .then(([yr, rep]) => {
        setByYear(yr);
        setByRep(rep);
      })
      .finally(() => setLoading(false));
  }, [filterModelId, filterYear]);

  // Transform byYear data for recharts: group by year
  const years = [...new Set(byYear.map((d) => d.year))].sort();
  const modelNames = [...new Set(byYear.map((d) => d.modelName))];

  const chartData = years.map((year) => {
    const row: Record<string, number | string> = { year: String(year) };
    byYear
      .filter((d) => d.year === year)
      .forEach((d) => {
        row[d.modelName] = d.count;
      });
    return row;
  });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statistiken</h1>
        <p className="text-sm text-gray-500 mt-0.5">Übersicht über Verkäufe und Leistung</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="label text-xs">Modell filtern</label>
          <select
            className="input text-sm py-1.5"
            value={filterModelId}
            onChange={(e) => setFilterModelId(e.target.value)}
          >
            <option value="">Alle Modelle</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.modelName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Jahr filtern</label>
          <select
            className="input text-sm py-1.5"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            <option value="">Alle Jahre</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-brand-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Machines by year chart */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-gray-900">Abgeschlossene Maschinen pro Jahr</h2>
            </div>
            <div className="card-body">
              {chartData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Keine Daten vorhanden.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {modelNames.map((name, i) => (
                      <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === modelNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Sales by rep */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600" />
                <h2 className="text-sm font-semibold text-gray-900">Verkäufe pro Mitarbeiter</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {byRep.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Keine Daten vorhanden.</p>
                ) : (
                  byRep.map((rep, i) => (
                    <div key={rep.repId} className="flex items-center gap-3 px-6 py-3">
                      <span className="w-6 text-xs font-bold text-gray-400">{i + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{rep.repName}</p>
                        <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all"
                            style={{ width: `${byRep[0].count > 0 ? (rep.count / byRep[0].count) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-6 text-right">{rep.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-gray-900">Verteilung Vertrieb</h2>
              </div>
              <div className="card-body">
                {byRep.filter((r) => r.count > 0).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">Keine Daten vorhanden.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={byRep}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <YAxis dataKey="repName" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} width={60} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                        formatter={(val) => [val, 'Abschlüsse']}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {byRep.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
