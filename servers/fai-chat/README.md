# FAI Chat

FastAPI service for streaming chat responses with AI models and documentation search.

Shared retrieval/LLM/prompt logic now lives in `../python-libs/fai_ai_core` and is consumed via a Poetry path dependency.

## Architecture

- **Runtime**: Python 3.12 (ECS Fargate)
- **Framework**: FastAPI
- **Deployment**: ECS Fargate with ALB
- **Domain**: `fai-chat.buildwithfern.com` (prod), `fai-chat-dev2.buildwithfern.com` (dev)

## Development

### Setup

```bash
# Install dependencies
poetry install

# Activate virtual environment
poetry shell
```

### Local Development

```bash
# Run linting and formatting
make code-cleanup

# Run type checking
make check

# Run tests
make test
```

### Environment Variables

Required environment variables:
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude
- `OPENAI_API_KEY` - OpenAI API key
- `COHERE_API_KEY` - Cohere API key
- `TURBOPUFFER_API_KEY` - Turbopuffer API key for semantic search
- `FERN_TOKEN` - Fern authentication token

## API Endpoints

### `POST /chat`
Stream chat responses with documentation context.

**Response:**
Server-sent events stream with text chunks.

### `GET /health`
Health check endpoint.

## Deployment

Deployed via CDK stack in `servers/fai-chat-deploy/src/fai-chat-ecs-stack.ts`.

```bash
# Deploy to dev
cd servers/fai-chat-deploy
VERSION=0.1.0 pnpm deploy:dev2

# Deploy to prod
VERSION=0.1.0 pnpm deploy:prod
```

## TODO

- [ ] Implement Turbopuffer semantic search integration
- [ ] Add system prompt generation with documentation snippets
- [ ] Implement tool calling for additional searches
- [ ] Add conversation history storage
- [ ] Add rate limiting and usage tracking
- [ ] Add comprehensive error handling and logging
