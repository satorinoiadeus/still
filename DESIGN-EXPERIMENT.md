# Still · Quiet Edition (experimental)

A visual-only refinement of Still 0.2.1 on `experiment/quiet-edition`. No task, area, project, storage, import/export, or navigation features were added or removed. The main and `still-rebuild` branches are unaffected.

## Direction

- **Calm hierarchy:** editorial typography, warmer neutral surfaces, consistent spacing, and a single green accent.
- **Less noise:** quieter project controls, action buttons visible on hover or keyboard focus (always visible on touch), smaller mobile creation toolbar.
- **Crisp navigation:** lightweight inline SVG icons rather than font glyphs; selected view exposes `aria-current="page"`.
- **Motion with purpose:** short opacity/transform transitions on view changes, sheets, confirmations, and cards. No layout-animation loops, JavaScript animation libraries, or animated background effects.
- **Phone-first comfort:** 44px+ touch targets for key actions, safe-area-aware floating capture, bottom-sheet editors, reduced-motion support, and compact layouts for narrow phones.
- **Performance:** no UI libraries, fonts, images, external assets, or runtime dependencies added.

## Research inspiration and licenses

Studied visual interaction patterns in [Vikunja](https://github.com/go-vikunja/vikunja) (AGPL-3.0-or-later), [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) (AGPL-3.0), and [PLANKA](https://github.com/plankanban/planka) (Fair Use / Pro terms). Their broad principles (legible hierarchy, restrained toolbars, compact navigation, mobile ergonomics) informed the design. **No third-party code, images, icons, or assets were copied into Still.** Still's SVG paths and CSS were authored for this project. Existing Still licensing is unchanged.

## Validation

Run `npm ci && npm run verify`. Native APK and Windows EXE packages are built by `.github/workflows/still-build.yml` on this experimental branch; GitHub Actions results determine whether native packaging succeeded. Test on real devices before release.
