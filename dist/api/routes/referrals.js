"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralRoutes = referralRoutes;
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const crypto_1 = require("../../infrastructure/encryption/crypto");
const validation_1 = require("../middleware/validation");
const logger_1 = require("../../infrastructure/logging/logger");
const referralSchema = joi_1.default.object({
    patientId: joi_1.default.string().uuid().required(),
    specialistProviderId: joi_1.default.string().uuid().optional(),
    referralType: joi_1.default.string().required(),
    priority: joi_1.default.string().valid('routine', 'urgent', 'emergent').required(),
    reason: joi_1.default.string().required(),
    clinicalNotes: joi_1.default.string().optional(),
});
const referralUpdateSchema = joi_1.default.object({
    status: joi_1.default.string().valid('pending', 'accepted', 'declined', 'completed', 'cancelled').required(),
    handoffNotes: joi_1.default.string().optional(),
});
function referralRoutes(db, config) {
    const router = (0, express_1.Router)();
    const encryption = new crypto_1.EncryptionService(config.encryption.key);
    router.post('/', (0, validation_1.validate)(referralSchema), async (req, res) => {
        try {
            const { patientId, specialistProviderId, referralType, priority, reason, clinicalNotes } = req.body;
            const result = await db.query(`INSERT INTO referrals (patient_id, referring_provider_id, specialist_provider_id, referral_type, status, priority, reason, clinical_notes_encrypted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, patient_id, referral_type, status, priority, created_at`, [
                patientId,
                req.user.id,
                specialistProviderId || null,
                referralType,
                'pending',
                priority,
                reason,
                clinicalNotes ? encryption.encrypt(clinicalNotes) : null,
            ]);
            await db.query('INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'CREATE', 'referral', result.rows[0].id, req.ip]);
            res.status(201).json(result.rows[0]);
        }
        catch (error) {
            logger_1.logger.error('Referral creation error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.get('/', validation_1.validatePagination, async (req, res) => {
        try {
            const limit = parseInt(req.query.limit, 10);
            const offset = parseInt(req.query.offset, 10);
            const result = await db.query('SELECT id, patient_id, referral_type, status, priority, created_at FROM referrals ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
            res.json({ referrals: result.rows, limit, offset });
        }
        catch (error) {
            logger_1.logger.error('Referral list error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.patch('/:id', (0, validation_1.validate)(referralUpdateSchema), async (req, res) => {
        try {
            const { status, handoffNotes } = req.body;
            const result = await db.query('UPDATE referrals SET status = $1, handoff_notes_encrypted = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, status, updated_at', [status, handoffNotes ? encryption.encrypt(handoffNotes) : null, req.params.id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Referral not found' });
            }
            await db.query('INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'UPDATE', 'referral', req.params.id, req.ip]);
            res.json(result.rows[0]);
        }
        catch (error) {
            logger_1.logger.error('Referral update error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    return router;
}
//# sourceMappingURL=referrals.js.map