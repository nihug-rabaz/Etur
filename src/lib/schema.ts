import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "";
const client = connectionString
  ? postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  : (null as unknown as ReturnType<typeof postgres>);
export const db = connectionString
  ? drizzle(client)
  : (null as unknown as ReturnType<typeof drizzle>);

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  password: text("password").notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  role: text("role").notNull().default("חפ״ש"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    {
      compoundKey: primaryKey({
        columns: [account.provider, account.providerAccountId],
      }),
    },
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    {
      compositePk: primaryKey({
        columns: [verificationToken.identifier, verificationToken.token],
      }),
    },
  ],
);

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [
    {
      compositePK: primaryKey({
        columns: [authenticator.userId, authenticator.credentialID],
      }),
    },
  ],
);

// Parent tasks (new level above existing tasks)
export const parentTasks = pgTable("parentTask", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  section: text("section").notNull(), // "מיצוב" | "איתור"
  domain: text("domain").notNull(),
  title: text("title").notNull(),
  // Per your latest choice: single topic on the parent (not multi-select)
  topic: text("topic").notNull(),
  priority: text("priority").notNull().default("medium"),
  createdByUserId: text("createdByUserId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const tasks = pgTable("task", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  // New hierarchy fields (nullable for backward compatibility)
  parentTaskId: text("parentTaskId").references(() => parentTasks.id, {
    onDelete: "set null",
  }),
  // Task classification: regular child-task vs general task
  isGeneral: boolean("isGeneral").notNull().default(false),
  // Section (מיצוב / איתור). Nullable for existing rows.
  section: text("section"),
  domain: text("domain").notNull(),
  topic: text("topic").notNull(),
  leaderId: text("leaderId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dueDate: timestamp("dueDate", { mode: "date" }),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

// User -> topics mapping (what a soldier/team-lead can see)
export const userTopics = pgTable(
  "userTopic",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    section: text("section").notNull(),
    topic: text("topic").notNull(),
  },
  (userTopic) => [
    {
      compositePK: primaryKey({
        columns: [userTopic.userId, userTopic.section, userTopic.topic],
      }),
    },
  ],
);

export const discussionMessages = pgTable("discussionMessage", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  entityType: text("entityType").notNull(), // "task" | "parentTask"
  entityId: text("entityId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const discussionReadStates = pgTable(
  "discussionReadState",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entityType").notNull(),
    entityId: text("entityId").notNull(),
    lastReadAt: timestamp("lastReadAt", { mode: "date" }).notNull().defaultNow(),
  },
  (state) => [
    {
      compositePK: primaryKey({
        columns: [state.userId, state.entityType, state.entityId],
      }),
    },
  ],
);

export const taskUsers = pgTable(
  "taskUser",
  {
    taskId: text("taskId")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("collaborator"),
  },
  (taskUser) => [
    {
      compositePK: primaryKey({
        columns: [taskUser.taskId, taskUser.userId],
      }),
    },
  ],
);

export const domains = pgTable("domain", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const userPinnedTasks = pgTable(
  "userPinnedTask",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: text("taskId")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (userPinnedTask) => [
    {
      compositePK: primaryKey({
        columns: [userPinnedTask.userId, userPinnedTask.taskId],
      }),
    },
  ],
);
