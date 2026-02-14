# BuilderPro Setup Guide

## Quick Start

1. **Open the project in Replit** - The app runs automatically via `npm run dev`
2. **Visit the app** - Click the webview or navigate to the provided URL
3. **Create an account** - Go to `/signup` and register with email + password
4. **Start building** - Create a project from the dashboard and use the drag-and-drop builder

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-configured in Replit) |
| `SESSION_SECRET` | Yes | Secret key for session encryption |
| `RAZORPAY_KEY_ID` | No | Razorpay test key for payments |
| `RAZORPAY_KEY_SECRET` | No | Razorpay test secret for payments |
| `RAZORPAY_WEBHOOK_SECRET` | No | Razorpay webhook secret |

**Note:** The app works without Razorpay keys - payments will show a "not configured" message. All other features work fully.

## Setting Up Admin Access

To make a user an admin, run this SQL command in the database:

```sql
UPDATE users SET role='admin' WHERE email='your-admin-email@example.com';
```

Admin users can access:
- `/admin/submissions` - Full admin dashboard with stats
- View all user projects, manage submissions, reply to support tickets, see user list

## Features Overview

### For Users
- **Dashboard** (`/dashboard`) - Create and manage website projects
- **Builder** (`/builder/:id`) - Drag-and-drop website builder with:
  - 9 component types (hero, section, heading, text, button, image, divider, spacer, features)
  - AI Assistant for generating content blocks (3/day free, unlimited with Pro)
  - Properties panel for editing selected blocks
  - Auto-save, undo/redo
  - Click-to-add buttons on empty canvas
- **Billing** (`/billing`) - View plans, upgrade to Pro, cancel subscription
- **Submissions** (`/submissions`) - Submit projects for team review, track status
- **Support** (`/support`) - Create support tickets, view admin replies

### For Admins
- **Admin Panel** (`/admin/submissions`) - Full dashboard with:
  - Platform statistics (users, projects, subscriptions, tickets)
  - Manage project submissions (approve/reject)
  - Reply to support tickets
  - View all user projects
  - View all registered users

### Subscription Plans
| Feature | Free | Pro ($9/mo) |
|---------|------|-------------|
| Projects | Unlimited | Unlimited |
| Drag & Drop Builder | Yes | Yes |
| AI Calls | 3/day | Unlimited |
| Export to ZIP | No | Yes |
| Team Submissions | Yes | Yes |
| Support Tickets | Yes | Yes |

## Setting Up Razorpay (Optional)

1. Create a Razorpay account at https://razorpay.com
2. Get test API keys from Razorpay Dashboard > Settings > API Keys
3. Add the keys as environment secrets:
   - `RAZORPAY_KEY_ID` - Your test key ID
   - `RAZORPAY_KEY_SECRET` - Your test key secret
   - `RAZORPAY_WEBHOOK_SECRET` - (Optional) For webhook verification
4. The billing page will now allow real payment processing

## Automation Scripts

Background jobs for maintenance (run via `JOB_NAME` env var):

```bash
# Reset expired AI usage records
JOB_NAME=RESET_AI npx tsx automation/index.ts

# Expire overdue subscriptions
JOB_NAME=CHECK_SUBS npx tsx automation/index.ts

# Fail stale pending payments
JOB_NAME=CLEANUP_PAYMENTS npx tsx automation/index.ts
```

## Database Tables

- `users` - User accounts (email, password, role)
- `projects` - Website projects with JSONB schema
- `subscriptions` - Pro plan subscriptions
- `ai_usage` - Daily AI call tracking
- `submissions` - Project submissions for review
- `support_tickets` - User support tickets

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Current user info

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### AI & Export
- `POST /api/ai` - Generate AI content blocks
- `GET /api/export/:projectId` - Export project as ZIP (Pro only)

### Billing
- `POST /api/razorpay/order` - Create payment order
- `POST /api/razorpay/verify` - Verify payment
- `POST /api/subscription/cancel` - Cancel subscription

### Support
- `GET /api/support` - User's tickets
- `POST /api/support` - Create ticket

### Submissions
- `GET /api/submissions` - User's submissions
- `POST /api/submissions` - Submit project

### Admin (requires admin role)
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/submissions` - All submissions
- `PATCH /api/admin/submissions/:id` - Update submission status
- `GET /api/admin/tickets` - All support tickets
- `PATCH /api/admin/tickets/:id` - Reply to/update ticket
- `GET /api/admin/users` - All users
- `GET /api/admin/projects` - All projects
