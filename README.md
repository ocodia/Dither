# Dither

A local-first image compositor built with native browser APIs. Images, text, shapes, transforms and effects stay editable until export. No CDN, framework, account, backend or production dependency is required.

## Run

Serve this directory with any static HTTP server. With Node.js installed:

```sh
npm start
```

Open http://127.0.0.1:4173. No install or build step is needed. ES modules, IndexedDB and the service worker require an HTTP origin; opening `index.html` as a `file:` URL is not supported. Installation/offline support requires HTTPS or localhost.

To deploy on GitHub Pages, publish the directory as static files. All app, icon, manifest, worker and module URLs are relative and support a repository subdirectory. No deployment has been performed by this implementation.

## Working capabilities

- Custom documents, common presets, transparent/solid backgrounds, document resizing, zoom, pan and fit.
- PNG/JPEG/WebP import, multi-file import, image drop and clipboard paste.
- Rectangular/elliptical marquees and freehand/polygonal lassos on image layers, with undoable pixel deletion, copy, cut and paste as a new image layer.
- Ordered image, text, rectangle, ellipse, line and arrow layers. Select on canvas or in the layer list; rename, duplicate, delete, reorder, hide, lock and set opacity.
- Move, eight resize handles, rotation and flips. Shift preserves proportions/snaps rotation; Alt/Option resizes from the centre. Numeric transform controls provide keyboard-accessible alternatives.
- Editable text content, font, weight/style, colour, alignment, line height, letter spacing and wrapping within a text box.
- Editable shape fill, stroke and opacity, rectangle corners and configurable arrowheads.
- Brightness, contrast, monochrome Floyd–Steinberg dithering, colour overlay, outside stroke, blur and drop shadow. Each effect can be enabled, configured and reset independently.
- Command-based undo/redo, including one entry per pointer gesture, slider gesture or committed text edit.
- Explicit browser-local project saves and reopening with original image Blobs stored separately; full-resolution transparent PNG export.
- Installable PWA, offline app shell and local fonts, update notification, dark desktop layout, collapsible inspector on small screens, named controls and visible keyboard focus.

Use the **?** button for keyboard shortcuts. Changes to text fields commit when focus leaves the field. The layer panel displays the topmost layer first. Shape stroke is independent of the optional layer stroke effect.

The document menu at the top of the left toolbar contains New, Open, Save and Export, plus installation/update controls when available. Canvas properties include the project name; use the Canvas properties toolbar button to deselect the current layer and open them. The History inspector tab contains undo/redo and clickable editing states. You can return to later states until a new edit replaces the redo branch. History is session-only and resets when a document is opened.

Creation shortcuts (T, R, E, L, A) place objects centred at the cursor in the workspace, accounting for zoom and pan. Toolbar creation, or shortcuts with the cursor outside the workspace, use the canvas centre. Toasts appear at the workspace's bottom right.

Lines and arrows use two endpoint handles instead of a transform box. Drag either handle to change length and direction while keeping the other end fixed; hold Shift to snap direction to 15° increments. Drag the stroke to move the whole object. Each completed gesture is one history entry, and Escape cancels it. Arrow shafts join the bases of the arrowheads without extending past their tips.

Select an unlocked, visible image layer, then use **M** for rectangular marquee, **Shift M** for elliptical marquee, **Q** for freehand lasso or **Shift Q** for polygonal lasso. Drag marquees/freehand paths; click polygon vertices and close with Enter, double-click or a click on the starting point. Backspace removes a polygon vertex; Escape cancels an unfinished selection or clears a completed one. Hold Space to pan.

The selection toolbar provides Select All, Copy, Cut, Paste, Delete and Deselect. Ctrl/⌘ A selects the whole image; C/X/V copy/cut/paste; D clears an active pixel selection (otherwise it duplicates the layer). Delete/Backspace erases selected pixels; the Layers trash button still deletes the whole layer. Text fields retain their normal editing shortcuts. Selections follow the source layer's transforms and clear when another layer is selected, locked or hidden.

Copies use original image resolution with existing erased areas and transparent edges preserved. Pasting creates an independent image layer at the copied region's position, with the source transform, opacity and editable effects; pasting into a different document centres it. The operating-system clipboard receives the source pixels before effects, so pasting into another application does not include Dither effects. A session-local clipboard and Paste button remain available if browser clipboard permission is denied. Active selection outlines and clipboard contents are not saved; erased areas are saved.

Projects belong to the browser profile and origin where they were saved. Clearing that origin's storage removes local projects. PNG exports are flattened images; portable editable project files are a future addition.

## Architecture and files

```text
index.html                  Semantic editor shell and dialogs
css/app.css                 Dark theme, responsive layout and focus states
manifest.webmanifest        Installation metadata and local icons
sw.js                       Versioned offline cache, scoped to deployment path
js/app.js                   Explicit editor state and application orchestration
js/model/                   Document/layer factories, validation, effect defaults
js/rendering/               Canvas renderer, effect registry, pixel worker, dither
js/interaction/             Shared geometry, object hit testing, viewport and gestures
js/history/                 Reversible commands and saved-state checkpoints
js/storage/                 IndexedDB projects, binary assets and decoded image lifetime
js/components/              Escaped property/effect/layer panel templates
icons/                      Supplied Bootstrap assets and app installation icons
tests/                      Node unit tests and optional real-browser integration checks
tools/                      Dependency-free dev server and optional icon regeneration
```

**Document model.** Version 1 is plain JSON: document ID/name/timestamps, canvas dimensions/background, an ordered `layers` array and asset metadata. Every layer has a stable ID, name, visibility, locking, opacity, transform and effects. Variants add `assetId`, `text` or `shape`. Transforms use centre coordinates, positive dimensions, degrees and explicit flip flags. Selection, history, decoded images, viewport and caches are session state, outside project JSON. `validateDocument` rejects unsupported versions, invalid properties and broken asset references.

**Image selections.** `model/pixel-region.js` supplies normalized paths, validation and source-pixel crop bounds. `interaction/pixel-selection.js` owns transient selection gestures and SVG outlines. `rendering/image-pixels.js` extracts cropped PNGs and applies the optional image-layer `eraseRegions` paths using even-odd alpha subtraction before effects. Original assets remain immutable. Erasure commands store the affected path lists; the renderer includes those paths in its cache key while still reusing pixel processing during movement. Older version-1 documents without paths remain valid.

**Rendering.** `DocumentRenderer.renderDocument(document, assets, canvas)` draws document state independently of the UI. A layer is rasterised in local coordinates, processed through its ordered effects, transformed and composited with layer opacity. An SVG overlay provides editor handles; export uses a separate canvas and never includes the overlay. `exportPNG` returns a Blob. Text wraps/clips to its editable box; transforms never overwrite image source data.

**Effects.** Defaults/UI field definitions live in `model/effects.js`; processors live in `rendering/effects.js`. The initial ordering is brightness → contrast → dither → colour overlay → stroke → blur → drop shadow. Each effect has an ID, type, enabled flag and parameters. Rendering follows the stored order. Brightness, contrast, dithering and alpha dilation run in a module worker; Canvas handles compositing and blur. Stroke is an outside alpha contour with square joins. Layer buffers include padding for strokes, arrowheads, blur and shadow. Add algorithms in the image-processing modules without modifying toolbar code.

**Interaction/history.** Shared inverse geometry implements object-bound selection. `Workspace` owns viewport and transient pointer gestures, committing one reversible transform command on pointer release; Escape restores the starting transform. The history manager stores changed properties, affected layer objects or ordering, not full-document snapshots. It tracks saved command states, clears redo on divergent edits and keeps up to 150 commands. Undo history resets when a project is opened.

**Storage/assets.** IndexedDB `dither` has `projects` and `assets` stores. `saveProject` writes the versioned JSON and referenced source Blobs in one transaction. `loadProject` validates and decodes the required assets before replacing the open document. `AssetStore` caches ImageBitmaps and closes them when switching documents. Shared immutable image IDs allow duplicates without copying sources. Failed/quota-limited saves leave the open project intact.

**Performance.** Render requests are coalesced with animation frames. Local layer caches exclude position, rotation, flip and layer opacity; those edits reuse processed pixels. Effects process at document resolution so preview and export agree. Worker processing leaves the UI event loop free. The current limits are 8192 pixels per document/layer edge, 32 million document/layer pixels, 40 million padded layer pixels and 80 million imported source pixels.

**Offline updates.** The service worker caches the shell, modules, worker, icons and both local font files. It does not force an update while editing. Bump the cache version in `sw.js` when publishing changed static assets, and include any new runtime module in its shell list. Cache namespaces include the deployment path. Applying an offered update requires saved changes first.

## Verification

Run the dependency-free unit suite with Node.js (verified with Node 24):

```sh
npm test
```

The optional integration suite uses Playwright with an installed Edge browser. Playwright is a development tool only and is not shipped or needed to run Dither. To use a separately installed package on PowerShell:

```powershell
$env:DITHER_PLAYWRIGHT_PATH = 'C:/path/to/playwright/index.mjs'
node tests/browser.mjs
node tests/editor-ui.mjs
node tests/line-editing.mjs
node tests/pixel-selection.mjs
```

Start the static server first. `DITHER_URL` can target a subdirectory deployment (include the trailing slash); `DITHER_BROWSER` overrides the default `msedge` channel. Each integration run uses a fresh temporary browser profile and writes screenshots and a PNG to `.test-results/`.

The integration suite exercises image import, native pointer transforms, modifiers, all layer types/effects, keyboard actions, save/reload/reopen, exact preview/export pixel agreement, stroke/shadow padding, alpha, quota errors, missing assets, unsupported versions, corrupt imports, local fonts, responsive panels, installability and offline reopening. It also processes a 12-megapixel image and verifies that movement reuses its processed layer cache. Synthetic drop/paste events cover those import handlers; operating-system clipboard permission behaviour is browser-dependent.

## Limitations and risks

- Verified in current desktop Chromium/Edge. Safari, Firefox, touch-only editing and actual operating-system installation still need separate manual coverage.
- PNG export and monochrome Floyd–Steinberg only. Effect order is stored and honoured but cannot yet be reordered in the UI. Stroke has square joins and outside placement only.
- One selected layer at a time; selection uses object bounds, including transparent image areas, except lines/arrows which are selected near their stroke and heads. Text uses installed fonts rather than embedded font files. The initial UI offers six font families.
- Pixel selection supports one region on one image layer at a time. Selection union/subtraction, feathering, inverse selection, selection movement and general mask editing are not implemented. Freehand paths are limited to 4096 samples; ellipses use 128 segments. Copied regions are limited to 40 million source pixels. Cropped dimensions below one document pixel use the layer's existing one-pixel minimum. Erasures can be reversed through session history; there is no mask-restoration UI after reopening.
- No autosave, portable `.dither` container, project deletion UI, grouping, pixel painting, blend modes or advanced colour management.
- Large documents can still consume substantial memory. Full-resolution compositing and browser-native blur are main-thread operations. Layer caches currently have no global memory budget; worker errors are surfaced and later processing falls back to the main thread.
- Assets retained for history remain in session memory. Obsolete IndexedDB assets are not garbage-collected yet; repeated replacement of source images can grow storage. Local saves are not a cross-device backup.
- Browser canvas/font rasterisation determines rendering fidelity. Effect padding uses three blur radii; very faint blur tails can be truncated.

## Next steps

1. Add portable project import/export and a local project manager with safe asset garbage collection.
2. Add Atkinson/Bayer algorithms, colour palettes, JPEG/WebP export and effect reordering UI.
3. Add memory-budgeted caches, cancellable worker jobs and a reduced-resolution interaction preview for oversized effects.
4. Extend cross-browser, touch and assistive-technology checks, then consider grouping and alignment tools.

Bootstrap Icons retain their bundled MIT licence notices. App installation PNGs are derived from the supplied `icons/app-icon.svg`; `tools/generate-icons.mjs` is an optional maintenance helper, not a build requirement.
