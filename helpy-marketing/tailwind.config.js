/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Match Helpy design tokens (using the same CSS variables as the main app)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        // Convenience alias for components that still use brand-primary
        brand: {
          primary: "#3EAFD2"
        }
      },
      boxShadow: {
        soft: "0 15px 35px rgba(15,23,42,0.08)"
      },
      borderRadius: {
        "2xl": "1rem"
      }
    }
  },
  plugins: []
};


