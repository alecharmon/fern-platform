# Fern Self-Hosted Kubernetes Deployment

This directory contains a sample Kubernetes deployment for running Fern self-hosted documentation. The deployment works on Docker Desktop with Kubernetes enabled, AWS EKS, or any other Kubernetes cluster.

## Directory Structure

```
kubernetes-example/
├── README.md                    # This file
├── deployment.yaml              # Kubernetes Deployment
├── service.yaml                 # Kubernetes Service
├── k8s-start.sh                 # Script to start deployment with custom image (supports --local flag)
└── k8s-delete.sh                # Script to delete deployment
```

## Quick Start

### Prerequisites

1. Docker installed for building images
2. Kubernetes cluster (Docker Desktop, EKS, GKE, etc.)
3. `kubectl` configured to use your cluster

### Step 1: Build Your Docker Image

Build a Docker image with your fern folder baked in. You can use the base `fernapi/fern-self-hosted` image and add your fern folder:

```dockerfile
FROM fernapi/fern-self-hosted:latest
COPY ./your-fern-folder /fern
```

Or build and push to your registry:

```bash
docker build -t your-registry/fern-docs:latest .
docker push your-registry/fern-docs:latest
```

### Step 2: Deploy to Kubernetes

From the `servers/self-hosted` directory, use the pnpm scripts with the `--image` flag:

```bash
cd servers/self-hosted

# Deploy with your custom image from a registry
pnpm k8s:start --image your-registry/fern-docs:latest

# Deploy with a local image (e.g., built with docker:build)
pnpm k8s:start --image fern-self-hosted:latest --local

# View logs from the running pods
pnpm k8s:logs

# Stop the deployment when done
pnpm k8s:stop
```

Or run the scripts directly:

```bash
./kubernetes-example/k8s-start.sh --image your-registry/fern-docs:latest
./kubernetes-example/k8s-start.sh --image fern-self-hosted:latest --local  # for local images
./kubernetes-example/k8s-delete.sh
```

### Step 3: Access Your Documentation

Wait for the pod to be ready (this may take 1-2 minutes):

```bash
kubectl get pods -w -l app=fern-docs
```

Get the service URL:

```bash
kubectl get service fern-docs
```

For Docker Desktop, access via `http://localhost:30080`.

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SKIP_WARMUP` | Skip cache warmup on startup | `false` |
| `FERN_LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `TMPDIR` | Temporary directory for the container | `/tmp` |

### Resource Requirements

The default resource configuration is:

```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"
```

Adjust these based on your documentation size and expected traffic.

### Security Context

The deployment is configured to run as a non-root user (UID 65532) with proper security settings to avoid permission denied errors:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 65532
  runAsGroup: 65532
  fsGroup: 65532
  fsGroupChangePolicy: OnRootMismatch
```

Container-level security:

```yaml
securityContext:
  allowPrivilegeEscalation: false
  runAsNonRoot: true
  runAsUser: 65532
  runAsGroup: 65532
  privileged: false
  readOnlyRootFilesystem: false
  capabilities:
    drop:
      - ALL
```

### Health Checks

The deployment includes liveness and readiness probes:

- **Liveness Probe** (`/liveness` on port 8081): Checks if all service processes are running
- **Readiness Probe** (`/readiness` on port 8081): Checks if all services are ready to serve traffic

The probes are configured with appropriate delays to account for the container's startup time:

```yaml
livenessProbe:
  initialDelaySeconds: 120  # Wait 2 minutes before first check
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  initialDelaySeconds: 60   # Wait 1 minute before first check
  periodSeconds: 5
  failureThreshold: 6
```

## AWS EKS Deployment

### Using AWS ECR

```bash
# Create ECR repository
aws ecr create-repository --repository-name fern-docs

# Get login credentials
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/fern-docs:latest .
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/fern-docs:latest

# Deploy
pnpm k8s:start --image YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/fern-docs:latest
```

## Troubleshooting

### Pod stuck in Pending state

Check if there are resource constraints:
```bash
kubectl describe pod -l app=fern-docs
```

### Pod crashes or restarts

Check the logs:
```bash
kubectl logs -l app=fern-docs --tail=100
```

### Readiness probe failing

The container takes 2-3 minutes to fully start. Check the readiness status:
```bash
kubectl get pods -l app=fern-docs -o wide
kubectl exec -it <pod-name> -- curl http://localhost:8081/readiness
```

## Scaling

For production deployments, you can scale the deployment:

```bash
kubectl scale deployment fern-docs --replicas=3
```

## Ingress Configuration

For production, you may want to use an Ingress instead of a NodePort service:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fern-docs
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  ingressClassName: nginx
  rules:
    - host: docs.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: fern-docs
                port:
                  number: 80
```

## Support

For issues with the self-hosted deployment, please open an issue on the [fern-platform repository](https://github.com/fern-api/fern-platform/issues).
