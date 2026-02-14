# BuilderPro - AI Website Builder SaaS

## Overview
A Website Builder SaaS application similar to Wix/Webflow. Users can create projects, build pages using drag-and-drop components, generate content with AI, export to ZIP, and submit projects for team review. Includes billing with Razorpay integration, support ticket system, and comprehensive admin panel.

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
- `/billing` - Plans & payment with cancel option (protected)
- `/submissions` - User's submissions (protected)
- `/support` - Support tickets (protected)
- `/admin/submissions` - Full admin panel with stats, tickets, projects, users (protected, admin only)

## Database Tables
- `users` - Auth with email/password, role (user/admin)
- `projects` - User projects with JSONB schema
- `subscriptions` - Pro plan status, Razorpay integration
- `ai_usage` - Daily AI call tracking
- `submissions` - Project submissions for team review
- `support_tickets` - User support tickets with admin replies

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
- `POST /api/subscription/cancel` - Cancel subscription
- `GET /api/export/:projectId` - Export project as ZIP (pro only)
- `GET/POST /api/submissions` - User submissions
- `GET/POST /api/support` - User support tickets
- `GET/PATCH /api/admin/submissions` - Admin submission management
- `GET/PATCH /api/admin/tickets` - Admin ticket management
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/users` - All users
- `GET /api/admin/projects` - All projects
- `GET /api/admin/automations/logs` - Automation run history
- `POST /api/admin/automations/run` - Trigger automation job

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `RAZORPAY_KEY_ID` - Razorpay test key (optional)
- `RAZORPAY_KEY_SECRET` - Razorpay test secret (optional)
- `RAZORPAY_WEBHOOK_SECRET` - Razorpay webhook secret (optional)

## Builder Component Types
hero, section, heading, text, button, image, divider, spacer, features, navbar, footer, product-card, pricing-table, contact-form, testimonials, gallery, video, faq, stats, team, social-links, banner, countdown, newsletter, logo-cloud, cta

## Website Templates
Blank, E-Commerce Store, SaaS Landing, Portfolio, Restaurant, Agency - available during project creation

## Automation System
- Database table `automation_logs` tracks all job executions with status, messages, and triggered-by info
- Admin can trigger jobs manually from the Automations tab in admin panel
- API: `GET /api/admin/automations/logs`, `POST /api/admin/automations/run`
- Available jobs: reset_ai_usage, check_subscriptions, cleanup_pending_payments
- Legacy scripts in `automation/` directory for cron-based execution

## Admin Setup
To make a user admin: `UPDATE users SET role='admin' WHERE email='admin@example.com';`

## Setup Guide
Full setup instructions are in SETUP.md
