import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../logging/logger';

export class DatabaseClient {
  private pool: Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      logger.info('Database connection validated');
    } catch (error: any) {
      logger.error('Database connection failed', { error: error.message });
      throw error;
    }
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      return await this.pool.query<T>(text, params);
    } catch (error: any) {
      logger.error('Database query error', { error: error.message, query: text });
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database pool closed');
  }
}