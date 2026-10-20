
const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = 3000;

// Open or create the database file.
const db = new Database
(
  path.join(__dirname, "lifeadmin.db")
);

// Create the tasks table if it doesn't exist.
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    deadline TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Convert SQLite rows into the format used by the webpage.
function formatTask(row) {
  return {
    ...row,
    completed: Boolean(row.completed)
  };
}

// Get all tasks.
app.get("/api/tasks", (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM tasks
    ORDER BY deadline ASC, id ASC
  `).all();

  res.json(rows.map(formatTask));
});

// Create a task.

app.post("/api/tasks", (req, res) => {
  const { title, category, deadline } = req.body;

  // 1. Check the task title
  if (
    typeof title !== "string" ||
    title.trim().length === 0
  ) {
    return res.status(400).json({
      error: "Task title is required."
    });
  }

  if (title.trim().length > 120) {
    return res.status(400).json({
      error: "Task title must be 120 characters or less."
    });
  }

  // 2. Check the category
  const allowedCategories = [
    "Return",
    "Warranty",
    "Free trial",
    "Subscription",
    "Other"
  ];

  if (!allowedCategories.includes(category)) {
    return res.status(400).json({
      error: "Please choose a valid category."
    });
  }

  // 3. Check the deadline format and actual date
  if (
    typeof deadline !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(deadline)
  ) {
    return res.status(400).json({
      error: "Deadline must be a valid date."
    });
  }

  const [year, month, day] = deadline.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return res.status(400).json({
      error: "Please enter a real calendar date."
    });
  }

  // 4. Save the validated task in SQLite
  const result = db.prepare(`
    INSERT INTO tasks (title, category, deadline, completed)
    VALUES (?, ?, ?, 0)
  `).run(title.trim(), category, deadline);

  const task = db.prepare(`
    SELECT id, title, category, deadline, completed
    FROM tasks
    WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(task);
});


// Toggle a task's completion status.
app.patch("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: "Invalid task ID."
    });
  }

  const task = db.prepare(`
    SELECT * FROM tasks WHERE id = ?
  `).get(id);

  if (!task) {
    return res.status(404).json({
      error: "Task not found."
    });
  }

  db.prepare(`
    UPDATE tasks
    SET completed = ?
    WHERE id = ?
  `).run(task.completed ? 0 : 1, id);

  const updatedTask = db.prepare(`
    SELECT * FROM tasks WHERE id = ?
  `).get(id);

  res.json(formatTask(updatedTask));
});


app.post("/api/assistant", (req, res) => {
  const message = String(req.body.message || "")
    .trim()
    .toLowerCase();


  // Detect requests to create a task.
  const wantsToAddTask =
    /\b(add|create|remind me|remember to)\b/i.test(message);

  if (wantsToAddTask) {
    const rawMessage = String(req.body.message || "").trim();

    // Accept dates like October 20, Oct 20, or 2026-10-20.
    
    // Recognize relative dates such as "tomorrow" and "in 3 days".
    const relativeDatePattern =
      /\b(tomorrow|today|next week|in\s+\d+\s+days?|in\s+(?:one|two|three|four|five|six|seven)\s+days?)\b/i;

    // Recognize dates such as "October 20" or "2026-10-20".
    const datePattern =
      /\b(\d{4}-\d{2}-\d{2}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?)\b/i;

    const dateMatch =
      rawMessage.match(relativeDatePattern) ||
      rawMessage.match(datePattern);

    let deadline;

    if (dateMatch) {
      const dateText = dateMatch[0].toLowerCase();

      // Start from today's local date.
      const targetDate = new Date();
      targetDate.setHours(12, 0, 0, 0);

      const relativeDays = {
        today: 0,
        tomorrow: 1,
        "next week": 7,
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7
      };

      if (dateText === "today" ||
          dateText === "tomorrow" ||
          dateText === "next week") {
        targetDate.setDate(
          targetDate.getDate() + relativeDays[dateText]
        );

        deadline =
          `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

      } else if (/^in\s+/.test(dateText)) {
        const amountMatch = dateText.match(
          /^in\s+(\d+|one|two|three|four|five|six|seven)\s+days?$/
        );

        if (amountMatch) {
          const amount = /^\d+$/.test(amountMatch[1])
            ? Number(amountMatch[1])
            : relativeDays[amountMatch[1]];

          if (amount >= 0 && amount <= 365) {
            targetDate.setDate(targetDate.getDate() + amount);

            deadline =
              `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
          }
        }

      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
        deadline = dateText;

      } else {
        const parsed = new Date(dateText);

        if (!Number.isNaN(parsed.getTime())) {
          const hasYear = /\d{4}/.test(dateText);
          const year = hasYear
            ? parsed.getFullYear()
            : new Date().getFullYear();

          const month = parsed.getMonth();
          const day = parsed.getDate();

          const candidate = new Date(Date.UTC(year, month, day));

          if (
            candidate.getUTCFullYear() === year &&
            candidate.getUTCMonth() === month &&
            candidate.getUTCDate() === day
          ) {
            deadline =
              `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          }
        }
      }
    }


    if (!deadline) {
      return res.json({
        reply: "I couldn't understand that date. Please try October 20 or 2026-10-20."
      });
    }

    // Remove the date and common command phrases to get the title.
    let title = rawMessage
      .replace(dateMatch[0], "")
      .replace(/\b(remind me to|remember to|add a task to|add|create a reminder to|create a task to|create|please)\b/gi, "")
      .replace(/\b(on|by|for)\s*$/i, "")
      .replace(/[.!?,]+/g, "")
      .trim();

    if (!title) {
      return res.json({
        reply: "What should I remind you to do? Include a task and deadline."
      });
    }

    if (title.length > 120) {
      return res.json({
        reply: "Please shorten the task description to 120 characters or fewer."
      });
    }

    // Infer a category from the request.
    const lowerTitle = title.toLowerCase();
    let category = "Other";

    if (/\b(return|send back)\b/.test(lowerTitle)) {
      category = "Return";
    } else if (/\bwarranty\b/.test(lowerTitle)) {
      category = "Warranty";
    } else if (/\b(free trial|trial)\b/.test(lowerTitle)) {
      category = "Free trial";
    } else if (/\b(subscription|renewal|renew)\b/.test(lowerTitle)) {
      category = "Subscription";
    }

    // Validate that the deadline is a real calendar date.
    const [year, month, day] = deadline.split("-").map(Number);
    const dateCheck = new Date(Date.UTC(year, month - 1, day));

    if (
      dateCheck.getUTCFullYear() !== year ||
      dateCheck.getUTCMonth() !== month - 1 ||
      dateCheck.getUTCDate() !== day
    ) {
      return res.json({
        reply: "That isn't a valid calendar date. Please try again."
      });
    }

    // Save to the existing SQLite database.
    const result = db.prepare(`
      INSERT INTO tasks (title, category, deadline, completed)
      VALUES (?, ?, ?, 0)
    `).run(title, category, deadline);

    return res.status(201).json({
      reply: `Task added: "${title}" — ${category}, due ${deadline}.`,
      taskId: result.lastInsertRowid
    });
  }


  if (!message) {
    return res.status(400).json({
      reply: "Please enter a question."
    });
  }

  const tasks = db.prepare(`
    SELECT id, title, category, deadline, completed
    FROM tasks
  `).all();

  // Use the server's local calendar date.
  const now = new Date();
  const today =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const incomplete = tasks.filter(task => !task.completed);

  const overdue = incomplete.filter(
    task => task.deadline < today
  );

  const dueToday = incomplete.filter(
    task => task.deadline === today
  );

  const upcoming = incomplete.filter(
    task => task.deadline > today
  );

  const completed = tasks.filter(
    task => Boolean(task.completed)
  );

  let reply;

  if (message.includes("overdue")) {
    reply = overdue.length
      ? "Overdue tasks:\n" +
        overdue.map(task =>
          `• ${task.title} — due ${task.deadline}`
        ).join("\n")
      : "You have no overdue tasks.";
  } else if (
    message.includes("upcoming") ||
    message.includes("future deadline")
  ) {
    reply = upcoming.length
      ? "Upcoming tasks:\n" +
        upcoming.map(task =>
          `• ${task.title} — due ${task.deadline}`
        ).join("\n")
      : "You have no upcoming tasks.";
  } else if (
    message.includes("due today") ||
    message.includes("today's tasks")
  ) {
    reply = dueToday.length
      ? "Due today:\n" +
        dueToday.map(task =>
          `• ${task.title}`
        ).join("\n")
      : "You have no tasks due today.";
  } else if (
    message.includes("completed") ||
    message.includes("finished")
  ) {
    reply = `You have completed ${completed.length} task(s).`;
  } else if (
  message.includes("all tasks") ||
  message.includes("show my tasks") ||
  message.includes("list my tasks") ||
  message.includes("show all tasks") ||
  message.includes("how many tasks")
) {
    reply =
      `Total: ${tasks.length}\n` +
      `Incomplete: ${incomplete.length}\n` +
      `Completed: ${completed.length}`;
  } else {
    reply =
      "Try asking: 'Show my overdue tasks', " +
      "'Show upcoming deadlines', 'What's due today?', " +
      "or 'How many tasks have I completed?'";
  }

  res.json({ reply });
});

app.delete("/api/tasks/:id", (req, res) => {
  try {
    const taskId = Number(req.params.id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ error: "Invalid task ID." });
    }

    const result = db
      .prepare("DELETE FROM tasks WHERE id = ?")
      .run(taskId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Task not found." });
    }

    res.json({ message: "Task deleted successfully." });
  } catch (error) {
    console.error("Failed to delete task:", error);
    res.status(500).json({ error: "Failed to delete task." });
  }
});

app.listen(PORT, () => {
  console.log(`LifeAdmin is running at http://localhost:${PORT}`);
});
