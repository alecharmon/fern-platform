# Local Mocks

Mock services for local development of fern-platform. Provides local alternatives for:

- **Upstash REST API** (port 8079) - Compatible with `@upstash/redis` SDK
- **Vercel Edge Config** (port 8078) - Compatible with `@vercel/edge-config` SDK

## Usage

These services are started automatically by `pnpm fdr:dev` via docker-compose.

### Environment Variables

Add these to your `.env.local` files for docs/dashboard:

```bash
# Upstash REST API mock
MWARE_KV_REST_API_URL=http://localhost:8079
MWARE_KV_REST_API_TOKEN=local-dev-token
KV_REST_API_URL=http://localhost:8079
KV_REST_API_TOKEN=local-dev-token

# Edge Config mock
EDGE_CONFIG=http://localhost:8078
```

## Upstash REST API

The mock translates HTTP requests to Redis commands via ioredis.

### Supported Commands

| Command | Usage |
|---------|-------|
| `hgetall` | `POST /hgetall/:key` |
| `hkeys` | `POST /hkeys/:key` |
| `hget` | `POST /hget/:key/:field` |
| `hset` | `POST /hset/:key` with JSON body |
| `get` | `POST /get/:key` |
| `set` | `POST /set/:key/:value` |
| `del` | `POST /del/:key` |
| `smembers` | `POST /smembers/:key` |
| `sadd` | `POST /sadd/:key/:member` |
| `scan` | `POST /scan/:cursor` |

### Seeding Data

Use the redis-cli to seed data:

```bash
docker exec -it fdr-redis-1 redis-cli

# Set domain settings
HSET domain-settings:acme.docs.buildwithfern.com defaultBasepath /docs

# Set basepath routes
HSET basepath-routes:acme.docs.buildwithfern.com /docs 1 /api 1
```

## Edge Config

Serves config from `edge-config.json` or in-memory defaults.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /items` | Get all config items |
| `GET /item/:key` | Get single config item |
| `GET /?keys=key1,key2` | Get multiple config items |
| `PATCH /items` | Update config items |
| `POST /reload` | Reload config from file |
| `GET /health` | Health check |

### Customizing Config

Edit `edge-config.json` and restart the container, or call `POST /reload`.

## Initial Data

Both services load seed data on startup:

- **Edge Config**: `edge-config.json`
- **Redis**: `redis-seed.json`

### redis-seed.json format

```json
{
  "domain-settings:example.com": {
    "defaultBasepath": "/docs"
  },
  "basepath-routes:example.com": {
    "/docs": "1",
    "/api": "1"
  }
}
```

Objects are stored as Redis hashes (HSET), strings as simple keys (SET).

## Development

Run standalone (outside docker):

```bash
cd servers/local-mocks
npm install
REDIS_URL=redis://localhost:6379 npm start
```
