import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { DatabaseClient } from '../../infrastructure/database/client';
import { Config } from '../../infrastructure/config/config';
import { validate, validatePagination } from '../middleware/validation';
import { logger } from '../../infrastructure/logging/logger';

const appointmentSchema = Joi.object({
  patientId: Joi.string().uuid().required(),
  providerId: Joi.string().uuid().required(),
  appointmentType: Joi.string().required(),
  location: Joi.string().required(),
  startTime: Joi.date().iso().required(),
  durationMinutes: Joi.number().min(15).max(480).required(),
  notes: Joi.string().optional(),
});

export function appointmentRoutes(db: DatabaseClient, config: Config) {
  const router = Router();

  router.post('/', validate(appointmentSchema), async (req: Request, res: Response) => {
    try {
      const { patientId, providerId, appointmentType, location, startTime, durationMinutes, notes } = req.body;
      const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000);

      const conflicts = await db.query(
        'SELECT id FROM appointments WHERE provider_id = $1 AND status != $2 AND ((start_time <= $3 AND end_time > $3) OR (start_time < $4 AND end_time >= $4) OR (start_time >= $3 AND end_time <= $4))',
        [providerId, 'cancelled', startTime, endTime]
      );

      if (conflicts.rows.length > 0) {
        return res.status(409).json({ error: 'Provider schedule conflict' });
      }

      const result = await db.query(
        `INSERT INTO appointments (patient_id, provider_id, appointment_type, status, location, start_time, end_time, duration_minutes, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, patient_id, provider_id, appointment_type, status, start_time, end_time`,
        [patientId, providerId, appointmentType, 'scheduled', location, startTime, endTime, durationMinutes, notes]
      );

      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'CREATE', 'appointment', result.rows[0].id, req.ip]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      logger.error('Appointment creation error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/', validatePagination, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string, 10);
      const offset = parseInt(req.query.offset as string, 10);
      const providerId = req.query.providerId as string;

      let query = 'SELECT id, patient_id, provider_id, appointment_type, status, start_time, end_time FROM appointments';
      const params: any[] = [];

      if (providerId) {
        query += ' WHERE provider_id = $1';
        params.push(providerId);
      }

      query += ' ORDER BY start_time DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await db.query(query, params);
      res.json({ appointments: result.rows, limit, offset });
    } catch (error: any) {
      logger.error('Appointment list error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}