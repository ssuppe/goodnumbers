# **Component Specification: Sticky Action Bar (Fixed Footer)**

Component Name: StickyActionBar  
Location: Journal Page (Fixed Footer)  
Tech Stack: React (Functional), Tailwind CSS  
Purpose: To provide persistent access to the form submission controls, regardless of the user's scroll position.

## **1\. Design and Styling Adherence (Compact V3)**

The design prioritizes compactness and non-intrusiveness while maintaining clear contrast for the primary action.

| Feature                        | Implementation Detail                          | Tailwind/Style Notes                                                   |
| :----------------------------- | :--------------------------------------------- | :--------------------------------------------------------------------- |
| **Positioning**                | Fixed at the bottom, full width, high Z-index. | fixed bottom-0 left-0 right-0 z-40                                     |
| **Container**                  | Compact, elevated white bar.                   | bg-white shadow-xl border-t-2 border-gray-200 p-3                      |
| **Button Text**                | Short, clear actions.                          | **"Discard"** and **"Save"**                                           |
| **Primary Button (Save)**      | V3 Primary Blue fill, compact size.            | bg-blue-600 py-2 px-4 text-white text-base font-semibold               |
| **Secondary Button (Discard)** | Bordered, compact size.                        | text-gray-700 border border-gray-300 py-2 px-4 text-base font-semibold |

## **2\. Behavior and Interaction**

- **Persistence:** The component **must** remain visible and fixed at the bottom of the viewport at all times.
- **Save Action:** Triggers the onSave prop. When clicked, the component enters a loading state (isLoading).
- **Loading State:** If isLoading is true, the button must be disabled and show a spinning indicator and "Saving..." text.
- **Discard Action:** Triggers the onCancel prop. This action should be guarded by a **custom modal confirmation** (do not use browser window.confirm()).

## **3\. Implementation Code Snippets (React/Tailwind)**

This is the latest, compact version featuring the "Discard" and "Save" button labels.

// Latest version using "Discard" and "Save"  
const StickyActionBar \= ({ onSave, onCancel, isLoading }) \=\> {  
 const primaryColor \= '\#1976d2';  
 const buttonBaseClasses \= "py-2 px-4 rounded-lg font-semibold text-base transition-all duration-200 w-full sm:w-auto";

return (  
 \<div className="fixed bottom-0 left-0 right-0 z-40 bg-white shadow-xl border-t-2 border-gray-200"\>  
 \<div className="max-w-4xl mx-auto p-3"\>  
 \<div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4"\>

          \<button
            onClick={onCancel}
            disabled={isLoading}
            className={\`${buttonBaseClasses} text-gray-700 border border-gray-300 hover:bg-gray-100\`}
          \>
            Discard
          \</button\>

          \<button
            onClick={onSave}
            disabled={isLoading}
            style={{ backgroundColor: primaryColor }}
            className={\`${buttonBaseClasses} text-white shadow-md hover:shadow-lg\`}
          \>
            {isLoading ? (
              // Loading Spinner HTML
              \<span className="flex items-center justify-center"\>
                \<svg className="animate-spin \-ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"\>...\</svg\>
                Saving...
              \</span\>
            ) : (
              'Save'
            )}
          \</button\>
        \</div\>
      \</div\>
    \</div\>

);  
};
