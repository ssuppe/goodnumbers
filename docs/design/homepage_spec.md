GoodNumbers Homepage & Global Layout Specification (V3)Target Audience: Frontend Engineers (for implementation in React/Tailwind/Express views).Source Prototype: goodnumbers_homepage.html (Latest Version)Design System: GoodNumbers V3 (Unified Blue Primary)1. Global Styling and TypographyThe application uses a clean, professional, and performance-optimized aesthetic.PropertyValueNotesFont StackSystem Fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif)Ensures maximum legibility and native feel across all devices.Page Background#F8F9FAA soft, off-white canvas defined by the PRD.Primary Text Color#212529Standard dark text for readability.Layout Containermax-w-7xl mx-auto px-4 sm:px-6 lg:px-8All primary content should be horizontally centered within this responsive container.2. V3 Color Palette (CSS Variables)The V3 system unifies interactive elements under a primary blue, reserving red exclusively for critical alerts. These variables must be defined in the application's global styles.Variable NameHex ValueUse Case--primary-color#1976d2 (Blue)Logo, secondary button text/border, links, active/focus states.--primary-color-hover#1e88e5 (Lighter Blue)Primary button hover state.--feedback-critical-color#d32f2f (Red)Used for the Critical Alert Banner's background.--feedback-critical-background#ffebee (Light Red)(Not used on Homepage, but reserved for light alert boxes.)3. Universal Styling PropertiesThese properties define the general look and feel of all contained components (e.g., Cards, Buttons).PropertyValueTailwind EquivalentNotesStandard Radius8pxroundedUsed for badges, standard elements.Large Radius12pxrounded-lgUsed for Cards and main CTAs.Light Box Shadow0 2px 5px rgba(0, 0, 0, 0.07)shadow-smUsed for cards and headers.4. CSS Utility Mappings (For Tailwind Integration)The following custom CSS classes are required to map Tailwind classes to the V3 CSS variables, as Tailwind cannot directly use CSS variables for background/text color without specific configuration./_ Must be included in the global stylesheet or within a <style> block _/
.v3-primary-text { color: var(--primary-color); }
.v3-bg-primary { background-color: var(--primary-color); }
.v3-hover-bg-primary-hover:hover { background-color: var(--primary-color-hover); }
.v3-border-primary { border-color: var(--primary-color); }
.v3-banner-title-bg { background-color: var(--feedback-critical-color); } 5. Component Specification: Critical Alert BannerThis component is mandatory, site-wide, and must be visually striking.FeatureImplementation DetailsTailwind/CSS ClassesFunctionalityMust be sticky at the very top of the viewport.sticky top-0 z-20BackgroundSolid Critical Red (--feedback-critical-color).v3-banner-title-bgText ColorHigh-contrast white throughout.text-whitePaddingVertically condensed to remain unobtrusive.py-2 px-2"NOTE" BadgeWhite border for distinction.border border-white opacity-80HTML Structure (Critical Alert Banner)<div class="v3-banner-title-bg py-2 px-2 text-sm font-medium sticky top-0 z-20">
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 text-white">
<!-- Badge -->
<span class="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider flex-shrink-0 border border-white opacity-80">
NOTE
</span>
<!-- Content -->
<span class="text-left leading-snug">
GoodNumbers is an experiment and is for educational use only. Do not make any changes to your diabetic healthcare plan without speaking to your doctor.
</span>
</div>

</div>
6. Component Specification: Main HeaderThe header is non-sticky and scrolls with the page content.FeatureImplementation DetailsTailwind ClassesFunctionalityStandard header that scrolls with the page.(No sticky or fixed positioning)Background/ShadowWhite background with a subtle dividing shadow.bg-white shadow-smPaddingReduced vertical padding for a tighter look.py-3LogoText is styled using the Primary Blue color.v3-primary-text7. Component Specification: Call-to-Action ButtonsBoth buttons must use large rounded corners (rounded-lg) and have a defined visual hierarchy.Button TypeBackgroundText ColorBorderHover StatePrimary (Login/Register)Solid Primary Blue (v3-bg-primary)WhiteNone (border border-transparent)Background lightens (v3-hover-bg-primary-hover), slight scale transform (hover:scale-[1.01]).Secondary (See a Demo)White/Transparent (bg-white)Primary Blue (v3-primary-text)2px Primary Blue (border-2 v3-border-primary)Background turns light blue (hover:bg-blue-50).8. Component Specification: FooterThe footer is required on all public pages and provides essential legal and organizational links.FeatureImplementation DetailsTailwind ClassesSeparationSeparated from the main content by a light gray line.border-t border-gray-200ContentCopyright, App description, and required legal links.text-sm text-gray-500LinksStandard text color, subtle hover effect.hover:text-gray-700HTML Structure (Footer)<footer class="mt-12 py-8 border-t border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
        &copy; 2025 GoodNumbers, Inc. | Experimental Journal for T1D. |
        <a href="/privacy" class="hover:text-gray-700">Privacy Policy</a> |
        <a href="/terms" class="hover:text-gray-700">Terms of Service</a>
    </div>
</footer>
9. Full Page Layout Reference (Homepage)The homepage follows a simple, linear structure, prioritizing the critical medical disclaimer and clear calls to action. The content is designed to be fully responsive.ComponentPositionStickinessPurposeCritical Alert BannerTopSticky (z-20)Site-wide medical disclaimer. Always visible.Main HeaderBelow BannerScrollingLogo and main site navigation (Login/Register).Main Content (<main>)CentralScrollingMarketing headline, descriptive paragraph, and primary CTAs.FooterBottomScrollingLegal links and copyright.Final HTML Structure HierarchyThis simplified structure shows the required order and primary wrapper classes for all major components.<!-- Root container for CSS variables and global styling is assumed. -->

<!-- 1. CRITICAL ALERT BANNER (Component Specification 5) -->
<div class="v3-banner-title-bg py-2 px-2 text-sm font-medium sticky top-0 z-20">
    <!-- Banner content here... -->
</div>

<!-- 2. MAIN HEADER (Component Specification 6) -->
<header class="bg-white shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <!-- Header content here... -->
    </div>
</header>

<!-- 3. MAIN MARKETING CONTENT -->
<main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
    <!-- Headline -->
    <h1 class="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-6">A smart weekly journal for type 1 diabetics</h1>
    
    <!-- Descriptive Paragraph -->
    <p class="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">GoodNumbers is an experimental weekly journal...</p>

    <!-- Call-to-Action Buttons (Component Specification 7) -->
    <div class="mt-10 flex flex-col sm:flex-row justify-center gap-4">
        <!-- Secondary CTA: See a demo -->
        <a href="/demo" class="...">See a demo</a>
        <!-- Primary CTA: Login / Register -->
        <a href="/api/auth/signin" class="...">Login / Register</a>
    </div>

</main>

<!-- 4. FOOTER (Component Specification 8) -->
<footer class="mt-12 py-8 border-t border-gray-200">
    <!-- Footer content here... -->
</footer>
Now the specification is truly complete and includes everything from global styles and custom utilities to detailed component blueprints and the final page structure.Would you like me to begin updating the React files (Layout.tsx, HomePage.tsx) based on this completed specification?
