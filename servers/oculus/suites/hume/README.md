# Hume Code Queries Test Suite

This evaluation suite tests code-related queries against the Hume Discord AI namespace.

## Domain
`hume-discord-ai.docs.buildwithfern.com`

## Setup

This suite uses **manual questions** - questions are created by hand rather than auto-generated.

### Adding a New Question

Create a new JSON file in the `questions/` directory following this format:

```json
{
  "question": "Your code-related question here?",
  "ground_truth": "The expected correct answer that the system should provide",
  "metadata": {
    "category": "code",
    "source": "manual",
    "slug": "descriptive-slug-name",
    "domain": "hume-discord-ai.docs.buildwithfern.com",
    "cited_context": "Relevant context or code snippet that the answer should cite"
  }
}
```

**Naming convention:** Use descriptive kebab-case names like:
- `setup-discord-bot.json`
- `handle-voice-messages.json`
- `error-handling-example.json`

## Running Evaluations

### Run the full pipeline (answer + evaluate)
```bash
cd servers/oculus
oculus run --suite hume-code-queries
```

### Run with specific integration
```bash
# Test against local FAI
oculus run --suite hume-code-queries --integration fai-local

# Test against FAI HTTP endpoint
oculus run --suite hume-code-queries --integration fai-http

# Test against production Vercel
oculus run --suite hume-code-queries --integration vercel-http
```

### Step-by-step execution
```bash
# Generate answers (questions must already exist)
oculus answer --suite hume-code-queries --run-id test_v1

# Evaluate the answers
oculus evaluate --suite hume-code-queries --run-id test_v1
```

## Example Questions

Good code-related questions to include:
- How to initialize/setup specific components
- How to handle specific API calls or events
- How to implement common patterns (error handling, retries, etc.)
- How to use specific features with code examples
- Troubleshooting common issues with code

## Results

Results are saved in:
- `answers/{run_id}/` - Generated answers for each question
- `evaluations/{run_id}/` - Evaluation judgments
- `results_{run_id}.json` - Aggregated metrics and results