import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseClient } from '../../infrastructure/database/client';
import { Config } from '../../infrastructure/config/config';
import { EncryptionService } from '../../infrastructure/encryption/crypto';
import { validate, validatePagination } from '../middleware/validation';
import { logger } from '../../infrastructure/logging/logger';

const patientSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  dob: Joi.date().iso().required(),
  ssn: Joi.string().pattern(/^\d{9}$/).optional(),
  gender: Joi.string().valid('male', 'female', 'other', 'unknown').required(),
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  address: Joi.string().optional(),
  emergencyContact: Joi.string().optional(),
});

const consentSchema = Joi.object({
  consentType: Joi.string().required(),
  status: Joi.string().valid('granted', 'denied', 'revoked').required(),
  documentUrl: Joi.string().uri().optional(),
});

export function patientRoutes(db: DatabaseClient, config: Config) {
  const router = Router();
  const encryption = new EncryptionService(config.encryption.key);

  router.post('/', validate(patientSchema), async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, dob, ssn, gender, email, phone, address, emergencyContact } = req.body;
      const mrn = `MRN-${uuidv4().substring(0, 8).toUpperCase()}`;

      const result = await db.query(
        `INSERT INTO patients (mrn, first_name_encrypted, last_name_encrypted, dob_encrypted, ssn_encrypted, gender, email_encrypted, phone_encrypted, address_encrypted, emergency_contact_encrypted, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, mrn, gender, created_at`,
        [
          mrn,
          encryption.encrypt(firstName),
          encryption.encrypt(lastName),
          encryption.encrypt(dob),
          ssn ? encryption.encrypt(ssn) : null,
          gender,
          email ? encryption.encrypt(email) : null,
          phone ? encryption.encrypt(phone) : null,
          address ? encryption.encrypt(address) : null,
          emergencyContact ? encryption.encrypt(emergencyContact) : null,
          req.user!.id,
        ]
      );

      const patient = result.rows[0];
      logger.info('Patient created', { patientId: patient.id, mrn: patient.mrn, userId: req.user!.id });

      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'CREATE', 'patient', patient.id, req.ip]
      );

      res.status(201).json(patient);
    } catch (error: any) {
      logger.error('Patient creation error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/', validatePagination, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string, 10);
      const offset = parseInt(req.query.offset as string, 10);

      const result = await db.query(
        'SELECT id, mrn, gender, created_at FROM patients ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      res.json({ patients: result.rows, limit, offset });
    } catch (error: any) {
      logger.error('Patient list error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      // Authorization check: verify user has access to this patient
      // Staff can only access patients they created
      // Providers can access patients assigned to them via encounters
      // Admins can access all patients
      const result = await db.query(
        'SELECT id, mrn, first_name_encrypted, last_name_encrypted, dob_encrypted, gender, email_encrypted, phone_encrypted, created_at FROM patients WHERE id = $1 AND (created_by = $2 OR $3 IN (SELECT provider_id FROM encounters WHERE patient_id = $1) OR $4 = \'admin\')',
       [req.params.id, req.user!.id, req.user!.id, req.user!.role]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const patient = result.rows[0];
      const decrypted = {
        id: patient.id,
        mrn: patient.mrn,
        firstName: encryption.decrypt(patient.first_name_encrypted),
        lastName: encryption.decrypt(patient.last_name_encrypted),
        dob: encryption.decrypt(patient.dob_encrypted),
        gender: patient.gender,
        email: patient.email_encrypted ? encryption.decrypt(patient.email_encrypted) : null,
        phone: patient.phone_encrypted ? encryption.decrypt(patient.phone_encrypted) : null,
        createdAt: patient.created_at,
      };

      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'READ', 'patient', patient.id, req.ip]
      );

      res.json(decrypted);
    } catch (error: any) {
      logger.error('Patient retrieval error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:id/consents', validate(consentSchema), async (req: Request, res: Response) => {
    try {
      const { consentType, status, documentUrl } = req.body;
      const grantedAt = status === 'granted' ? new Date() : null;

      const result = await db.query(
        'INSERT INTO consents (patient_id, consent_type, status, granted_at, document_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, consent_type, status, granted_at',
        [req.params.id, consentType, status, grantedAt, documentUrl]
      );

      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'CREATE', 'consent', result.rows[0].id, req.ip]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      logger.error('Consent creation error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}