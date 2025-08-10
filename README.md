# Goodnumbers Weekly Health Journal (AI-Driven Development)

This project is the redevelopment of the Goodnumbers Weekly Health Journal, a SaaS application designed to help Type 1 Diabetics reflect on and improve their health management. The backend is being built with **Express.js** and **TypeScript**, and the entire development process is orchestrated by a team of specialized AI agents using the **Google Agent Development Kit (ADK)**.

## Core Documents

All product and feature requirements are defined in the following documents. Agents and humans should refer to these as the source of truth for implementation.

- **[Product Requirements Document (PRD)](./docs/PRD.md):** Defines the overall vision, user stories, and detailed functional requirements for the application, including the weekly journal, data analysis, and AI coaching features.
- **[Login & Registration PRD](./docs/LOGIN.md):** Provides specific requirements for the user authentication flow, which is exclusively handled by Google OAuth via Auth.js.

## Legacy Code Reference

The `archive/` directory contains the complete source code for the original Next.js application. This codebase should not be used for direct implementation but serves as a critical reference for the AI agents for:

- Product functionality
- UI/UX inspiration
- Existing business logic and data structures

## Technology Stack

- **Backend:** Express.js, TypeScript
- **Authentication:** Auth.js (with Google OAuth provider)
- **Agent Framework:** Google Agent Development Kit (ADK)
- **Task Runner:** [Just](https://github.com/casey/just)

## Development Environment and Agent Workflow

The development process is managed by a team of AI agents that operate in a Test-Driven Development (TDD) loop. The user's role is to initiate and monitor this process from a dedicated shell environment.
