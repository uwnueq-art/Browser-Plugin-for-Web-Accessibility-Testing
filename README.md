# Vision Simulator: Browser Plugin for Web Accessibility Testing

The main contributor Dana K. Bikturganova, student of SPbPU ICSC. 
The contributor E.S. Bulykina, students, SPbPU ICSC.
The advisor Alexander V. Shchukin, PhD, docent, SPbPU ICSC.

**Vision Simulator** is a Chromium-based browser extension (Manifest V3) that combines:

1. **Real-time simulation** of four types of color vision deficiencies (protanopia, deuteranopia, tritanopia, achromatopsia) using the physiological Machado model via SVG `feColorMatrix` filters.
2. **Automated accessibility audit** of web interfaces against 7 criteria from GOST R 52872-2019 and WCAG 2.1:

   - Text contrast ≥ 4.5:1 (SC 1.4.3)

   - Font size ≥ 12px (SC 1.4.4)

   - Alt text for images (SC 1.1.1)

   - Line height ≥ 1.5 (SC 1.4.12)

   - Link distinguishability (SC 1.4.1)

   - UI elements contrast ≥ 3:1 (SC 1.4.11)

   - Text alignment (SC 1.4.8)


The plugin operates entirely client-side, requires no backend, and provides instant visual feedback.

## Instruction

### Installation
1. Clone the repository
2. Open Chrome/Edge and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the project folder containing `manifest.json`

### Usage
- Click the extension icon → choose simulation mode or run accessibility audit
- Works offline, client-side only, compatible with all Chromium-based browsers
- Open `test-page.html` to test the plugin on a page with known accessibility defects
