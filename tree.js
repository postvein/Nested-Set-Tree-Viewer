let currentRoot = null;
let currentData = null;
let selectedNode = null;

const NODE_WIDTH = 220;
const NODE_HEIGHT = 68;

const LEVEL_GAP = 180;
const SIBLING_GAP = 240;

const elements = {
  treeContainer: document.getElementById("treeContainer"),

  svg: d3.select("#treeSvg"),
  viewport: d3.select("#treeViewport"),

  openModalBtn: document.getElementById("openModalBtn"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  cancelBtn: document.getElementById("cancelBtn"),
  buildBtn: document.getElementById("buildBtn"),

  jsonInput: document.getElementById("jsonInput"),
  errorBox: document.getElementById("errorBox"),

  emptyState: document.getElementById("emptyState"),
  stats: document.getElementById("stats"),

  fitBtn: document.getElementById("fitBtn"),
  layoutBtn: document.getElementById("layoutBtn"),
};

const zoom = d3
  .zoom()
  .scaleExtent([0.1, 4])
  .filter((event) => {
    if (event.target.closest?.(".tree-node")) {
      return false;
    }

    return !event.ctrlKey || event.type === "wheel";
  })
  .on("zoom", (event) => {
    elements.viewport.attr(
      "transform",
      event.transform,
    );
  });

elements.svg.call(zoom);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object,
    key,
  );
}

function getParentId(item, index = -1) {
  if (hasOwn(item, "parent_id")) {
    return item.parent_id;
  }

  if (hasOwn(item, "parentId")) {
    return item.parentId;
  }

  if (index === 0) {
    return null;
  }

  return undefined;
}

function getRight(item) {
  if (hasOwn(item, "rgt")) {
    return item.rgt;
  }

  return item.rght;
}

function getLevel(item) {
  if (hasOwn(item, "lvl")) {
    return item.lvl;
  }

  return item.level;
}

function openModal() {
  hideError();

  elements.modalBackdrop.classList.add("open");

  setTimeout(() => {
    elements.jsonInput.focus();
  }, 0);
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

function parseInput() {
  const parsed = JSON.parse(
    elements.jsonInput.value,
  );

  const data = normalizeInput(parsed);

  validateData(data);

  return data;
}

function normalizeInput(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (
    parsed &&
    Array.isArray(parsed.organizations)
  ) {
    return parsed.organizations;
  }

  throw new Error(
    'JSON must be an array or an object containing an "organizations" array.',
  );
}

function validateData(data) {
  if (data.length === 0) {
    throw new Error("The array is empty.");
  }

  const ids = new Set();

  data.forEach((item, index) => {
    validateNodeShape(item, index);

    const id = String(item.id);

    if (ids.has(id)) {
      throw new Error(`Duplicate id: ${id}`);
    }

    ids.add(id);
  });

  data.forEach((item, index) => {
    validateParentReference(
      item,
      index,
      ids,
    );
  });
}

function validateNodeShape(item, index) {
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item)
  ) {
    throw new Error(
      `Item at index ${index} must be an object.`,
    );
  }

  if (
    item.id === undefined ||
    item.id === null
  ) {
    throw new Error(
      `Item at index ${index} is missing "id".`,
    );
  }

  if (
    index > 0 &&
    !hasOwn(item, "parent_id") &&
    !hasOwn(item, "parentId")
  ) {
    throw new Error(
      `Item at index ${index} (id ${item.id}) is missing "parent_id" / "parentId".`,
    );
  }
}

function validateParentReference(
  item,
  index,
  ids,
) {
  const parentId = getParentId(
    item,
    index,
  );

  if (
    parentId === null ||
    parentId === undefined
  ) {
    return;
  }

  if (!ids.has(String(parentId))) {
    throw new Error(
      `Node ${item.id} references missing parent ${parentId}.`,
    );
  }

  if (
    String(parentId) ===
    String(item.id)
  ) {
    throw new Error(
      `Node ${item.id} cannot be its own parent.`,
    );
  }
}

function createHierarchy(data) {
  const indexedData = data.map(
    (item, index) => ({
      ...item,

      __parentId: getParentId(
        item,
        index,
      ),
    }),
  );

  const stratify = d3
    .stratify()
    .id((item) => String(item.id))
    .parentId((item) => {
      if (
        item.__parentId === null ||
        item.__parentId === undefined
      ) {
        return null;
      }

      return String(item.__parentId);
    });

  return stratify(indexedData);
}

function getNodeTitle(node) {
  const data = node.data;

  if (
    data.name !== undefined &&
    data.name !== null
  ) {
    return String(data.name);
  }

  return `Node ${data.id}`;
}

function getNodeMetadata(node) {
  const data = node.data;

  const left = data.lft;
  const right = getRight(data);
  const level = getLevel(data);

  const parts = [
    `ID: ${data.id}`,
  ];

  if (left !== undefined) {
    parts.push(`L: ${left}`);
  }

  if (right !== undefined) {
    parts.push(`R: ${right}`);
  }

  if (level !== undefined) {
    parts.push(`Level: ${level}`);
  }

  return parts.join("  ·  ");
}

function getTreeLayout(root) {
  return d3
    .tree()
    .nodeSize([
      SIBLING_GAP,
      LEVEL_GAP,
    ])(root);
}

function renderTree(data) {
  currentData = data;
  selectedNode = null;

  elements.viewport
    .selectAll("*")
    .remove();

  let root;

  try {
    root = createHierarchy(data);
  } catch (error) {
    throw new Error(
      `Could not build hierarchy: ${error.message}`,
    );
  }

  currentRoot = getTreeLayout(root);

  renderLinks();
  renderNodes();

  elements.emptyState.style.display =
    "none";

  updateStats(data);

  requestAnimationFrame(() => {
    fitTree();
  });
}

function renderLinks() {
  const links = currentRoot.links();

  const linkGenerator = d3
    .linkVertical()
    .x((point) => point.x)
    .y((point) => point.y);

  elements.viewport
    .selectAll(".tree-link")
    .data(
      links,
      (link) => String(link.target.data.id),
    )
    .join("path")
    .attr("class", "tree-link")
    .attr("d", linkGenerator);
}

function renderNodes() {
  const nodes = currentRoot.descendants();

  const groups = elements.viewport
    .selectAll(".tree-node")
    .data(
      nodes,
      (node) => String(node.data.id),
    )
    .join("g")
    .attr(
      "class",
      (node) =>
        node.depth === 0
          ? "tree-node root"
          : "tree-node",
    )
    .attr(
      "transform",
      (node) =>
        `translate(${node.x}, ${node.y})`,
    )
    .on("click", (event, node) => {
      event.stopPropagation();
      selectNode(node);
    });

  groups
    .append("rect")
    .attr("class", "node-card")
    .attr(
      "x",
      -NODE_WIDTH / 2,
    )
    .attr(
      "y",
      -NODE_HEIGHT / 2,
    )
    .attr("width", NODE_WIDTH)
    .attr("height", NODE_HEIGHT)
    .call(createNodeDrag());

  groups
    .append("text")
    .attr("class", "node-title")
    .attr("y", -7)
    .text((node) =>
      getNodeTitle(node),
    );

  groups
    .append("text")
    .attr("class", "node-meta")
    .attr("y", 17)
    .text((node) =>
      getNodeMetadata(node),
    );
}

function createNodeDrag() {
  return d3
    .drag()
    .on("start", function (
      event,
      node,
    ) {
      event.sourceEvent.stopPropagation();

      selectNode(node);

      d3.select(this.parentNode).raise();
    })
    .on("drag", function (
      event,
      node,
    ) {
      const [x, y] = d3.pointer(
        event.sourceEvent,
        elements.viewport.node(),
      );

      node.x = x;
      node.y = y;

      updateNodePosition(node);
      updateLinks();
    });
}

function selectNode(node) {
  selectedNode = node;

  elements.viewport
    .selectAll(".tree-node")
    .classed(
      "selected",
      (candidate) =>
        candidate === node,
    );
}

function clearSelection() {
  selectedNode = null;

  elements.viewport
    .selectAll(".tree-node")
    .classed(
      "selected",
      false,
    );
}

function updateNodePosition(node) {
  elements.viewport
    .selectAll(".tree-node")
    .filter(
      (candidate) =>
        candidate === node,
    )
    .attr(
      "transform",
      `translate(${node.x}, ${node.y})`,
    );
}

function updateLinks() {
  const linkGenerator = d3
    .linkVertical()
    .x((point) => point.x)
    .y((point) => point.y);

  elements.viewport
    .selectAll(".tree-link")
    .attr(
      "d",
      (link) =>
        linkGenerator(link),
    );
}

function resetLayout() {
  if (!currentData) {
    return;
  }

  renderTree(currentData);
}

function updateStats(data) {
  const rootCount = data.filter(
    (item, index) =>
      getParentId(item, index) ===
      null,
  ).length;

  const edgeCount =
    data.length - rootCount;

  elements.stats.textContent =
    `${data.length} node${data.length === 1 ? "" : "s"} · ` +
    `${edgeCount} edge${edgeCount === 1 ? "" : "s"} · ` +
    `${rootCount} root${rootCount === 1 ? "" : "s"}`;

  elements.stats.style.display =
    "block";
}

function fitTree() {
  if (!currentRoot) {
    return;
  }

  const container =
    elements.treeContainer;

  const width =
    container.clientWidth;

  const height =
    container.clientHeight;

  const bounds =
    elements.viewport
      .node()
      .getBBox();

  if (
    bounds.width === 0 ||
    bounds.height === 0
  ) {
    return;
  }

  const padding = 80;

  const availableWidth =
    Math.max(
      1,
      width - padding * 2,
    );

  const availableHeight =
    Math.max(
      1,
      height - padding * 2,
    );

  const scale = Math.min(
    availableWidth /
      bounds.width,

    availableHeight /
      bounds.height,

    1.3,
  );

  const translateX =
    width / 2 -
    scale *
      (
        bounds.x +
        bounds.width / 2
      );

  const translateY =
    height / 2 -
    scale *
      (
        bounds.y +
        bounds.height / 2
      );

  const transform =
    d3.zoomIdentity
      .translate(
        translateX,
        translateY,
      )
      .scale(scale);

  elements.svg
    .transition()
    .duration(350)
    .call(
      zoom.transform,
      transform,
    );
}

function buildTree() {
  try {
    hideError();

    const data = parseInput();

    renderTree(data);

    closeModal();
  } catch (error) {
    showError(
      error instanceof Error
        ? error.message
        : String(error),
    );
  }
}

function registerEventListeners() {
  elements.openModalBtn.addEventListener(
    "click",
    openModal,
  );

  elements.cancelBtn.addEventListener(
    "click",
    closeModal,
  );

  elements.buildBtn.addEventListener(
    "click",
    buildTree,
  );

  elements.fitBtn.addEventListener(
    "click",
    fitTree,
  );

  elements.layoutBtn.addEventListener(
    "click",
    resetLayout,
  );

  elements.modalBackdrop.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        elements.modalBackdrop
      ) {
        closeModal();
      }
    },
  );

  elements.svg.on(
    "click.clear-selection",
    (event) => {
      if (
        event.target.closest?.(
          ".tree-node",
        )
      ) {
        return;
      }

      clearSelection();
    },
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        elements.modalBackdrop.classList.contains(
          "open",
        )
      ) {
        closeModal();
      }

      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key === "Enter" &&
        elements.modalBackdrop.classList.contains(
          "open",
        )
      ) {
        buildTree();
      }
    },
  );

  window.addEventListener(
    "resize",
    () => {
      if (currentRoot) {
        fitTree();
      }
    },
  );
}

registerEventListeners();
openModal();