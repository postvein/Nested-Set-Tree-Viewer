let currentRoot = null;
let currentData = null;
let selectedNode = null;
let currentExtensions = new Map();
let modalMode = "tree";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 82;
const EXTENSION_WIDTH = 150;
const EXTENSION_HEIGHT = 28;
const EXTENSION_GAP = 6;
const EXTENSION_TOP_GAP = 8;
const BASE_LEVEL_GAP = 180;
const SIBLING_GAP = 220;

const DEFAULT_TREE_JSON = `[
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
  },
  {
    "id": 4,
    "parent_id": 2,
    "name": "Node 4",
    "lft": 5,
    "rght": 6,
    "level": 2
  },
  {
    "id": 5,
    "parent_id": 1,
    "name": "Node 5",
    "lft": 8,
    "rght": 11,
    "level": 1
  },
  {
    "id": 6,
    "parent_id": 5,
    "name": "Node 6",
    "lft": 9,
    "rght": 10,
    "level": 2
  }
]`;

const DEFAULT_EXTENSIONS_JSON = `{
  "groups": [
    {
      "id": 1858646,
      "group_focus_id": 3    
    }
  ]
}`;

const elements = {
  treeContainer: document.getElementById("treeContainer"),
  svg: d3.select("#treeSvg"),
  viewport: d3.select("#treeViewport"),
  openModalBtn: document.getElementById("openModalBtn"),
  openFileBtn: document.getElementById("openFileBtn"),
  fileInput: document.getElementById("fileInput"),
  extensionsBtn: document.getElementById("extensionsBtn"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalDescription: document.getElementById("modalDescription"),
  cancelBtn: document.getElementById("cancelBtn"),
  buildBtn: document.getElementById("buildBtn"),
  jsonInput: document.getElementById("jsonInput"),
  errorBox: document.getElementById("errorBox"),
  emptyState: document.getElementById("emptyState"),
  stats: document.getElementById("stats"),
  fitBtn: document.getElementById("fitBtn"),
  layoutBtn: document.getElementById("layoutBtn"),
};

const zoom = d3.zoom()
  .scaleExtent([0.1, 4])
  .filter(event => {
    if (event.target.closest?.(".tree-node")) return false;
    return !event.ctrlKey || event.type === "wheel";
  })
  .on("zoom", event => {
    elements.viewport.attr("transform", event.transform);
  });

elements.svg.call(zoom);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getParentId(item, index = -1) {
  if (hasOwn(item, "parent_id")) return item.parent_id;
  if (hasOwn(item, "parentId")) return item.parentId;
  if (index === 0) return null;
  return undefined;
}

function setParentId(item, value) {
  if (hasOwn(item, "parent_id")) item.parent_id = value;
  else if (hasOwn(item, "parentId")) item.parentId = value;
  else item.parent_id = value;
}

function getLeft(item) {
  if (hasOwn(item, "lft")) return item.lft;
  if (hasOwn(item, "left")) return item.left;
  return undefined;
}

function getRight(item) {
  if (hasOwn(item, "rgt")) return item.rgt;
  if (hasOwn(item, "rght")) return item.rght;
  if (hasOwn(item, "right")) return item.right;
  return undefined;
}

function getLevel(item) {
  if (hasOwn(item, "lvl")) return item.lvl;
  if (hasOwn(item, "level")) return item.level;
  return undefined;
}

function isTreeLikeItem(item) {
  return isObject(item)
    && item.id !== undefined
    && item.id !== null
    && getLeft(item) !== undefined
    && getRight(item) !== undefined
    && getLevel(item) !== undefined;
}

function isTreeLikeArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isTreeLikeItem);
}

function isExtensionLikeItem(item) {
  return isObject(item)
    && item.id !== undefined
    && item.id !== null
    && hasOwn(item, "group_focus_id");
}

function isExtensionLikeArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isExtensionLikeItem);
}

function findFirstMatchingArray(parsed, matcher, name) {
  if (matcher(parsed)) return parsed;

  if (!isObject(parsed)) {
    throw new Error(`Could not find a ${name} array in the JSON.`);
  }

  for (const value of Object.values(parsed)) {
    if (matcher(value)) return value;
  }

  throw new Error(`Could not find a top-level array containing ${name} objects.`);
}

function normalizeTreeInput(parsed) {
  return findFirstMatchingArray(parsed, isTreeLikeArray, "nested-set tree").map(item => ({ ...item }));
}

function normalizeExtensionsInput(parsed) {
  return findFirstMatchingArray(parsed, isExtensionLikeArray, "extension").map(item => ({ ...item }));
}

function openTreeModal() {
  modalMode = "tree";
  elements.modalTitle.textContent = "Paste tree JSON";
  elements.modalDescription.innerHTML = `
    Paste an array directly or an object containing a tree array.
    Only top-level arrays are inspected. The first matching array is used.
  `;
  elements.buildBtn.textContent = "Build tree";
  elements.jsonInput.value = DEFAULT_TREE_JSON;
  openModal();
}

function openExtensionsModal() {
  modalMode = "extensions";
  elements.modalTitle.textContent = "Paste extensions";
  elements.modalDescription.innerHTML = `
    Paste an array directly or an object containing an extensions array.
    Only top-level arrays are inspected. Each item must have
    <code>id</code> and <code>group_focus_id</code>.
    Existing extensions will be replaced.
  `;
  elements.buildBtn.textContent = "Paste extensions";
  elements.jsonInput.value = DEFAULT_EXTENSIONS_JSON;
  openModal();
}

function openModal() {
  hideError();
  elements.modalBackdrop.classList.add("open");
  setTimeout(() => elements.jsonInput.focus(), 0);
}

function closeModal() {
  elements.modalBackdrop.classList.remove("open");
  hideError();
}

function showError(message) {
  elements.errorBox.textContent = message;
  elements.errorBox.classList.add("show");
}

function hideError() {
  elements.errorBox.classList.remove("show");
}

function parseTreeText(text) {
  const data = normalizeTreeInput(JSON.parse(text));
  validateTreeData(data);
  return data;
}

function parseExtensionsText(text) {
  const data = normalizeExtensionsInput(JSON.parse(text));
  validateExtensions(data);
  return data;
}

function validateTreeData(data) {
  if (data.length === 0) throw new Error("The tree array is empty.");

  const ids = new Set();

  data.forEach((item, index) => {
    if (!isObject(item)) throw new Error(`Item at index ${index} must be an object.`);
    if (item.id === undefined || item.id === null) throw new Error(`Item at index ${index} is missing "id".`);
    if (getLeft(item) === undefined) throw new Error(`Node ${item.id} is missing "lft" / "left".`);
    if (getRight(item) === undefined) throw new Error(`Node ${item.id} is missing "rgt" / "rght" / "right".`);
    if (getLevel(item) === undefined) throw new Error(`Node ${item.id} is missing "lvl" / "level".`);

    if (index > 0 && !hasOwn(item, "parent_id") && !hasOwn(item, "parentId")) {
      throw new Error(`Item at index ${index} (id ${item.id}) is missing "parent_id" / "parentId".`);
    }

    const id = String(item.id);

    if (ids.has(id)) throw new Error(`Duplicate id: ${id}`);
    ids.add(id);
  });

  const root = data[0];
  const rootParentId = getParentId(root, 0);

  if (rootParentId !== null && rootParentId !== undefined && !ids.has(String(rootParentId))) {
    setParentId(root, null);
  }

  data.forEach((item, index) => {
    const parentId = getParentId(item, index);

    if (parentId === null || parentId === undefined) return;

    if (!ids.has(String(parentId))) {
      throw new Error(`Node ${item.id} references missing parent ${parentId}.`);
    }

    if (String(parentId) === String(item.id)) {
      throw new Error(`Node ${item.id} cannot be its own parent.`);
    }
  });
}

function validateExtensions(data) {
  if (!currentData) throw new Error("Load a tree before pasting extensions.");
  if (data.length === 0) throw new Error("The extensions array is empty.");

  const nodeIds = new Set(currentData.map(item => String(item.id)));

  data.forEach((extension, index) => {
    if (!isObject(extension)) throw new Error(`Extension at index ${index} must be an object.`);
    if (extension.id === undefined || extension.id === null) throw new Error(`Extension at index ${index} is missing "id".`);
    if (!hasOwn(extension, "group_focus_id")) throw new Error(`Extension ${extension.id} is missing "group_focus_id".`);
    if (extension.group_focus_id === null || extension.group_focus_id === undefined) {
      throw new Error(`Extension ${extension.id} has an empty "group_focus_id".`);
    }

    if (!nodeIds.has(String(extension.group_focus_id))) {
      throw new Error(`Extension ${extension.id} references missing node ${extension.group_focus_id}.`);
    }
  });
}

function replaceExtensions(extensions) {
  currentExtensions = new Map();

  for (const extension of extensions) {
    const nodeId = String(extension.group_focus_id);

    if (!currentExtensions.has(nodeId)) {
      currentExtensions.set(nodeId, []);
    }

    currentExtensions.get(nodeId).push(extension);
  }
}

function getNodeExtensions(node) {
  return currentExtensions.get(String(node.data.id)) ?? [];
}

function getExtensionCount() {
  let count = 0;
  for (const extensions of currentExtensions.values()) count += extensions.length;
  return count;
}

function getMaxExtensionsPerNode() {
  let max = 0;
  for (const extensions of currentExtensions.values()) max = Math.max(max, extensions.length);
  return max;
}

function createHierarchy(data) {
  const indexedData = data.map((item, index) => ({
    ...item,
    __parentId: getParentId(item, index),
  }));

  return d3.stratify()
    .id(item => String(item.id))
    .parentId(item => item.__parentId === null || item.__parentId === undefined ? null : String(item.__parentId))
    (indexedData);
}

function getNodeName(node) {
  const name = node.data.name;
  return name !== undefined && name !== null && String(name).trim() !== ""
    ? String(name)
    : "Unnamed";
}

function getNodeId(node) {
  return `ID: ${node.data.id}`;
}

function getNodeMetadata(node) {
  return `L: ${getLeft(node.data)}   R: ${getRight(node.data)}   LVL: ${getLevel(node.data)}`;
}

function getTreeLayout(root) {
  const maxExtensions = getMaxExtensionsPerNode();

  const extensionSpace = maxExtensions === 0
    ? 0
    : EXTENSION_TOP_GAP + maxExtensions * (EXTENSION_HEIGHT + EXTENSION_GAP);

  return d3.tree().nodeSize([
    SIBLING_GAP,
    BASE_LEVEL_GAP + extensionSpace,
  ])(root);
}

function renderTree(data) {
  currentData = data;
  selectedNode = null;

  elements.viewport.selectAll("*").remove();

  let root;

  try {
    root = createHierarchy(data);
  } catch (error) {
    throw new Error(`Could not build hierarchy: ${error.message}`);
  }

  currentRoot = getTreeLayout(root);

  renderLinks();
  renderNodes();

  elements.emptyState.style.display = "none";
  updateStats();

  requestAnimationFrame(fitTree);
}

function renderLinks() {
  const linkGenerator = d3.linkVertical()
    .x(point => point.x)
    .y(point => point.y);

  elements.viewport
    .selectAll(".tree-link")
    .data(currentRoot.links(), link => String(link.target.data.id))
    .join("path")
    .attr("class", "tree-link")
    .attr("d", linkGenerator);
}

function renderNodes() {
  const groups = elements.viewport
    .selectAll(".tree-node")
    .data(currentRoot.descendants(), node => String(node.data.id))
    .join("g")
    .attr("class", node => node.depth === 0 ? "tree-node root" : "tree-node")
    .attr("transform", node => `translate(${node.x}, ${node.y})`)
    .on("click", (event, node) => {
      event.stopPropagation();
      selectNode(node);
    });

  groups.append("rect")
    .attr("class", "node-card")
    .attr("x", -NODE_WIDTH / 2)
    .attr("y", -NODE_HEIGHT / 2)
    .attr("width", NODE_WIDTH)
    .attr("height", NODE_HEIGHT)
    .call(createNodeDrag());

  groups.append("text")
    .attr("class", "node-title")
    .attr("y", -18)
    .text(getNodeName);

  groups.append("text")
    .attr("class", "node-meta")
    .attr("y", 3)
    .text(getNodeId);

  groups.append("text")
    .attr("class", "node-meta")
    .attr("y", 23)
    .text(getNodeMetadata);

  groups.each(function(node) {
    renderNodeExtensions(d3.select(this), node);
  });
}

function renderNodeExtensions(group, node) {
  const extensions = getNodeExtensions(node);
  if (extensions.length === 0) return;

  const startY = NODE_HEIGHT / 2 + EXTENSION_TOP_GAP;

  const extensionGroups = group.append("g")
    .attr("class", "node-extensions")
    .selectAll(".node-extension")
    .data(extensions)
    .join("g")
    .attr("class", "node-extension")
    .attr("transform", (_, index) => `translate(0, ${startY + index * (EXTENSION_HEIGHT + EXTENSION_GAP)})`);

  extensionGroups.append("rect")
    .attr("class", "node-extension-card")
    .attr("x", -EXTENSION_WIDTH / 2)
    .attr("y", 0)
    .attr("width", EXTENSION_WIDTH)
    .attr("height", EXTENSION_HEIGHT);

  extensionGroups.append("text")
    .attr("class", "node-extension-text")
    .attr("x", 0)
    .attr("y", EXTENSION_HEIGHT / 2)
    .text(extension => `ID: ${extension.id}`);
}

function createNodeDrag() {
  return d3.drag()
    .on("start", function(event, node) {
      event.sourceEvent.stopPropagation();
      selectNode(node);
      d3.select(this.parentNode).raise();
    })
    .on("drag", function(event, node) {
      const [x, y] = d3.pointer(event.sourceEvent, elements.viewport.node());

      node.x = x;
      node.y = y;

      updateNodePosition(node);
      updateLinks();
    });
}

function selectNode(node) {
  selectedNode = node;

  elements.viewport.selectAll(".tree-node")
    .classed("selected", candidate => candidate === node);
}

function clearSelection() {
  selectedNode = null;
  elements.viewport.selectAll(".tree-node").classed("selected", false);
}

function updateNodePosition(node) {
  elements.viewport
    .selectAll(".tree-node")
    .filter(candidate => candidate === node)
    .attr("transform", `translate(${node.x}, ${node.y})`);
}

function updateLinks() {
  const linkGenerator = d3.linkVertical()
    .x(point => point.x)
    .y(point => point.y);

  elements.viewport.selectAll(".tree-link")
    .attr("d", link => linkGenerator(link));
}

function resetLayout() {
  if (currentData) renderTree(currentData);
}

function updateStats() {
  if (!currentData) {
    elements.stats.style.display = "none";
    return;
  }

  const rootCount = currentData.filter((item, index) => getParentId(item, index) === null).length;
  const edgeCount = currentData.length - rootCount;
  const extensionCount = getExtensionCount();

  elements.stats.textContent =
    `${currentData.length} node${currentData.length === 1 ? "" : "s"} · ` +
    `${edgeCount} edge${edgeCount === 1 ? "" : "s"} · ` +
    `${rootCount} root${rootCount === 1 ? "" : "s"} · ` +
    `${extensionCount} extension${extensionCount === 1 ? "" : "s"}`;

  elements.stats.style.display = "block";
}

function fitTree() {
  if (!currentRoot) return;

  const width = elements.treeContainer.clientWidth;
  const height = elements.treeContainer.clientHeight;
  const bounds = elements.viewport.node().getBBox();

  if (bounds.width === 0 || bounds.height === 0) return;

  const padding = 80;
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);

  const scale = Math.min(
    availableWidth / bounds.width,
    availableHeight / bounds.height,
    1.3,
  );

  const translateX = width / 2 - scale * (bounds.x + bounds.width / 2);
  const translateY = height / 2 - scale * (bounds.y + bounds.height / 2);

  const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

  elements.svg.transition().duration(350).call(zoom.transform, transform);
}

function buildTreeFromText(text) {
  const data = parseTreeText(text);

  currentExtensions = new Map();
  renderTree(data);
}

function pasteExtensionsFromText(text) {
  const extensions = parseExtensionsText(text);

  replaceExtensions(extensions);
  renderTree(currentData);
}

function submitModal() {
  try {
    hideError();

    if (modalMode === "extensions") {
      pasteExtensionsFromText(elements.jsonInput.value);
    } else {
      buildTreeFromText(elements.jsonInput.value);
    }

    closeModal();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
}

async function loadTreeFile(file) {
  try {
    buildTreeFromText(await file.text());
  } catch (error) {
    window.alert(error instanceof Error ? error.message : String(error));
  } finally {
    elements.fileInput.value = "";
  }
}

function registerEventListeners() {
  elements.openModalBtn.addEventListener("click", openTreeModal);
  elements.extensionsBtn.addEventListener("click", openExtensionsModal);
  elements.openFileBtn.addEventListener("click", () => elements.fileInput.click());

  elements.fileInput.addEventListener("change", () => {
    const file = elements.fileInput.files?.[0];
    if (file) loadTreeFile(file);
  });

  elements.cancelBtn.addEventListener("click", closeModal);
  elements.buildBtn.addEventListener("click", submitModal);
  elements.fitBtn.addEventListener("click", fitTree);
  elements.layoutBtn.addEventListener("click", resetLayout);

  elements.modalBackdrop.addEventListener("click", event => {
    if (event.target === elements.modalBackdrop) closeModal();
  });

  elements.svg.on("click.clear-selection", event => {
    if (!event.target.closest?.(".tree-node")) clearSelection();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && elements.modalBackdrop.classList.contains("open")) {
      closeModal();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && elements.modalBackdrop.classList.contains("open")) {
      submitModal();
    }
  });

  window.addEventListener("resize", () => {
    if (currentRoot) fitTree();
  });
}

registerEventListeners();