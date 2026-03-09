import { Application } from 'express';
import { DatabaseClient } from '../../infrastructure/database/client';
import { Config } from '../../infrastructure/config/config';
import { patientRoutes } from './patients';
import { referralRoutes } from './referrals';
import { appointmentRoutes } from './appointments';
import { claimRoutes } from './claims';
import { reportRoutes } from './reports';
import { authRoutes } from './auth';

export function setupRoutes(app: Application, db: DatabaseClient, config: Config) {
  app.use('/api/auth', authRoutes(db, config));
  app.use('/api/patients', patientRoutes(db, config));
  app.use('/api/referrals', referralRoutes(db, config));
  app.use('/api/appointments', appointmentRoutes(db, config));
  app.use('/api/claims', claimRoutes(db, config));
  app.use('/api/reports', reportRoutes(db, config));
}