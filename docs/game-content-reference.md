# Landing game content reference

Last checked: 2026-10-11, Heroes_Trial commit `84e44ca`.

The landing catalog in `src/config/missions.ts` follows the six modules registered
in `web-poc/src/content/catalog/register-current.ts`. Mission and activity IDs
come from each module's `definition.ts`. Location labels follow the visible room
names in `web-poc/src/runtime/world-scene/generated-rooms.ts`, not internal room IDs.
There are five minigames; the bullying mission uses exploration and dialogue.

`public/assets/jogo/minigame-defesas-atual.webp` is a real capture from the Phaser
replay scene for the ball-defense activity at that commit. The replay used private
in-memory storage. The 448 x 900 browser capture was cropped to 448 x 800 at
offset (0, 76) to exclude replay tooling, then encoded as WebP. No game artwork
was generated or altered.

This content refresh does not rebuild or replace the embedded game bundle.
