# Security Notes (from CT-MCP code generation)

- **Secrets validation**: All secrets (JWT_SECRET, API_KEY_SECRET, ENCRYPTION_KEY, DB_PASSWORD, REDIS_PASSWORD) are validated at startup for presence, non-emptiness, and minimum cryptographic strength (64+ chars for signing secrets, 64-char hex for encryption key). System fails immediately if any requirement is violated.

- **Authentication**: Enforced on all endpoints except /health. JWT tokens require explicit HS256 algorithm enforcement, exp/iat/nbf validation with 60-second clock tolerance. API keys use constant-time comparison to prevent timing attacks.

- **Rate limiting**: Per-client (by IP) using Redis-backed sorted sets with atomic operations and TTL. Configurable (default: 100 requests per 15 minutes). Concurrency-safe.

- **CORS**: Origins validated from environment; no wildcards. Preflight OPTIONS return 403 for unauthorized origins.

- **PHI encryption**: All PHI encrypted at rest with AES-256-GCM. Encryption key validated as 32-byte hex at startup. IV and auth tag per ciphertext.

- **Pagination & request limits**: Max 100 items/page, max offset 10000. Body size 10MB. Content-Type validated for POST/PUT/PATCH.

- **Audit logging**: All CREATE/UPDATE/DELETE emit structured audit logs. Sensitive fields redacted in logs.

- **SQL & input**: Parameterized queries only. Joi validation. Generic client errors; details server-side only.

- **Transactions**: PostgreSQL ACID; transaction helper with BEGIN/COMMIT/ROLLBACK. Connection pooling; SSL configurable.

- **Passwords**: bcrypt cost 12; min 12 chars at registration. Generic "Invalid credentials" to prevent user enumeration.

- **EHR/FHIR**: FHIR R4 compliance; sync logged; credentials validated at startup.

- **Shutdown**: Graceful 30s timeout; SIGTERM/SIGINT close DB and Redis. /health unauthenticated for load balancers.

- **Headers & proxy**: Helmet (CSP, HSTS, frame options). Trust proxy for IP behind load balancers.
