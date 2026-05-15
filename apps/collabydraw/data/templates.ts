/**
 * Phase 4: Built-in Template Library
 * 12 professional templates across 5 categories.
 * Shapes use the same CollabyDraw Shape schema.
 */

import { v4 as uuidv4 } from "uuid";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  shapes: object[];
  previewColor: string; // gradient from-color for card
}

export type TemplateCategory =
  | "flowchart"
  | "wireframe"
  | "mindmap"
  | "kanban"
  | "diagram"
  | "retrospective";

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { label: string; emoji: string }> = {
  flowchart:     { label: "Flowcharts",    emoji: "🔀" },
  wireframe:     { label: "Wireframes",    emoji: "📐" },
  mindmap:       { label: "Mind Maps",     emoji: "🧠" },
  kanban:        { label: "Kanban",        emoji: "📋" },
  diagram:       { label: "Diagrams",      emoji: "🗂️" },
  retrospective: { label: "Retrospective", emoji: "🔄" },
};

// ── Helper builders ────────────────────────────────────────────────────────────

function rect(x: number, y: number, w: number, h: number, label?: string, color = "rgba(18,18,18)") {
  const id = uuidv4();
  const shapes: object[] = [{
    id, type: "rectangle", x, y, width: w, height: h,
    strokeWidth: 1.5, strokeFill: "rgba(139,92,246)", bgFill: color,
    rounded: "round", strokeStyle: "solid", roughStyle: 0, fillStyle: "solid",
  }];
  if (label) shapes.push(text(x + w / 2 - 60, y + h / 2 - 10, label));
  return shapes;
}

function diamond(x: number, y: number, w: number, h: number, label?: string) {
  const id = uuidv4();
  const shapes: object[] = [{
    id, type: "diamond", x, y, width: w, height: h,
    strokeWidth: 1.5, strokeFill: "rgba(236,72,153)", bgFill: "rgba(18,18,18)",
    rounded: "round", strokeStyle: "solid", roughStyle: 0, fillStyle: "solid",
  }];
  if (label) shapes.push(text(x + w / 2 - 40, y + h / 2 - 10, label));
  return shapes;
}

function ellipse(x: number, y: number, rx: number, ry: number, label?: string) {
  const id = uuidv4();
  const shapes: object[] = [{
    id, type: "ellipse", x, y, radX: rx, radY: ry,
    strokeWidth: 1.5, strokeFill: "rgba(37,99,235)", bgFill: "rgba(18,18,18)",
    strokeStyle: "solid", roughStyle: 0, fillStyle: "solid",
  }];
  if (label) shapes.push(text(x - rx + 10, y - 10, label));
  return shapes;
}

function arrow(x1: number, y1: number, x2: number, y2: number) {
  return [{
    id: uuidv4(), type: "arrow", x: x1, y: y1, toX: x2, toY: y2,
    strokeWidth: 1.5, strokeFill: "rgba(255,255,255,0.5)", strokeStyle: "solid", roughStyle: 0,
  }];
}

function text(x: number, y: number, content: string, size: "Small" | "Medium" = "Small") {
  return {
    id: uuidv4(), type: "text", x, y, width: 160, height: 24,
    text: content, fontSize: size, fontFamily: "normal", fontStyle: "normal",
    textAlign: "center", strokeFill: "rgba(255,255,255,0.8)",
  };
}

function sticky(x: number, y: number, content: string, color = "#fbbf24") {
  return {
    id: uuidv4(), type: "sticky", x, y, width: 160, height: 120,
    text: content, fontSize: "Small", fontFamily: "normal", fontStyle: "normal",
    textAlign: "left", strokeFill: color, bgFill: color + "30",
    strokeWidth: 1, strokeStyle: "solid", roughStyle: 0, fillStyle: "solid",
  };
}

function line(x1: number, y1: number, x2: number, y2: number) {
  return [{
    id: uuidv4(), type: "line", x: x1, y: y1, toX: x2, toY: y2,
    strokeWidth: 1, strokeFill: "rgba(255,255,255,0.2)", strokeStyle: "solid", roughStyle: 0,
  }];
}

// ── Template definitions ────────────────────────────────────────────────────────

export const TEMPLATES: Template[] = [

  // ─── FLOWCHARTS ──────────────────────────────────────────────────────────────

  {
    id: "login-flow",
    name: "User Login Flow",
    description: "Standard authentication flow: login → validation → dashboard or error",
    category: "flowchart",
    tags: ["auth", "login", "flow"],
    previewColor: "from-violet-600/40 to-indigo-600/20",
    shapes: [
      ...ellipse(400, 60, 60, 25, "Start"),
      ...arrow(400, 85, 400, 120),
      ...rect(300, 120, 200, 60, "Login Form"),
      ...arrow(400, 180, 400, 220),
      ...diamond(300, 220, 200, 70, "Valid?"),
      ...arrow(500, 255, 580, 255),
      ...rect(580, 220, 180, 60, "Show Error"),
      ...arrow(400, 290, 400, 340),
      ...rect(300, 340, 200, 60, "Dashboard"),
      ...ellipse(400, 440, 60, 25, "End"),
      ...arrow(400, 400, 400, 420),
    ].flat(),
  },

  {
    id: "ci-cd-pipeline",
    name: "CI/CD Pipeline",
    description: "Complete DevOps pipeline from commit to production deploy",
    category: "flowchart",
    tags: ["devops", "ci-cd", "pipeline"],
    previewColor: "from-emerald-600/40 to-teal-600/20",
    shapes: [
      ...rect(40, 80, 140, 50, "Code Commit"),
      ...arrow(180, 105, 220, 105),
      ...rect(220, 80, 140, 50, "Unit Tests"),
      ...arrow(360, 105, 400, 105),
      ...diamond(380, 68, 140, 60, "Tests Pass?"),
      ...arrow(520, 98, 560, 98),
      ...rect(560, 80, 140, 50, "Build Image"),
      ...arrow(700, 105, 740, 105),
      ...rect(740, 80, 140, 50, "Staging Deploy"),
      ...arrow(880, 105, 920, 105),
      ...diamond(900, 68, 140, 60, "QA Pass?"),
      ...arrow(1040, 98, 1080, 98),
      ...rect(1080, 80, 160, 50, "Production 🚀"),
    ].flat(),
  },

  // ─── WIREFRAMES ──────────────────────────────────────────────────────────────

  {
    id: "saas-dashboard",
    name: "SaaS Dashboard",
    description: "Admin dashboard wireframe with sidebar, stats, and data table",
    category: "wireframe",
    tags: ["dashboard", "saas", "admin"],
    previewColor: "from-blue-600/40 to-cyan-600/20",
    shapes: [
      // Sidebar
      ...rect(40, 40, 180, 600, "Sidebar", "rgba(20,20,30)"),
      text(70, 60, "📊 Dashboard"),
      text(70, 100, "📋 Boards"),
      text(70, 130, "👥 Users"),
      text(70, 160, "⚙️ Settings"),
      // Top bar
      ...rect(240, 40, 800, 60, "", "rgba(20,20,30)"),
      text(600, 60, "Search..."),
      // Stat cards
      ...rect(240, 120, 180, 100, "Total Users\n1,240"),
      ...rect(440, 120, 180, 100, "Active Boards\n328"),
      ...rect(640, 120, 180, 100, "Revenue\n$12,400"),
      ...rect(840, 120, 180, 100, "Uptime\n99.9%"),
      // Chart area
      ...rect(240, 240, 480, 240, "Chart Area"),
      // Table
      ...rect(240, 500, 800, 140, "Data Table"),
    ].flat(),
  },

  {
    id: "mobile-app",
    name: "Mobile App Wireframe",
    description: "Mobile app screens: onboarding, home, and profile",
    category: "wireframe",
    tags: ["mobile", "app", "ux"],
    previewColor: "from-pink-600/40 to-rose-600/20",
    shapes: [
      // Phone 1 - Onboarding
      ...rect(60, 40, 200, 380, "", "rgba(15,15,20)"),
      ...ellipse(160, 140, 50, 50, ""),
      text(80, 200, "Welcome to App"),
      text(80, 230, "Start your journey"),
      ...rect(100, 280, 120, 40, "Get Started"),
      // Phone 2 - Home
      ...rect(320, 40, 200, 380, "", "rgba(15,15,20)"),
      text(340, 60, "Home"),
      ...rect(340, 100, 160, 80, "Featured Card"),
      ...rect(340, 200, 70, 70, "Item 1"),
      ...rect(430, 200, 70, 70, "Item 2"),
      ...rect(340, 290, 70, 70, "Item 3"),
      ...rect(430, 290, 70, 70, "Item 4"),
      // Phone 3 - Profile
      ...rect(580, 40, 200, 380, "", "rgba(15,15,20)"),
      ...ellipse(680, 110, 40, 40, ""),
      text(620, 160, "John Doe"),
      text(620, 185, "@johndoe"),
      ...rect(620, 220, 140, 40, "Edit Profile"),
      ...line(580, 280, 780, 280),
      text(620, 295, "Settings"),
      text(620, 325, "Help"),
      text(620, 355, "Sign out"),
    ].flat(),
  },

  // ─── MIND MAPS ───────────────────────────────────────────────────────────────

  {
    id: "product-roadmap-mindmap",
    name: "Product Roadmap Mind Map",
    description: "Visualise Q1–Q4 roadmap with features, priorities, and owners",
    category: "mindmap",
    tags: ["product", "roadmap", "planning"],
    previewColor: "from-amber-600/40 to-orange-600/20",
    shapes: [
      // Center
      ...ellipse(600, 300, 80, 40, "Product 2026"),
      // Q branches
      ...arrow(520, 300, 380, 200), ...rect(280, 175, 120, 50, "Q1: Launch"),
      ...arrow(520, 290, 380, 130), ...rect(280, 105, 120, 50, "Auth & Boards"),
      ...arrow(520, 285, 380, 60),  ...rect(280, 35, 120, 50, "API v1"),

      ...arrow(680, 300, 820, 200), ...rect(820, 175, 120, 50, "Q2: Growth"),
      ...arrow(680, 290, 820, 130), ...rect(820, 105, 120, 50, "Templates"),
      ...arrow(680, 285, 820, 60),  ...rect(820, 35, 120, 50, "AI Features"),

      ...arrow(600, 340, 380, 420), ...rect(280, 395, 120, 50, "Q3: Scale"),
      ...arrow(600, 345, 380, 480), ...rect(280, 455, 120, 50, "Redis WS"),
      ...arrow(600, 350, 380, 540), ...rect(280, 515, 120, 50, "Enterprise"),

      ...arrow(600, 340, 820, 420), ...rect(820, 395, 120, 50, "Q4: Monetize"),
      ...arrow(600, 345, 820, 480), ...rect(820, 455, 120, 50, "Stripe Live"),
      ...arrow(600, 350, 820, 540), ...rect(820, 515, 120, 50, "Marketplace"),
    ].flat(),
  },

  {
    id: "brainstorm-template",
    name: "Brainstorming Session",
    description: "Open brainstorm board with central theme and idea zones",
    category: "mindmap",
    tags: ["brainstorm", "ideas", "creative"],
    previewColor: "from-fuchsia-600/40 to-purple-600/20",
    shapes: [
      ...ellipse(600, 320, 100, 50, "Central Theme"),
      sticky(100, 80,  "💡 Idea 1\nWrite your idea here"),
      sticky(300, 80,  "💡 Idea 2\nWrite your idea here", "#34d399"),
      sticky(500, 80,  "💡 Idea 3\nWrite your idea here", "#60a5fa"),
      sticky(700, 80,  "💡 Idea 4\nWrite your idea here", "#f472b6"),
      sticky(900, 80,  "💡 Idea 5\nWrite your idea here", "#fb923c"),
      sticky(100, 480, "⚡ Action 1\nNext step"),
      sticky(300, 480, "⚡ Action 2\nNext step", "#34d399"),
      sticky(500, 480, "⚡ Action 3\nNext step", "#60a5fa"),
      sticky(700, 480, "⚡ Action 4\nNext step", "#f472b6"),
    ],
  },

  // ─── KANBAN ──────────────────────────────────────────────────────────────────

  {
    id: "sprint-kanban",
    name: "Sprint Kanban Board",
    description: "4-column sprint board: Backlog, In Progress, Review, Done",
    category: "kanban",
    tags: ["agile", "sprint", "scrum"],
    previewColor: "from-cyan-600/40 to-sky-600/20",
    shapes: [
      // Column headers
      ...rect(40,  40, 220, 50, "📋 Backlog",      "rgba(30,30,45)"),
      ...rect(280, 40, 220, 50, "🔧 In Progress",  "rgba(30,30,45)"),
      ...rect(520, 40, 220, 50, "👁️ In Review",    "rgba(30,30,45)"),
      ...rect(760, 40, 220, 50, "✅ Done",          "rgba(30,30,45)"),
      // Cards - Backlog
      sticky(50, 110, "User Auth\n[HIGH] Backend"),
      sticky(50, 250, "Dashboard UI\n[MED] Frontend"),
      sticky(50, 390, "Email verify\n[LOW] Backend"),
      // Cards - In Progress
      sticky(290, 110, "Canvas Engine\n[HIGH] Frontend", "#60a5fa"),
      sticky(290, 250, "WebSocket WS\n[MED] Backend",    "#60a5fa"),
      // Cards - Review
      sticky(530, 110, "Minimap\n[HIGH] Done ✓",         "#34d399"),
      sticky(530, 250, "Command Palette\n[MED] Done ✓",  "#34d399"),
      // Cards - Done
      sticky(770, 110, "Landing Page\n[HIGH] Done ✓",    "#a78bfa"),
      sticky(770, 250, "Auth flow\n[HIGH] Done ✓",       "#a78bfa"),
      sticky(770, 390, "Pricing Page\n[MED] Done ✓",     "#a78bfa"),
    ],
  },

  {
    id: "product-backlog",
    name: "Product Backlog",
    description: "Feature backlog with priority scoring (MoSCoW method)",
    category: "kanban",
    tags: ["backlog", "moscow", "prioritization"],
    previewColor: "from-teal-600/40 to-emerald-600/20",
    shapes: [
      ...rect(40, 40, 240, 50, "Must Have 🔴",    "rgba(30,30,45)"),
      ...rect(300, 40, 240, 50, "Should Have 🟡",  "rgba(30,30,45)"),
      ...rect(560, 40, 240, 50, "Could Have 🟢",   "rgba(30,30,45)"),
      ...rect(820, 40, 240, 50, "Won't Have ⚪",   "rgba(30,30,45)"),

      sticky(50,  110, "User login\nP0 Critical"),
      sticky(50,  250, "Data backup\nP0 Critical"),
      sticky(50,  390, "Payment flow\nP0 Critical"),
      sticky(310, 110, "Dark mode\nP1 Nice to have", "#fbbf24"),
      sticky(310, 250, "CSV export\nP1 Nice to have", "#fbbf24"),
      sticky(570, 110, "Emoji picker\nP2 Optional", "#34d399"),
      sticky(570, 250, "Sound FX\nP2 Optional", "#34d399"),
      sticky(830, 110, "VR mode\nFuture", "#6b7280"),
    ],
  },

  // ─── DIAGRAMS ─────────────────────────────────────────────────────────────────

  {
    id: "org-chart",
    name: "Organisation Chart",
    description: "Company org chart: CEO → VPs → Directors → Teams",
    category: "diagram",
    tags: ["org-chart", "company", "hierarchy"],
    previewColor: "from-indigo-600/40 to-blue-600/20",
    shapes: [
      // CEO
      ...rect(480, 40, 160, 50, "CEO"),
      ...arrow(560, 90, 280, 140),
      ...arrow(560, 90, 560, 140),
      ...arrow(560, 90, 840, 140),
      // VPs
      ...rect(180, 140, 160, 50, "VP Engineering"),
      ...rect(480, 140, 160, 50, "VP Product"),
      ...rect(780, 140, 160, 50, "VP Marketing"),
      // Directors
      ...arrow(260, 190, 120, 260), ...arrow(260, 190, 300, 260),
      ...rect(60,  260, 140, 50, "Backend Lead"),
      ...rect(220, 260, 140, 50, "Frontend Lead"),
      ...arrow(560, 190, 460, 260), ...arrow(560, 190, 620, 260),
      ...rect(400, 260, 140, 50, "Design Lead"),
      ...rect(560, 260, 140, 50, "PM Lead"),
      ...arrow(860, 190, 760, 260), ...arrow(860, 190, 920, 260),
      ...rect(700, 260, 140, 50, "SEO Lead"),
      ...rect(860, 260, 140, 50, "Growth Lead"),
    ].flat(),
  },

  {
    id: "er-diagram",
    name: "Database ER Diagram",
    description: "Entity-relationship diagram for a SaaS product database",
    category: "diagram",
    tags: ["database", "er", "schema"],
    previewColor: "from-orange-600/40 to-red-600/20",
    shapes: [
      // Entities
      ...rect(80, 80, 200, 160, ""),
      text(130, 90, "User"), text(100, 120, "id: UUID PK"), text(100, 145, "email: String"), text(100, 170, "plan: Enum"), text(100, 195, "createdAt: Date"),
      ...rect(420, 80, 200, 160, ""),
      text(470, 90, "Board"), text(440, 120, "id: UUID PK"), text(440, 145, "name: String"), text(440, 170, "ownerId: FK"), text(440, 195, "shapes: JSON"),
      ...rect(760, 80, 200, 160, ""),
      text(810, 90, "Room"), text(780, 120, "id: UUID PK"), text(780, 145, "adminId: FK"), text(780, 170, "boardId: FK"), text(780, 195, "createdAt: Date"),
      ...rect(80, 340, 200, 130, ""),
      text(130, 350, "Session"), text(100, 380, "id: UUID PK"), text(100, 405, "userId: FK"), text(100, 430, "expires: Date"),
      ...rect(420, 340, 200, 130, ""),
      text(470, 350, "Shape"), text(440, 380, "id: UUID PK"), text(440, 405, "roomId: FK"), text(440, 430, "message: JSON"),
      // Relations
      ...arrow(280, 160, 420, 160),
      ...arrow(620, 160, 760, 160),
      ...arrow(180, 240, 180, 340),
      ...arrow(520, 240, 520, 340),
    ].flat(),
  },

  // ─── RETROSPECTIVE ────────────────────────────────────────────────────────────

  {
    id: "sprint-retro",
    name: "Sprint Retrospective",
    description: "Start / Stop / Continue retro format with sticky note zones",
    category: "retrospective",
    tags: ["retro", "agile", "team"],
    previewColor: "from-rose-600/40 to-pink-600/20",
    shapes: [
      ...rect(40,  40, 280, 620, "▶ START\nWhat should we start doing?", "rgba(20,40,20)"),
      ...rect(360, 40, 280, 620, "⏹ STOP\nWhat should we stop doing?",  "rgba(40,20,20)"),
      ...rect(680, 40, 280, 620, "🔁 CONTINUE\nWhat's working well?",    "rgba(20,20,40)"),
      sticky(60,  130, "💡 Add your idea...", "#34d399"),
      sticky(60,  270, "💡 Add your idea...", "#34d399"),
      sticky(380, 130, "🚫 Add your idea...", "#f87171"),
      sticky(380, 270, "🚫 Add your idea...", "#f87171"),
      sticky(700, 130, "✅ Add your idea...", "#60a5fa"),
      sticky(700, 270, "✅ Add your idea...", "#60a5fa"),
    ],
  },

  {
    id: "4ls-retro",
    name: "4L's Retrospective",
    description: "Liked, Learned, Lacked, Longed for — deep retrospective format",
    category: "retrospective",
    tags: ["retro", "4ls", "team"],
    previewColor: "from-violet-600/40 to-purple-600/20",
    shapes: [
      ...rect(40,  40, 460, 330, "❤️ LIKED\nWhat did you enjoy?",           "rgba(30,20,40)"),
      ...rect(540, 40, 460, 330, "📚 LEARNED\nWhat new did you discover?",  "rgba(20,30,40)"),
      ...rect(40, 400, 460, 300, "😔 LACKED\nWhat was missing?",            "rgba(40,20,20)"),
      ...rect(540,400, 460, 300, "🌟 LONGED FOR\nWhat did you wish for?",   "rgba(20,40,30)"),
      sticky(60,  130, "Write here...", "#c084fc"),
      sticky(240, 130, "Write here...", "#c084fc"),
      sticky(560, 130, "Write here...", "#60a5fa"),
      sticky(740, 130, "Write here...", "#60a5fa"),
      sticky(60,  490, "Write here...", "#f87171"),
      sticky(240, 490, "Write here...", "#f87171"),
      sticky(560, 490, "Write here...", "#34d399"),
      sticky(740, 490, "Write here...", "#34d399"),
    ],
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: TemplateCategory): Template[] {
  return TEMPLATES.filter(t => t.category === category);
}
