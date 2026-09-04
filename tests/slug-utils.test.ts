import { test } from "node:test";
import assert from "node:assert/strict";

import {
  slugify,
  deslugify,
  ensureUniqueSlug,
  validateSlugFormat,
} from "../lib/slug-utils-pure.ts";

test("slugify converts spaces and punctuation to dashes", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
  assert.equal(slugify("The Quick Brown Fox"), "the-quick-brown-fox");
});

test("slugify strips accents via NFD decomposition", () => {
  assert.equal(slugify("Café résumé — naïve"), "cafe-resume-naive");
  assert.equal(slugify("Ångström"), "angstrom");
});

test("slugify collapses multiple separators and trims them", () => {
  assert.equal(slugify("   ---weird   spacing---   "), "weird-spacing");
  assert.equal(slugify("a///b===c"), "a-b-c");
});

test("slugify respects a maxLength option without trailing dash", () => {
  assert.equal(slugify("abcdefghij", { maxLength: 5 }), "abcde");
  assert.equal(slugify("a-b-c-d", { maxLength: 3 }), "a-b");
});

test("slugify returns empty string for input with no slug characters", () => {
  assert.equal(slugify("!!!!???"), "");
  assert.equal(slugify("   "), "");
});

test("slugify throws on non-string input", () => {
  // @ts-expect-error runtime guard
  assert.throws(() => slugify(42), /expects a string/);
});

test("deslugify turns dashes into spaces and capitalizes the first letter", () => {
  assert.equal(deslugify("hello-world"), "Hello world");
  assert.equal(deslugify("the-quick-brown-fox"), "The quick brown fox");
});

test("deslugify handles underscores and camelCase separators", () => {
  assert.equal(deslugify("hello_world"), "Hello world");
  assert.equal(deslugify("camelCaseWord"), "Camel Case Word");
});

test("ensureUniqueSlug returns the input when it is not already taken", () => {
  assert.equal(ensureUniqueSlug("foo", ["bar", "baz"]), "foo");
  assert.equal(ensureUniqueSlug("foo", new Set(["bar"])), "foo");
});

test("ensureUniqueSlug appends -2, -3, ... until unique", () => {
  assert.equal(ensureUniqueSlug("foo", ["foo"]), "foo-2");
  assert.equal(
    ensureUniqueSlug("foo", ["foo", "foo-2", "foo-3"]),
    "foo-4",
  );
  assert.equal(
    ensureUniqueSlug("foo", new Set(["foo", "foo-2"])),
    "foo-3",
  );
});

test("validateSlugFormat accepts strict kebab-case and rejects others", () => {
  for (const ok of ["foo", "foo-bar", "foo-bar-baz123", "abc-123"]) {
    assert.equal(validateSlugFormat(ok), true, `expected valid: ${ok}`);
  }
  for (const bad of ["Foo", "-foo", "foo-", "foo--bar", "foo_bar", "", "foo bar"]) {
    assert.equal(validateSlugFormat(bad), false, `expected invalid: ${bad}`);
  }
});
