# Visual asset replacement

- Replace `scenes/office-placeholder.svg` with the final 16:9 office scene and update `officeScene.src` in `src/visualAssets.ts`.
- Replace each file in `sprites/` with an independent transparent PNG. Keep generous transparent space around the character and place the feet near the bottom edge.
- Adjust `x`, `y`, and `scale` for each employee in `src/visualAssets.ts`. Coordinates are percentages of the scene; `x/y` point to the character's feet.
- Simulation data and rules do not depend on any asset path or scene coordinate.
