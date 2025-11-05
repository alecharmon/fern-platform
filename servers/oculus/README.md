## Oculus

The `oculus` subrepository is used to generate and run evaluations on Ask Fern. There are three main components:

- `generators` create an evaluation set (can either be programmatic or stochastic).
- `integrations` invoke various forms of the `/chat` endpoint (API, Slack, Discord, etc.).
- `evaluators` run on output responses to measure performance on various metrics.

## Commands

### Generate questions for a suite

    oculus generate --suite {suite_name}

### Run full evaluation pipeline (generate answers + evaluate)

    oculus run --suite {suite_name} [--run-id {id}] [--model {model}]

### Generate answers only

    oculus answer --suite {suite_name} [--run-id {id}] [--model {model}]

### Evaluate existing answers

    oculus evaluate --suite {suite_name} --run-id {id} [--judge-model {model}]
