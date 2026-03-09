import winston from 'winston';

const redactSensitive = winston.format((info) => {
  const sensitiveKeys = ['password', 'secret', 'token', 'authorization', 'api_key', 'ssn', 'dob', 'insurance_number'];
  const redact = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    const result: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        result[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        result[key] = redact(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  };
  return redact(info);
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    redactSensitive(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});