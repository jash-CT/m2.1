import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify';
import { DatabaseClient } from '../../infrastructure/database/client';
import { Config } from '../../infrastructure/config/config';
import { logger } from '../../infrastructure/logging/logger';

export function reportRoutes(db: DatabaseClient, config: Config) {
  const router = Router();

  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      // Ensure tenant isolation for multi-tenant deployment
      const tenantId = (req as any).user?.tenant_id;
      if (!tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      const patientCount = await db.query('SELECT COUNT(*) as count FROM patients WHERE tenant_id = $1', [tenantId]);
      const appointmentCount = await db.query('SELECT COUNT(*) as count FROM appointments WHERE tenant_id = $1 AND start_time >= CURRENT_DATE', [tenantId]);
      const pendingReferrals = await db.query('SELECT COUNT(*) as count FROM referrals WHERE tenant_id = $1 AND status = $2', [tenantId, 'pending']);
      const claimsSubmitted = await db.query('SELECT COUNT(*) as count FROM claims WHERE tenant_id = $1 AND submitted_at >= CURRENT_DATE - INTERVAL \'30 days\'', [tenantId]);

      res.json({
        patients: parseInt(patientCount.rows[0].count, 10),
        todayAppointments: parseInt(appointmentCount.rows[0].count, 10),
        pendingReferrals: parseInt(pendingReferrals.rows[0].count, 10),
        recentClaims: parseInt(claimsSubmitted.rows[0].count, 10),
      });
    } catch (error: any) {
      logger.error('Dashboard report error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/patients/export', async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as string) || 'csv';
      const result = await db.query('SELECT id, mrn, gender, created_at FROM patients ORDER BY created_at DESC LIMIT 1000');

      if (format === 'pdf') {
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=patients.pdf');
        doc.pipe(res);
        doc.fontSize(16).text('Patient Report', { align: 'center' });
        doc.moveDown();
        result.rows.forEach((row, idx) => {
          doc.fontSize(10).text(`${idx + 1}. MRN: ${row.mrn}, Gender: ${row.gender}, Created: ${row.created_at}`);
        });
        doc.end();
      } else {
        const csvData = result.rows.map(r => [r.id, r.mrn, r.gender, r.created_at]);
        csvData.unshift(['ID', 'MRN', 'Gender', 'Created At']);
        stringify(csvData, (err, output) => {
          if (err) {
            logger.error('CSV generation error', { error: err.message });
            return res.status(500).json({ error: 'Internal server error' });
          }
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=patients.csv');
          res.send(output);
        });
      }

      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, ip_address, details) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'EXPORT', 'patient', req.ip, JSON.stringify({ format, count: result.rows.length })]
      );
    } catch (error: any) {
      logger.error('Patient export error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}