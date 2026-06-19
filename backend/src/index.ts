import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fs from 'fs';
import authRouter from './routes/auth';
import customersRouter from './routes/customers';
import machineModelsRouter from './routes/machineModels';
import accessoriesRouter from './routes/accessories';
import machineRequestsRouter from './routes/machineRequests';
import salesRepsRouter from './routes/salesReps';
import statisticsRouter from './routes/statistics';
import importRouter from './routes/import';
import uploadsRouter from './routes/uploads';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    userRole: string;
    userName: string;
  }
}

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

app.use('/api/uploads/files', express.static(UPLOADS_DIR));
app.use('/api/uploads', uploadsRouter);
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/machine-models', machineModelsRouter);
app.use('/api/accessories', accessoriesRouter);
app.use('/api/machine-requests', machineRequestsRouter);
app.use('/api/sales-reps', salesRepsRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/import', importRouter);

app.listen(PORT, () => {
  console.log(`Auftragsverwaltung Backend läuft auf Port ${PORT}`);
});

export default app;
