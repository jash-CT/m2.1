"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseClient = void 0;
const pg_1 = require("pg");
const logger_1 = require("../logging/logger");
class DatabaseClient {
    pool;
    constructor(config) {
        this.pool = new pg_1.Pool(config);
    }
    async connect() {
        try {
            const client = await this.pool.connect();
            client.release();
            logger_1.logger.info('Database connection validated');
        }
        catch (error) {
            logger_1.logger.error('Database connection failed', { error: error.message });
            throw error;
        }
    }
    async query(text, params) {
        try {
            return await this.pool.query(text, params);
        }
        catch (error) {
            logger_1.logger.error('Database query error', { error: error.message, query: text });
            throw error;
        }
    }
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger_1.logger.error('Transaction rolled back', { error: error.message });
            throw error;
        }
        finally {
            client.release();
        }
    }
    async close() {
        await this.pool.end();
        logger_1.logger.info('Database pool closed');
    }
}
exports.DatabaseClient = DatabaseClient;
//# sourceMappingURL=client.js.map