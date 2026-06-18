import { Router } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';

type PdfParseFunc = (buf: Buffer) => Promise<{ text: string }>;
let _pdfParse: PdfParseFunc | null = null;
function getPdfParse(): PdfParseFunc {
  if (!_pdfParse) {
    // pdf-parse v1: index.js runs self-tests on require, use internal path to skip
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _pdfParse = require('pdf-parse/lib/pdf-parse.js') as PdfParseFunc;
  }
  return _pdfParse;
}

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const CONSUMABLE_KEYWORDS = [
  'verbrauchsmaterial', 'toner', 'entwickler', 'resttonerbehälter',
  'trommel', 'heftklammern', 'staple', 'heftklammer',
];

export interface ParsedItem {
  code: string;
  articleNumber: string;
  name: string;
  selected: boolean;
}

export interface ParsedModel {
  name: string;
  selected: boolean;
  existsAlready: boolean;
}

function extractMachineModels(text: string): string[] {
  // Case-insensitive dedup: keep first occurrence
  const seen = new Map<string, string>();

  const add = (name: string) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  };

  // Handle "e-STUDIO2525Ac/3025Ac/3525Ac/4525Ac" slash-separated format
  const slashRe = /e-STUDIO(\d+[A-Za-z]+)((?:\/\d+[A-Za-z]+)+)/gi;
  let m: RegExpExecArray | null;
  while ((m = slashRe.exec(text)) !== null) {
    add(`e-STUDIO${m[1]}`);
    m[2].split('/').filter(Boolean).forEach((s) => add(`e-STUDIO${s}`));
  }

  // Direct full names (e.g. "e-STUDIO3525Ac")
  const directRe = /e-STUDIO\d+[A-Za-z]+/gi;
  while ((m = directRe.exec(text)) !== null) {
    add(m[0]);
  }

  return [...seen.values()];
}

function parseAccessories(text: string): ParsedItem[] {
  // pdf-parse extracts table cells WITHOUT spaces between columns:
  // "KA-5005PC6AG00006726Vorlagenglasabdeckung"
  // Toshiba article numbers always start with "6" + 10 alphanumeric chars
  const ITEM_RE = /\b([A-Z]{2,5}(?:-[A-Z0-9]+)+)(6[A-Z0-9]{9,11})([^\n]{2,120})/g;
  const TRIM_RE = /[,;]?\s*\d[\d\s]*\s*(x\s*\d|mm|cm|kg|Blatt|Umschläge|Ablagen|Kapazität|g\/m).*/i;

  const accessories: ParsedItem[] = [];
  const seenCodes = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = ITEM_RE.exec(text)) !== null) {
    const [, code, articleNumber, rawName] = m;
    if (seenCodes.has(code)) continue;

    let name = rawName.trim();
    name = name.replace(TRIM_RE, '').trim();
    name = name.replace(/[,;]\s*$/, '').trim();
    if (!name || name.length < 2) continue;

    const lower = name.toLowerCase();
    if (CONSUMABLE_KEYWORDS.some((kw) => lower.includes(kw))) continue;
    if (name.startsWith('e-STUDIO')) continue;

    seenCodes.add(code);
    accessories.push({ code, articleNumber, name, selected: true });
  }

  return accessories;
}

// ── POST /api/import/parse-pdf ───────────────────────────────────────────────
router.post('/parse-pdf', requireRole('ADMIN'), upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Keine Datei hochgeladen.' });

    const data = await getPdfParse()(req.file.buffer);
    const rawModels = extractMachineModels(data.text);
    const accessories = parseAccessories(data.text);

    // Check which models already exist in DB
    const existing = await prisma.machineModel.findMany({
      where: { modelName: { in: rawModels } },
      select: { modelName: true },
    });
    const existingNames = new Set(existing.map((e) => e.modelName));

    const machineModels: ParsedModel[] = rawModels.map((name) => ({
      name,
      selected: true,
      existsAlready: existingNames.has(name),
    }));

    // Debug: first 1000 chars of extracted text (remove after testing)
    const _debug = data.text.substring(0, 1500);
    res.json({ machineModels, accessories, _debug });
  } catch (error) {
    console.error('PDF parse error:', error);
    res.status(500).json({ message: 'Fehler beim Lesen der PDF. Bitte prüfen ob es ein gültiges PDF ist.' });
  }
});

// ── POST /api/import/confirm ─────────────────────────────────────────────────
router.post('/confirm', requireRole('ADMIN'), async (req, res) => {
  try {
    const { accessories, machineModels } = req.body as {
      accessories: ParsedItem[];
      machineModels: ParsedModel[];
    };

    // 1. Create or find machine models
    const modelIds: string[] = [];
    for (const m of machineModels) {
      if (!m.selected) continue;
      let model = await prisma.machineModel.findFirst({ where: { modelName: m.name } });
      if (!model) {
        model = await prisma.machineModel.create({ data: { modelName: m.name } });
      }
      modelIds.push(model.id);
    }

    // 2. Create accessories and link to models
    let created = 0;
    let skipped = 0;
    for (const acc of accessories) {
      if (!acc.selected || !acc.name?.trim()) continue;
      const exists = await prisma.accessory.findFirst({ where: { name: acc.name.trim() } });
      if (exists) {
        // Still link to the new models if not already linked
        for (const modelId of modelIds) {
          const linked = await prisma.machineModelAccessory.findUnique({
            where: { machineModelId_accessoryId: { machineModelId: modelId, accessoryId: exists.id } },
          });
          if (!linked) {
            await prisma.machineModelAccessory.create({
              data: { machineModelId: modelId, accessoryId: exists.id },
            });
          }
        }
        skipped++;
        continue;
      }
      await prisma.accessory.create({
        data: {
          name: acc.name.trim(),
          description: acc.articleNumber ? `Art.-Nr.: ${acc.articleNumber}` : undefined,
          hasSerialNumber: false,
          compatibleModels: {
            create: modelIds.map((id) => ({ machineModelId: id })),
          },
        },
      });
      created++;
    }

    const newModels = machineModels.filter((m) => m.selected && !m.existsAlready).length;
    res.json({
      created,
      skipped,
      newModels,
      message: `${newModels} Modelle + ${created} Zubehör-Artikel angelegt, ${skipped} Zubehör bereits vorhanden (Verlinkung aktualisiert).`,
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ message: 'Fehler beim Importieren.' });
  }
});

export default router;
