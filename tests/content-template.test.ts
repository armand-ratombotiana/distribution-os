import assert from "node:assert/strict";
import test from "node:test";

import {
  renderTemplate,
  extractVariables,
  validateTemplate,
} from "../lib/content-template-pure.ts";

test("renderTemplate returns the input unchanged when no placeholders exist", () => {
  assert.equal(renderTemplate("Hello world", {}), "Hello world");
});

test("renderTemplate interpolates a simple variable", () => {
  assert.equal(renderTemplate("Hi {{name}}!", { name: "Ada" }), "Hi Ada!");
});

test("renderTemplate renders unknown variables as empty string", () => {
  assert.equal(renderTemplate("Hi {{name}}!", {}), "Hi !");
});

test("renderTemplate supports a default value via the pipe syntax", () => {
  assert.equal(
    renderTemplate("Hi {{name|friend}}!", {}),
    "Hi friend!",
  );
});

test("renderTemplate prefers context value over default when both exist", () => {
  assert.equal(
    renderTemplate("Hi {{name|friend}}!", { name: "Ada" }),
    "Hi Ada!",
  );
});

test("renderTemplate resolves dotted paths", () => {
  const ctx = { user: { profile: { first: "Grace" } } };
  assert.equal(renderTemplate("{{user.profile.first}}", ctx), "Grace");
});

test("renderTemplate renders missing nested path as empty string", () => {
  const ctx = { user: { profile: {} } };
  assert.equal(renderTemplate("{{user.profile.first}}", ctx), "");
});

test("renderTemplate stringifies numbers, booleans, and objects", () => {
  assert.equal(
    renderTemplate("n={{n}} b={{b}} o={{o}}", { n: 42, b: true, o: { x: 1 } }),
    'n=42 b=true o={"x":1}',
  );
});

test("extractVariables collects distinct variable names and strips defaults", () => {
  const vars = extractVariables("Hi {{name|friend}}, {{name}} from {{city}}!");
  assert.deepEqual(vars.sort(), ["city", "name"]);
});

test("extractVariables returns an empty array for plain text", () => {
  assert.deepEqual(extractVariables("no placeholders here"), []);
});

test("validateTemplate flags malformed templates (unbalanced braces, empty, whitespace)", () => {
  assert.equal(validateTemplate("Hi {{name").ok, false);
  assert.equal(validateTemplate("Hi name}}").ok, false);
  assert.equal(validateTemplate("Hi {{}}!").ok, false);
  assert.equal(validateTemplate("{{user first name}}").ok, false);
});

test("validateTemplate reports ok and lists variables for a clean template", () => {
  const res = validateTemplate("Hi {{name}} from {{city}}!");
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.variables.sort(), ["city", "name"]);
});
