# Contributing to GoodNumbers 🩸

First off, thank you for considering contributing to GoodNumbers! It's people like you that make GoodNumbers such a great tool for the diabetes community.

This document provides guidelines for contributing to the project. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## 🤝 Community Values

- **Empathy First**: We are building tools for people managing a challenging chronic condition. Keep the user experience and safety at the forefront of every change.
- **Transparency**: We operate in the open. Decisions should be documented and discussed in issues or PRs.
- **Quality over Speed**: We prefer small, well-tested, and well-documented changes over large, "heroic" features that might introduce regressions.

## 🏗️ Technical Standards

### 🧬 Test-Driven Development (TDD)
We follow a strict Red/Green/Refactor workflow.
1. **Red**: Write a failing test that defines the desired behavior.
2. **Green**: Write the minimum amount of code to make the test pass.
3. **Refactor**: Clean up the code while ensuring the tests stay green.

**No PR will be merged without accompanying tests.**

### 🌿 Branch Naming
Branches must follow the format `type/short-description`:
- `feat/`: New features
- `fix/`: Bug fixes
- `test/`: Adding or correcting tests
- `refactor/`: Code changes that neither fix bugs nor add features
- `docs/`: Documentation changes
- `chore/`: Build process or auxiliary tool changes

### 📝 Commit Messages
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
```
<type>(<scope>): <subject>

[optional body]
```
Example: `feat(ui): add blood glucose hotspot visualization`

## 🚀 Getting Started

1. **Fork the repository** and clone it locally.
2. **Setup the environment**:
   - Copy `.env.example` to `.env`.
   - Install dependencies: `npm install`.
3. **Create a branch**: `git checkout -b feat/your-feature-name` (from `develop`).
4. **Implement your changes** using the TDD workflow.
5. **Verify your work**:
   - Run linter: `npm run lint`
   - Run tests: `npm run test:ai` (Optimized for CI and AI contexts)
6. **Push and Open a PR** against the `develop` branch.

## 📥 Pull Request Process

Every PR should include:
1. **Clear Title**: Using Conventional Commit format.
2. **Summary**: What was changed and why?
3. **Task Link**: Link to the relevant Issue or Task.
4. **How to Test**: Step-by-step instructions for reviewers to verify the change.
5. **Screenshots**: (If applicable) For UI changes.

**Merge Strategy**: We use **Squash and Merge** to keep the `develop` and `main` history clean.

## 🛡️ Security
If you discover a security vulnerability, please do **not** open an issue. See [SECURITY.md](SECURITY.md) (coming soon) for instructions on how to report it privately.

---
*GoodNumbers is an open-source project licensed under the AGPL-3.0. By contributing, you agree to abide by its terms.*
