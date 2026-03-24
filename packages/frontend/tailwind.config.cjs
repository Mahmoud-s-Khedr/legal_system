module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  plugins: [require("tailwindcss-rtl")],
  theme: {
    extend: {
      fontFamily: {
        body: ['"Cairo"', "system-ui", "sans-serif"],
        heading: ['"Cairo"', "system-ui", "sans-serif"]
      },
      colors: {
        sand: { DEFAULT: "#f7f3ec", warm: "#f8edd8", deep: "#ede4d3" },
        ink: "#1f2937",
        accent: { DEFAULT: "#0f766e", hover: "#0d6b63" },
        accentSoft: "#d1fae5"
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        elevated: "var(--shadow-elevated)"
      },
      animation: {
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "fade-in": "fade-in var(--transition-normal) ease-out",
        "slide-up": "slide-up var(--transition-normal) ease-out",
        "toast-enter": "toast-enter 300ms ease-out",
        "toast-exit": "toast-exit 200ms ease-in forwards",
        "spin-slow": "spin-slow 1.5s linear infinite",
        "desktop-bootstrap": "desktop-bootstrap 1.3s ease-in-out infinite"
      },
      transitionDuration: {
        fast: "150ms",
        normal: "250ms",
        slow: "350ms"
      }
    }
  }
};
