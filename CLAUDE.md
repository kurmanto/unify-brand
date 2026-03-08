# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- In all interactions and commit messages, be extremely concise and sacrifice grammar for the sake of concision.

- In places where asked to break plan into multiple phases, automatically make a gitHub issue containing the current plan, including all of the items you checked off the plan list. When context is cleared, look for context when asked to complete a phase, and go into plan mode to create a thorough plan.

## Project Overview

Brand design and visualization repository for **Unify Labs**. Contains interactive HTML-based visualizations for logos, brand marks, and brand assets. The centerpiece is a 3D WebGL hero scene with orbital rings, particle effects, and multiple color palettes. Will also build a website with central piece of orbital 3d hero to set theme and standard. This is currently the "mothership of the vibe" for the website.

## Tech Stack

- Vanilla HTML/CSS/JavaScript (no framework, no bundler)
- Three.js v0.160.0 (loaded from CDN via ESM imports)
- Three.js post-processing: EffectComposer, UnrealBloomPass, ShaderPass
- Google Fonts: Outfit, Inter, JetBrains Mono
- Custom GLSL shaders for particles, nebula, gas clouds, and orbital rings

## Running Locally

No build step. Open HTML files directly in a browser, or serve locally:

```bash
python -m http.server 8000
# Visit http://localhost:8000/logos/hero_orbital_3d.html
```

No tests, no linter, no package.json.

## Key Files

- `logos/hero_orbital_3d.html` — Main 3D orbital rings hero scene (~91KB, contains all JS/GLSL inline). This is the primary file you'll work with.
- `logos/unify_labs_energy.html` — 2D orbital mark reference designs in multiple color schemes
- `logos/generate_logos.html` — Utility to export the orbital mark as PNG at various sizes
- `assets/` — Exported logo files (PNG and SVG at 52px and 104px)

## Architecture: hero_orbital_3d.html

Everything lives in a single HTML file with inline `<script type="module">`:

- **Palette System**: 8 color palettes (deepGreen, warmSunset, aurora, volcanic, reef, royale, gold, synthwave). Each palette defines color vectors in RGB 0-1 range for Three.js, including primary colors, glow/spark/ring colors, nebula/galaxy colors, and background/text-shadow colors. A UI toggle button cycles through them.
- **GLSL Shaders**: Simplex 3D noise (Ashima Arts), custom vertex/fragment shaders for star particles (blackbody radiation color temperature), gas cloud parallax, orbital ring animations, and nebula rendering.
- **Animation**: requestAnimationFrame loop with bloom post-processing. Stars use slow breathing animation without rotation flicker. Perlin noise drives organic motion.
- **Scene Graph**: Three.js scene with orbital ring meshes, particle systems (stars), gas cloud layers, and nebula/galaxy background elements.

## Conventions

- All visualization code is self-contained in single HTML files (no separate JS/CSS files)
- Colors use Three.js `new THREE.Color(r, g, b)` with 0-1 float values, not hex
- Three.js modules imported via CDN: `https://unpkg.com/three@0.160.0/`
- Brand mark: center white sphere with 3 elliptical orbital rings


## GitHub

- Your primary method for interacting with GitHub should be the GitHub CLI.

## Plans

- At the end of each plan, give me a list of unresolved questions to answer, if any. Make the questions extremenly concise. Sacrifice grammar for the sake of concision.
