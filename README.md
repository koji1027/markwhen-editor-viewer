# Markwhen Editor and Viewer

A web-based editor and viewer for Markwhen timeline files, featuring Monaco Editor integration and real-time preview.

## Overview

This application provides a side-by-side editor and preview for Markwhen files. Markwhen is a text-to-timeline tool that allows you to create interactive timelines, Gantt charts, and calendars from markdown-like syntax.

![Markwhen Editor and Viewer Screenshot]

## Features

-   **Monaco Editor Integration** - Feature-rich code editor with:

    -   Syntax highlighting for Markwhen syntax
    -   Auto-completion suggestions
    -   Hover information for syntax guidance
    -   Custom theme optimized for Markwhen

-   **Real-time Preview** - See your timeline update as you type with minimal delay (300ms debounce)

-   **Multiple View Types** - Support for different visualization formats:

    -   Timeline view
    -   (Other Markwhen supported views)

-   **WebSocket Communication** - Real-time updates between the editor and preview using Socket.IO

-   **Example Content** - Sample timeline available to help you get started

## Installation

### Prerequisites

-   Node.js (v14 or newer)
-   [Markwhen CLI](https://github.com/mark-when/markwhen) installed globally

### Setup

1. Clone this repository:

    ```
    git clone https://github.com/yourusername/markwhen-editor-viewer.git
    cd markwhen-editor-viewer
    ```

2. Install dependencies:

    ```
    npm install
    ```

3. Install the Markwhen CLI globally:

    ```
    npm install -g @markwhen/mw
    ```

    Alternatively, use the setup script:

    ```
    npm run setup
    ```

## Usage

1. Start the server:

    ```
    npm start
    ```

    For development with auto-reload:

    ```
    npm run dev
    ```

2. Open your browser and navigate to `http://localhost:3000`

3. Begin typing in the editor or load the example timeline

## Markwhen Syntax

The editor includes syntax highlighting and auto-completion for Markwhen syntax. Here are some basic elements:

-   **Events**: `YYYY-MM-DD: Event title`
-   **Date ranges**: `YYYY-MM-DD -> YYYY-MM-DD: Event title`
-   **Tasks**: `- [ ] Uncompleted task` or `- [x] Completed task`
-   **Tags**: `#tagname`
-   **Locations**: `@location`
-   **Sections**: Use the `section` and `endSection` keywords

For more details on Markwhen syntax, see the [Markwhen documentation](https://markwhen.com/docs).

## Project Structure

```
markwhen-editor-viewer/
├── public/                # Static assets
│   ├── css/              # Stylesheets
│   ├── js/               # Client-side JavaScript
│   └── example.mw        # Example timeline file
├── server.js             # Express server and WebSocket handler
├── package.json          # Project metadata and dependencies
└── README.md             # Project documentation
```

## Technical Details

-   **Frontend**:

    -   Monaco Editor for text editing
    -   Custom syntax highlighting for Markwhen
    -   Responsive layout with flexbox

-   **Backend**:
    -   Express.js server
    -   Socket.IO for real-time communication
    -   Node.js child process to execute Markwhen CLI commands

## License

MIT

## Acknowledgments

-   [Markwhen](https://markwhen.com/) for the timeline syntax and rendering engine
-   [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the powerful code editing capabilities
-   [Socket.IO](https://socket.io/) for real-time communication
