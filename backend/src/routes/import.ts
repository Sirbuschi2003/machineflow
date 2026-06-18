import { Router } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Sections to completely skip (consumables)
const CONSUMABLE_SECTIONS = [
  'verbrauchsmaterial', 'toner', 'entwickler', 'resttonerbehälter',
  'trommel', 'heftklammern',
];

// Line looks like a section header (only text, no article number)
function isSectionHeader(line: string): boolean {
  return /^[A-Za-zÄÖÜäöüß\s\-\/]{4,40}$/.test(line) && !/^\d/.test(line);
}

interface ParsedAccessory {
  code: string;
  articleNumber: string;
  name: string;
  selected: boolean;
}

function parsePdf(text: string): { machineModels: string[]; accessories: ParsedAccessory[] } {
  // Extract all e-STUDIO model references
  const rawModels = text.match(/e-STUDIO\d+[A-Za-z]+/g) || [];
  const machineModels = [...new Set(rawModels)];

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Pattern: PRODUCT-CODE  ARTICLE-NUMBER  Description
  // Code examples: KA-5005PC, MR-3033, GQ-1280-N, GS-1010Node, TP-Link
  // Article number: starts with digit, 10-12 alphanumeric chars
  const ITEM_RE = /^([A-Z][A-Z0-9]{0,5}(?:-[A-Z0-9]+)+)\s+([0-9][A-Z0-9]{9,11})\s+(.+)/;

  const accessories: ParsedAccessory[] = [];
  let skipSection = false;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect section headers
    if (isSectionHeader(line)) {
      skipSection = CONSUMABLE_SECTIONS.some((s) => lower.includes(s));
      continue;
    }

    if (skipSection) continue;

    const m = line.match(ITEM_RE);
    if (m) {
      // Skip if description looks like a machine model line (Standardausstattung)
      const name = m[3].trim();
      if (name.startsWith('e-STUDIO') || name.startsWith('6AG') || name.startsWith('6AH')) continue;

      accessories.push({
        code: m[1],
        articleNumber: m[2],
        name,
        selected: true,
      });
    }
  }

  return { machineModels, accessories };
}

// POST /api/import/parse-pdf  — parse PDF, return preview
router.post('/parse-pdf', requireRole('ADMIN'), upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Keine Datei hochgeladen.' });
    const data = await pdfParse(req.file.buffer);
    const result = parsePdf(data.text);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Fehler beim Lesen der PDF.' });
  }
});

// POST /api/import/confirm  — actually create the accessories
router.post('/confirm', requireRole('ADMIN'), async (req, res) => {
  try {
    const { accessories, machineModelIds = [] } = req.body as {
      accessories: ParsedAccessory[];
      machineModelIds: string[];
    };

    let created = 0;
    let skipped = 0;

    for (const acc of accessories) {
      if (!acc.selected || !acc.name?.trim()) continue;

      const exists = await prisma.accessory.findFirst({ where: { name: acc.name.trim() } });
      if (exists) { skipped++; continue; }

      await prisma.accessory.create({
        data: {
          name: acc.name.trim(),
          description: acc.articleNumber ? `Art.-Nr.: ${acc.articleNumber}` : undefined,
          hasSerialNumber: false,
          compatibleModels: {
            create: machineModelIds.map((id: string) => ({ machineModelId: id })),
          },
        },
      });
      created++;
    }

    res.json({ created, skipped, message: `${created} Artikel importiert, ${skipped} übersprungen (bereits vorhanden).` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Fehler beim Importieren.' });
  }
});

export default router;
