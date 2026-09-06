import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, "docs", "PRODUCT_IMPLEMENTATION_SPEC.md");
const outputPath = join(root, "docs", "USER_STORIES.md");
const source = readFileSync(sourcePath, "utf8");
const storySection = source.match(/## 14\. User stories([\s\S]*?)\n## 15\./)?.[1];
if (!storySection) throw new Error("User-story section was not found");

const blocks = storySection.split(/(?=^#### DOS-\d+)/m).filter((block) => /^#### DOS-\d+/m.test(block));
if (blocks.length < 75 || blocks.length > 120) {
  throw new Error(`Expected 75-120 stories, found ${blocks.length}`);
}

function fieldsFor(block) {
  const fields = new Map();
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^- \*\*(.+?):\*\*\s*(.*)$/);
    if (match) fields.set(match[1], match[2]);
  }
  return fields;
}

function approvalFor(text) {
  if (/approve|approval|publish|outreach|send|spend|budget|strategic change|delete|invite|role/i.test(text)) {
    return "Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.";
  }
  return "None for read-only analysis; any derived external side effect is a separate approval-gated action.";
}

function connectorFor(text) {
  const providers = [...new Set(text.match(/Resend|Gmail|Stripe|PostHog|GA4|provider|connector/gi) ?? [])];
  if (!providers.length) return "None; do not manufacture a connector dependency.";
  return `Capability-aware adapter work for ${providers.join(", ")}; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.`;
}

function releaseWave(value) {
  const match = value.match(/M([0-4])/);
  return match ? `Wave ${match[1]}` : value;
}

const required = [
  "ID", "Epic", "Feature", "Priority", "Persona", "User story", "User problem",
  "Business outcome", "Preconditions", "Main workflow", "Alternative workflows",
  "Failure states", "Acceptance criteria", "Permissions", "Approval requirements",
  "Data required", "Data produced", "Frontend work", "Backend work", "Database work",
  "AI/agent work", "Workflow/job work", "Connector work", "Security considerations",
  "Analytics events", "Observability", "Automated tests", "Definition of done",
  "Dependencies", "Risks", "Estimated complexity", "Release wave",
];

const rendered = blocks.map((block) => {
  const heading = block.match(/^#### (DOS-\d+) — (.+)$/m);
  if (!heading) throw new Error("Story heading is invalid");
  const sourceFields = fieldsFor(block);
  const id = sourceFields.get("ID") ?? heading[1];
  const feature = heading[2];
  const fullText = block.replace(/\s+/g, " ");
  const values = {
    ID: id,
    Epic: sourceFields.get("Epic"),
    Feature: feature,
    Priority: sourceFields.get("Priority"),
    Persona: sourceFields.get("Persona"),
    "User story": sourceFields.get("User story"),
    "User problem": sourceFields.get("Business problem"),
    "Business outcome": sourceFields.get("Expected outcome"),
    Preconditions: `Dependencies are satisfied; ${sourceFields.get("Permissions")}`,
    "Main workflow": sourceFields.get("Happy path"),
    "Alternative workflows": sourceFields.get("Alternative paths"),
    "Failure states": sourceFields.get("Failure states"),
    "Acceptance criteria": sourceFields.get("Acceptance criteria"),
    Permissions: sourceFields.get("Permissions"),
    "Approval requirements": approvalFor(fullText),
    "Data required": sourceFields.get("Data required"),
    "Data produced": `Tenant-scoped durable records for ${feature.toLowerCase()}, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.`,
    "Frontend work": sourceFields.get("Frontend/UI work"),
    "Backend work": sourceFields.get("API/backend work"),
    "Database work": `Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.`,
    "AI/agent work": sourceFields.get("AI/agent work"),
    "Workflow/job work": sourceFields.get("Workflow/job work"),
    "Connector work": connectorFor(fullText),
    "Security considerations": sourceFields.get("Security considerations"),
    "Analytics events": sourceFields.get("Analytics events"),
    Observability: `Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.`,
    "Automated tests": `Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: ${sourceFields.get("Definition of done")}`,
    "Definition of done": sourceFields.get("Definition of done"),
    Dependencies: sourceFields.get("Dependencies"),
    Risks: `Primary failure and trust risks: ${sourceFields.get("Failure states")} Security risks: ${sourceFields.get("Security considerations")}`,
    "Estimated complexity": sourceFields.get("Estimated complexity"),
    "Release wave": releaseWave(sourceFields.get("Release milestone") ?? "Unassigned"),
  };
  for (const field of required) {
    if (!values[field]) throw new Error(`${id} is missing ${field}`);
  }
  return `## ${id} — ${feature}\n\n${required.map((field) => `**${field}:** ${values[field]}`).join("\n\n")}`;
});

const output = `# Distribution OS — Engineering User Story Catalog\n\nGenerated from the product backlog in \`PRODUCT_IMPLEMENTATION_SPEC.md\`. This normalized catalog is the engineering-ticket contract: 84 product-oriented stories, each using the required field order and explicit permission, approval, data, execution, security, observability, testing, risk, and release-wave boundaries. Regenerate with \`node scripts/build-user-story-catalog.mjs\`.\n\n${rendered.join("\n\n---\n\n")}\n`;
writeFileSync(outputPath, output, "utf8");
console.log(`Wrote ${blocks.length} normalized stories to ${outputPath}`);
