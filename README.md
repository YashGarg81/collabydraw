# 🎨 CollabyDraw | The AI-Powered Collaboration Platform

[![CI](https://github.com/YashGarg81/collabydraw/actions/workflows/ci.yml/badge.svg)](https://github.com/YashGarg81/collabydraw/actions/workflows/ci.yml)
[![Frontend CD](https://github.com/YashGarg81/collabydraw/actions/workflows/cd_frontend.yml/badge.svg)](https://github.com/YashGarg81/collabydraw/actions/workflows/cd_frontend.yml)
[![WebSocket CD](https://github.com/YashGarg81/collabydraw/actions/workflows/cd_ws.yml/badge.svg)](https://github.com/YashGarg81/collabydraw/actions/workflows/cd_ws.yml)

---

**CollabyDraw** is a premium, enterprise-grade digital whiteboard and collaboration platform. Evolving far beyond a simple drawing tool, CollabyDraw integrates **Generative AI**, **Real-Time Yjs Synchronization**, **SaaS Monetization**, and deep **Ecosystem Integrations** to provide a seamless brainstorming and diagramming experience.

---

## 🌟 What's New? (The 7-Phase Evolution)

We have recently completed a massive 7-phase development roadmap, transforming CollabyDraw into a full-featured SaaS platform:

### Phase 1: MVP Foundation & Architecture 🏗️
- **Next.js 15 (App Router)** powering a monolithic fullstack architecture.
- **PostgreSQL & Prisma** for robust, scalable relational data storage.
- **OAuth Authentication** via NextAuth.js (Google, GitHub).
- **High-Performance Canvas Engine** capable of handling thousands of shapes smoothly.
- **Workspace Dashboard** to manage folders, boards, and account settings.

### Phase 2: Premium UI & Tooling 🎨
- **Modern Design System** using Tailwind CSS and shadcn/ui.
- **Layers Panel** for precise z-index management (reorder, lock, hide shapes).
- **Rulers & Guidelines** with snap-to-grid capabilities.
- **Customization:** Dark/Light mode and custom board covers.

### Phase 3: Real-Time Collaboration ⚡
- **Yjs (CRDT) Engine** for pixel-perfect, conflict-free synchronization.
- **Node.js WebSocket Microservice** (`@repo/ws-server`) for low-latency broadcasts.
- **Live Presence:** Multi-colored cursors with user name tags and active selection indicators.
- **Spatial Comments:** Threaded comments anchored directly to the canvas.
- **Role-Based Access Control:** Granular Owner, Editor, and Viewer permissions.

### Phase 4: AI Differentiation 🧠
- **Generative AI Integration** powered by Google's Gemini (1.5-Flash).
- **Text-to-Diagram:** Type prompts to instantly generate editable Mermaid.js architecture and flowcharts.
- **5 Smart Generators:** Mind Maps, Flowcharts, Wireframes, Brainstorming Sticky Notes, and Database Schemas.
- **Laser Pointer Tool** for live, fading presentation strokes.

### Phase 5: SaaS Monetization 💳
- **Plan Tiers:** Free, Pro, and Enterprise subscription models.
- **Quotas & Limits Engine:** Enforced limits on active boards, AI generations, and max collaborators.
- **Billing Dashboard:** Beautiful UI for usage tracking and checkout flows.
- **Premium Exports:** High-res PNG, SVG, and JSON exports gated by subscription tier.

### Phase 6: Ecosystem & Integrations 🌐
- **Public REST API (`/api/v1/boards`)** authenticated via generated API Keys.
- **Zapier-Ready Webhooks:** Send HTTP payloads on board creation, updates, and deletion.
- **Slack Notifications:** Webhook engine natively formats rich-text alerts for Slack.
- **Native Canvas Integrations:** Drop GitHub and Jira URLs onto the canvas to spawn live, syncing smart cards.
- **Web Embeds:** Notion/Confluence unfurling via oEmbed, and a secure `/embed/[id]` iframe view.

### Phase 7: Template Marketplace 🛍️
- **Template Browser:** Beautiful gallery featuring categorized, trending, and featured templates.
- **Creator Portfolios:** Public profile pages (`/creators/[id]`) showcasing a creator's published templates, total downloads, and affiliate codes.
- **Monetization & Checkout:** Paid premium templates ($1–$20) with a seamless, Stripe-ready mock checkout system.
- **SEO & Growth:** Google-discoverable, dynamically generated static detail pages for every template.
- **Viral Growth Engine:** "Use Template" functionality that instantly forks predefined structures directly into the user's dashboard.

---

## ⚙️ Tech Stack

- **Frontend & API Framework:** Next.js 15 (App Router), React, TypeScript
- **Styling:** Tailwind CSS, Radix UI (shadcn)
- **Database & ORM:** SQLite/PostgreSQL, Prisma
- **Real-Time Sync:** Yjs (CRDT), WebSockets (ws)
- **Generative AI:** Google Gemini API
- **Monetization:** Stripe (Mocked for Templates/Subscriptions)
- **Canvas:** Native HTML5 Canvas API + Custom Rendering Engine

---

## 🚀 Getting Started Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YashGarg81/collabydraw.git
   cd collabydraw
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Environment Setup:**
   Create a `.env` file in `apps/collabydraw` based on `.env.example`. You will need PostgreSQL credentials, NextAuth secrets, and a Gemini API key for AI features.

4. **Database Setup:**
   ```bash
   pnpm run db:push
   ```

5. **Start Development Servers:**
   ```bash
   pnpm run dev
   ```

---

## 🌍 Open Source & Contributions

I want **CollabyDraw** to be an incredible resource for developers to learn from. If you'd like to contribute—whether it's improving the UI, optimizing performance, or adding new tools—feel free to open an issue or submit a pull request!

1. **Fork the Repo** and clone it locally
2. Check the `Issues` tab for open tasks — especially those labeled `good first issue`
3. Submit a Pull Request — even small improvements matter!

---

## 📄 License

This project is licensed under a **Custom Personal Use License** — you may view and learn from the code, but **commercial use, redistribution, or claiming authorship is strictly prohibited**.  
See the full [LICENSE](./LICENSE) for details.
