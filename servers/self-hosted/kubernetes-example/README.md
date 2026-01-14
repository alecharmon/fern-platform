# Fern Self-Hosted Kubernetes Deployment

This directory contains a sample Kubernetes deployment for running Fern self-hosted documentation. The deployment works on Docker Desktop with Kubernetes enabled, AWS EKS, or any other Kubernetes cluster.

## Directory Structure

```
kubernetes-example/
├── README.md                    # This file
├── deployment.yaml              # Kubernetes Deployment
├── service.yaml                 # Kubernetes Service
├── networkpolicy.yaml           # NetworkPolicy for air-gapped deployments
├── k8s-start.sh                 # Script to start deployment with custom image (supports --local and --air-gapped flags)
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

# Deploy in air-gapped mode (blocks Internet access at runtime)
pnpm k8s:start --image your-registry/fern-docs:latest --air-gapped

# View logs from the running pods
pnpm k8s:logs

# Stop the deployment when done
pnpm k8s:stop
```

Or run the scripts directly:

```bash
./kubernetes-example/k8s-start.sh --image your-registry/fern-docs:latest
./kubernetes-example/k8s-start.sh --image fern-self-hosted:latest --local  # for local images
./kubernetes-example/k8s-start.sh --image your-registry/fern-docs:latest --air-gapped  # air-gapped mode
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

## Air-Gapped Deployments

For environments that require network isolation (e.g., secure enterprise environments), you can deploy Fern docs in air-gapped mode. This applies a NetworkPolicy that blocks all egress traffic to the public Internet while allowing internal cluster communication.

### Requirements

1. Your Kubernetes cluster must have a CNI that supports NetworkPolicy (e.g., Calico, Cilium, Weave Net, or cloud provider CNIs like AWS VPC CNI)
2. The fern-docs container must be built with all documentation pre-baked (no runtime fetching from external sources)

### Deploy in Air-Gapped Mode

```bash
pnpm k8s:start --image your-registry/fern-docs:latest --air-gapped
```

Or apply the NetworkPolicy manually:

```bash
kubectl apply -f kubernetes-example/networkpolicy.yaml
```

### What the NetworkPolicy Does

The `networkpolicy.yaml` creates a policy that:

1. Allows all ingress traffic (so users can access the docs)
2. Allows egress only to cluster DNS (kube-dns/coredns) for internal name resolution
3. Blocks all other egress traffic (no Internet access at runtime)

### Verify Air-Gapped Mode

To verify the container cannot reach the Internet:

```bash
# Get the pod name
POD=$(kubectl get pods -l app=fern-docs -o jsonpath='{.items[0].metadata.name}')

# Try to reach an external site (should fail/timeout)
kubectl exec $POD -- curl -s --connect-timeout 5 https://google.com || echo "Blocked as expected"

# Verify DNS still works for internal services
kubectl exec $POD -- nslookup kubernetes.default.svc.cluster.local
```

### Remove Air-Gapped Restrictions

To remove the NetworkPolicy and restore Internet access:

```bash
kubectl delete networkpolicy fern-docs-air-gapped
```

## Testing Buf Cache Behavior with gRPC Dependencies

The Fern API definition in this example includes a gRPC spec with external buf dependencies (`buf.build/googleapis/googleapis`). This allows testing the buf cache behavior in different deployment scenarios.

### Understanding the Build Modes

There are two key build-time options that affect how dependencies are handled:

1. **`fern generate --docs`** (full generation): Runs complete docs generation at build time, including fetching buf dependencies and caching them in the image.

2. **`fern generate --only-deps`** (dependency-only): Only fetches and caches buf dependencies at build time, deferring actual docs generation to runtime.

3. **Pure runtime generation**: No build-time generation; everything happens at container startup.

### Prerequisites for NetworkPolicy Testing

NetworkPolicy enforcement requires a CNI (Container Network Interface) that supports it. By default, KIND clusters do not enforce NetworkPolicies because the default CNI (kindnet) does not support them.

To test air-gapped scenarios with NetworkPolicy in KIND, you need to create a cluster with a CNI that supports NetworkPolicy, such as Calico or Cilium:

**Option 1: KIND with Calico**

```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: true  # Disable kindnet
  podSubnet: 192.168.0.0/16  # Calico default
nodes:
  - role: control-plane
  - role: worker
```

```bash
# Create cluster without default CNI
kind create cluster --config kind-config.yaml

# Install Calico
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.1/manifests/calico.yaml

# Wait for Calico to be ready
kubectl wait --for=condition=ready pod -l k8s-app=calico-node -n kube-system --timeout=90s
```

**Option 2: KIND with Cilium**

```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: true
nodes:
  - role: control-plane
  - role: worker
```

```bash
# Create cluster without default CNI
kind create cluster --config kind-config.yaml

# Install Cilium CLI and deploy
cilium install
cilium status --wait
```

For production Kubernetes clusters (EKS, GKE, AKS), NetworkPolicy is typically supported out of the box by the cloud provider's CNI.

### Test Scenarios

The following test scenarios validate the expected behavior of air-gapped deployments with gRPC dependencies:

#### Tests That Should PASS

| # | Scenario | Build Command | Network Policy | Why It Works |
|---|----------|---------------|----------------|--------------|
| 1 | Pure runtime generation (no network policy) | None | Disabled | Container has network access at runtime to fetch buf dependencies |
| 2 | `--only-deps` with no buf cache (no network policy) | `RUN /scripts/generate.sh --only-deps` | Disabled | Dependencies fetched at build time, runtime has network for docs generation |
| 3 | `--only-deps` with buf cache (prevent egress) | `RUN /scripts/generate.sh --only-deps` | Enabled | Dependencies cached at build time, no network needed at runtime |
| 4 | Full `fern generate` (prevent egress) | `RUN /scripts/generate.sh` | Enabled | Everything generated and cached at build time, no network needed at runtime |

#### Tests That Should FAIL

| # | Scenario | Build Command | Network Policy | Why It Fails |
|---|----------|---------------|----------------|--------------|
| 5 | `--only-deps` without buf cache (prevent egress) | None | Enabled | No cached dependencies, but network blocked - cannot fetch from buf.build |
| 6 | Pure runtime generation (prevent egress) | None | Enabled | No cached dependencies, no network access - cannot fetch from buf.build |

### Running the Tests

#### Test 1: Pure runtime generation (no network policy) - SHOULD PASS

```dockerfile
FROM fernapi/fern-self-hosted:latest
COPY fern/ /fern/
# No generate.sh - everything happens at runtime
```

```bash
docker build -t fern-test:runtime .
pnpm k8s:start --image fern-test:runtime --local
# Should succeed - has network access to fetch buf dependencies
```

#### Test 2: --only-deps with no buf cache (no network policy) - SHOULD PASS

```dockerfile
FROM fernapi/fern-self-hosted:latest
COPY fern/ /fern/
RUN /scripts/generate.sh --only-deps
```

```bash
docker build -t fern-test:only-deps .
pnpm k8s:start --image fern-test:only-deps --local
# Should succeed - dependencies cached, runtime has network for docs generation
```

#### Test 3: --only-deps with buf cache (prevent egress) - SHOULD PASS

```dockerfile
FROM fernapi/fern-self-hosted:latest
COPY fern/ /fern/
RUN /scripts/generate.sh --only-deps
```

```bash
docker build -t fern-test:only-deps-cached .
pnpm k8s:start --image fern-test:only-deps-cached --local --air-gapped
# Should succeed - buf dependencies cached at build time, no network needed
```

#### Test 4: Full fern generate (prevent egress) - SHOULD PASS

```dockerfile
FROM fernapi/fern-self-hosted:latest
COPY fern/ /fern/
RUN /scripts/generate.sh
```

```bash
docker build -t fern-test:full .
pnpm k8s:start --image fern-test:full --local --air-gapped
# Should succeed - everything pre-generated, no network needed at runtime
```

#### Test 5: --only-deps without buf cache (prevent egress) - SHOULD FAIL

```dockerfile
FROM fernapi/fern-self-hosted:latest
COPY fern/ /fern/
# No generate.sh - no cached dependencies
```

```bash
docker build -t fern-test:no-cache .
pnpm k8s:start --image fern-test:no-cache --local --air-gapped
# Should FAIL - needs to fetch buf dependencies but network is blocked
```

#### Test 6: Pure runtime generation (prevent egress) - SHOULD FAIL

```dockerfile
FROM fernapi/fern-self-hosted:latest
COPY fern/ /fern/
# No generate.sh - everything at runtime
```

```bash
docker build -t fern-test:runtime-blocked .
pnpm k8s:start --image fern-test:runtime-blocked --local --air-gapped
# Should FAIL - needs network to fetch buf dependencies but egress is blocked
```

### Verifying Test Results

After deploying, check the pod status and logs:

```bash
# Check pod status
kubectl get pods -l app=fern-docs -w

# View logs to see if buf dependency fetching succeeded/failed
kubectl logs -l app=fern-docs --tail=200

# For failed tests, you should see errors like:
# "failed to fetch buf.build/googleapis/googleapis"
# or connection timeout errors
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
