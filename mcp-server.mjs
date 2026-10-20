
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the same database as the existing LifeAdmin app.
const db = new Database(path.join(__dirname, "lifeadmin.db"));


const app = express();

// Allow the local LifeAdmin demo to communicate with the MCP server.
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, DELETE, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());


function createMcpServer() {
  const server = new McpServer({
    name: "lifeadmin",
    version: "1.0.0"
  });

  // Tool 1: List saved tasks.
  
  // Tool 1: List and filter saved tasks.
  server.registerTool(
    "list_tasks",
    {
      title: "List LifeAdmin Tasks",
      description:
        "List tasks and filter them by status: all, pending, completed, overdue, upcoming, or today.",
      inputSchema: {
        includeCompleted: z.boolean().default(true),
        status: z.enum([
          "all",
          "pending",
          "completed",
          "overdue",
          "upcoming",
          "today"
        ]).default("all")
      }
    },
    async ({ includeCompleted, status }) => {
      const tasks = db.prepare(`
        SELECT id, title, category, deadline, completed
        FROM tasks
        ORDER BY deadline ASC
      `).all();

      // Get today's date in local YYYY-MM-DD format.
      const now = new Date();
      const today =
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const filteredTasks = tasks.filter(task => {
        const isCompleted = task.completed === 1;

        if (status === "completed") return isCompleted;
        if (status === "pending") return !isCompleted;

        if (status === "overdue") {
          return !isCompleted && task.deadline < today;
        }

        if (status === "upcoming") {
          return !isCompleted && task.deadline > today;
        }

        if (status === "today") {
          return !isCompleted && task.deadline === today;
        }

        // "all" respects the existing includeCompleted option.
        return includeCompleted || !isCompleted;
      });

      return {
        content: [{
          type: "text",
          text: filteredTasks.length
            ? JSON.stringify(filteredTasks, null, 2)
            : "No tasks found for this filter."
        }]
      };
    }
  );


  // Tool 2: Add a task.
  server.registerTool(
    "add_task",
    {
      title: "Add LifeAdmin Task",
      description: "Save a new task with a title, category, and deadline.",
      inputSchema: {
        title: z.string().trim().min(1).max(120),
        category: z.enum([
          "Return",
          "Warranty",
          "Free trial",
          "Subscription",
          "Other"
        ]),
        deadline: z.string().regex(
          /^\d{4}-\d{2}-\d{2}$/,
          "Use YYYY-MM-DD format."
        )
      }
    },
    async ({ title, category, deadline }) => {
      // Check that the date is a real calendar date.
      const [year, month, day] = deadline.split("-").map(Number);
      const check = new Date(Date.UTC(year, month - 1, day));

      if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
      ) {
        return {
          content: [{
            type: "text",
            text: "Invalid calendar date. Please use a real date in YYYY-MM-DD format."
          }],
          isError: true
        };
      }

      const result = db.prepare(`
        INSERT INTO tasks (title, category, deadline, completed)
        VALUES (?, ?, ?, 0)
      `).run(title, category, deadline);

      return {
        content: [{
          type: "text",
          text: `Task added successfully. ID: ${result.lastInsertRowid}. Title: ${title}. Category: ${category}. Deadline: ${deadline}.`
        }]
      };
    }
  );

  return server;
}

// MCP endpoint using Streamable HTTP.
app.post("/mcp", async (req, res) => {
  const server = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: "MCP request failed." });
    }
  }
});

// MCP clients can use POST requests at /mcp.
app.get("/mcp", (req, res) => {
  res.status(405).send("Use the MCP Streamable HTTP protocol.");
});

const PORT = 3001;

app.listen(PORT, "127.0.0.1", () => {
  console.log(`LifeAdmin MCP server running at http://127.0.0.1:${PORT}/mcp`);
});
