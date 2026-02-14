# BuilderPro - AI Website Builder SaaS

## Overview
A Website Builder SaaS application similar to Wix/Webflow. Users can create projects, build pages using drag-and-drop components, generate content with AI, export to ZIP, and submit projects for team review. Includes billing with Razorpay integration.

## Architecture
- **Frontend**: React + TypeScript + TailwindCSS + shadcn/ui + wouter routing
- **Backend**: Express.js API server
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Passport.js with email/password (session-based)
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **Export**: JSZip for generating static site ZIPs
- **Payments**: Razorpay (works without keys in mock mode)

## Key Pages
- `/` - Landing page
- `/login` - Sign in
- `/signup` - Create account
- `/dashboard` - Project management (protected)
- `/builder/:projectId` - 3-column builder (protected)
- `/billing` - Plans & payment (protected)
- `/submissions` - User's submissions (protected)
- `/admin/submissions` - Admin review panel (protected, admin only)

## Database Tables
- `users` - Auth with email/password, role (user/admin)
- `projects` - User projects with JSONB schema
- `subscriptions` - Pro plan status, Razorpay integration
- `ai_usage` - Daily AI call tracking
- `submissions` - Project submissions for team review

## API Routes
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Current user + subscription
- `GET/POST/PATCH/DELETE /api/projects` - Project CRUD
- `POST /api/ai` - AI block generation (3/day free, unlimited pro)
- `POST /api/razorpay/order` - Create Razorpay order
- `POST /api/razorpay/verify` - Verify payment signature
- `POST /api/razorpay/webhook` - Razorpay webhook handler
- `GET /api/export/:projectId` - Export project as ZIP (pro only)
- `GET/POST /api/submissions` - User submissions
- `GET/PATCH /api/admin/submissions` - Admin submission management

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `RAZORPAY_KEY_ID` - Razorpay test key (optional)
- `RAZORPAY_KEY_SECRET` - Razorpay test secret (optional)
- `RAZORPAY_WEBHOOK_SECRET` - Razorpay webhook secret (optional)

## Builder Component Types
hero, section, heading, text, button, image, divider, spacer, features

## Automation Scripts (automation/)
- `reset-ai-usage.ts` - Daily AI usage reset
- `check-subscriptions.ts` - Expire overdue subscriptions
- `cleanup-pending-payments.ts` - Fail stale pending payments
- `index.ts` - Entry runner (uses JOB_NAME env var)

## Admin Setup
To make a user admin: `UPDATE users SET role='admin' WHERE email='admin@example.com';`
