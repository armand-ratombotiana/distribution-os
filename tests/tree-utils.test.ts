import { test } from "node:test";
import assert from "node:assert/strict";

import {
  flattenTree,
  findNode,
  mapTree,
  filterTree,
  countNodes,
  getDepth,
  type TreeNode,
} from "../lib/tree-utils-pure.ts";

interface N extends TreeNode<N> {
  id: string;
  children?: N[];
}

const tree: N = {
  id: "root",
  children: [
    {
      id: "a",
      children: [
        { id: "a1" },
        { id: "a2", children: [{ id: "a2x" }] },
      ],
    },
    { id: "b" },
  ],
};

test("flattenTree walks depth-first, root first", () => {
  assert.deepEqual(
    flattenTree(tree).map((n) => n.id),
    ["root", "a", "a1", "a2", "a2x", "b"],
  );
});

test("flattenTree handles a single-node tree", () => {
  assert.deepEqual(flattenTree({ id: "solo" }).map((n) => n.id), ["solo"]);
});

test("findNode returns the first node matching the predicate", () => {
  const found = findNode(tree, (n) => n.id === "a2");
  assert.equal(found?.id, "a2");
});

test("findNode returns undefined when nothing matches", () => {
  assert.equal(findNode(tree, (n) => n.id === "missing"), undefined);
});

test("mapTree transforms each node and re-attaches mapped children", () => {
  const mapped = mapTree(tree, (node, children) => ({
    id: node.id.toUpperCase(),
    children,
  }));
  assert.equal(mapped.id, "ROOT");
  assert.deepEqual(
    flattenTree(mapped).map((n) => n.id),
    ["ROOT", "A", "A1", "A2", "A2X", "B"],
  );
});

test("filterTree keeps a subtree when a descendant matches", () => {
  const filtered = filterTree(tree, (n) => n.id === "a2x");
  assert.ok(filtered);
  assert.deepEqual(
    flattenTree(filtered).map((n) => n.id),
    ["root", "a", "a2", "a2x"],
  );
});

test("filterTree returns undefined when no node matches", () => {
  assert.equal(filterTree(tree, (n) => n.id === "missing"), undefined);
});

test("countNodes returns the total node count including root", () => {
  assert.equal(countNodes(tree), 6);
  assert.equal(countNodes({ id: "solo" }), 1);
});

test("getDepth returns 1 for a leaf and the max depth for a tree", () => {
  assert.equal(getDepth({ id: "leaf" }), 1);
  // root → a → a2 → a2x is 4 levels deep.
  assert.equal(getDepth(tree), 4);
});

test("tree utilities respect a custom childrenKey option", () => {
  type CN = { id: string; items?: CN[] };
  const custom: CN = {
    id: "r",
    items: [{ id: "c1", items: [{ id: "g1" }] }, { id: "c2" }],
  };
  // The runtime doesn't care that the children key is named `items` instead
  // of `children`; we just need to satisfy the TreeNode contract structurally.
  const node = custom as unknown as TreeNode;
  assert.deepEqual(
    flattenTree(node, { childrenKey: "items" }).map((n) => (n as CN).id),
    ["r", "c1", "g1", "c2"],
  );
  assert.equal(countNodes(node, { childrenKey: "items" }), 4);
  assert.equal(getDepth(node, { childrenKey: "items" }), 3);
});
