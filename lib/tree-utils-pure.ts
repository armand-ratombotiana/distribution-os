/**
 * Pure tree-structure utility helpers. The tree node contract is minimal:
 * any object with a `children` array of the same shape qualifies. The
 * `childrenKey` option (default `"children"`) lets you customize that.
 */

export interface TreeNode<T = unknown> {
  [key: string]: unknown;
  children?: T[];
}

export interface TreeOptions {
  childrenKey?: string;
}

function getChildren<T extends TreeNode>(node: T, key: string): T[] {
  const raw = node[key];
  return Array.isArray(raw) ? (raw as T[]) : [];
}

/**
 * Flattens a tree into a depth-first list of nodes.
 * Returns the nodes themselves (not copies).
 */
export function flattenTree<T extends TreeNode>(
  root: T,
  options: TreeOptions = {},
): T[] {
  const key = options.childrenKey ?? "children";
  const out: T[] = [];
  const stack: T[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    out.push(node);
    const children = getChildren(node, key);
    // Push children in reverse so leftmost child is processed first.
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push(children[i]);
    }
  }
  return out;
}

/**
 * Finds the first node for which `predicate` returns true. Depth-first.
 * Returns `undefined` if no node matches.
 */
export function findNode<T extends TreeNode>(
  root: T,
  predicate: (node: T) => boolean,
  options: TreeOptions = {},
): T | undefined {
  const key = options.childrenKey ?? "children";
  if (predicate(root)) return root;
  for (const child of getChildren(root, key)) {
    const found = findNode(child, predicate, options);
    if (found) return found;
  }
  return undefined;
}

/**
 * Returns a new tree where every node has been transformed by `mapper`.
 * `mapper` receives the original node and the mapped children (already mapped).
 */
export function mapTree<T extends TreeNode, R extends TreeNode>(
  root: T,
  mapper: (node: T, mappedChildren: R[]) => R,
  options: TreeOptions = {},
): R {
  const key = options.childrenKey ?? "children";
  const mappedChildren = getChildren(root, key).map((child) =>
    mapTree(child as T, mapper, options),
  );
  return mapper(root, mappedChildren);
}

/**
 * Returns a new tree containing only the nodes for which `predicate` is true.
 * A parent is kept if any of its descendants is kept. Returns `undefined`
 * when the root itself fails the predicate.
 */
export function filterTree<T extends TreeNode>(
  root: T,
  predicate: (node: T) => boolean,
  options: TreeOptions = {},
): T | undefined {
  const key = options.childrenKey ?? "children";
  const keptChildren = getChildren(root, key)
    .map((child) => filterTree(child as T, predicate, options))
    .filter((c): c is T => c !== undefined);
  if (predicate(root)) {
    return { ...root, [key]: keptChildren };
  }
  if (keptChildren.length > 0) {
    return { ...root, [key]: keptChildren };
  }
  return undefined;
}

/** Counts all nodes in the tree (including the root). */
export function countNodes<T extends TreeNode>(
  root: T,
  options: TreeOptions = {},
): number {
  const key = options.childrenKey ?? "children";
  let count = 1;
  for (const child of getChildren(root, key)) {
    count += countNodes(child as T, options);
  }
  return count;
}

/** Returns the maximum depth of the tree. A leaf has depth 1. */
export function getDepth<T extends TreeNode>(
  root: T,
  options: TreeOptions = {},
): number {
  const key = options.childrenKey ?? "children";
  const children = getChildren(root, key);
  if (children.length === 0) return 1;
  let max = 0;
  for (const child of children) {
    const d = getDepth(child as T, options);
    if (d > max) max = d;
  }
  return 1 + max;
}
