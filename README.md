# Nested Set Tree Viewer

A small browser-based viewer for visualizing hierarchical data stored in a flat JSON structure.

It uses:

- `id` / `parent_id` relationships to build the hierarchy
- D3.js for tree layout and rendering
- `lft`, `rgt` / `rght`, and `lvl` / `level` as nested-set metadata

No build step or package manager is required.

## Features

- Paste JSON directly into the browser
- Supports both:
  - `parent_id`
  - `parentId`
- Supports nested-set aliases:
  - `rgt` or `rght`
  - `lvl` or `level`
- The first node may omit its parent field and will be treated as the root
- Zoom and pan
- Fit tree to viewport
- Reset tree layout
- Select nodes
- Drag nodes manually
- Copy node text
- Smooth D3 tree links with arrowheads

## Input format

Example:

```json
[
  {
    "id": 1,
    "parent_id": null,
    "name": "Node 1",
    "lft": 1,
    "rght": 12,
    "level": 0
  },
  {
    "id": 2,
    "parent_id": 1,
    "name": "Node 2",
    "lft": 2,
    "rght": 7,
    "level": 1
  },
  {
    "id": 3,
    "parent_id": 2,
    "name": "Node 3",
    "lft": 3,
    "rght": 4,
    "level": 2
  }
]