# **Component Specification: Weekly Vibe Card (V3)**

Component Name: WeeklyVibeCard  
Location: Journal Page (Subjective Input Section)  
Tech Stack: React, Tailwind CSS

## **1\. Overview and Purpose**

This component provides a core subjective input mechanism for the user to report their overall emotional and glycemic status for the week. It replaces traditional radio buttons with engaging, card-based interaction to enhance the user experience.

## **2\. Design and Styling Adherence (V3 System)**

| Feature               | Implementation                                                                  | Notes                                                                             |
| :-------------------- | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------- |
| **Container**         | Standard V3 Card (bg-white, p-6, rounded-lg, shadow-sm, border border-gray-100) | Provides a clear section boundary.                                                |
| **Layout**            | Responsive Grid: grid-cols-2 (mobile) and md:grid-cols-4 (desktop)              | Ensures all four options are clearly visible without scrolling on larger screens. |
| **Primary Color**     | Uses the V3 Primary Blue (\#1976d2)                                             | Used for the active border and related visual cues.                               |
| **Active Background** | Light Blue (bg-blue-100)                                                        | Used for the background of the selected card.                                     |
| **Text**              | font-semibold for the label, text-gray-500 for the description.                 | Standard V3 typography for readability.                                           |

## **3\. Data Model (vibeOptions Array)**

The component is driven by the following structured data. The value field must be used for the API payload.

| Field       | Example Value                            | Description                                             |
| :---------- | :--------------------------------------- | :------------------------------------------------------ |
| emoji       | '🌻'                                     | Visual representation of the mood.                      |
| label       | 'Blossoming'                             | Short, user-friendly title.                             |
| value       | 'thriving'                               | **Required** string value for the weeklyVibe API field. |
| description | "My blood sugars were largely stable..." | Detailed explanation of the mood.                       |

## **4\. Behavior and Interaction**

### **A. Selection Logic**

- **Mode:** Single-select (Radio Group equivalent). Only one card can be active at a time.
- **State:** The component must use an internal state (selectedVibe) initialized from the journal's fetched data (e.g., journal.weeklyVibe).
- **Action:** Clicking any VibeCard updates the selectedVibe state and immediately triggers the styling changes for the new active card.

### **B. Active State Styling**

When a card's value matches the selectedVibe state:

1. **Border:** The card receives a solid 2px border using the V3 Primary Blue (\#1976d2).
2. **Background:** The card background is set to the light blue (bg-blue-100).
3. **Ring/Glow:** A surrounding accent ring is added (ring-4 ring-offset-2 ring-opacity-50) and a subtle blue shadow is applied (e.g., boxShadow: 0 0 10px \#1976d230).

### **C. Hover and Animation (Micro-Interaction)**

To maximize engagement, the entire card utilizes two concurrent hover effects:

1. **Card Scale:** The entire VibeCard container scales slightly upward (hover:scale-\[1.03\]) and gains a stronger shadow (hover:shadow-lg).
2. **Emoji Rotation:** The emoji/icon element inside the card rotates 6 degrees (group-hover:rotate-6).

**Implementation Note:** The rotation effect requires the use of the Tailwind **group** utility class on the parent VibeCard container, and the **group-hover:** prefix on the child emoji element. This ensures the animation is triggered by hovering over any part of the card.

## **5\. Code Snippets for Implementation**

The following snippets illustrate the key React/Tailwind logic for the VibeCard component.

### **A. Conditional Styling for Active State**

This shows how to dynamically apply V3 styling based on the isSelected prop.

const VibeCard \= ({ vibe, isSelected, onClick }) \=\> {  
 const selectedClasses \= isSelected  
 ? \`bg-blue-100 ring-4 ring-offset-2 ring-opacity-50\` // Active state colors  
 : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'; // Inactive state colors

const borderStyle \= isSelected ? { borderColor: '\#1976d2', borderWidth: '2px', borderStyle: 'solid' } : {};

return (  
 \<div  
 className={\`p-4 rounded-lg shadow-sm transition-all duration-200 h-full ${selectedClasses}\`}  
 style={{ ...borderStyle }}  
 onClick={() \=\> onClick(vibe.value)}  
 \>  
 {/\* ... Card Content ... \*/}  
 \</div\>  
 );  
};

### **B. Group-Hover Animation Implementation**

This demonstrates the use of the group and group-hover utilities to link the parent card's hover state to the child emoji's rotation effect.

const VibeCard \= ({ vibe, isSelected, onClick }) \=\> {  
 // 1\. Add 'group', 'hover:scale-\[1.03\]', and 'hover:shadow-lg' to the parent  
 const baseClasses \= "flex flex-col items-center p-4 cursor-pointer transform group hover:scale-\[1.03\] hover:shadow-lg";

return (  
 \<div className={\`${baseClasses} ...other classes...\`} onClick={() \=\> onClick(vibe.value)}\>

      {/\* 2\. Add 'group-hover:rotate-6' and 'transition-transform duration-300' to the child \*/}
      \<div className="text-4xl mb-2 transition-transform duration-300 group-hover:rotate-6"\>
        {vibe.emoji}
      \</div\>

      {/\* ... Other Content ... \*/}
    \</div\>

);  
};

The specification now includes detailed descriptions and executable examples, which should be sufficient for a junior engineer to implement the component accurately.
