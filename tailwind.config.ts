import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", lg: "2rem" },
      screens: { "2xl": "1360px" },
    },
    extend: {
      // -------- Portal-direct tokens (read CSS vars; sharable everywhere) --------
      colors: {
        // shadcn / theme aliases — driven by HSL vars in globals.css
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        // Direct portal palette (use these for portal-specific surfaces)
        portal: {
          main: "var(--bg-main)",
          page: "var(--bg-page)",
          panel: "var(--bg-panel)",
          "panel-raised": "var(--bg-panel-raised)",
          "panel-soft": "var(--bg-panel-soft)",
          inverse: "var(--bg-inverse)",
          text: "var(--text-main)",
          "text-muted": "var(--text-muted)",
          "text-soft": "var(--text-soft)",
          "border-main": "var(--border-main)",
          "border-muted": "var(--border-muted)",
          "border-soft": "var(--border-soft)",
          orange: "var(--accent-orange)",
          blue: "var(--accent-blue)",
          green: "var(--accent-green)",
          yellow: "var(--accent-yellow)",
          red: "var(--accent-red)",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        panel: "var(--radius-panel)",
        pill: "var(--radius-pill)",
      },
      fontFamily: {
        ui: ["var(--font-ui)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        hero: ["var(--font-hero)", "system-ui", "sans-serif"],
        sans: ["var(--font-ui)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        tighter: "-0.04em",
        label: "0.18em",
        wider: "0.12em",
      },
      boxShadow: {
        portal: "var(--shadow-panel)",
        soft: "var(--shadow-soft)",
        glow: "var(--shadow-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
