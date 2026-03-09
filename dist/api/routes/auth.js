"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const joi_1 = __importDefault(require("joi"));
const validation_1 = require("../middleware/validation");
const logger_1 = require("../../infrastructure/logging/logger");
const loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(8).required(),
});
const registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(12).required(),
    firstName: joi_1.default.string().required(),
    lastName: joi_1.default.string().required(),
    role: joi_1.default.string().valid('admin', 'provider', 'staff').required(),
});
function authRoutes(db, config) {
    const router = (0, express_1.Router)();
    router.post('/login', (0, validation_1.validate)(loginSchema), async (req, res) => {
        try {
            const { email, password } = req.body;
            const result = await db.query('SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1', [email]);
            if (result.rows.length === 0) {
                logger_1.logger.warn('Login attempt for non-existent user', { email, ip: req.ip });
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const user = result.rows[0];
            if (!user.is_active) {
                logger_1.logger.warn('Login attempt for inactive user', { email, ip: req.ip });
                return res.status(401).json({ error: 'Account inactive' });
            }
            const valid = await bcrypt_1.default.compare(password, user.password_hash);
            if (!valid) {
                logger_1.logger.warn('Login attempt with invalid password', { email, ip: req.ip });
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const token = jsonwebtoken_1.default.sign({
                sub: user.id,
                email: user.email,
                role: user.role,
            }, config.jwt.secret, {
                algorithm: 'HS256',
                expiresIn: config.jwt.expiry,
            });
            logger_1.logger.info('User logged in', { userId: user.id, email: user.email });
            res.json({ token, expiresIn: config.jwt.expiry });
        }
        catch (error) {
            logger_1.logger.error('Login error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    router.post('/register', (0, validation_1.validate)(registerSchema), async (req, res) => {
        try {
            const { email, password, firstName, lastName, role } = req.body;
            const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existingUser.rows.length > 0) {
                return res.status(409).json({ error: 'Email already registered' });
            }
            const passwordHash = await bcrypt_1.default.hash(password, 12);
            const result = await db.query('INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role', [email, passwordHash, role, firstName, lastName]);
            const newUser = result.rows[0];
            logger_1.logger.info('User registered', { userId: newUser.id, email: newUser.email });
            await db.query('INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [newUser.id, 'CREATE', 'user', newUser.id, req.ip]);
            res.status(201).json({ id: newUser.id, email: newUser.email, role: newUser.role });
        }
        catch (error) {
            logger_1.logger.error('Registration error', { error: error.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    return router;
}
//# sourceMappingURL=auth.js.map