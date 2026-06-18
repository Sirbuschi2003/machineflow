import { Router } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';

type PdfParseFunc = (buf: Buffer) => Promise<{ text: string }>;
let _pdfParse: PdfParseFunc | null = null;
function getPdfParse(): PdfParseFunc {
  if (!_pdfParse) {
    // pdf-parse index.js runs self-tests on require — use internal path to skip that
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _pdfParse = require('pdf-parse/lib/pdf-parse.js') as PdfParseFunc;
  }
  return _pdfParse;
}

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const CONSUMABLE_KEYWORDS = [
  'verbrauchsmaterial', 'toner', 'entwickler', 'resttonerbehälter',
  'trommel', 'heftklammern',
];

function isSectionHeader(line: string): boolean {
  return /^[A-Za-zÄÖÜäöüß\s\-\/]{4,50}$/.test(line) && !/\d{6,}/.test(line);
}

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
  const models: string[] = [];

  // Handle "e-STUDIO2525Ac/3025Ac/3525Ac/4525Ac" slash-separated format
  const slashRe = /e-STUDIO(\d+[A-Za-z]+)((?:\/\d+[A-Za-z]+)+)/g;
  let m: RegExpExecArray | null;
  while ((m = slashRe.exec(text)) !== null) {
    models.push(`e-STUDIO${m[1]}`);
    m[2].split('/').filter(Boolean).forEach((s) => models.push(`e-STUDIO${s}`));
  }

  // Direct full names (e.g. "e-STUDIO3525Ac")
  const directRe = /e-STUDIO\d+[A-Za-z]+/g;
  let d: RegExpExecArray | null;
  while ((d = directRe.exec(text)) !== null) {
    models.push(d[0]);
  }

  return [...new Set(models)];
}

function parseAccessories(text: string): ParsedItem[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  // CODE  ARTICLE-NO  Description
  // e.g.: KA-5005PC 6AG00006726 Vorlagenglasabdeckung
  const ITEM_RE = /^([A-Z][A-Z0-9]{0,5}(?:-[A-Z0-9]+)+)\s+([0-9][A-Z0-9]{9,11})\s+(.+)/;

  const accessories: ParsedItem[] = [];
  let skipSection = false;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (isSectionHeader(line)) {
      skipSection = CONSUMABLE_KEYWORDS.some((kw) => lower.includes(kw));
      continue;
    }
    if (skipSection) continue;

    const hit = line.match(ITEM_RE);
    if (hit) {
      const name = hit[3].trim();
      // Skip lines that are actually machine model references
      if (name.startsWith('e-STUDIO') || /^[0-9]{6,}/.test(name)) continue;
      accessories.push({ code: hit[1], articleNumber: hit[2], name, selected: true });
    }
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

    res.json({ machineModels, accessories });
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
