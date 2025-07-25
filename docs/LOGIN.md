# **Product Requirements Document: SaaS Login & Registration Page (MVP)**

## **1\. Introduction**

This document outlines the product requirements for the user Login and Registration page for our SaaS application's Minimum Viable Product (MVP). The goal is to provide a secure, intuitive, and seamless experience for both new and existing users to access the application, **initially focusing solely on Google OAuth for authentication using Auth.js built-in pages** to accelerate development.

## **2\. Goals**

- **Enable Secure User Access:** Provide a robust and secure mechanism for users to log into their existing accounts.
- **Facilitate Seamless Onboarding:** Allow new users to easily register and gain access to the application with minimal friction, leveraging Google's identity.
- **Enhance User Convenience:** Offer Google OAuth as the primary and sole authentication method for a quick and familiar sign-in experience.
- **Improve Conversion Rates:** Optimize the registration flow to reduce abandonment and encourage new sign-ups via Google.
- **Maintain Brand Consistency (within Auth.js limitations):** Ensure the login/registration experience aligns with the overall application's design and user experience, leveraging the customization options provided by Auth.js built-in pages.
- **Accelerate MVP Development:** Streamline authentication implementation by focusing on a single, widely-used OAuth provider and utilizing pre-built UI components.

## **3\. User Stories**

### **New User Registration**

- As a **new user**, I want to register quickly using my existing Google account, so I don't have to create new credentials.
- As a **new user**, I want to understand and explicitly agree to the terms, privacy policy, and software disclaimer before I register, so I can make an informed decision and proceed.
- As a **new user**, I want clear feedback if my registration attempt fails (e.g., Google authentication error), so I can correct my input.

### **Existing User Login**

- As an **existing user**, I want to log in using my Google account, so I can access the application conveniently.
- As an **existing user**, I want clear error messages if my Google login fails, so I know what to fix.

## **4\. Functional Requirements**

### **4.1. Authentication Interface**

- The authentication interface MUST primarily leverage Auth.js's built-in pages for login and registration.
- The UI MUST clearly indicate that Google is the primary (and only) sign-in method.
- **Authenticated User Handling:** Upon initial page load, the system will check for an active, valid user session. If a session is found, the user will be immediately redirected to the application's Dashboard.

### **4.2. Google OAuth Integration (Primary Authentication)**

<a id="login-page-disabled"></a>
![Login page - disabled](<imgs/Login Page-disabled.png> 'Goodnumbers homepage')

- Users MUST be able to register and log in using their Google account.
- Before being able to sign in/authenticate, Users MUST explicitly agree to the following before their account can be fully provisioned/accessed (e.g., after the first successful Google sign-in, presented as checkboxes on the Agreements Page):

  - Terms and Conditions and acknowledge the experimental nature of the project
  - Privacy Policy

The 'Login' button MUST be disabled unless both of the above checkboxes are checked by the user (as seen in [Login Page-disabled](#login-page-disabled)).

Once a user checks the boxes of both the T&Cs and the Pricacy Policy, the "Login" button becomes enabled (as seen below in [Login Page-enabled](#login-page-enabled))

<a id="login-page-enabled"></a>
![Login page - enabled](<imgs/Login Page-enabled.png> 'Goodnumbers homepage')

- A prominent "Sign in with Google" button MUST be available on the page, as provided by Auth.js.
- When pressed, it should load a page or popup with the standard Google OAuth consent screen (NOTE TO GEMINI: Help me define what's needed here, if anything)
- Upon successful Google authentication, the system MUST:

  - **For New Users:** Create a new user account linked to their Google profile.
  - **For Existing Users:** Log the user directly into their account.

- The system MUST handle potential errors during the OAuth flow (e.g., user declines permissions, network issues).

### **4.3. Error States & Feedback**

- **Authentication Errors:** For any issues during the Google OAuth flow (e.g., network issues, Google service errors, user denial), a generic but informative error message will be displayed on the Auth.js login page.
- **Loading Indicators:** All asynchronous operations will be accompanied by appropriate loading indicators.

### **4.4. Accessibility**

- The Auth.js built-in pages are expected to provide a reasonable level of accessibility.
- All interactive elements will be keyboard navigable.
- Color contrast and screen reader compatibility will be considered based on Auth.js defaults and any custom styling applied.

### **4.5. Responsiveness**

- The Auth.js built-in pages are expected to be responsive and adapt gracefully to various screen sizes.

### **4.6. Session Management**

- Upon successful login or registration via Google OAuth, a secure user session MUST be established by Auth.js.
- The session MUST be managed securely (e.g., using JWTs or secure cookies).
- Users MUST be automatically logged out after a period of inactivity (configurable session timeout).
- Users MUST be able to explicitly log out of their account.

### **4.7. User Interface & Experience (UI/UX)**

- The authentication pages MUST be fully responsive and adapt gracefully to various screen sizes (desktop, tablet, mobile), leveraging Auth.js's default responsiveness.
- Loading indicators MUST be displayed during OAuth redirects to provide feedback to the user.
- The design will largely follow Auth.js's default built-in page styling, with minimal custom branding to align with the overall SaaS application's branding where possible (e.g., logo, primary colors via CSS variables if supported by Auth.js theming).

### **4.8. Authenticated User Redirection**

- If an already authenticated user attempts to access the login/registration page, they MUST be automatically redirected to the application's main dashboard.

## **6\. Non-Functional Requirements**

### **6.1. Security**

- All data transmitted between the client and server MUST be encrypted (HTTPS/SSL).
- The system MUST be protected against common web vulnerabilities (e.g., XSS, CSRF, SQL Injection).
- Rate limiting SHOULD be considered on the initiation of the Google OAuth flow to prevent abuse.
- Sensitive user data (e.g., tokens) MUST be stored securely.

### **6.2. Performance**

- The login/registration page MUST load quickly (target \< 2 seconds on average network conditions).
- Authentication responses MUST be fast (target \< 1 second).

### **6.3. Usability & Accessibility**

- The page MUST be intuitive and easy to use for all users.
- The page SHOULD adhere to WCAG 2.1 AA guidelines for accessibility (e.g., sufficient color contrast, proper ARIA attributes).

### **6.4. Scalability**

- The authentication system MUST be able to handle a growing number of concurrent users and registration requests without degradation in performance.

### **6.5. Reliability**

- The authentication system MUST have high availability and be resilient to failures.

## **8\. Out of Scope (for this phase)**

- Email/password registration or login.
- Password reset functionality.
- Multi-factor authentication (MFA).
- Additional social login providers (e.g., Facebook, Twitter, GitHub).
- User profile management (beyond initial registration data provided by Google and the required agreements).
- Complex onboarding flows post-registration (e.g., guided tours, beyond the initial agreement screen).
