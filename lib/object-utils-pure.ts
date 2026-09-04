/**
 * Pure object utility functions. All functions are side-effect free;
 * inputs are never mutated.
 */

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deeply clone a value. Plain objects and arrays are recursively cloned;
 * everything else (primitives, Date, RegExp, etc.) is returned as-is
 * (Date and RegExp would survive a structured-clone but we keep this
 * implementation dependency-free and JSON-safe).
 *
 *   deepClone({ a: [1, 2, { b: 3 }] })
 */
export function deepClone<T>(value: T): T {
  return deepCloneInternal(value) as T;
}

function deepCloneInternal(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => deepCloneInternal(v));
  }
  if (isPlainObject(value)) {
    const out: PlainObject = {};
    for (const key of Object.keys(value)) {
      out[key] = deepCloneInternal(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * Recursively merge `source` into `target` and return a new object.
 * Plain objects are merged recursively; arrays and primitives are
 * replaced (not concatenated).
 *
 *   deepMerge({ a: { x: 1 } }, { a: { y: 2 } })
 *   // { a: { x: 1, y: 2 } }
 */
export function deepMerge<T extends PlainObject>(
  target: T,
  ...sources: PlainObject[]
): T {
  const out: PlainObject = deepCloneInternal(target) as PlainObject;
  for (const source of sources) {
    if (!isPlainObject(source)) continue;
    for (const key of Object.keys(source)) {
      const srcVal = source[key];
      const dstVal = out[key];
      if (isPlainObject(srcVal) && isPlainObject(dstVal)) {
        out[key] = deepMerge(dstVal, srcVal);
      } else {
        out[key] = deepCloneInternal(srcVal);
      }
    }
  }
  return out as T;
}

/**
 * Return a new object containing only the specified `keys` from `obj`.
 * Missing keys are simply omitted (not set to `undefined`).
 */
export function pick<T extends PlainObject, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      out[key] = obj[key];
    }
  }
  return out;
}

/**
 * Return a new object with the specified `keys` omitted.
 */
export function omit<T extends PlainObject, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> {
  const exclude = new Set(keys as readonly (string | number | symbol)[]);
  const out: PlainObject = {};
  for (const key of Object.keys(obj)) {
    if (exclude.has(key)) continue;
    out[key] = obj[key];
  }
  return out as Omit<T, K>;
}

/**
 * Read a value at a dotted/bracket path inside an object. Returns
 * `undefined` for any missing segment.
 *
 *   getPath({ a: { b: [10, 20] } }, "a.b.1")        // 20
 *   getPath({ a: { b: [10, 20] } }, "a[b][0]")     // 10
 *   getPath({ a: { b: 1 } }, "a.c")                // undefined
 */
export function getPath<T = unknown>(obj: unknown, path: string): T | undefined {
  if (typeof path !== "string" || path.length === 0) return undefined;
  const segments = parsePath(path);
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[seg];
  }
  return current as T | undefined;
}

/**
 * Return `true` when a value exists at the given dotted path. Uses
 * `getPath` internally so missing segments return `false`.
 */
export function hasPath(obj: unknown, path: string): boolean {
  return getPath(obj, path) !== undefined;
}

/**
 * Return a new object with `value` set at the dotted `path`. Intermediate
 * objects are created as needed. Arrays are created when a numeric
 * segment is encountered.
 *
 * Does NOT mutate the input.
 */
export function setPath<T extends PlainObject>(
  obj: T,
  path: string,
  value: unknown,
): T {
  if (typeof path !== "string" || path.length === 0) return obj;
  const segments = parsePath(path);
  const root: unknown = deepCloneInternal(obj);
  let current: Record<string | number, unknown> = root as Record<
    string | number,
    unknown
  >;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (isLast) {
      current[seg] = value;
    } else {
      const nextSeg = segments[i + 1];
      const wantArray = typeof nextSeg === "number";
      const existing = current[seg];
      if (existing === null || existing === undefined || typeof existing !== "object") {
        current[seg] = wantArray ? [] : {};
      }
      current = current[seg] as Record<string | number, unknown>;
    }
  }
  return root as T;
}

/**
 * Flatten a nested object into a single-level object whose keys are the
 * dotted paths of the original nested values. Arrays are preserved as
 * values (not flattened) and indexed using their numeric keys.
 *
 *   flattenObject({ a: { b: 1, c: 2 }, d: 3 })
 *   // { "a.b": 1, "a.c": 2, "d": 3 }
 */
export function flattenObject(
  obj: unknown,
  prefix: string = "",
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isPlainObject(obj)) return out;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const newKey = prefix.length === 0 ? key : `${prefix}.${key}`;
    if (isPlainObject(value)) {
      Object.assign(out, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        out[`${newKey}.${i}`] = value[i];
      }
    } else {
      out[newKey] = value;
    }
  }
  return out;
}

/** Parse a dotted/bracket path into a list of accessors. */
function parsePath(path: string): Array<string | number> {
  const out: Array<string | number> = [];
  let i = 0;
  let buf = "";
  while (i < path.length) {
    const ch = path[i];
    if (ch === ".") {
      if (buf.length > 0) {
        out.push(buf);
        buf = "";
      }
      i++;
      continue;
    }
    if (ch === "[") {
      if (buf.length > 0) {
        out.push(buf);
        buf = "";
      }
      let j = i + 1;
      let inner = "";
      while (j < path.length && path[j] !== "]") {
        inner += path[j];
        j++;
      }
      const trimmed = inner.replace(/^["']|["']$/g, "");
      const asNum = Number(trimmed);
      out.push(Number.isInteger(asNum) && trimmed.match(/^\d+$/) ? asNum : trimmed);
      i = j + 1;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.length > 0) out.push(buf);
  return out;
}
