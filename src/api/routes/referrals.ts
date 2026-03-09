import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { DatabaseClient } from '../../infrastructure/database/client';
import { Config } from '../../infrastructure/config/config';
import { EncryptionService } from '../../infrastructure/encryption/crypto';
import { validate, validatePagination } from '../middleware/validation';
import { logger } from '../../infrastructure/logging/logger';

const referralSchema = Joi.object({
  patientId: Joi.string().uuid().required(),
  specialistProviderId: Joi.string().uuid().optional(),
  referralType: Joi.string().required(),
  priority: Joi.string().valid('routine', 'urgent', 'emergent').required(),
  reason: Joi.string().required(),
  clinicalNotes: Joi.string().optional(),
});

const referralUpdateSchema = Joi.object({
  status: Joi.string().valid('pending', 'accepted', 'declined', 'completed', 'cancelled').required(),
  handoffNotes: Joi.string().optional(),
});

export function referralRoutes(db: DatabaseClient, config: Config) {
  const router = Router();
  const encryption = new EncryptionService(config.encryption.key);

  router.post('/', validate(referralSchema), async (req: Request, res: Response) => {
    try {
      const { patientId, specialistProviderId, referralType, priority, reason, clinicalNotes } = req.body;

      const result = await db.query(
        `INSERT INTO referrals (patient_id, referring_provider_id, specialist_provider_id, referral_type, status, priority, reason, clinical_notes_encrypted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, patient_id, referral_type, status, priority, created_at`,
        [
          patientId,
          req.user!.id,
          specialistProviderId || null,
          referralType,
          'pending',
          priority,
          reason,
          clinicalNotes ? encryption.encrypt(clinicalNotes) : null,
        ]
      );

      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'CREATE', 'referral', result.rows[0].id, req.ip]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      logger.error('Referral creation error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/', validatePagination, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string, 10);
      const offset = parseInt(req.query.offset as string, 10);

      const result = await db.query(
        'SELECT id, patient_id, referral_type, status, priority, created_at FROM referrals ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      res.json({ referrals: result.rows, limit, offset });
    } catch (error: any) {
      logger.error('Referral list error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id', validate(referralUpdateSchema), async (req: Request, res: Response) => {
    try {
      const { status, handoffNotes } = req.body;

      const result = await db.query(
        'UPDATE referrals SET status = $1, handoff_notes_encrypted = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, status, updated_at',
        [status, handoffNotes ? encryption.encrypt(handoffNotes) : null, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Referral not found' });
      }

      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'UPDATE', 'referral', req.params.id, req.ip]
      );

      res.json(result.rows[0]);
    } catch (error: any) {
      logger.error('Referral update error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}