# Design System Documentation: The Bespoke Editorial Experience

## 1. Overview & Creative North Star
**The Creative North Star: "The Digital Curator"**

This design system moves away from the "utility-first" aesthetic of traditional e-commerce. Instead, we are building a high-end digital library that feels as tactile and intentional as a physical flagship bookstore. We treat every book cover as a piece of art and every user recommendation as a personalized invitation.

To achieve this, we break the "template" look. We favor **intentional asymmetry**, where book titles may slightly overlap hero containers, and **high-contrast typography scales** that guide the eye with editorial authority. This isn't just a shop; it’s a premium browsing experience that values "breathing room" (white space) as much as the content itself.

---

## 2. Colors & Atmospheric Tones
Our palette is rooted in the heritage of the signature red, but we’ve infused it with a "touch of warmth" via a sophisticated off-white base (`#fbf9f7`) to prevent eye fatigue during long browsing sessions.

### The "No-Line" Rule
**Borders are forbidden for sectioning.** To create a premium feel, we never use 1px solid lines to separate content. Instead, boundaries are defined through:
- **Background Shifts:** Use a `surface-container-low` section sitting directly on a `surface` background.
- **Tonal Transitions:** Sophisticated depth is created by placing `surface-container-lowest` cards on top of `surface-container` galleries.

### Surface Hierarchy & Nesting
Treat the interface as a series of stacked, fine papers. 
- **Base Layer:** `surface` (`#fbf9f7`) – The foundation.
- **Sectioning Layer:** `surface-container-low` (`#f5f3f1`) – For secondary content blocks.
- **Interactive Layer:** `surface-container-lowest` (`#ffffff`) – For cards and elevated interactive elements.

### The "Glass & Gradient" Rule
To elevate the mobile-first interface beyond a "standard app" feel:
- **Glassmorphism:** For floating navigation or top bars, use `surface` with 80% opacity and a `20px` backdrop-blur. This allows book cover colors to bleed through as the user scrolls, creating a dynamic, integrated feel.
- **Signature Textures:** For primary CTAs and Hero backgrounds, use a subtle linear gradient transitioning from `primary` (`#ba0015`) to `primary-container` (`#e21f26`) at a 135-degree angle. This adds "soul" and prevents the red from feeling flat or aggressive.

---

## 3. Typography: The Editorial Voice
We use two distinct typefaces to create an authoritative yet accessible hierarchy.

- **Display & Headlines (Manrope):** This is our "Curator" voice. Use `display-lg` and `headline-md` for book titles and major category headers. The geometric nature of Manrope feels modern and premium. Use tighter letter-spacing for headlines to create a "compact editorial" look.
- **Body & Labels (Work Sans):** This is our "Guide" voice. Work Sans provides exceptional readability for book descriptions and metadata. Use `body-md` for the bulk of the reading experience.

**Hierarchy Tip:** Pair a `headline-sm` title with a `label-md` uppercase subtitle (using `on-surface-variant` color) to create a clear, sophisticated hierarchy for book categories.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows often look "muddy." We achieve depth through **Tonal Layering**.

- **The Layering Principle:** Instead of a shadow, place a `surface-container-lowest` card on a `surface-container-high` background. The subtle difference in lightness creates a clean, natural "lift."
- **Ambient Shadows:** When an element must float (like a "Buy Now" bottom sheet), use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(27, 28, 27, 0.06)`. The shadow color is a tinted version of `on-surface`, never pure black.
- **The "Ghost Border" Fallback:** If accessibility requires a border, use the `outline-variant` token at **15% opacity**. It should be felt, not seen.
- **Glassmorphism:** Use semi-transparent layers for elements that sit above high-quality imagery, ensuring the book covers remain the "hero" of the layout.

---

## 5. Components

### Buttons
- **Primary:** Gradient-filled (`primary` to `primary-container`) with `on-primary` text. Use `xl` (0.75rem) roundedness for a modern feel.
- **Secondary:** Use `surface-container-highest` background with `on-surface` text. No border.
- **Tertiary:** Text-only in `primary` red, used for "See All" actions.

### Cards & Book Lists
- **The "No-Divider" Mandate:** Never use horizontal lines to separate books in a list. Use `1.5rem` of vertical white space or shift the background of alternating groups to `surface-container-low`.
- **The Floating Cover:** Book covers in cards should have a `sm` (0.125rem) corner radius and a very subtle ambient shadow to make them pop off the page.

### Chips (Category Filters)
- **Selection Chips:** Use `secondary-container` for unselected and `primary` for selected. Use `full` roundedness (9999px) to contrast against the more rectangular book covers.

### Input Fields
- Avoid the "box" look. Use a `surface-container-highest` background with a bottom-only "Ghost Border" that transitions to a 2px `primary` line on focus. This mimics the clean look of high-end stationery.

---

## 6. Do's and Don'ts

### Do:
- **Do** prioritize high-quality book cover imagery; the UI should act as a frame for the content.
- **Do** use `display-lg` typography for personalized greetings (e.g., "Good morning, Ahmed") to create a hyper-personalized, premium feel.
- **Do** utilize the `warmth` of the `#fbf9f7` background to make white text containers (`surface-container-lowest`) stand out without harsh contrast.

### Don't:
- **Don't** use 100% opaque, high-contrast borders. It breaks the "premium editorial" flow.
- **Don't** use standard "Material Design" blue for links. Use `tertiary` (`#00608e`) for a more sophisticated, scholarly blue.
- **Don't** overcrowd the mobile viewport. If in doubt, increase the spacing between elements using the `surface-container` shifts rather than adding more lines or boxes.
- **Don't** use sharp 0px corners. Even the most "professional" brand needs the "touch of warmth" provided by our `DEFAULT` (0.25rem) and `lg` (0.5rem) roundedness scale.