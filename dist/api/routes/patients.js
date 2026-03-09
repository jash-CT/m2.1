"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientRoutes = patientRoutes;
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const uuid_1 = require("uuid");
const crypto_1 = require("../../infrastructure/encryption/crypto");
const validation_1 = require("../middleware/validation");
const logger_1 = require("../../infrastructure/logging/logger");
const patientSchema = joi_1.default.object({
    firstName: joi_1.default.string().required(),
    lastName: joi_1.default.string().required(),
    dob: joi_1.default.date().iso().required(),
    ssn: joi_1.default.string().pattern(/^\d{9}$/).optional(),
    gender: joi_1.default.string().valid('male', 'female', 'other', 'unknown').required(),
    email: joi_1.default.string().email().optional(),
    phone: joi_1.default.string().optional(),
    address: joi_1.default.string().optional(),
    emergencyContact: joi_1.default.string().optional(),
});
const consentSchema = joi_1.default.object({
    consentType: joi_1.default.string().required(),
    status: joi_1.default.string().valid('granted', 'denied', 'revoked').required(),
    documentUrl: joi_1.default.string().uri().optional(),
});
function patientRoutes(db, config) {
    const router = (0, express_1.Router)();
    const encryption = new crypto_1.EncryptionService(config.encryption.key);
    router.post('/', (0, validation_1.validate)(patientSchema), async (req, res) => {
        try {
            const { firstName, lastName, dob, ssn, gender, email, phone, address, emergencyContact } = req.body;
            const mrn = `MRN-${(0, uuid_1.v4)().substring(0, 8).toUpperCase()}`;
            const result = await db.query(`INSERT INTO patients (mrn, first_name_encrypted, last_name_encrypted, dob_encrypted, ssn_encrypted, gender, email_encrypted, phone_encrypted, address_encrypted, emergency_contact_encrypted, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, mrn, gender, created_at`, [
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
                req.user.id,
            ]);
            const patient = result.rows[0];
            logger_1.logger.info('Patient created', { patientId: patient.id, mrn: patient.mrn, userId: req.user.id });
            await db.query('INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'CREATE', 'patient', patient.id, req.ip]);
            res.status(201).json(patient);
        }
        catch (error) {
            logger_1.logger.error('Patient creation error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.get('/', validation_1.validatePagination, async (req, res) => {
        try {
            const limit = parseInt(req.query.limit, 10);
            const offset = parseInt(req.query.offset, 10);
            const result = await db.query('SELECT id, mrn, gender, created_at FROM patients ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
            res.json({ patients: result.rows, limit, offset });
        }
        catch (error) {
            logger_1.logger.error('Patient list error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.get('/:id', async (req, res) => {
        try {
            const result = await db.query('SELECT id, mrn, first_name_encrypted, last_name_encrypted, dob_encrypted, gender, email_encrypted, phone_encrypted, created_at FROM patients WHERE id = $1', [req.params.id]);
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
            await db.query('INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'READ', 'patient', patient.id, req.ip]);
            res.json(decrypted);
        }
        catch (error) {
            logger_1.logger.error('Patient retrieval error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.post('/:id/consents', (0, validation_1.validate)(consentSchema), async (req, res) => {
        try {
            const { consentType, status, documentUrl } = req.body;
            const grantedAt = status === 'granted' ? new Date() : null;
            const result = await db.query('INSERT INTO consents (patient_id, consent_type, status, granted_at, document_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, consent_type, status, granted_at', [req.params.id, consentType, status, grantedAt, documentUrl]);
            await db.query('INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'CREATE', 'consent', result.rows[0].id, req.ip]);
            res.status(201).json(result.rows[0]);
        }
        catch (error) {
            logger_1.logger.error('Consent creation error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    return router;
}
//# sourceMappingURL=patients.js.map