import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';

const router = Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien sind erlaubt.'));
    }
  },
});

// POST /api/uploads/machine-model/:id
router.post('/machine-model/:id', requireRole('ADMIN'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'Keine Datei hochgeladen.' });
      return;
    }
    const imagePath = `/api/uploads/files/${req.file.filename}`;
    await prisma.machineModel.update({
      where: { id: req.params.id },
      data: { imagePath },
    });
    res.json({ imagePath });
  } catch (e: unknown) {
    res.status(500).json({ message: e instanceof Error ? e.message : 'Fehler beim Hochladen.' });
  }
});

// POST /api/uploads/accessory/:id
router.post('/accessory/:id', requireRole('ADMIN'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'Keine Datei hochgeladen.' });
      return;
    }
    const imagePath = `/api/uploads/files/${req.file.filename}`;
    await prisma.accessory.update({
      where: { id: req.params.id },
      data: { imagePath },
    });
    res.json({ imagePath });
  } catch (e: unknown) {
    res.status(500).json({ message: e instanceof Error ? e.message : 'Fehler beim Hochladen.' });
  }
});

export default router;
