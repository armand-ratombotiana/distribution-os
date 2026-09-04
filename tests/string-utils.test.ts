import { test } from "node:test";
import assert from "node:assert/strict";

import {
  capitalize,
  camelCase,
  kebabCase,
  snakeCase,
  titleCase,
  truncate,
  pad,
  reverse,
} from "../lib/string-utils-pure";

test("capitalize uppercases the first char, lowercases the rest, and handles non-strings", () => {
  assert.equal(capitalize("hello"), "Hello");
  assert.equal(capitalize("HELLO"), "Hello");
  assert.equal(capitalize("hELLO wORLD"), "Hello world");
  assert.equal(capitalize(""), "");
  assert.equal(capitalize(null as unknown as string), "");
  assert.equal(capitalize(123 as unknown as string), "");
});

test("camelCase converts various inputs to camelCase", () => {
  assert.equal(camelCase("hello world"), "helloWorld");
  assert.equal(camelCase("foo-bar_baz"), "fooBarBaz");
  assert.equal(camelCase("HTTPServer"), "httpServer");
  assert.equal(camelCase("FooBarBaz"), "fooBarBaz");
  assert.equal(camelCase(""), "");
});

test("camelCase handles numbers and mixed separators", () => {
  assert.equal(camelCase("hello 2 the world"), "hello2TheWorld");
  assert.equal(camelCase("foo.bar/baz"), "fooBarBaz");
});

test("kebabCase converts to kebab-case", () => {
  assert.equal(kebabCase("hello world"), "hello-world");
  assert.equal(kebabCase("fooBar"), "foo-bar");
  assert.equal(kebabCase("foo_bar baz"), "foo-bar-baz");
  assert.equal(kebabCase(""), "");
});

test("kebabCase handles camelCase and PascalCase boundaries", () => {
  assert.equal(kebabCase("MyHTMLParser"), "my-html-parser");
  assert.equal(kebabCase("HTTPServer"), "http-server");
});

test("snakeCase converts to snake_case", () => {
  assert.equal(snakeCase("hello world"), "hello_world");
  assert.equal(snakeCase("fooBar"), "foo_bar");
  assert.equal(snakeCase("foo-bar.baz"), "foo_bar_baz");
});

test("titleCase capitalizes each word", () => {
  assert.equal(titleCase("hello world"), "Hello World");
  assert.equal(titleCase("foo-bar_baz"), "Foo Bar Baz");
  assert.equal(titleCase("HELLO WORLD"), "Hello World");
  assert.equal(titleCase(""), "");
});

test("truncate appends the suffix when text exceeds the limit", () => {
  assert.equal(truncate("hello world", 8), "hello w…");
  assert.equal(truncate("hello world", 8, "..."), "hello...");
  assert.equal(truncate("short", 10), "short");
  assert.equal(truncate("abc", 1), "…");
});

test("truncate handles edge cases", () => {
  assert.equal(truncate("abc", 0), "");
  assert.equal(truncate("", 5), "");
  assert.equal(truncate(123 as unknown as string, 5), "");
});

test("pad pads on the right by default", () => {
  assert.equal(pad("abc", 6), "abc   ");
  assert.equal(pad("abc", 6, "0"), "abc000");
});

test("pad supports left and center alignment", () => {
  assert.equal(pad("abc", 6, "0", "right"), "000abc");
  assert.equal(pad("abc", 7, "-", "center"), "--abc--");
  assert.equal(pad("abc", 8, "-", "center"), "--abc---");
});

test("pad returns the value unchanged when already long enough", () => {
  assert.equal(pad("abcdef", 3), "abcdef");
  assert.equal(pad("abcdef", 6), "abcdef");
});

test("pad throws when char is not a single character", () => {
  assert.throws(() => pad("abc", 6, ""));
  assert.throws(() => pad("abc", 6, "ab"));
});

test("reverse returns the code-point-wise reversal of the input (and tolerates non-strings)", () => {
  assert.equal(reverse("hello"), "olleh");
  assert.equal(reverse("abc"), "cba");
  assert.equal(reverse(""), "");
  assert.equal(reverse("ab😊cd"), "dc😊ba");
  assert.equal(reverse(null as unknown as string), "");
  assert.equal(reverse(123 as unknown as string), "");
});
