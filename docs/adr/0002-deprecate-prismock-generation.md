# ADR 0002: Deprecate `generatePrismock` Generation

## Status

Accepted (since v1.13.0)

## Context

Until version `1.12.0`, the mocked version of prisma client could be generated using a function `generatePrismock` (and `generatePrismockSync`).
Recently, we learned that `Prisma` always generates the content of the `DMMF` (which contains the necessary information about models, among other things).
The goal of `generatePrismock` was to retrieve that information (through an async function).

However, `generatePrismock` was not completely satisfying for two reasons:

1. It doesn't need to be asynchronous (as we don't need to retrieve the `DMMF`), which also makes the mock harder to write.
2. `PrismaClient` is supposed to be a class which can be extended from, and that was not supported.

## Decision

We are deprecating `generatePrismock` (and the less used `generatePrismockSync`) and will completely remove them in a future version. We recommend replacing them with the `PrismockClient` class.

`PrismockClient` can be used to mock the `PrismaClient` directly:

```ts
jest.mock("@prisma/client", () => {
  return {
    ...jest.requireActual("@prisma/client"),
    PrismaClient: jest.requireActual("prismock").PrismockClient,
  };
});
```

Or can be used in your codebase as-is:

```ts
import { PrismockClient } from "prismock";

const prismock = new PrismockClient();
```

## Consequences

- Mocking is easier, and doesn't rely on async functions anymore.
- `PrismockClient` can be extended from.
