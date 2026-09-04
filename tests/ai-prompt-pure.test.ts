import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrompt,
  validatePrompt,
  extractVariables,
  type PromptTemplate,
} from "../lib/ai-prompt-pure.ts";

const tpl: PromptTemplate = {
  id: "mission-brief",
  role: "system",
  template: "You are a {{role}}. Write a {{tone}} brief about {{topic}}.",
  variables: ["role", "tone", "topic"],
};

test("extractVariables returns placeholders in first-occurrence order, deduped", () => {
  assert.deepEqual(
    extractVariables("Hello {{name}}, {{name}} is {{adjective}} and {{topic}}."),
    ["name", "adjective", "topic"],
  );
});

test("extractVariables returns an empty array for placeholder-free, empty, or invalid input", () => {
  assert.deepEqual(extractVariables("no placeholders here"), []);
  assert.deepEqual(extractVariables(""), []);
  assert.deepEqual(extractVariables(null as unknown as string), []);
  // malformed placeholders (leading digit, no closing braces, empty name) are ignored
  assert.deepEqual(extractVariables("{{1invalid}} {{{{ }}} {{}}"), []);
});

test("extractVariables tolerates whitespace inside braces", () => {
  assert.deepEqual(extractVariables("{{  name  }} {{ age }}"), ["name", "age"]);
});

test("buildPrompt substitutes declared variables", () => {
  const out = buildPrompt(tpl, { role: "strategist", tone: "formal", topic: "ICP" });
  assert.equal(out, "You are a strategist. Write a formal brief about ICP.");
});

test("buildPrompt replaces missing and null/undefined variables with the empty string", () => {
  const out = buildPrompt(tpl, { role: "strategist" });
  assert.equal(out, "You are a strategist. Write a  brief about .");
  const out2 = buildPrompt("a={{a}} b={{b}}", { a: null, b: undefined });
  assert.equal(out2, "a= b=");
});

test("buildPrompt stringifies numbers, booleans, and objects", () => {
  const out = buildPrompt("{{n}} {{b}} {{o}}", { n: 42, b: true, o: { a: 1 } });
  assert.equal(out, "42 true {\"a\":1}");
});

test("buildPrompt accepts a raw string template and tolerates non-object vars", () => {
  assert.equal(buildPrompt("hi {{x}}", { x: "world" }), "hi world");
  assert.equal(buildPrompt("hi", {}), "hi");
  assert.equal(buildPrompt("", {}), "");
  assert.equal(buildPrompt("hi {{x}}", null as unknown as Record<string, unknown>), "hi ");
});

test("validatePrompt accepts a well-formed template", () => {
  const res = validatePrompt(tpl);
  assert.equal(res.valid, true);
  assert.deepEqual(res.errors, []);
});

test("validatePrompt flags declared variables missing from the template", () => {
  const res = validatePrompt({
    id: "x",
    template: "no placeholders",
    variables: ["missing"],
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('"missing" is missing')));
});

test("validatePrompt flags template placeholders not declared", () => {
  const res = validatePrompt({
    id: "x",
    template: "{{undeclared}}",
    variables: [],
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('"undeclared" is not declared')));
});

test("validatePrompt rejects non-object input and flags structural errors", () => {
  const nonObject = validatePrompt(null as unknown as PromptTemplate);
  assert.equal(nonObject.valid, false);
  assert.ok(nonObject.errors.some((e) => e.includes("template must be an object")));

  const res = validatePrompt({
    id: "",
    template: "   ",
    role: "robot" as never,
    variables: [],
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("id must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("template must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("invalid role")));
});

test("validatePrompt flags maxLength violations and negative maxLength", () => {
  const tooLong = validatePrompt({
    id: "x",
    template: "abcdef",
    variables: [],
    maxLength: 3,
  });
  assert.equal(tooLong.valid, false);
  assert.ok(tooLong.errors.some((e) => e.includes("exceeds maxLength 3")));

  const negative = validatePrompt({
    id: "x",
    template: "abc",
    variables: [],
    maxLength: -1,
  });
  assert.equal(negative.valid, false);
  assert.ok(negative.errors.some((e) => e.includes("maxLength must be non-negative")));
});
