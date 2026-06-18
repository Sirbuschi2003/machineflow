import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ message: 'Nicht autorisiert. Bitte anmelden.' });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.userId) {
      res.status(401).json({ message: 'Nicht autorisiert.' });
      return;
    }
    if (!req.session.userRole || !roles.includes(req.session.userRole)) {
      res.status(403).json({ message: 'Keine Berechtigung für diese Aktion.' });
      return;
    }
    next();
  };
}
