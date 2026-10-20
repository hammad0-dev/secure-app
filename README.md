vxdscvdscwee# CloudSentinel — Secure Demo Application (App A)

[![Node.js LTS](https://img.shields.io/badge/Node.js-20%20LTS-green.svg)](https://nodejs.org/)
[![Security Hardened](https://img.shields.io/badge/Security-Hardened%20Container-00bcd4.svg)](#security-specifications)
[![Audit](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen.svg)](#final-validation)
[![Pod Security](https://img.shields.io/badge/k8s%20PodSecurity-Restricted-blueviolet.svg)](#kubernetes-manifests)

A production-style reference Node.js/Express web application specifically designed for demonstrating **CloudSentinel's** security-gated CI/CD pipeline, cryptographic image attestation, and hardened local Minikube deployment.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Security Specifications](#security-specifications)
- [Installation & Local Execution](#installation--local-execution)
- [Automated Testing](#automated-testing)
- [HTTP Endpoints](#http-endpoints)
- [Docker Build & Verification](#docker-build--verification)
- [Kubernetes Manifests](#kubernetes-manifests)
- [GitHub Repository Setup](#github-repository-setup)
- [CloudSentinel Onboarding Procedure](#cloudsentinel-onboarding-procedure)
- [Expected Security-Gate Behavior](#expected-security-gate-behavior)
- [Deployment Verification Commands](#deployment-verification-commands)
- [Immutable Image Provenance Requirements](#immutable-image-provenance-requirements)

---

## Project Overview

`cloudsentinel-secure-demo` serves as **App A (Secure Baseline)** in the CloudSentinel DevSecOps demonstration suite. It implements defensive coding standards, least-privilege containerization, and restricted Kubernetes execution to showcase how CloudSentinel’s automated security gates validate and deploy compliant workloads.

### Key Objectives
- **Zero-Vulnerability Baseline:** Free of intentionally introduced CVEs or excessive dependencies.
- **Defensive HTTP Stack:** Helmet-hardened response headers, strict request size limits, and sanitization.
- **Rootless Container Execution:** Executes exclusively under non-root user `node` (UID 1000).
- **Hardened Kubernetes Profile:** Complies with Kubernetes `restricted` Pod Security Standards (`readOnlyRootFilesystem: true`, capabilities dropped, no host namespaces).
- **Digest-Based Immutable Deployment:** Rejects floating tags (`:latest`) in favor of verified cryptographic digests (`sha256:...`).

---

## Architecture

```
+-------------------------------------------------------------------------------+
|                       CLOUDSENTINEL DEVSECOPS PIPELINE                        |
+-------------------------------------------------------------------------------+
       |
       v
 [ Git Commit ] ---> [ SAST Gate (SonarQube) ] ---> [ SCA Gate (npm audit) ]
                              |                                  |
                              +----------------+-----------------+
                                               |
                                               v
                                   [ Container Build & Lint ]
                                               |
                                               v
                                   [ Trivy Vulnerability Gate ]
                                   (0 Critical, 0 High CVEs)
                                               |
                                               v
                                [ Cosign / Attestation Signing ]
                                (Immutable SHA-256 OCI Digest)
                                               |
                                               v
                                [ Staging Verification Service ]
                                (Replaces Manifest Placeholder)
                                               |
                                               v
                               [ Hardened Minikube Deployment ]
                              (Namespace: cloudsentinel-secure-demo)
```

---

## Directory Structure

```
cloudsentinel-secure-demo/
├── src/
│   └── app.js             # Core Express server, security headers & lifecycle
├── public/
│   ├── index.html         # FYP Dark-theme demo interface & status dashboard
│   └── styles.css         # Modern design tokens, glassmorphism & responsive CSS
├── tests/
│   └── app.test.js        # Automated test suite (10 security & lifecycle tests)
├── k8s/
│   ├── namespace.yaml     # Dedicated namespace with Restricted PodSecurity labels
│   ├── deployment.yaml    # Non-root, read-only rootfs, immutable digest deployment
│   └── service.yaml       # Internal ClusterIP Service (Port 3000)
├── Dockerfile             # Multi-stage minimal Node.js LTS container definition
├── .dockerignore          # Build context pruning rules
├── .gitignore             # Git ignore specification
├── package.json           # Minimal dependencies (express, helmet, supertest)
├── package-lock.json      # Reproducible dependency lockfile
└── README.md              # Project documentation and operational guide
```

---

## Security Specifications

| Layer | Implementation | Verification |
| :--- | :--- | :--- |
| **HTTP Headers** | Helmet (`nosniff`, `SAMEORIGIN`, CSP, HSTS) | Verified via `tests/app.test.js` |
| **Identity Header** | `X-Powered-By` completely disabled | Verified via `tests/app.test.js` |
| **Payload Limits** | Request body limited to `10kb` (JSON & URL-encoded) | Prevents memory exhaustion attacks |
| **Error Handling** | Centralized sanitized error responses (no stack traces) | Generic HTTP 500 error boundary |
| **User Identity** | Non-root `node` (UID: 1000, GID: 1000) | Enforced in Dockerfile & Kubernetes |
| **Filesystem** | `readOnlyRootFilesystem: true` | Enforced in Kubernetes manifest |
| **Capabilities** | `capabilities: drop: ["ALL"]` | Enforced in Kubernetes manifest |
| **Privilege** | `allowPrivilegeEscalation: false`, `privileged: false` | Enforced in Kubernetes manifest |
| **Seccomp** | `type: RuntimeDefault` | Enforced in Kubernetes manifest |

---

## Installation & Local Execution

### Prerequisites
- Node.js 20 LTS or higher (`node -v`)
- npm 10+ (`npm -v`)

### Steps

1. Clone or navigate to the repository directory:
   ```bash
   cd cloudsentinel-secure-demo
   ```

2. Perform a clean, reproducible installation of dependencies:
   ```bash
   npm ci
   ```

3. Run dependency security audit:
   ```bash
   npm audit
   ```
   *(Expected result: `found 0 vulnerabilities`)*

4. Start the application locally:
   ```bash
   npm start
   ```

5. Access the homepage at `http://localhost:3000`.

---

## Automated Testing

The automated test suite runs via the native Node.js test runner (`node:test`) and Supertest, ensuring zero vulnerable dev dependencies.

Run tests:
```bash
npm test
```

### Test Coverage Checklist
- [x] **Test 1:** Homepage returns HTTP 200.
- [x] **Test 2:** Homepage displays exact message: `"Deployed securely through CloudSentinel"`.
- [x] **Test 3:** `/health` returns HTTP 200.
- [x] **Test 4:** `/health` returns deterministic identity (`status: healthy`, `application: cloudsentinel-secure-demo`, `version: 1.0.0`).
- [x] **Test 5:** `/ready` returns HTTP 200 with timestamp.
- [x] **Test 6:** `/api/info` excludes sensitive fields (no passwords, tokens, paths, or secrets).
- [x] **Test 7:** Unknown routes return HTTP 404 with structured JSON.
- [x] **Test 8:** Security headers are present (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, CSP active, `X-Powered-By` disabled).
- [x] **Test 9:** Application binds and listens on configured custom `PORT`.
- [x] **Test 10:** Graceful shutdown behaves cleanly on shutdown signals.

---

## HTTP Endpoints

| Method | Route | Description | Auth Required | Cache-Control |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Web dashboard displaying deployment attestation | No | `public, max-age=3600` |
| `GET` | `/health` | Deterministic liveness probe (`status: healthy`) | No | `no-store, no-cache` |
| `GET` | `/ready` | Deterministic readiness probe (`status: ready`) | No | `no-store, no-cache` |
| `GET` | `/api/info` | Safe runtime metadata and purpose disclosure | No | `no-store, no-cache` |

---

## Docker Build & Verification

The container image uses a multi-stage Alpine build that discards build artifacts and development dependencies.

### Build Local Image
```bash
docker build -t cloudsentinel-secure-demo:1.0.0 .
```

### Inspect Non-Root Execution
```bash
docker run --rm cloudsentinel-secure-demo:1.0.0 id
# Expected output: uid=1000(node) gid=1000(node)
```

### Run Container Locally
```bash
docker run -d --name secure-demo -p 3000:3000 cloudsentinel-secure-demo:1.0.0
```

### Test Container Healthcheck
```bash
docker inspect --format='{{json .State.Health.Status}}' secure-demo
# Expected output: "healthy"
```

---

## Kubernetes Manifests

All Kubernetes definitions reside in the `k8s/` directory and adhere strictly to the Kubernetes **Restricted Pod Security Standard**:

1. **`k8s/namespace.yaml`**: Creates namespace `cloudsentinel-secure-demo` with audit and enforce labels for `restricted`.
2. **`k8s/deployment.yaml`**:
   - 1 Replica
   - Prohibits `hostNetwork`, `hostPID`, `hostIPC`
   - Explicit `runAsNonRoot: true` (UID: 1000)
   - `allowPrivilegeEscalation: false`
   - `capabilities.drop: ["ALL"]`
   - `readOnlyRootFilesystem: true`
   - Deterministic HTTP probes on `/health` and `/ready`
   - Strictly bounded resource requests and limits
   - **Image Placeholder:** Uses an unresolvable reference (`DISALLOWED_UNVERIFIED_IMAGE_PLACEHOLDER_AWAITING_CLOUDSENTINEL_VERIFICATION@sha256:...`) preventing premature or unverified deployment.
3. **`k8s/service.yaml`**: Internal `ClusterIP` on port 3000. No public Ingress or LoadBalancer exposure.

---

## GitHub Repository Setup

To prepare this standalone repository for source control:

1. Initialize repository:
   ```bash
   git init
   git branch -M main
   ```

2. Verify status and untracked files:
   ```bash
   git status
   ```

3. Commit baseline artifacts:
   ```bash
   git add .
   git commit -m "feat: initial secure demo application baseline (App A)"
   ```

*(Note: Never push upstream without explicitly verifying remote repository authorization and pipeline targets.)*

---

## CloudSentinel Onboarding Procedure

1. **Repository Registration:** Onboard `cloudsentinel-secure-demo` in CloudSentinel's control plane.
2. **Webhooks & Branch Protection:** Configure protected `main` branch requiring signed commits and mandatory status checks.
3. **Pipeline Triggers:** Attach GitHub Actions / CI webhook to invoke CloudSentinel's automated security gates upon PR creation and merge.

---

## Expected Security-Gate Behavior

When CloudSentinel processes this application, the following gate outcomes are expected:

| Security Gate | Tool | Expected Outcome | Rationale |
| :--- | :--- | :--- | :--- |
| **SAST Gate** | SonarQube | **PASS** | Clean code semantics, no CWE violations, no hardcoded secrets |
| **SCA Gate** | npm audit | **PASS** | 0 vulnerabilities across all dependencies |
| **Lint Gate** | Hadolint | **PASS** | Multi-stage Dockerfile, non-root user, pinned package manager flags |
| **Container CVE**| Trivy | **PASS** | 0 Critical, 0 High vulnerabilities on Node.js Alpine base |
| **Attestation** | Cosign | **PASS** | Cryptographic signature generated for immutable image digest |
| **Staging Admission** | Staging Service | **APPROVED** | Replaces placeholder in `k8s/deployment.yaml` with verified digest |

---

## Deployment Verification Commands

After CloudSentinel verifies and applies the manifests to Minikube:

```bash
# Verify namespace
kubectl get namespace cloudsentinel-secure-demo

# Verify Pod status (must show Running and 1/1 Ready)
kubectl get pods -n cloudsentinel-secure-demo -o wide

# Verify container security context in running pod
kubectl get pod -n cloudsentinel-secure-demo -l app.kubernetes.io/name=cloudsentinel-secure-demo \
  -o jsonpath='{.items[0].spec.containers[0].securityContext}'

# Port-forward to test locally
kubectl port-forward -n cloudsentinel-secure-demo svc/cloudsentinel-secure-demo-svc 8080:3000

# Probe health endpoint via port-forward
curl -i http://localhost:8080/health
```

---

## Immutable Image Provenance Requirements

CloudSentinel enforces strict container provenance to prevent tag mutation and supply-chain attacks:

1. **Prohibition of Floating Tags:** Deployments referencing `:latest`, `:dev`, or mutable branch names are rejected by admission controllers.
2. **Digest Pinning:** The deployment manifest must reference the immutable SHA-256 digest:
   ```
   ghcr.io/cloudsentinel/secure-demo@sha256:<64-hex-character-sha256-hash>
   ```
3. **Automated Manifest Mutation:** Developers commit manifests containing the verified placeholder. Only CloudSentinel's staging pipeline is authorized to replace the placeholder with the signed digest upon passing all gating criteria.
