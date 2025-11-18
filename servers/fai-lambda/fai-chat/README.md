# FAI Chat Lambda

Lambda function for streaming chat responses with AI models and documentation search.

## Architecture

- **Runtime**: Python 3.12 (AWS Lambda)
- **Framework**: FastAPI with Mangum adapter
- **Deployment**: API Gateway + Lambda
- **Domain**: `fai-chat.buildwithfern.com` (prod), `fai-chat-dev.buildwithfern.com` (dev)

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

Deployed via CDK stack in `servers/fai-lambda-deploy/scripts/fai-chat-stack.ts`.

```bash
# Deploy to dev
cd servers/fai-lambda-deploy
VERSION=0.1.0 cdk deploy fai-chat-dev

# Deploy to prod
VERSION=0.1.0 cdk deploy fai-chat-prod
```

## TODO

- [ ] Implement Turbopuffer semantic search integration
- [ ] Add system prompt generation with documentation snippets
- [ ] Implement tool calling for additional searches
- [ ] Add conversation history storage
- [ ] Add rate limiting and usage tracking
- [ ] Add comprehensive error handling and logging
