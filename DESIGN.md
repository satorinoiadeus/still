# Still presentation

The engine and database adapters remain upstream. Presentation uses warm paper (`#fbfaf7`), soft neutral sidebar (`#f1f0e9`), dark forest surfaces and sage (`#52765a`). Optional clay/slate accents and comfortable/compact spacing are local appearance preferences, separate from task storage.

Reused code: the actual HamsterBase Tasks React desktop/mobile interfaces, Loro model and services; its vendored MIT VSCF/VS Code-derived context, command and keyboard infrastructure; its existing Lucide icons and dnd-kit interactions. These retain their upstream notices. No proprietary app assets or unverified third-party snippets are copied.

Design patterns adapted in original Still code: a focused navigation rail with a hide/show control, discoverable keyboard command search, semantic color tokens, per-user density, touch-sized bottom navigation, visible focus rings, and reduced-motion support. The aim is to combine proven open-source desktop-editor and native mobile patterns while retaining one task model.

The existing command palette and settings remain available rather than creating duplicate command or preferences engines. Appearance values are validated before applying them. Motion avoids drag transforms. Compact mobile rows retain at least 44px targets.
