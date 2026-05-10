# TileMap Systems Guide (SimpleTileMap)

This guide explains the production-ready `Random Tilemap` and `Terrain/Autotile` systems for `SimpleTileMap`.

## 1. Where To Use These Systems

Use these systems in two places:

1. In the editor painting tool (Tileset panel):
- `Random`
- `Auto terrain`

2. In Events as **Actions** on the `SimpleTileMap` object:
- `Set random tile (at position)`
- `Set random tile (on the grid)`
- `Fill area with random tiles`
- `Set terrain tile (at position)`
- `Set terrain tile (on the grid)`

These are Actions, not Conditions.

## 2. What `Auto terrain` Does In The Editor

When `Auto terrain` is enabled while painting:

1. The editor reads a `4x4` tile pattern from your current tileset selection.
2. This pattern is treated as the 16 terrain masks (`0` to `15`).
3. While you paint, the system checks the painted cell and its neighbors.
4. It picks the correct tile variant automatically so terrain pieces connect cleanly.

Important behavior:

- Best quality is with a `4x4` selection.
- Smaller selections are now supported:
  - `1x1`: all masks fallback to the same tile.
  - `2x2` / `3x3`: missing masks are auto-filled from the closest available masks.
- `Random` and `Auto terrain` are mutually exclusive in the editor UI.
- If `Auto terrain` is enabled, random painting is disabled.

## 3. Terrain Mask Layout (0..15)

The `4x4` selection is read in row-major order:

```text
0   1   2   3
4   5   6   7
8   9   10  11
12  13  14  15
```

Each mask index is computed from 4-direction neighbors:

- North = `1`
- East = `2`
- South = `4`
- West = `8`

Formula:

```text
mask = (N ? 1 : 0) | (E ? 2 : 0) | (S ? 4 : 0) | (W ? 8 : 0)
```

Examples:

- `0`: isolated tile (no terrain neighbors).
- `15`: connected on all four sides.
- `3`: connected North + East.
- `12`: connected South + West.

## 4. Random Tilemap System

The random system accepts a tile list as text.

Accepted separators:

- Comma `,`
- Space
- New line
- Semicolon `;`
- Tab

Example:

```text
5, 6 7
8;9
```

Weighted random via repetition:

```text
5,5,5,8
```

This makes tile `5` more likely than tile `8`.

Invalid or missing tile IDs are ignored.

## 5. Terrain Actions (Events) Input Format

`Set terrain tile` actions expect a terrain mask list (mask order `0` to `15`).

Input format supports:

- Comma/space/new-line/semicolon separated values.
- Optional `-1` placeholders for missing masks.

Behavior for missing masks:

- If a mask is missing or `-1`, the runtime picks the closest available mask automatically.
- This keeps the system working even with incomplete terrain sets.

Recommended for best visual quality:

- Provide all 16 masks explicitly.

## 6. Typical Workflow

1. Create a `SimpleTileMap` object.
2. Make sure atlas tile IDs you use are valid in this tilemap.
3. Set `Active layer index` if you work on multiple layers.
4. Pick one mode:
- Random mode for noisy/procedural variation.
- Auto terrain mode for connected terrain edges.
5. Paint in editor, or call actions from events at runtime.

## 7. Runtime Notes

The systems are implemented in runtime code, not in `pixi-tilemap` itself.

Key files:

- Runtime logic: `Extensions/TileMap/simpletilemapruntimeobject.ts`
- Actions declarations: `Extensions/TileMap/JsExtension.js`
- Editor autotile painting logic: `newIDE/app/src/InstancesEditor/index.js`
- Editor toggles (`Random` / `Auto terrain`): `newIDE/app/src/InstancesEditor/TileSetVisualizer.js`

## 8. Troubleshooting

If terrain appears not to work:

1. Confirm you are using `SimpleTileMap`.
2. Confirm the active layer is the one you are painting/updating.
3. Confirm your terrain input is mask order `0..15`.
4. In editor mode, confirm the selected terrain pattern is at least `4x4`.
4. For premium results, use a `4x4` pattern. Smaller patterns still work via smart fallback.
5. Confirm your tile IDs exist in the current atlas/tile definitions.

If random appears not to work:

1. Confirm tile IDs are valid.
2. Confirm the list is not empty after parsing.
3. In editor mode, confirm `Auto terrain` is not enabled at the same time.

## 9. Quick Arabic Summary

- `Auto terrain` فائدته إنه يوصل بلاطات الأرض تلقائيًا أثناء الرسم بدل ما تختار كل edge يدويًا.
- الأفضل تختار باترن `4x4`، لكن الآن حتى لو أصغر النظام بيكمل الباقي تلقائيًا بـ fallback ذكي.
- في الـEvents هتستخدم Actions الخاصة بـ`Set terrain tile...` أو `Set random tile...`.
- النظام الآن يقبل إدخال مرن، ويدعم fallback لو بعض الـmasks ناقصة.
