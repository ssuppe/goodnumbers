# **UI Specification: Agreements Page**

**Target File:** frontend/src/pages/AgreementsPage.tsx

This specification defines the visual design, required copy, and interactive behavior for the mandatory onboarding Agreements page. It must adhere to the V3 Design System and satisfy the Acceptance Gates defined in the engineering plan.

## **1\. Design & Layout Requirements**

| Element             | Specification                                                                                                                |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------- |
| **Page Layout**     | Centered content, max width of max-w-2xl within a main container. Padding top of pt-12.                                      |
| **Page Background** | Must use the designated light background color: \#F8F9FA (bg-light).                                                         |
| **Card Style**      | Content must be contained within a central card component (bg-white), featuring rounded-xl corners and a moderate shadow-lg. |
| **Typography**      | Font Family: **Inter**. Body text for agreements must be text-base for improved readability.                                 |
| **Primary Color**   | Interactive elements (links, button background) must use \#1976d2 (primary-blue).                                            |
| **Critical Color**  | The disclaimer banner must use \#D32F2F (critical-red).                                                                      |

## **2\. Component: Critical Disclaimer Banner**

This banner must be a sticky, non-dismissible component at the top of the viewport.

| Element              | Content / State                                                                                                                                                                                           |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Background Color** | \#D32F2F (critical-red)                                                                                                                                                                                   |
| **Text Color**       | White (text-white)                                                                                                                                                                                        |
| **Text Content**     | \<strong class="mr-2 uppercase"\>NOTE:\</strong\> GoodNumbers is an experiment and is for educational use only. Do not make any changes to your diabetic healthcare plan without speaking to your doctor. |

## **3\. Page Content & Copy**

| Element              | Text Content                                                                        |
| :------------------- | :---------------------------------------------------------------------------------- |
| **Header (\<h1\>)**  | Welcome to GoodNumbers (3xl, extra-bold)                                            |
| **Subtitle (\<p\>)** | Before we can create your account, you must review and accept the agreements below. |

## **4\. Interaction Requirements & Copy**

The page must contain two distinct checkbox fields. The link text within the agreement text must be styled using primary-blue and have enhanced **focus:ring-2** for accessibility.

### **4.1. Terms and Disclaimer Checkbox**

| Element        | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Label Text** | I accept the \<a href="/terms"\>Terms and Conditions\</a\>. I understand that \<strong class="font-bold"\>GoodNumbers is an experimental project, is NOT medical advice\</strong\>, and may provide incorrect or misleading information. I confirm that I will \<strong class="font-bold"\>always consult a healthcare professional\</strong\> before making any changes to my diabetic healthcare plan, insulin usage, or device settings. I accept all responsibility and liability for the use of this software. |
| **Input Type** | Checkbox, required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### **4.2. Privacy Policy and Consent Checkbox**

| Element        | Requirement                                                                                                                                                                                                                                                                                                              |
| :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Label Text** | I have read and accept the \<a href="/privacy"\>Privacy Policy\</a\>. I consent to the storage and processing of my pseudonymized health data (including any treatment, CGM data, Nightscout data, etc) for the purpose of journal analysis and feature development. I understand I am responsible for the data I share. |
| **Input Type** | Checkbox, required.                                                                                                                                                                                                                                                                                                      |

### **4.3. Primary Action Button**

| Element                                        | Requirement                                                                                               |
| :--------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **Text**                                       | Accept and Continue to Setup                                                                              |
| **Initial State**                              | **Disabled**. Appearance: bg-gray-400 and text-gray-700.                                                  |
| **Enabled State**                              | **Enabled only when BOTH checkboxes are checked.** Appearance: bg-primary-blue (\#1976d2) and text-white. |
| **Action**                                     | On click (when enabled), trigger the form submission via the useApiForm hook.                             |
| **Payload Structure (PUT /api/user/settings)** | { agreementsSigned: true }                                                                                |
| **Success Logic**                              | Redirect to /setup (via useNavigate).                                                                     |

## **5\. Form Submission States (UX)**

The page must clearly communicate state changes during and after the API call, utilizing the state returned by useApiForm (isSubmitting and error).

| State                  | Button Text/Appearance                                                                                                                                                                                                        | Error Handling                                             |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| **Loading/Submitting** | Text changes to **Saving and Continuing...**. Button is **disabled** to prevent double-clicks. A spinner or loading icon should be visible inside the button.                                                                 | N/A (Error displayed on failure).                          |
| **Error**              | Button returns to **Accept and Continue to Setup** and becomes enabled (if checkboxes are still checked). A clear, concise error message must be displayed above the button in a prominent red alert box (text-critical-red). | Display the error message returned by the useApiForm hook. |
