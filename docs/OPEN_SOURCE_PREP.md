# Open Source Readiness Checklist: GoodNumbers 🩸

**Goal**: Prepare the `goodnumbers` repository for public release on GitHub under the AGPL-3.0 license.

## Status Summary
- **Phase**: Legal & Governance
- **Completion**: 25%
- **Target License**: AGPL-3.0

---

## 🏁 Stage 1: Infrastructure & Security Audit
- [x] **1.1 Secret Scanning**: Deep audit performed using Gitleaks and Grep.
- [x] **1.2 History Cleaning**: Cleaned two `CONTEXT7_API_KEY` instances from entire history via `git-filter-repo` in a clean clone.
- [x] **1.3 Environment Templates**: `backend/.env.example` verified and safe.
- [x] **1.4 Dependency Audit**: All `package.json` files updated to `AGPL-3.0` and verified.

## 🟩 Stage 2: Legal & Governance
- [x] **2.1 Add LICENSE File**: Populate with the full text of the AGPL-3.0.
- [x] **2.2 Create DISCLAIMER.md**: Standardized medical disclaimer for user safety.
- [x] **2.3 Create CONTRIBUTING.md**: Guidelines for TDD, branch naming, and PRs.
- [x] **2.4 Create CODE_OF_CONDUCT.md**: Establish community standards (Contributor Covenant).
- [x] **2.5 Create SECURITY.md**: Instructions for reporting vulnerabilities.

## 🟩 Stage 3: The "Front Door" (README.md)
- [x] **3.1 Brand & Value Prop**: Clear explanation of what the app does.
- [x] **3.2 Visuals**: Add placeholders for screenshots or diagrams.
- [x] **3.3 Installation Guide**: Step-by-step for a fresh clone.
- [x] **3.4 Development Guide**: How to run tests and linters.

## 🟩 Stage 4: GitHub Metadata (DEFERRED)
- [ ] **4.1 Issue Templates**: Bug reports and feature requests.
- [ ] **4.2 PR Template**: Ensure every PR includes test verification.
- [ ] **4.3 Repository Settings**: Draft the "About" section, tags (`#diabetes`, `#nightscout`, `#health-tech`), and social preview.

---

## 🏁 Final Status
- **Legal & Governance**: 100% Complete
- **README & Documentation**: 100% Complete
- **GitHub Metadata**: Deferred (YAGNI)
