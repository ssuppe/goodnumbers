# GoodNumbers Deployment Guide 🚀

This document outlines the infrastructure setup, Docker multi-stage build sequence, and library requirements for successfully deploying the GoodNumbers monorepo.

## 1. Infrastructure Requirements

The production environment runs on a Google Cloud Compute Engine **`e2-micro`** instance (1GB RAM).
To prevent compiler/build out-of-memory (OOM) kills:

- Configure a **2GB swap file** on the virtual machine.
- Perform image building in a remote environment or dev server if local building on the VM remains memory-constrained.

## 2. Build Sequence & Monorepo Layering

We use a sequential multi-stage Docker build process to satisfy our strict package layering. When building dependencies, they must be compiled in the following order:

1.  **`@goodnumbers/types`** must be built first (contains pure TypeScript interfaces/enums with zero dependencies).
2.  **`@goodnumbers/schemas`** must be built second (depends on `@goodnumbers/types`).
3.  **`@goodnumbers/common`** must be built third (depends on types and schemas).

Only after these shared workspaces are compiled should the `backend`, `worker`, and `frontend` services compile their respective entrypoints.

## 3. Prisma Configuration

The system is built to target Prisma v6. To avoid breaking schema or API definition changes introduced in Prisma v7 (specifically relating to the `url` property in `schema.prisma`), you must:

- Force the generation of client files in your Dockerfiles using:
  ```bash
  npx prisma@6 generate
  ```
- Ensure that any automated build pipelines do not pull down Prisma v7 client generation tools.
