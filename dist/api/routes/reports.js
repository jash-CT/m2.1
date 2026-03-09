"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRoutes = reportRoutes;
const express_1 = require("express");
const pdfkit_1 = __importDefault(require("pdfkit"));
const csv_stringify_1 = require("csv-stringify");
const logger_1 = require("../../infrastructure/logging/logger");
function reportRoutes(db, config) {
    const router = (0, express_1.Router)();
    router.get('/dashboard', async (req, res) => {
        try {
            const patientCount = await db.query('SELECT COUNT(*) as count FROM patients');
            const appointmentCount = await db.query('SELECT COUNT(*) as count FROM appointments WHERE start_time >= CURRENT_DATE');
            const pendingReferrals = await db.query('SELECT COUNT(*) as count FROM referrals WHERE status = $1', ['pending']);
            const claimsSubmitted = await db.query('SELECT COUNT(*) as count FROM claims WHERE submitted_at >= CURRENT_DATE - INTERVAL \'30 days\'');
            res.json({
                patients: parseInt(patientCount.rows[0].count, 10),
                todayAppointments: parseInt(appointmentCount.rows[0].count, 10),
                pendingReferrals: parseInt(pendingReferrals.rows[0].count, 10),
                recentClaims: parseInt(claimsSubmitted.rows[0].count, 10),
            });
        }
        catch (error) {
            logger_1.logger.error('Dashboard report error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.get('/patients/export', async (req, res) => {
        try {
            const format = req.query.format || 'csv';
            const result = await db.query('SELECT id, mrn, gender, created_at FROM patients ORDER BY created_at DESC LIMIT 1000');
            if (format === 'pdf') {
                const doc = new pdfkit_1.default();
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=patients.pdf');
                doc.pipe(res);
                doc.fontSize(16).text('Patient Report', { align: 'center' });
                doc.moveDown();
                result.rows.forEach((row, idx) => {
                    doc.fontSize(10).text(`${idx + 1}. MRN: ${row.mrn}, Gender: ${row.gender}, Created: ${row.created_at}`);
                });
                doc.end();
            }
            else {
                const csvData = result.rows.map(r => [r.id, r.mrn, r.gender, r.created_at]);
                csvData.unshift(['ID', 'MRN', 'Gender', 'Created At']);
                (0, csv_stringify_1.stringify)(csvData, (err, output) => {
                    if (err) {
                        logger_1.logger.error('CSV generation error', { error: err.message });
                        return res.status(500).json({ error: 'Internal server error' });
                    }
                    res.setHeader('Content-Type', 'text/csv');
                    res.setHeader('Content-Disposition', 'attachment; filename=patients.csv');
                    res.send(output);
                });
            }
            await db.query('INSERT INTO audit_logs (user_id, action, resource_type, ip_address, details) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'EXPORT', 'patient', req.ip, JSON.stringify({ format, count: result.rows.length })]);
        }
        catch (error) {
            logger_1.logger.error('Patient export error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    return router;
}
//# sourceMappingURL=reports.js.map