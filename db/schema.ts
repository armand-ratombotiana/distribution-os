import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull().unique(),
    ownerEmail: text("owner_email").notNull(),
    displayName: text("display_name").notNull(),
    plan: text("plan").notNull().default("founder"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  }
);

export const workspaceConnections = sqliteTable(
  "workspace_connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("setup_required"),
    scopesJson: text("scopes_json").notNull().default("[]"),
    lastSyncAt: integer("last_sync_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("workspace_connections_workspace_updated_idx").on(
      table.workspaceId,
      table.updatedAt
    ),
  ]
);

export const missions = sqliteTable(
  "missions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    websiteUrl: text("website_url").notNull(),
    productName: text("product_name").notNull(),
    mode: text("mode").notNull(),
    status: text("status").notNull().default("learning"),
    currentStage: text("current_stage").notNull().default("observe"),
    cycleNumber: integer("cycle_number").notNull().default(1),
    paymentCount: integer("payment_count").notNull().default(0),
    approved: integer("approved", { mode: "boolean" }).notNull().default(false),
    missionJson: text("mission_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("missions_workspace_updated_idx").on(
      table.workspaceId,
      table.updatedAt
    ),
  ]
);

export const missionEvents = sqliteTable(
  "mission_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    actor: text("actor").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("mission_events_mission_created_idx").on(
      table.missionId,
      table.createdAt
    ),
  ]
);
