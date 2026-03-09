import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

export interface Config {
  server: {
    host: string;
    port: number;
    env: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    maxConnections: number;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    tls: boolean;
  };
  jwt: {
    secret: string;
    expiry: number;
  };
  apiKey: {
    secret: string;
  };
  cors: {
    allowedOrigins: string[];
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  ehr: {
    fhirBaseUrl: string;
    clientId: string;
    clientSecret: string;
  };
  encryption: {
    key: Buffer;
  };
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function validateSecret(name: string, value: string | undefined, minLength: number): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required and cannot be empty`);
  }
  if (value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters (cryptographic quality required)`);
  }
  return value;
}

function validateEncryptionKey(value: string | undefined): Buffer {
  if (!value || value.trim().length === 0) {
    throw new Error('ENCRYPTION_KEY is required');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('ENCRYPTION_KEY must be 64-character hex string (32 bytes)');
  }
  return Buffer.from(value, 'hex');
}

function validateCorsOrigins(value: string | undefined): string[] {
  if (!value || value.trim().length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS is required and cannot be empty');
  }
  const origins = value.split(',').map(o => o.trim()).filter(o => o.length > 0);
  if (origins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must contain at least one origin');
  }
  if (origins.some(o => o.includes('*'))) {
    throw new Error('CORS_ALLOWED_ORIGINS cannot contain wildcards');
  }
  return origins;
}

export function configLoader(): Config {
  const jwtSecret = validateSecret('JWT_SECRET', process.env.JWT_SECRET, 64);
  const apiKeySecret = validateSecret('API_KEY_SECRET', process.env.API_KEY_SECRET, 64);
  const encryptionKey = validateEncryptionKey(process.env.ENCRYPTION_KEY);
  const corsOrigins = validateCorsOrigins(process.env.CORS_ALLOWED_ORIGINS);

  const dbPassword = validateSecret('DB_PASSWORD', process.env.DB_PASSWORD, 16);
  const redisPassword = validateSecret('REDIS_PASSWORD', process.env.REDIS_PASSWORD, 16);

  return {
    server: {
      host: process.env.HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '3000', 10),
      env: process.env.NODE_ENV || 'production',
    },
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME || 'healthcare_coordination',
      user: process.env.DB_USER || 'healthcare_app',
      password: dbPassword,
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: redisPassword,
      tls: process.env.REDIS_TLS === 'true',
    },
    jwt: {
      secret: jwtSecret,
      expiry: parseInt(process.env.JWT_EXPIRY || '3600', 10),
    },
    apiKey: {
      secret: apiKeySecret,
    },
    cors: {
      allowedOrigins: corsOrigins,
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
    ehr: {
      fhirBaseUrl: process.env.EHR_FHIR_BASE_URL || '',
      clientId: process.env.EHR_CLIENT_ID || '',
      clientSecret: process.env.EHR_CLIENT_SECRET || '',
    },
    encryption: {
      key: encryptionKey,
    },
  };
}