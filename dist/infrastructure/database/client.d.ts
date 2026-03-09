import { PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
export declare class DatabaseClient {
    private pool;
    constructor(config: PoolConfig);
    connect(): Promise<void>;
    query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    close(): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map