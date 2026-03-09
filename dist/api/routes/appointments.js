"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentRoutes = appointmentRoutes;
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const validation_1 = require("../middleware/validation");
const logger_1 = require("../../infrastructure/logging/logger");
const appointmentSchema = joi_1.default.object({
    patientId: joi_1.default.string().uuid().required(),
    providerId: joi_1.default.string().uuid().required(),
    appointmentType: joi_1.default.string().required(),
    location: joi_1.default.string().required(),
    startTime: joi_1.default.date().iso().required(),
    durationMinutes: joi_1.default.number().min(15).max(480).required(),
    notes: joi_1.default.string().optional(),
});
function appointmentRoutes(db, config) {
    const router = (0, express_1.Router)();
    router.post('/', (0, validation_1.validate)(appointmentSchema), async (req, res) => {
        try {
            const { patientId, providerId, appointmentType, location, startTime, durationMinutes, notes } = req.body;
            const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000);
            const conflicts = await db.query('SELECT id FROM appointments WHERE provider_id = $1 AND status != $2 AND ((start_time <= $3 AND end_time > $3) OR (start_time < $4 AND end_time >= $4) OR (start_time >= $3 AND end_time <= $4))', [providerId, 'cancelled', startTime, endTime]);
            if (conflicts.rows.length > 0) {
                return res.status(409).json({ error: 'Provider schedule conflict' });
            }
            const result = await db.query(`INSERT INTO appointments (patient_id, provider_id, appointment_type, status, location, start_time, end_time, duration_minutes, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, patient_id, provider_id, appointment_type, status, start_time, end_time`, [patientId, providerId, appointmentType, 'scheduled', location, startTime, endTime, durationMinutes, notes]);
            await db.query('INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'CREATE', 'appointment', result.rows[0].id, req.ip]);
            res.status(201).json(result.rows[0]);
        }
        catch (error) {
            logger_1.logger.error('Appointment creation error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.get('/', validation_1.validatePagination, async (req, res) => {
        try {
            const limit = parseInt(req.query.limit, 10);
            const offset = parseInt(req.query.offset, 10);
            const providerId = req.query.providerId;
            let query = 'SELECT id, patient_id, provider_id, appointment_type, status, start_time, end_time FROM appointments';
            const params = [];
            if (providerId) {
                query += ' WHERE provider_id = $1';
                params.push(providerId);
            }
            query += ' ORDER BY start_time DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
            params.push(limit, offset);
            const result = await db.query(query, params);
            res.json({ appointments: result.rows, limit, offset });
        }
        catch (error) {
            logger_1.logger.error('Appointment list error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    return router;
}
//# sourceMappingURL=appointments.js.map