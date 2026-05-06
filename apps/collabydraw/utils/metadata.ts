import { Metadata } from "next";

export const baseMetadata: Metadata = {
  metadataBase: new URL("https://collabydraw.xyz"),
  title: {
    default: "Collabydraw | Hand-drawn look & feel • Collaborative • Secure",
    template: "%s | Collabydraw",
  },
  description:
    "Collabydraw is a secure, end-to-end encrypted collaborative whiteboard tool that lets you draw and brainstorm together in real time. Create beautiful hand-drawn sketches, diagrams, and designs with real-time collaboration.",
  keywords: [
    "collaborative drawing",
    "online whiteboard",
    "real-time canvas",
    "digital whiteboard",
    "end-to-end encrypted whiteboard",
    "whiteboard app",
    "collaborative whiteboard",
    "drawing tool",
    "sketch tool",
    "brainstorming tool",
    "team collaboration",
    "real-time drawing",
    "hand-drawn sketches",
    "secure whiteboard",
    "privacy-focused drawing",
    "web whiteboard",
    "canvas drawing",
    "rough.js",
    "perfect-freehand",
    "E2EE whiteboard",
    "100xdevs",
    "100xdevs community",
    "100xdevs cohort 2 excalidraw project",
    "harkirat singh cohort 2 excalidraw project",
  ],
  authors: [{ name: "Om Sharma" }],
  creator: "Om Sharma",
  publisher: "Collabydraw",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://collabydraw.xyz",
    title: "Collabydraw — Collaborative whiteboarding made easy",
    description:
      "Collabydraw is a virtual collaborative whiteboard tool that lets you easily sketch diagrams that have a hand-drawn feel to them. End-to-end encrypted and privacy-focused.",
    siteName: "Collabydraw",
    images: [
      {
        url: "https://collabydraw.xyz/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "Collabydraw - Collaborative Drawing Tool UI",
        type: "image/png",
        secureUrl: "https://collabydraw.xyz/brand/og-image.png",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Collabydraw — Collaborative whiteboarding made easy",
    description:
      "Collabydraw is a virtual collaborative whiteboard tool that lets you easily sketch diagrams that have a hand-drawn feel to them. End-to-end encrypted and privacy-focused.",
    creator: "@1omsharma",
    images: ["https://collabydraw.xyz/brand/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || "your-google-site-verification-code",
  },

  alternates: {
    canonical: "https://collabydraw.xyz",
  },

  icons: {
    icon: [
      { url: "/brand/favicon.png" },
      { url: "/brand/favicon.png", sizes: "180x180", type: "image/png" },
    ],
    apple: [{ url: "/brand/favicon.png" }],
  },

  other: {
    "msapplication-TileColor": "#ffffff",
    "theme-color": "#ffffff",
  },
  applicationName: "Collabydraw",
  category: "productivity",
};

// Optional: page-specific
export const generateRoomMetadata: Metadata = {
  title: "Join Room | Collabydraw",
  description:
    "Join a secure, end-to-end encrypted drawing room. Collaborate in real-time with others. No login required.",
  openGraph: {
    ...baseMetadata.openGraph,
    title: "Join Room | Collabydraw",
    description:
      "Join a secure, end-to-end encrypted drawing room. Collaborate in real-time with others. No login required.",
  },
  twitter: {
    ...baseMetadata.twitter,
    title: "Join Room | Collabydraw",
  },
};

export const jsonLdSchemas = {
  // WebApplication Schema
  webApplication: {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Collabydraw",
    url: "https://collabydraw.xyz",
    description: "End-to-end encrypted real-time collaborative drawing tool with hand-drawn look and feel",
    applicationCategory: "ProductivityApplication",
    applicationSubCategory: "Drawing Software",
    operatingSystem: "Web Browser",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Real-time collaborative drawing",
      "End-to-end encryption",
      "Hand-drawn look and feel",
      "Shape tools",
      "Editable text",
      "Eraser tool",
      "Rough.js support",
      "Perfect-freehand support",
    ],
    screenshot: "https://collabydraw.xyz/brand/og-image.png",
  },

  // Organization Schema
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Collabydraw",
    url: "https://collabydraw.xyz",
    logo: "https://collabydraw.xyz/brand/CollabyDrawLogo.png",
    description: "A secure, collaborative whiteboard application",
    founder: {
      "@type": "Person",
      name: "Om Sharma",
    },
    sameAs: [
      "https://twitter.com/1omsharma",
      "https://github.com/coderomm/CollabyDraw",
    ],
  },

  // WebSite Schema
  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Collabydraw",
    url: "https://collabydraw.xyz",
    description: "Collaborative whiteboard with end-to-end encryption",
    publisher: {
      "@type": "Organization",
      name: "Collabydraw",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://collabydraw.xyz/?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  },
};
