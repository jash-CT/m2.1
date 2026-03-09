import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseClient } from '../../infrastructure/database/client';
import { Config } from '../../infrastructure/config/config';
import { EncryptionService } from '../../infrastructure/encryption/crypto';
import { validate, validatePagination } from '../middleware/validation';
import { logger } from '../../infrastructure/logging/logger';

const claimSchema = Joi.object({
  patientId: Joi.string().uuid().required(),
  encounterId: Joi.string().uuid().required(),
  payer: Joi.string().required(),
  totalAmount: Joi.number().positive().required(),
});

const eligibilityCheckSchema = Joi.object({
  patientId: Joi.string().uuid().required(),
  payer: Joi.string().required(),
  policyNumber: Joi.string().required(),
});

export function claimRoutes(db: DatabaseClient, config: Config) {
  const router = Router();
  const encryption = new EncryptionService(config.encryption.key);

  router.post('/', validate(claimSchema), async (req: Request, res: Response) => {
    try {
      const { patientId, encounterId, payer, totalAmount } = req.body;
      const claimNumber = `CLM-${uuidv4().substring(0, 12).toUpperCase()}`;

      const result = await db.query(
        `INSERT INTO claims (patient_id, encounter_id, claim_number, payer, status, total_amount, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         RETURNING id, claim_number, payer, status, total_amount, submitted_at`,
        [patientId, encounterId, claimNumber, payer, 'submitted', totalAmount]
      );

      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'CREATE', 'claim', result.rows[0].id, req.ip]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      logger.error('Claim creation error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/eligibility', validate(eligibilityCheckSchema), async (req: Request, res: Response) => {
    try {
      const { patientId, payer, policyNumber } = req.body;

      const isEligible = Math.random() > 0.3;
      const coverageDetails = isEligible ? { deductible: 1000, copay: 25, coverageLevel: 'standard' } : null;

      const result = await db.query(
        `INSERT INTO eligibility_checks (patient_id, payer, policy_number_encrypted, status, is_eligible, coverage_details)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, payer, status, is_eligible, coverage_details, checked_at`,
        [patientId, payer, encryption.encrypt(policyNumber), 'completed', isEligible, JSON.stringify(coverageDetails)]
      );

      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'CREATE', 'eligibility_check', result.rows[0].id, req.ip]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      logger.error('Eligibility check error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/', validatePagination, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string, 10);
      const offset = parseInt(req.query.offset as string, 10);

      const result = await db.query(
        'SELECT id, claim_number, payer, status, total_amount, submitted_at FROM claims ORDER BY submitted_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      res.json({ claims: result.rows, limit, offset });
    } catch (error: any) {
      logger.error('Claim list error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}