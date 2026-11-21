# WORLD BUILDER — Bryce-inspired world creation (`#/world`)

Built incrementally, phase by phase. Everything listed under “Done” works and is covered by the automated tests (`tests/world-*.test.mjs`) and a scripted browser run; everything else is marked in the app as “next phase” — no fake buttons.

## Done — phases 1 & 2 (+ the sky / water / project basics a world needs)

| Area | What works |
|---|---|
| **Layout** | Left rail (World, Terrain, Sculpt, Characters, Objects, Drawing, Text, Materials, Textures, Sky, Water, Camera & light, Project) + section panel · centre viewport · right: scene hierarchy + properties · bottom dock: Timeline, Terrain layers, History. |
| **World generator** | 14 world types: mountains, fantasy, alien planet, ocean & lakes, islands, desert, forest, caves & canyons, floating islands, futuristic city, surreal (checkerboard classic), abstract, space / asteroid, dreamlike. Seeds, regenerate, everything editable afterwards. |
| **Terrain** | Procedural (Perlin fBm, ridged mountains, domain warp, terraces, plateaus, canyons, dunes, craters, spires, island mask, depth offset), hydraulic erosion (droplets) and thermal erosion, surface colours by height / slope / snow line, faceted look, checkerboard, heightmap import / export, smooth / invert / clear. |
| **Terrain layers** | Any number of layers, each with visibility, lock, rename, strength 0–2, reorder, merge down, delete; sculpting writes into the active layer. |
| **Sculpting** | Draw, Raise, Lower, Smooth, Flatten, Inflate, Push, Pull, Carve, Erode, Add detail, Remove detail. Brush size, strength, softness, shape (circle, square, rough, star), falloff (smooth, linear, sharp, constant), pen pressure, Shift inverts, `[` `]` size, live brush ring on the surface. |
| **Objects** | Sphere, cube, cylinder, cone, pyramid, torus, rock, tree, building, planet, floating island, rock arch, crystal, monolith, abstract knot, twisted sculpture, chair, table, Ether characters, image / reference planes, imported models (GLB, glTF, OBJ, FBX, STL, PLY, 3MF, DAE). Move / rotate / scale (gizmo or numbers), edit geometry parameters, material, rename, duplicate, delete, drop to ground. |
| **Scatter** | Instanced trees, rocks, crystals, cacti, chrome spheres, monoliths, towers, floating islands, arches — placed by height / slope, re-placed after sculpting. |
| **Hierarchy** | World → Terrain, Water, Sky, Clouds, Planets, Vegetation, Lighting, then all objects as a tree. Hide, lock, rename (double-click / F2), multi-select (Ctrl / Shift), group / ungroup, parent / unparent (drag onto an item, or the Parent field), reorder (drag above / below). |
| **History** | Undo / redo for everything including terrain strokes (60 steps), clickable history list. |
| **Sky** | Presets (day, sunset, sunrise, night, aurora, alien, fantasy, space), zenith / horizon / ground / sun colours, sun direction / height / size, haze, fog, stars, nebula, animated aurora, clouds (cover, altitude, colour, drifting), any number of planets & moons (colours, size, position, ring, glow). |
| **Water** | Sea level, colour, deep tint, transparency, GPU waves, speed, scrolling ripples, mirror reflections. |
| **Camera & render** | 7 presets, perspective / orthographic, field of view, fly mode (WASD, E / C), ambient occlusion, depth of field, sun / ambient / exposure / shadows, PNG renders up to 4K, camera keyframe timeline (add keys, scrub, play, loop). |
| **Project** | Save / open / delete in the browser, autosave every 20 s and on leaving (restored on return), project file (`.triadworld.json`) export / import, GLB / glTF export with hierarchy, materials and instancing, terrain OBJ, heightmap PNG, terrain colour PNG. |

## Next phases

3. Character sculpting & rigging (face / body sculpt brushes on the mesh, bone rig + posing).
4. Painting directly on 3D surfaces (brush, pencil, eraser, picker, paint layers, projected onto the real surface).
5. Typography on objects (text on surfaces, extruded 3D text, outlines, bend, replacing lettering in textures).
6. Texture studio (bump / normal maps, texture scale, procedural stone / wood / concrete, image textures).
7. Sketch → 3D (sketch canvas, front / side / top references, extrusion from curves, sketch → terrain).

## Honest limits

* The terrain is a heightfield: overhangs and real caves are not possible in it. Arches, rock objects and canyons stand in; true caves need a voxel terrain (a later phase).
* Waterfalls are not simulated; rivers are carved channels below sea level.
* Clouds are a drifting layer, not volumetric.
* Performance was measured with software rendering only (no GPU in the test machine); there a still frame takes ~17 ms, an animated frame with the full sky ~1 s. Real graphics cards are many times faster, but this was not measured.
