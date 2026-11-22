# ETHER WORLD — 3D fashion universe (`#/ether`)

An original, ethereal / cyber / Y2K-underground look: white, silver, chrome, ice blue, pale grey, black accents, glass. No branded designs are reproduced; every garment, accessory and the graphic print are drawn from scratch.

## Files (`src/ether/`)

| File | Role |
|---|---|
| `state.js` | The whole scene as one plain object: defaults, character presets, catalogues, `sanitize()` for loading saves / JSON files safely. |
| `materials.js` | 16 material presets (chrome, brushed metal, silver, glossy plastic, glass, frosted glass, fabric, satin, leather, latex, holographic, mesh net, skin, hair, emissive, concrete) and `applySpec()` for live edits. |
| `character.js` | Skeleton from proportions + pose, smooth procedural body, 9 hairstyles. Shared geometry helpers (`tube`, `shell`, `torsoProfile`). |
| `wardrobe.js` | 6 tops, 6 bottoms, 4 shoes, 12 accessories — real geometry on the same skeleton. |
| `showroom.js` | Cyclorama room, glossy + mirror floor, lighting rig with shadows, light shafts, 12 editable object types. |
| `app.js` | UI (8 sections), viewport, selection + transform gizmo, undo/redo, walk mode, post effects, save/load, PNG / GLB / JSON export. |

Reused from the Studio: the shared WebGL renderer (`viewer.js`), controls, history, menu, icons, IndexedDB (new `scenes` store, DB version 4).

## Features

1. **Character** — 5 presets (Ether, Seraph, Frost, Void, Drift), 4 poses, height, build, shoulders, waist, hips, legs, head, 8 skin tones + custom, 9 hairstyles, hair colours + custom.
2. **Wardrobe** — tops: fitted long sleeve, graphic shirt (own text), layered top, mesh top, futuristic jacket, oversized hoodie. Bottoms: slim, flared jeans, cargos, layered, balloon, wrap skirt over leggings. Shoes: futuristic sneakers, slim boots, split-toe platforms, blade heels (shoes lift the body).
3. **Accessories** — chrome necklace, hanging chains, silver rings, wrap sunglasses, belt, earrings, gloves, chrome wings, orbit ring (tilted like a planet ring, deliberately not a halo), spine piece, arm cuffs, choker.
4. **Materials** — per slot (top, under layer, bottom, shoes & gloves, chrome parts, glasses, hair, selected room object): preset, colour, roughness, metalness, transparency, holographic shimmer, opacity.
5. **Environment** — 4 presets, room / fog / floor colours, fog density, mirror floor, light shafts; add 12 object types, select by click or outliner, move / rotate / scale with gizmo (W E R) or sliders, duplicate, delete, reset.
6. **Lighting** — 4 presets, key / fill / rim / ambient, key direction, key and rim colours, shadows off / soft / high (4K map).
7. **Camera** — 7 angles, lens, turntable, walk mode (W A S D / arrows / on-screen pad), ambient occlusion (GTAO), depth of field (Bokeh) with focus and blur.
8. **Export** — save / load / delete scenes on the device, scene JSON export / import, PNG screenshot (2×) and 4K render (with AO / DOF if on), GLB of the character or the whole scene.

## Honest limits

* Light shafts are a stylised additive effect, not physically simulated volumetric light (that needs ray marching and is too slow in a browser for this scene size).
* The character is a stylised procedural mannequin, not a rigged, sculpted human: poses are presets, there is no free bone posing yet.
* Garments are shaped shells around the body, not cloth simulation.
* Mirror floor, glass (transmission), AO and DOF each add render passes; on phones switch them off if it gets slow.
