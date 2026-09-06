import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = readFileSync(new URL("../docs/USER_STORIES.md", import.meta.url), "utf8");
const required = [
  "ID", "Epic", "Feature", "Priority", "Persona", "User story", "User problem",
  "Business outcome", "Preconditions", "Main workflow", "Alternative workflows",
  "Failure states", "Acceptance criteria", "Permissions", "Approval requirements",
  "Data required", "Data produced", "Frontend work", "Backend work", "Database work",
  "AI/agent work", "Workflow/job work", "Connector work", "Security considerations",
  "Analytics events", "Observability", "Automated tests", "Definition of done",
  "Dependencies", "Risks", "Estimated complexity", "Release wave",
];

test("normalized product backlog contains 75-120 complete user stories", () => {
  const stories = catalog.split(/(?=^## DOS-\d+)/m).filter((item) => /^## DOS-\d+/m.test(item));
  assert.equal(stories.length, 84);
  for (const story of stories) {
    let cursor = -1;
    for (const field of required) {
      const next = story.indexOf(`**${field}:**`);
      assert.ok(next > cursor, `${story.slice(3, 10)} is missing or misorders ${field}`);
      cursor = next;
    }
    assert.match(story, /\*\*User story:\*\* As an? .+, I want .+, so that .+/i);
  }
});
