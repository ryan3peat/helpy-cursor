<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Helpy

A mobile-first PWA for household management, built with React, TypeScript, and Supabase.

## Features

- **ToDo Management** - Tasks and shopping lists with real-time sync
- **Meal Planning** - Weekly meal planner with recipe management
- **Expense Tracking** - Household expenses with receipt OCR
- **Family Profiles** - Multi-user household with role-based permissions
- **Push Notifications** - Real-time notifications for household updates
- **Multi-language Support** - Full translation system

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Auth**: Clerk
- **Payments**: Stripe
- **AI**: Google Gemini (OCR, translations)
- **Deployment**: Vercel

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env.local`:
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key
   GEMINI_API_KEY=your_gemini_api_key
   VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:5173`

## Documentation

See the `/docs` folder for:
- **[DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)** - Comprehensive design system guide
- **[GLOBAL_RULES.md](./docs/GLOBAL_RULES.md)** - Development consistency guidelines
- **[LOCAL_DEV_SETUP.md](./docs/LOCAL_DEV_SETUP.md)** - Local development setup
- **[PUSH_NOTIFICATIONS_SETUP.md](./docs/PUSH_NOTIFICATIONS_SETUP.md)** - Push notification configuration

## Project Structure

```
helpy-cursor/
├── api/                 # Vercel serverless functions
├── components/          # React components
│   └── ui/             # Reusable UI components
├── contexts/           # React contexts
├── docs/               # Documentation
├── hooks/              # Custom React hooks
├── migrations/         # Supabase SQL migrations
├── services/           # API service layer
├── supabase/           # Supabase Edge Functions
├── types.ts            # TypeScript types
└── constants.ts        # App constants & translations
```

## Key Design Patterns

- **Mobile-first PWA** - No hover effects, touch-optimized
- **Sticky headers** - 120px fixed height with scroll shadow
- **Bottom sheets** - Standard modal pattern with safe area handling
- **Role-based UI** - Different badge colors per user role

See [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) for complete styling guidelines.

---

*Last updated: January 2025*
