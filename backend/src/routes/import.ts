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
  // Anchor on article numbers (very distinctive: digit + 10-11 alphanumeric chars)
  // Then look back for product code and forward for name
  const ARTICLE_RE = /\b([0-9][A-Z0-9]{9,11})\b/g;
  const CODE_RE = /([A-Z]{1,4}(?:-[A-Z0-9]+)+)\s*$/;
  // Size/weight/dims info to strip from name
  const TRIM_RE = /[,;]?\s*\d[\d\s]*\s*(x\s*\d|mm|cm|kg|Blatt|Blatt|Umschläge|Ablagen|Kapazität|g\/m).*/i;

  const accessories: ParsedItem[] = [];
  const seenCodes = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = ARTICLE_RE.exec(text)) !== null) {
    const articleNumber = match[1];
    const pos = match.index;

    // Look back up to 80 chars for a product code
    const before = text.substring(Math.max(0, pos - 80), pos);
    const codeMatch = before.match(CODE_RE);
    if (!codeMatch) continue;
    const code = codeMatch[1];
    if (seenCodes.has(code)) continue;

    // Look forward up to 300 chars for the name
    const after = text.substring(pos + articleNumber.length, pos + articleNumber.length + 300);
    // Name is the next non-empty stretch of text (skip leading whitespace/newlines)
    const nameMatch = after.match(/^[\s\n]+([^\n]+)/);
    if (!nameMatch) continue;

    let name = nameMatch[1].trim();
    // Strip dimension/weight details that come after the name
    name = name.replace(TRIM_RE, '').trim();
    // Remove trailing punctuation
    name = name.replace(/[,;]\s*$/, '').trim();
    if (!name || name.length < 3) continue;

    // Skip consumables
    const nameLower = name.toLowerCase();
    const codeLower = code.toLowerCase();
    if (CONSUMABLE_KEYWORDS.some((kw) => nameLower.includes(kw) || codeLower.includes(kw))) continue;

    // Skip machine model lines
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
