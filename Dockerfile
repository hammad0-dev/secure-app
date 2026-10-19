# ==============================================================================
# CloudSentinel Secure Reference Application (App A)
# Multi-stage hardened Dockerfile
#
# Provenance & Digest Attestation:
# - Base Image: Official Node.js 20 LTS on Alpine Linux (minimal attack surface)
# - Deployment Identity: Must be deployed via immutable OCI digest (sha256:...)
#   verified and attested by CloudSentinel's Cosign/Trivy gating pipeline.
# - Rootless Execution: Runs exclusively as non-root user 'node' (UID 1000).
# ==============================================================================

# Stage 1: Dependency resolution and production pruning
FROM node:20-alpine3.20 AS dependencies

WORKDIR /usr/src/app

# Install dependencies using reproducible lockfile (excluding devDependencies)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Stage 2: Hardened Runtime
FROM node:20-alpine3.20 AS runtime

LABEL maintainer="CloudSentinel Security Team" \
      application="cloudsentinel-secure-demo" \
      version="1.0.0" \
      description="Production hardened container image for CloudSentinel secure baseline demonstration" \
      security.hardened="true" \
      security.rootless="true"

# Production environment configuration
ENV NODE_ENV=production \
    PORT=3000

WORKDIR /usr/src/app

# Copy production dependencies from builder stage with strict non-root ownership
COPY --chown=node:node --from=dependencies /usr/src/app/node_modules ./node_modules

# Copy only required runtime source files
COPY --chown=node:node package.json ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/

# Enforce least-privilege non-root runtime user (node: UID 1000, GID 1000)
USER node

# Expose internal listening port
EXPOSE 3000

# Container Healthcheck using Node.js built-in HTTP client (no curl/wget dependency)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Launch application directly (exec form) to ensure direct propagation of SIGTERM/SIGINT
CMD ["node", "src/app.js"]
