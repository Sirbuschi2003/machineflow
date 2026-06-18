import express from 'express';
import session from 'express-session';
import cors from 'cors';
import authRouter from './routes/auth';
import customersRouter from './routes/customers';
import machineModelsRouter from './routes/machineModels';
import accessoriesRouter from './routes/accessories';
import machineRequestsRouter from './routes/machineRequests';
import salesRepsRouter from './routes/salesReps';
import statisticsRouter from './routes/statistics';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    userRole: string;
    userName: string;
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/machine-models', machineModelsRouter);
app.use('/api/accessories', accessoriesRouter);
app.use('/api/machine-requests', machineRequestsRouter);
app.use('/api/sales-reps', salesRepsRouter);
app.use('/api/statistics', statisticsRouter);

app.listen(PORT, () => {
  console.log(`Auftragsverwaltung Backend läuft auf Port ${PORT}`);
});

export default app;
