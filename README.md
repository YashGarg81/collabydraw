# 🎨 Collabydraw | Hand-drawn look & feel • Collaborative • Secure

[![CI](https://github.com/YashGarg81/collabydraw/actions/workflows/ci.yml/badge.svg)](https://github.com/YashGarg81/collabydraw/actions/workflows/ci.yml)
[![Frontend CD](https://github.com/YashGarg81/collabydraw/actions/workflows/cd_frontend.yml/badge.svg)](https://github.com/YashGarg81/collabydraw/actions/workflows/cd_frontend.yml)
[![WebSocket CD](https://github.com/YashGarg81/collabydraw/actions/workflows/cd_ws.yml/badge.svg)](https://github.com/YashGarg81/collabydraw/actions/workflows/cd_ws.yml)

---

**CollabyDraw** is a web-based collaborative whiteboard where multiple users can draw, edit, and brainstorm together in real time. Whether solo or in a group session, the app offers a smooth, intuitive canvas experience with real-time sync, shape tools, editable text, and privacy-focused end-to-end encryption — all without needing an account.

---

### ✅ Core Features

- **Canvas Drawing**: Freehand, shapes, and editable text
- **Rough.js Support**: Optional sketch-style drawing
- **Perfect-freehand Support**: Hand drawn feel
- **Eraser Tool**: Remove individual shapes
- **Editable Text**: Double-click to edit on canvas

---

### 🔗 Collaboration

- **Real-time Sync**: WebSocket-powered live drawing
- **Multi-Tab Awareness**: No duplicate join/leave events
- **Optimistic Updates**: Instant feedback before server response

---

### 🔐 **Privacy & End-to-End Encryption (E2EE)** in CollabyDraw

CollabyDraw is built with **privacy by design** to ensure that no sensitive drawing data can be accessed by anyone other than the intended participants.

### 🔑 **How It Works**

- When a user creates or joins a room, the app generates a link like:
    
    ```
    https://collabydraw.xyz#room=abc123,xyz456
    ```
    
    - `abc123`: Unique room ID (used by the server)
    - `xyz456`: Encryption key (used **only** on the client)

### 🧠 **Key Never Touches the Server**

- The **encryption key** after the comma (`xyz456`) is part of the URL fragment (`#...`).
- This fragment is **never sent** in HTTP requests, meaning:
    
    > The server cannot see or store the encryption key.
    > 

### 🔒 **Client-Side Only Decryption**

- All encrypted drawing data is transmitted over WebSocket.
- The **decryption and rendering** happen completely on the client-side using the `key` from the URL.
- Even if someone intercepts the WebSocket traffic, they cannot decrypt the data without the key.

### 🛡️ **Benefits**

- No one — not even the server — can read what’s drawn in a room without the key.
- Ensures **confidentiality** for private brainstorming, teaching, or design sessions.
- Works like **Collabydraw's E2EE rooms**, but tailored for your collaborative drawing logic.

---

### 🧠 Reliability

- **Message Queue**: Stores unsent messages in memory/localStorage
- **Auto Retry**: Flushes queued messages on reconnect

---

### 🧭 Modes

- **Standalone Mode**: Offline/local drawing
- **Room Mode**: Collaborative sessions

---

### ⚙️ Tech Stack

- **Frontend**: React (Vite), TypeScript, Tailwind CSS
- **Canvas**: HTML Canvas API + Custom Engine
- **Realtime**: Native WebSocket (`useWebSocket` hook)
- **Security**: Hash-based E2EE

---

### 📄 Notion Document

https://plum-chamomile-116.notion.site/Collabydraw-Hand-drawn-look-feel-Collaborative-Secure-1cb6d6552d9b802597c1cb575db2a9da?pvs=4



### 🌍 Open Source & Contributions

I want **CollabyDraw** to be open source so that other students and developers can explore and learn from it.  
If you'd like to contribute—whether it's improving the UI, optimizing performance, or adding new features—feel free to open an issue or submit a pull request!

---

### 🧠 How to Contribute

1. **Fork the Repo** and clone it locally
2. Run `pnpm install` and `pnpm dev` to start the dev server
3. Check the `Issues` tab for open tasks — especially those labeled `good first issue`
4. Follow the `CONTRIBUTING.md` (coming soon) for guidelines
5. Submit a Pull Request — even small improvements matter!

💡 **Ideas for Contribution** (feel free to raise these as issues):
- Add undo/redo support in standalone mode
- Add support for duplicating a selected shape using **Ctrl + D** keyboard shortcut.

---

## 🚀 Deployment

For hosting guidance and the current deployment plan, see `DEPLOYMENT.md`.

- Fix: **Rounded corners not working for Diamond shape**
  When the **"rounded"** option is selected for diamond shapes, the corners remain sharp. Update the rendering logic to support rounded edges for diamonds.

👉 Tag your issue with `good first issue`, `help wanted`, or `enhancement` so others can discover and contribute!

---

### 📄 Architecture Overview (Differences from Cohort Project)

- **Next.js 15 for Fullstack**: Frontend and backend are handled together using server actions. No separate HTTP services.
- **No Mandatory Auth for Canvas Use**: Users can draw without logging in. Auth is only required for collaboration.
- **Server Actions Instead of REST APIs**: Room creation, joining, and user management are handled through server actions.
- **Standalone Mode with Local Storage**: For solo drawing sessions, data is stored locally and never sent to a server.
- **Interactive Room Collaboration Mode**: Shows participant presence, names, and avatars in real-time sync only as of now.
- **End-to-End Encrypted Collaboration**: No drawn shapes or messages are stored in any database.
- **Database Used Only for Auth**: All other state management is client-side or ephemeral.
- **Hookified WebSocket Layer**: Abstracts the socket connection with clean React patterns.

---

## 📄 License

This project is licensed under a **Custom Personal Use License** — you may view and learn from the code, but **commercial use, redistribution, or claiming authorship is strictly prohibited**.  
See the full [LICENSE](./LICENSE) for details.
