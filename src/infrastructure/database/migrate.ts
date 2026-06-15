import { DatabaseClient } from './client';
import { logger } from '../logging/logger';

export async function runMigrations(db: DatabaseClient): Promise<void> {
  logger.info('Running database migrations...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrations = [
    {
      name: '001_create_users_table',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `,
    },
    {
      name: '002_create_patients_table',
      sql: `
        CREATE TABLE IF NOT EXISTS patients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mrn VARCHAR(50) UNIQUE NOT NULL,
          first_name_encrypted BYTEA NOT NULL,
          last_name_encrypted BYTEA NOT NULL,
          dob_encrypted BYTEA NOT NULL,
          ssn_encrypted BYTEA,
          gender VARCHAR(20),
          email_encrypted BYTEA,
          phone_encrypted BYTEA,
          address_encrypted BYTEA,
          emergency_contact_encrypted BYTEA,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);
      `,
    },
    {
      name: '003_create_consents_table',
      sql: `
        CREATE TABLE IF NOT EXISTS consents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
          consent_type VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL,
          granted_at TIMESTAMP,
          revoked_at TIMESTAMP,
          document_url VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_consents_patient ON consents(patient_id);
      `,
    },
    {
      name: '004_create_encounters_table',
      sql: `
        CREATE TABLE IF NOT EXISTS encounters (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
          encounter_type VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL,
          provider_id UUID REFERENCES users(id),
          location VARCHAR(200),
          start_time TIMESTAMP,
          end_time TIMESTAMP,
          chief_complaint TEXT,
          notes_encrypted BYTEA,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
        CREATE INDEX IF NOT EXISTS idx_encounters_provider ON encounters(provider_id);
      `,
    },
    {
      name: '005_create_referrals_table',
      sql: `
        CREATE TABLE IF NOT EXISTS referrals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
          referring_provider_id UUID REFERENCES users(id),
          specialist_provider_id UUID REFERENCES users(id),
          referral_type VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL,
          priority VARCHAR(20),
          reason TEXT,
          clinical_notes_encrypted BYTEA,
          handoff_notes_encrypted BYTEA,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id);
        CREATE INDEX IF NOT EXISTS idx_referrals_specialist ON referrals(specialist_provider_id);
      `,
    },
    {
      name: '006_create_appointments_table',
      sql: `
        CREATE TABLE IF NOT EXISTS appointments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
          provider_id UUID REFERENCES users(id),
          appointment_type VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL,
          location VARCHAR(200),
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          duration_minutes INTEGER,
          notes TEXT,
          reminder_sent BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
        CREATE INDEX IF NOT EXISTS idx_appointments_provider_time ON appointments(provider_id, start_time);
      `,
    },
    {
      name: '007_create_claims_table',
      sql: `
        CREATE TABLE IF NOT EXISTS claims (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
          encounter_id UUID REFERENCES encounters(id),
          claim_number VARCHAR(100) UNIQUE NOT NULL,
          payer VARCHAR(200) NOT NULL,
          status VARCHAR(50) NOT NULL,
          total_amount DECIMAL(10, 2),
          allowed_amount DECIMAL(10, 2),
          paid_amount DECIMAL(10, 2),
          patient_responsibility DECIMAL(10, 2),
          submitted_at TIMESTAMP,
          adjudicated_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);
        CREATE INDEX IF NOT EXISTS idx_claims_number ON claims(claim_number);
      `,
    },
    {
      name: '008_create_eligibility_checks_table',
      sql: `
        CREATE TABLE IF NOT EXISTS eligibility_checks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
          payer VARCHAR(200) NOT NULL,
          policy_number_encrypted BYTEA NOT NULL,
          status VARCHAR(50) NOT NULL,
          is_eligible BOOLEAN,
          coverage_details JSONB,
          checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_eligibility_patient ON eligibility_checks(patient_id);
      `,
    },
    {
      name: '009_create_audit_logs_table',
      sql: `
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id),
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(100) NOT NULL,
          resource_id UUID,
          ip_address VARCHAR(50),
          user_agent TEXT,
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
      `,
    },
    {
      name: '010_create_fhir_sync_log_table',
      sql: `
        CREATE TABLE IF NOT EXISTS fhir_sync_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          resource_type VARCHAR(100) NOT NULL,
          resource_id VARCHAR(255) NOT NULL,
          sync_direction VARCHAR(20) NOT NULL,
          status VARCHAR(50) NOT NULL,
          error_message TEXT,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_fhir_sync_resource ON fhir_sync_logs(resource_type, resource_id);
      `,
    },
  ];

  for (const migration of migrations) {
    // Safety guard: prevent automatic migrations in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_MIGRATIONS !== 'true') {
      logger.warn(
        'Skipping migrations in production. Set ALLOW_PRODUCTION_MIGRATIONS=true if intended.'
      );
      return;
    }

    const result = await db.query(
      'SELECT * FROM migrations WHERE name = $1',
      [migration.name]
    );

    if (result.rows.length === 0) {
      logger.info(`Running migration: ${migration.name}`);
      await db.query(migration.sql);
      await db.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [migration.name]
      );
      logger.info(`Migration completed: ${migration.name}`);
    }
  }

  logger.info('All migrations completed successfully');
}