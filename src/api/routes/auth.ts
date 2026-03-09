import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { DatabaseClient } from '../../infrastructure/database/client';
import { Config } from '../../infrastructure/config/config';
import { validate } from '../middleware/validation';
import { logger } from '../../infrastructure/logging/logger';

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(12).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  role: Joi.string().valid('admin', 'provider', 'staff').required(),
});

export function authRoutes(db: DatabaseClient, config: Config) {
  const router = Router();

  router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const result = await db.query(
        'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        logger.warn('Login attempt for non-existent user', { email, ip: req.ip });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      if (!user.is_active) {
        logger.warn('Login attempt for inactive user', { email, ip: req.ip });
        return res.status(401).json({ error: 'Account inactive' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        logger.warn('Login attempt with invalid password', { email, ip: req.ip });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
        },
        config.jwt.secret,
        {
          algorithm: 'HS256',
          expiresIn: config.jwt.expiry,
        }
      );

      logger.info('User logged in', { userId: user.id, email: user.email });
      res.json({ token, expiresIn: config.jwt.expiry });
    } catch (error: any) {
      logger.error('Login error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const result = await db.query(
        'INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role',
        [email, passwordHash, role, firstName, lastName]
      );

      const newUser = result.rows[0];
      logger.info('User registered', { userId: newUser.id, email: newUser.email });

      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [newUser.id, 'CREATE', 'user', newUser.id, req.ip]
      );

      res.status(201).json({ id: newUser.id, email: newUser.email, role: newUser.role });
    } catch (error: any) {
      logger.error('Registration error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}