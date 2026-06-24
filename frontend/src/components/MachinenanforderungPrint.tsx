import { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { MachineRequest } from '../api/client';

interface Props {
  request: MachineRequest;
  onClose: () => void;
}

const STANDARD_ZUBEHOER = [
  'DADF/RADF',
  'Finisher',
  'Ablage (KK)',
  'Papier-\nKassette',
  'Papier-\nKassette',
  'Papier-\nKassette',
  'Desk',
  'Aktiver KD',
  'Faxmodul',
  'HDD',
  'Tastatur GR',
  'Speicher',
  '',
  '',
  '',
  'Toner',
];

const PRUFLISTE_LEFT = [
  'Belichtung - Vergrößerung/Verkleinerung/Foto',
  'Flächendeckung',
  'Kopfanfänge - Kassetten/Duplex/ADF',
  'Seitliche Ausrichtung - Kassetten/Duplex/ADF',
  'Ausleuchtung/Bildschärfe/Maßstab/Winkeligkeit',
  'Sauberkeit/Gehäusezustand',
  'Laufruhe',
  'Trommelspannungen / Doctorblade eingemessen',
  'Wartungs-Trommelzähler gelöscht',
  'A3 Doppelzählung aktiviert',
  'CNT-Brücke',
  'Firmwareupdate Maschine/Optionen',
  'Kundendaten gelöscht? HDD, E-Filing, Faxdaten,',
  'Adressbuch, Templates, Netzw, Sicherungsdateien',
  '',
  'PM - Liste gepflegt',
];

const PRUFLISTE_RIGHT = [
  'Faxfunktion senden/empfangen geprüft',
  'Druckfunktion / USB / Netzwerk geprüft',
  'Scanfunktion geprüft',
  '',
  'Faxdaten programmiert',
  'Druckertreiber / Software / CD / DVD',
  'Faxkabel',
  'Druckerkabel',
  'Netzkabel',
  'Bordkarte / RR-Aufkleber / Konfigurationskarte',
  'QR-Code',
  'Einstellung automatische Tonerbestellung per-Mail',
  'Einstellung Tonerbestellung telefonisch',
  'Aufkleber Tonerbestellung / Mail',
  '',
  '',
];

const S = '1px solid #333';
const SL = '1px solid #bbb';

// Row heights used throughout – mm strings for correct print sizing
const H_STD = '7mm';   // Zubehör rows
const H_ET  = '8mm';   // Ersatzteil rows
const H_ZAE = '6mm';   // Zähler rows
const H_PL  = '7mm';   // Prüfliste rows
const H_DAT = '8mm';   // Datum/Einheiten rows
const H_INFO = '8mm';  // Info-Felder in der linken Spalte

function Cb() {
  return (
    <span style={{
      display: 'inline-block', width: 11, height: 11,
      border: S, verticalAlign: 'middle', flexShrink: 0,
    }} />
  );
}

function EtRow({ menge = '', name = '', artikelNr = '' }: { menge?: string | number; name?: string; artikelNr?: string }) {
  return (
    <tr>
      <td style={{ border: S, padding: '1px 3px', height: H_ET, verticalAlign: 'middle', fontSize: 8 }}>{menge}</td>
      <td style={{ border: S, padding: '1px 3px', height: H_ET, verticalAlign: 'middle', fontSize: 8 }}>{name}</td>
      <td style={{ border: S, padding: '1px 3px', height: H_ET, verticalAlign: 'middle', fontSize: 8 }}>{artikelNr}</td>
    </tr>
  );
}

const LEFT_ET_ROWS = 20;  // enough to fill left column to page bottom
const RIGHT_ET_ROWS = 10;

export default function MachinenanforderungPrint({ request, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Maschinenanforderung ${request.requestNumber}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        /* margin:0 removes browser-added title/URL/page-number from print output */
        @page{size:A4 portrait;margin:0}
        body{margin:10mm;font-family:Arial,sans-serif;font-size:9px;color:#000;background:#fff}
        table{border-collapse:collapse;width:100%}
        td,th{border:1px solid #333;padding:1px 4px;font-size:9px;vertical-align:middle}
        .p2{page-break-before:always}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head>
      <body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  };

  const site = request.customerSite;
  const cust = request.customer;
  const model = request.machineModel;
  const date = new Date(request.createdAt).toLocaleDateString('de-DE');
  const accs = request.accessories;

  const infoField = (label: string, value?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', height: H_INFO, borderBottom: S, marginBottom: 1, fontSize: 9 }}>
      <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginRight: 3 }}>{label}</span>
      <span style={{ flex: 1 }}>{value ?? ''}</span>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4 flex flex-col">

          {/* Modal-Kopf */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Maschinenanforderung</h2>
              <p className="text-xs text-gray-500">{request.requestNumber} · {cust.companyName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-primary" onClick={handlePrint}>
                <Printer className="w-4 h-4" /> Drucken
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Druckvorschau */}
          <div className="overflow-y-auto p-6 bg-gray-100">
            <div ref={printRef} style={{ background: '#fff', fontFamily: 'Arial, sans-serif', color: '#000', fontSize: 9 }}>

              {/* ══════════════ SEITE 1 ══════════════ */}
              <div style={{ width: '190mm' }}>

                {/* Zeile 1: Eingang / Lieferung / Toner */}
                <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 2 }}>
                  <tbody>
                    <tr>
                      <td style={{ border: S, padding: '2px 5px', width: '34%', height: '10mm', verticalAlign: 'top', fontWeight: 'bold', fontSize: 9 }}>
                        Eingang Technik
                      </td>
                      <td style={{ border: S, padding: '2px 5px', width: '34%', height: '10mm', verticalAlign: 'top', fontWeight: 'bold', fontSize: 9 }}>
                        Lieferung geplant
                      </td>
                      <td style={{ border: S, padding: '2px 5px', height: '10mm', verticalAlign: 'top', fontSize: 9 }}>
                        Tonerbestellung per Mail<br /><Cb />
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Zeile 2: Anforderung Nr. / Weitere Systeme / Datum / Liefertermin */}
                <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 3 }}>
                  <tbody>
                    <tr>
                      <td style={{ border: S, padding: '2px 5px', width: '26%', height: '11mm', verticalAlign: 'middle' }}>
                        <b style={{ fontSize: 11 }}>Anforderung<br />Nr.{request.requestNumber}</b>
                      </td>
                      <td style={{ border: S, padding: '2px 5px', width: '18%', height: '11mm', verticalAlign: 'middle' }}>
                        <b>Weitere Systeme?</b><br /><Cb />
                      </td>
                      <td style={{ border: S, padding: '2px 5px', width: '28%', height: '11mm', verticalAlign: 'middle', fontSize: 9 }}>
                        <b>Anforderungsdatum :</b><br />{date}
                      </td>
                      <td style={{ border: S, padding: '2px 5px', height: '11mm', verticalAlign: 'middle', fontSize: 9 }}>
                        <b>Liefertermin Vertrieb</b>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Hauptbereich 2 Spalten */}
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    <tr style={{ verticalAlign: 'top' }}>

                      {/* ── LINKE SPALTE ── */}
                      <td style={{ border: S, padding: '3px 5px', width: '46%', verticalAlign: 'top' }}>

                        {infoField('Modell:', model.modelName)}
                        {infoField('Herkunft :')}
                        {infoField('Masch.-Nr.:', request.machineSerialNumber)}

                        {/* Kunde */}
                        <div style={{ marginTop: 2, marginBottom: 2 }}>
                          <div style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 1 }}>Kunde :</div>
                          {[cust.companyName, site.street, `${site.zip} ${site.city}`, site.contactPerson ?? ''].map((line, i) => (
                            <div key={i} style={{ height: '6mm', borderBottom: S, fontSize: 9, display: 'flex', alignItems: 'center', paddingLeft: 2 }}>
                              {line}
                            </div>
                          ))}
                        </div>

                        {infoField('Tel.:', cust.phone)}
                        {infoField('Rücknahme Modell:')}

                        {/* Zähler */}
                        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 4, marginBottom: 4, fontSize: 9 }}>
                          <tbody>
                            <tr>
                              <td colSpan={2} style={{ border: SL, padding: '1px 3px', height: H_ZAE, fontWeight: 'bold', verticalAlign: 'middle' }}>Gesamt - Zähler ALT:</td>
                            </tr>
                            <tr>
                              <td style={{ border: SL, padding: '1px 3px', height: H_ZAE, width: '50%', verticalAlign: 'middle' }}><b>Schwarz ALT:</b></td>
                              <td style={{ border: SL, padding: '1px 3px', height: H_ZAE, verticalAlign: 'middle' }}><b>Farbe ALT:</b></td>
                            </tr>
                            <tr>
                              <td colSpan={2} style={{ border: SL, padding: '1px 3px', height: H_ZAE, fontWeight: 'bold', verticalAlign: 'middle' }}>Gesamt - Zähler NEU:</td>
                            </tr>
                            <tr>
                              <td style={{ border: SL, padding: '1px 3px', height: H_ZAE, verticalAlign: 'middle' }}><b>Schwarz NEU:</b></td>
                              <td style={{ border: SL, padding: '1px 3px', height: H_ZAE, verticalAlign: 'middle' }}><b>Farbe Neu:</b></td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Ersatzteil-Tabelle links – vorausgefüllt mit Zubehör aus dem Auftrag */}
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 9 }}>
                          <thead>
                            <tr>
                              <th style={{ border: S, padding: '1px 3px', width: '14%', background: '#f0f0f0' }}>Menge</th>
                              <th style={{ border: S, padding: '1px 3px', background: '#f0f0f0' }}>Ersatzteil</th>
                              <th style={{ border: S, padding: '1px 3px', width: '27%', background: '#f0f0f0' }}>Artikel-Nr.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: LEFT_ET_ROWS }).map((_, i) => {
                              const a = accs[i];
                              return (
                                <EtRow
                                  key={i}
                                  menge={a ? a.quantity : ''}
                                  name={a ? `${a.accessory.code ? a.accessory.code + ' ' : ''}${a.accessory.name}` : ''}
                                  artikelNr={a?.serialNumber ?? ''}
                                />
                              );
                            })}
                          </tbody>
                        </table>
                      </td>

                      {/* ── RECHTE SPALTE ── */}
                      <td style={{ border: S, padding: '3px 5px', verticalAlign: 'top' }}>

                        {/* Verkauft / V.-Beginn / geprüft / KD.NR */}
                        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 4, fontSize: 9 }}>
                          <tbody>
                            <tr>
                              <td style={{ border: SL, padding: '1px 4px', width: '62%', height: '9mm', verticalAlign: 'middle' }}>
                                <b>Verkauft :</b>&nbsp;
                                <span style={{ borderBottom: SL, display: 'inline-block', width: 55 }} />
                              </td>
                              <td style={{ border: SL, padding: '1px 4px', height: '9mm', verticalAlign: 'middle' }}><b>V.-Beginn</b></td>
                            </tr>
                            <tr>
                              <td style={{ border: SL, padding: '1px 4px', height: '9mm', verticalAlign: 'middle' }}><b>geprüft:</b></td>
                              <td style={{ border: SL, padding: '1px 4px', height: '9mm', verticalAlign: 'middle' }}><b>KD.NR:</b> {cust.customerNumber}</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Checkboxen */}
                        {[
                          ['Rebuild', 'Kopierfähig', 'Neuinstal.'],
                          ['Kauf :', 'CA :', 'Vorführung:'],
                          ['Miete:', 'CP :', 'Probestellung:'],
                        ].map((row, ri) => (
                          <div key={ri} style={{ display: 'flex', gap: 12, marginBottom: '4mm', alignItems: 'center' }}>
                            {row.map((l) => (
                              <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 'bold', fontSize: 9 }}>
                                {l}&nbsp;<Cb />
                              </span>
                            ))}
                          </div>
                        ))}

                        {/* Zubehör-Tabelle – Standard-Liste, leer (manuell) */}
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 9, marginBottom: 3 }}>
                          <thead>
                            <tr>
                              <th style={{ border: S, padding: '1px 3px', width: '34%', fontWeight: 'bold' }}>Zubehör:</th>
                              <th style={{ border: S, padding: '1px 3px', fontWeight: 'bold' }}>TYP/Modell</th>
                              <th style={{ border: S, padding: '1px 3px', fontWeight: 'bold' }}>Maschinenummer</th>
                            </tr>
                          </thead>
                          <tbody>
                            {STANDARD_ZUBEHOER.map((label, i) => (
                              <tr key={i}>
                                <td style={{ border: S, padding: '1px 3px', height: H_STD, verticalAlign: 'middle' }}>
                                  {label && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 8, whiteSpace: 'pre-line' }}>
                                      {label}&nbsp;<Cb />
                                    </span>
                                  )}
                                </td>
                                <td style={{ border: S, padding: '1px 3px', height: H_STD }} />
                                <td style={{ border: S, padding: '1px 3px', height: H_STD }} />
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Technikünterstützung */}
                        <div style={{ fontSize: 9, marginBottom: '2mm' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}>
                            Technikünterstützung für Installation erforderlich&nbsp;<Cb />
                          </span>
                        </div>
                        <div style={{ fontSize: 9, marginBottom: '2mm' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            gegen Berechnung laut Vertrag und Anlage/n&nbsp;<Cb />
                          </span>
                        </div>
                        <div style={{ fontSize: 9, marginBottom: '3mm' }}>
                          ohne Berechnung laut Vertrag bis zu&nbsp;
                          <span style={{ borderBottom: S, display: 'inline-block', width: 30 }} />&nbsp;Stunden
                        </div>

                        {/* Ersatzteil-Tabelle rechts – leer */}
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 9 }}>
                          <thead>
                            <tr>
                              <th style={{ border: S, padding: '1px 3px', width: '14%', background: '#f0f0f0' }}>Menge</th>
                              <th style={{ border: S, padding: '1px 3px', background: '#f0f0f0' }}>Ersatzteil</th>
                              <th style={{ border: S, padding: '1px 3px', width: '27%', background: '#f0f0f0' }}>Artikel-Nr.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: RIGHT_ET_ROWS }).map((_, i) => (
                              <EtRow key={i} />
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ══════════════ SEITE 2 ══════════════ */}
              <div className="p2" style={{ width: '190mm', pageBreakBefore: 'always' }}>

                {/* Fax-Box */}
                <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 4, fontSize: 9 }}>
                  <tbody>
                    <tr>
                      <td style={{ border: S, padding: '2px 5px', width: '50%', height: '8mm', verticalAlign: 'middle' }}>
                        <b>Faxnummer:</b>&nbsp;
                        <span style={{ borderBottom: S, display: 'inline-block', width: 80 }} />
                      </td>
                      <td style={{ border: S, padding: '2px 5px', height: '8mm', verticalAlign: 'middle' }}>
                        <b>Kopfzeile:</b>&nbsp;
                        <span style={{ borderBottom: S, display: 'inline-block', width: 100 }} />
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ border: S, padding: '2px 5px', height: '7mm', verticalAlign: 'middle' }}>
                        <span style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 8, flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Hauptanschluß <Cb /></span>
                          <span>Amtsholung: <span style={{ borderBottom: S, display: 'inline-block', width: 40 }} /></span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>TAE <Cb /></span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Western <Cb /></span>
                          <span>Sendebericht: <span style={{ borderBottom: S, display: 'inline-block', width: 35 }} /></span>
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Fortsetzung Ersatzteile */}
                <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 4, fontSize: 9 }}>
                  <thead>
                    <tr>
                      <th colSpan={6} style={{ border: S, padding: '2px 5px', background: '#f0f0f0', textAlign: 'left', fontWeight: 'bold', fontSize: 10 }}>
                        Fortsetzung Ersatzteile
                      </th>
                    </tr>
                    <tr>
                      <th style={{ border: S, padding: '1px 3px', width: '7%' }}>Menge</th>
                      <th style={{ border: S, padding: '1px 3px', width: '30%' }}>Ersatzteil</th>
                      <th style={{ border: S, padding: '1px 3px', width: '13%' }}>Artikelnummer</th>
                      <th style={{ border: S, padding: '1px 3px', width: '7%' }}>Menge</th>
                      <th style={{ border: S, padding: '1px 3px', width: '30%' }}>Ersatzteil</th>
                      <th style={{ border: S, padding: '1px 3px' }}>Artikelnummer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <tr key={i}>
                        {[0,1,2,3,4,5].map(c => (
                          <td key={c} style={{ border: S, padding: '1px 3px', height: H_ET }} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Prüfliste */}
                <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 4, fontSize: 9 }}>
                  <thead>
                    <tr>
                      <th colSpan={4} style={{ border: S, padding: '2px 5px', background: '#f0f0f0', textAlign: 'left', fontWeight: 'bold', fontSize: 10 }}>
                        Prüfliste - Vom Techniker auszufüllen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRUFLISTE_LEFT.map((item, i) => (
                      <tr key={i}>
                        <td style={{ border: SL, padding: '1px 4px', height: H_PL, width: '44%', verticalAlign: 'middle' }}>
                          <span style={{ fontWeight: item.startsWith('Kundendaten') ? 'bold' : 'normal' }}>{item}</span>
                        </td>
                        <td style={{ border: SL, padding: '1px 4px', height: H_PL, width: '6%', textAlign: 'center', verticalAlign: 'middle' }}>
                          {item && <Cb />}
                        </td>
                        <td style={{ border: SL, padding: '1px 4px', height: H_PL, width: '44%', verticalAlign: 'middle' }}>
                          {PRUFLISTE_RIGHT[i]}
                        </td>
                        <td style={{ border: SL, padding: '1px 4px', height: H_PL, width: '6%', textAlign: 'center', verticalAlign: 'middle' }}>
                          {PRUFLISTE_RIGHT[i] && <Cb />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Datum / Einheiten */}
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 9, marginBottom: 4 }}>
                  <tbody>
                    {(['Fertigstellung und Prüfliste abgearbeitet.', 'Techniker/Datum', '', ''] as string[]).map((label, i) => (
                      <tr key={i}>
                        <td style={{ border: SL, padding: '1px 5px', width: '12%', height: H_DAT, verticalAlign: 'middle' }}><b>Datum:</b></td>
                        <td style={{ border: SL, padding: '1px 5px', width: '27%', height: H_DAT }} />
                        <td style={{ border: SL, padding: '1px 5px', width: '12%', height: H_DAT, verticalAlign: 'middle' }}><b>Einheiten</b></td>
                        <td style={{ border: SL, padding: '1px 5px', height: H_DAT, verticalAlign: 'middle' }}>
                          {label && <b>{label}</b>}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2} style={{ border: SL, padding: '1px 5px', fontWeight: 'bold', height: H_DAT, verticalAlign: 'middle' }}>
                        Zeit Gesammt (Einheiten)
                      </td>
                      <td colSpan={2} style={{ border: SL, height: H_DAT }} />
                    </tr>
                  </tbody>
                </table>

                {/* Abnahme / Netzwerkanalyse */}
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 9 }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '2px solid #333', padding: '8px 5px', fontWeight: 'bold', width: '45%', height: '18mm', verticalAlign: 'top' }}>
                        Abnahme: Datum, Unterschrift
                      </td>
                      <td style={{ border: '2px solid #333', padding: '4px 5px', verticalAlign: 'middle' }}>
                        <b>Netzwerkanalysebogen vorhanden: Ja</b>&nbsp;<Cb />&nbsp;&nbsp;
                        <b>Nein</b>&nbsp;<Cb />
                      </td>
                    </tr>
                  </tbody>
                </table>

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
