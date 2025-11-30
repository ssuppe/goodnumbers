# **Component Specification: Contextual Notes Area**

Component Name: ContextualNotesArea  
Location: Journal Page (Below Chip Groups)  
Tech Stack: React (Functional Components, Hooks), Tailwind CSS (V3 Utility Classes)

## **1\. Overview and Component Purpose**

This component provides a dedicated space for users to log free-form, subjective narrative about their week. It is designed to be visually minimal and non-intrusive until the user requires it.

**Core Interaction Pattern:** **Progressive Disclosure (Expand on Focus)**. The component starts as a compact, single-line input field and automatically expands into a multi-line text area when clicked, maintaining a clean UI for users who do not need to add notes.

**Key Requirement:** The component must use React's useRef and useEffect to ensure a single, seamless click/tap immediately places the cursor inside the expanded text area.

## **2\. Design and Styling Adherence (V3 System)**

| Feature                     | Implementation Detail                                                   | Tailwind/Style Notes                                                       |
| :-------------------------- | :---------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| **Title**                   | "On reflection..."                                                      | text-xl font-bold text-gray-800                                            |
| **Icon**                    | Pencil/Edit icon (lucide/PencilLine)                                    | Uses V3 Primary Blue (\#1976d2).                                           |
| **Container**               | Elevated Card Structure                                                 | bg-white p-2 rounded-xl shadow-md border border-gray-100                   |
| **Collapsed State**         | Single-line \<input\> style                                             | py-2 padding, border-gray-300, shadow-sm                                   |
| **Expanded State**          | Multi-line \<textarea\>                                                 | rows={5} fixed height, resize-y allowed, standard focus ring.              |
| **Focus State**             | Primary Blue focus ring for input/textarea                              | focus:ring-2 focus:ring-blue-500 focus:border-blue-500                     |
| **Text Copy (Placeholder)** | "Add anything else about how you feel or what you were up to this week" | This text is used for both the collapsed input and the expanded text area. |
| **Character Counter**       | Display count below the expanded text area.                             | text-right text-xs text-gray-500                                           |

## **3\. Behavior and Interaction**

### **A. Collapse/Expand Logic**

The component's state (isExpanded) controls the visibility of the full text area:

1. **Initial State:** Renders as a single-line \<input\> if notes.length \=== 0\.
2. **Expand Trigger:** When the user clicks the \<input\>, the onFocus event sets isExpanded(true).
3. **Focus Transfer (Critical):** The useEffect hook must detect the state change and immediately call .focus() on the newly rendered \<textarea\> using a ref. (This prevents the double-click issue.)
4. **Collapse Trigger:** The onBlur event on the \<textarea\> checks the content. If the content is empty (notes.length \=== 0), it sets isExpanded(false) after a slight delay (100ms) to allow external actions (like saving) to complete.
5. **Content Persistence:** If the notes.length \> 0, the component must _remain_ expanded even if the user clicks away (onBlur), ensuring the user's content is immediately visible.

### **B. Data Management**

- **Input:** Receives notes (string) and setNotes (function) from the parent component.
- **Output:** Updates the notes state on every keystroke via the onChange handler.

## **4\. Implementation Code Snippets (React/Tailwind)**

### **A. ContextualNotesArea Component**

This snippet details the state management (isExpanded), the focus transfer logic (useEffect with useRef), and the conditional rendering based on the shouldShowFullTextarea variable.

const ContextualNotesArea \= ({ notes, setNotes }) \=\> {  
 // 1\. Ref for programmatic focusing  
 const textareaRef \= useRef(null);

// 2\. State to track expansion (starts expanded if content exists)  
 const \[isExpanded, setIsExpanded\] \= useState(notes.length \> 0);

const placeholderText \= "Add anything else about how you feel or what you were up to this week";  
 const shouldShowFullTextarea \= isExpanded || notes.length \> 0;

// 3\. EFFECT: Programmatically focus the textarea after expansion  
 useEffect(() \=\> {  
 if (shouldShowFullTextarea && textareaRef.current && isExpanded) {  
 // Ensures the cursor lands in the box after the initial click/focus  
 textareaRef.current.focus();  
 }  
 }, \[shouldShowFullTextarea, isExpanded\]);

// 4\. BLUR HANDLER: Collapse if empty  
 const handleBlur \= () \=\> {  
 if (notes.length \=== 0\) {  
 setTimeout(() \=\> setIsExpanded(false), 100);  
 }  
 };

const commonClasses \= "w-full p-3 border rounded-lg transition duration-150 text-gray-800";  
 const focusClasses \= "focus:ring-2 focus:ring-blue-500 focus:border-blue-500";  
 const inputStyle \= \`border-gray-300 ${focusClasses} bg-white shadow-sm\`;  
 const textareaStyle \= \`border-gray-300 resize-y ${focusClasses}\`;

return (  
 \<div className="space-y-4"\>  
 {/\* Title \*/}  
 \<h3 className="text-xl font-bold text-gray-800 flex items-center"\>  
 \<PencilLine className="inline-block w-5 h-5 mr-2" style={{ color: '\#1976d2' }} /\>  
 On reflection...  
 \</h3\>

      \<div className="bg-white p-2 rounded-xl shadow-md border border-gray-100"\>

        {\!shouldShowFullTextarea ? (
          /\* \--- Collapsed Input (Single Line) \--- \*/
          \<input
            type="text"
            placeholder={placeholderText}
            className={\`${commonClasses} ${inputStyle} py-2\`}
            onFocus={() \=\> setIsExpanded(true)}
            readOnly // Prevents soft keyboard pop-up until the final textarea is ready
          /\>
        ) : (
          /\* \--- Expanded Textarea (Multi-Line) \--- \*/
          \<div className="p-1"\>
            \<textarea
              ref={textareaRef} // Attach ref
              value={notes}
              onChange={(e) \=\> setNotes(e.target.value)}
              onBlur={handleBlur}
              placeholder={placeholderText}
              rows={5}
              className={\`${commonClasses} ${textareaStyle}\`}
            /\>

            \<div className="mt-3 text-right text-xs text-gray-500"\>
              {notes.length} characters
            \</div\>
          \</div\>
        )}
      \</div\>
    \</div\>

);  
};
