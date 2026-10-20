# LifeAdmin — Your Personal Deadline Guardian

LifeAdmin is a personal deadline management application that helps users keep track of important dates for product returns, warranties, free trials, subscription renewals, and other time-sensitive tasks.

Instead of relying on memory or scattered reminders, LifeAdmin provides a centralized dashboard and a conversational assistant to help users understand and manage their upcoming deadlines.

## Features

- **Task management:** Create tasks with a title, category, and deadline.
- **Persistent storage:** Store tasks in a local SQLite database so they remain available after the server restarts.
- **Deadline dashboard:** View task summaries, including overdue tasks, tasks due today, upcoming tasks, and completed tasks.
- **Task editing:** Update task details, including the title, category, and deadline.
- **Task completion:** Mark tasks as complete or reopen them.
- **Task deletion:** Remove tasks when they are no longer needed.
- **Conversational assistant:** Ask questions about overdue, upcoming, due-today, and completed tasks.
- **Model Context Protocol (MCP):** A self-hosted MCP server exposes tools for interacting with task data, enabling compatible AI clients to access LifeAdmin functionality.

## Technology Stack

- **Backend:** Node.js and Express
- **Database:** SQLite using `better-sqlite3`
- **Frontend:** HTML, CSS, and JavaScript
- **AI integration interface:** Model Context Protocol (MCP)
- **MCP server:** Node.js with the `@modelcontextprotocol/sdk`
- **Input validation:** Zod

## Project Structure

```text
LifeAdmin/
├── public/
│   ├── index.html
│   └── mcp-demo.html
├── server.js
├── mcp-server.mjs
├── package.json
├── package-lock.json
├── .gitignore
├── LICENSE
└── README.md
```

## Prerequisites

Install the following before running the project:

- Node.js and npm
- Git (optional, for cloning the repository)

## Installation

Clone the repository:

```bash
git clone https://github.com/parisha-g-07/LifeAdmin.git
cd LifeAdmin
```

Install dependencies:

```bash
npm install
```

## Running LifeAdmin

LifeAdmin uses two local Node.js processes: the main application server and the MCP server.

### 1. Start the main application

In the first terminal, run:

```bash
node server.js
```

Open the local application in your browser:

http://localhost:3000

### 2. Start the MCP server

Open a second terminal in the same project directory and run:

```bash
node mcp-server.mjs
```

The MCP endpoint is available at:

http://127.0.0.1:3001/mcp

### 3. Open the MCP demonstration page

With the main application server running, open:

http://localhost:3000/mcp-demo.html

Use this page to test the MCP integration tools provided by the project.

## MCP Tools

The MCP server provides task-related tools, including:

- `list_tasks` — retrieve tasks by status, including pending, completed, overdue, upcoming, and due today.
- `add_task` — create a task with a title, category, and deadline.

Both the main application and MCP server access the same local SQLite database, allowing task changes to be shared between the two interfaces.

The MCP server is intended for use with compatible MCP clients. A working local endpoint does not, by itself, mean that LifeAdmin is already connected to Alexa+.

## Current Scope and Limitations

- The project is a locally runnable prototype; public hosting is not required to run it.
- The conversational assistant currently uses rule-based logic rather than a hosted large language model.
- The MCP server must be connected to a compatible MCP client to provide an external AI interaction experience.
- The SQLite database is created and maintained locally; the database file is not included in the repository.

## Future Improvements

- Integrate with compatible voice assistants and AI clients.
- Add configurable reminders and notifications.
- Support recurring deadlines and subscription renewals.
- Improve conversational understanding and task recommendations.

## License

This project is released under the MIT License. See the `LICENSE` file for details.
