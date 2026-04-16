# Deployment Troubleshooting Report: TypeScript Monorepo & Docker 🛑

## 1. Overview
This document summarizes the current technical blockers preventing the successful deployment of the GoodNumbers monorepo to Google Cloud.

## 2. Infrastructure & Strategy
- **Development Server**: N100 Home Server (Ubuntu).
- **Production Server**: Google Cloud Compute Engine `e2-micro` (1GB RAM).
- **Deployment Strategy**: 
    1. Build Docker images on N100.
    2. Save images to tarballs.
    3. Transfer via rsync to GCP.
    4. `docker load` and restart.
- **Reasoning**: Building on the `e2-micro` triggers OOM (Out of Memory) kills even with a 2GB swap file.

## 3. Technical Blockers

### A. TypeScript Module Resolution (The "Ghost" Types)
Even though `npm install` successfully links the workspaces:
- `tsc` in the Docker container fails to resolve `@goodnumbers/types` when building `@goodnumbers/schemas`.
- **Error TS7016**: `Could not find a declaration file for module '@goodnumbers/types'`.
- **Error TS6305**: `Output file '/app/packages/types/dist/index.d.ts' has not been built from source file...`

### B. Prisma v7 Conflict
- The build environment automatically pulled Prisma 7.7.0, which has breaking changes for the `url` property in `schema.prisma`.
- **Fix**: Forcing `npx prisma@6 generate` in Dockerfiles.

### C. Build Sequence Complexity
- `packages/types` depends on the generated Prisma client in `backend/prisma`.
- `packages/schemas` depends on `packages/types`.
- `packages/common` depends on both.
- `backend` depends on everything.

## 4. Current State of Files
- **Root `tsconfig.json`**: Exists, uses `references`.
- **Package `tsconfig.json`**: Use `composite: true` and `baseUrl: "."`.
- **Dockerfiles**: Use multi-stage builds and sequential workspace preparation.

## 5. Attempted Fixes
1. **Explicit Paths**: Added `paths` mapping to every `tsconfig.json` pointing directly to `src/index.ts`. (Result: TS6305 conflict).
2. **Sequential Workspace Builds**: Tried `RUN npm run build` inside each workspace folder in order. (Result: Failed to find declarations).
3. **Optimized Caching**: Reordered Dockerfile commands to cache `node_modules`.

## 6. Diagnosis Needed
- Verification of the **monorepo symlink lifecycle** inside a Docker container.
- Correct configuration for **TypeScript Composite projects** when sharing a generated Prisma client across workspaces.
