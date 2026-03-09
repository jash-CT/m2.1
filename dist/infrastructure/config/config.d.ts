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
export declare function configLoader(): Config;
//# sourceMappingURL=config.d.ts.map