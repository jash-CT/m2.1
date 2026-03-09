"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimRoutes = claimRoutes;
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const uuid_1 = require("uuid");
const crypto_1 = require("../../infrastructure/encryption/crypto");
const validation_1 = require("../middleware/validation");
const logger_1 = require("../../infrastructure/logging/logger");
const claimSchema = joi_1.default.object({
    patientId: joi_1.default.string().uuid().required(),
    encounterId: joi_1.default.string().uuid().required(),
    payer: joi_1.default.string().required(),
    totalAmount: joi_1.default.number().positive().required(),
});
const eligibilityCheckSchema = joi_1.default.object({
    patientId: joi_1.default.string().uuid().required(),
    payer: joi_1.default.string().required(),
    policyNumber: joi_1.default.string().required(),
});
function claimRoutes(db, config) {
    const router = (0, express_1.Router)();
    const encryption = new crypto_1.EncryptionService(config.encryption.key);
    router.post('/', (0, validation_1.validate)(claimSchema), async (req, res) => {
        try {
            const { patientId, encounterId, payer, totalAmount } = req.body;
            const claimNumber = `CLM-${(0, uuid_1.v4)().substring(0, 12).toUpperCase()}`;
            const result = await db.query(`INSERT INTO claims (patient_id, encounter_id, claim_number, payer, status, total_amount, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         RETURNING id, claim_number, payer, status, total_amount, submitted_at`, [patientId, encounterId, claimNumber, payer, 'submitted', totalAmount]);
            await db.query('INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'CREATE', 'claim', result.rows[0].id, req.ip]);
            res.status(201).json(result.rows[0]);
        }
        catch (error) {
            logger_1.logger.error('Claim creation error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.post('/eligibility', (0, validation_1.validate)(eligibilityCheckSchema), async (req, res) => {
        try {
            const { patientId, payer, policyNumber } = req.body;
            const isEligible = Math.random() > 0.3;
            const coverageDetails = isEligible ? { deductible: 1000, copay: 25, coverageLevel: 'standard' } : null;
            const result = await db.query(`INSERT INTO eligibility_checks (patient_id, payer, policy_number_encrypted, status, is_eligible, coverage_details)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, payer, status, is_eligible, coverage_details, checked_at`, [patientId, payer, encryption.encrypt(policyNumber), 'completed', isEligible, JSON.stringify(coverageDetails)]);
            await db.query('INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'CREATE', 'eligibility_check', result.rows[0].id, req.ip]);
            res.status(201).json(result.rows[0]);
        }
        catch (error) {
            logger_1.logger.error('Eligibility check error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.get('/', validation_1.validatePagination, async (req, res) => {
        try {
            const limit = parseInt(req.query.limit, 10);
            const offset = parseInt(req.query.offset, 10);
            const result = await db.query('SELECT id, claim_number, payer, status, total_amount, submitted_at FROM claims ORDER BY submitted_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
            res.json({ claims: result.rows, limit, offset });
        }
        catch (error) {
            logger_1.logger.error('Claim list error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    return router;
}
//# sourceMappingURL=claims.js.map