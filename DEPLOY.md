# BuilderPro - Deployment & AI Setup Guide

Complete guide for deploying BuilderPro and setting up the AI assistant with real AI capabilities.

---

## Table of Contents

1. [Quick Deploy on Replit](#quick-deploy-on-replit)
2. [Deploy on Your Own Server](#deploy-on-your-own-server)
3. [Setting Up AI Assistant with OpenAI](#setting-up-ai-assistant-with-openai)
4. [Setting Up AI with Other Providers](#setting-up-ai-with-other-providers)
5. [Razorpay Payment Setup](#razorpay-payment-setup)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Production Checklist](#production-checklist)

---

## Quick Deploy on Replit

BuilderPro is built to run on Replit with zero configuration.

### Steps:

1. **Click the "Publish" button** in the Replit workspace
2. Replit handles building, hosting, TLS certificates, and health checks automatically
3. Your app will be available at `https://your-app-name.replit.app`

### Custom Domain:
- In Replit, go to the deployment settings
- Add your custom domain and follow the DNS configuration instructions
- Replit automatically provisions SSL certificates

### Database:
- The built-in PostgreSQL database is already configured via `DATABASE_URL`
- Database persists across deployments

---

## Deploy on Railway with Supabase

BuilderPro (PixelPrompt) can be easily hosted on Railway with a Supabase PostgreSQL database. This is the recommended production setup.

### Step 1: Set up Supabase (Database)
1. Go to [supabase.com](https://supabase.com/) and create a new project.
2. Once the database is provisioned, go to **Project Settings -> Database**.
3. Locate the **Connection String** (Node.js/URI format).
4. It should look like: \`postgresql://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres\`
5. Make sure to replace \`[password]\` with your actual database password.

### Step 2: Prepare Railway
1. Push your local codebase to a GitHub repository.
2. Go to [railway.app](https://railway.app/) and click **New Project**.
3. Select **Deploy from GitHub repo** and choose your repository.
4. Once the service is created, DO NOT deploy yet. Head to the **Variables** tab.

### Step 3: Configure Environment Variables
Add the following variables in Railway's Settings -> Variables:
- \`DATABASE_URL\`: Your Supabase connection string from Step 1.
- \`NODE_ENV\`: \`production\`
- \`SESSION_SECRET\`: A long random string (e.g., \`my_super_secret_key_32_chars_long\`).
- \`NVIDIA_API_KEY\`: Your NVIDIA API key for the AI functionality.
- \`GITHUB_TOKEN\`: (Optional) Your GitHub Personal Access Token for the tertiary fallback AI model.
- \`RAZORPAY_KEY_ID\`: Your Razorpay Key ID.
- \`RAZORPAY_KEY_SECRET\`: Your Razorpay Secret.
- \`RAZORPAY_WEBHOOK_SECRET\`: Your Razorpay Webhook Secret.
- \`SMTP_HOST\`, \`SMTP_PORT\`, \`SMTP_SECURE\`, \`SMTP_USER\`, \`SMTP_PASS\`: Your Nodemailer SMTP email configuration.
- \`ADMIN_EMAIL\`: Where you want to receive admin notifications.

### Step 4: Build Command
1. Railway automatically reads \`package.json\`.
2. Under **Settings -> Build**, ensure the Build Command is: \`npm run build\`
3. Under **Settings -> Deploy**, ensure the Start Command is: \`npm run start\`

### Step 5: Deploy & Custom Domain
1. Trigger a deployment. Railway will install dependencies, build the Vite frontend, and start the Express server.
2. Under **Settings -> Networking**, click **Generate Domain** to get your public \`.up.railway.app\` URL.
3. If using your custom domain (\`pixel-prompt.app\`), click **Custom Domain**, enter \`pixel-prompt.app\`, and add the generated CNAME record to your DNS settings (e.g., in Namecheap/GoDaddy).
4. **Important**: Go to your Razorpay dashboard and update your Webhook URL to: \`https://pixel-prompt.app/api/webhooks/razorpay\`

---

## Deploy on Your Own Server

### Prerequisites:
- Node.js 18+ installed
- PostgreSQL database
- A server (VPS, cloud instance, etc.)

### Steps:

1. **Clone the repository** and install dependencies:
```bash
git clone <your-repo-url>
cd builderpro
npm install
```

2. **Set environment variables** (create a `.env` file):
```env
DATABASE_URL=postgresql://user:password@host:5432/builderpro
SESSION_SECRET=your-random-secret-key-at-least-32-chars
NODE_ENV=production
PORT=5000

# Optional - AI (see AI setup section)
OPENAI_API_KEY=sk-your-openai-api-key

# Optional - Payments
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
```

3. **Build and start**:
```bash
npm run build
npm start
```

4. **Set up a reverse proxy** (Nginx example):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

5. **Set up SSL** with Let's Encrypt:
```bash
sudo certbot --nginx -d yourdomain.com
```

### Docker Deployment (Alternative):
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

### Using PM2 for Process Management:
```bash
npm install -g pm2
pm2 start npm --name "builderpro" -- start
pm2 save
pm2 startup
```

---

## Setting Up AI Assistant with OpenAI

The AI assistant currently uses a mock/template system that generates blocks based on keywords. To enable real AI-powered content generation using OpenAI:

### Step 1: Get an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to **API Keys** in the sidebar
4. Click **Create new secret key**
5. Copy the key (starts with `sk-`)

### Step 2: Add the API Key

**On Replit:**
- Go to the "Secrets" tab in your Replit workspace
- Add a new secret: Key = `OPENAI_API_KEY`, Value = your API key

**On your own server:**
- Add to your `.env` file:
```env
OPENAI_API_KEY=sk-your-openai-api-key
```

### Step 3: Modify the AI Route

Replace the `generateMockBlocks` function call in `server/routes.ts` with real OpenAI integration:

```typescript
// Add to the top of server/routes.ts
import OpenAI from "openai";

// In the POST /api/ai route, replace:
//   const blocks = generateMockBlocks(prompt);
// With:

const openaiKey = process.env.OPENAI_API_KEY;
let blocks;

if (openaiKey) {
  // Use real AI
  const openai = new OpenAI({ apiKey: openaiKey });

  const systemPrompt = `You are a website builder AI assistant. Generate website components as JSON arrays.
Each block must have: id (random 8-char string), type (one of: hero, navbar, footer, product-card, pricing-table, contact-form, testimonials, gallery, video, faq, stats, team, social-links, banner, countdown, newsletter, logo-cloud, cta, heading, text, button, image, divider, spacer, features, section), and props (object with component-specific properties).

Component prop structures:
- hero: { title, subtitle, buttonText }
- navbar: { brand, links: [{label, url}], ctaText }
- footer: { columns: [{title, links: [string]}], copyright }
- product-card: { products: [{name, price, description, image}] }
- pricing-table: { plans: [{name, price, features: [string], highlighted: boolean}] }
- contact-form: { title, subtitle, buttonText }
- testimonials: { testimonials: [{name, role, quote}] }
- gallery: { count: number }
- video: { url, height }
- faq: { title, items: [{question, answer}] }
- stats: { stats: [{value, label}] }
- team: { members: [{name, role, bio}] }
- social-links: { links: [{platform, url}] }
- banner: { text, linkText, variant: "info"|"warning"|"error" }
- countdown: { title, subtitle, targetDate }
- newsletter: { title, subtitle, buttonText }
- logo-cloud: { title, logos: [string] }
- cta: { title, subtitle, primaryButton, secondaryButton }
- heading: { text, align }
- text: { text, align }
- button: { text, url, align }
- image: { src, alt, height }
- features: { features: [{title, desc}] }

Respond with ONLY a valid JSON array of blocks. No explanation.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const responseText = completion.choices[0]?.message?.content || "[]";

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    blocks = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    blocks = generateMockBlocks(prompt); // Fallback to mock
  }
} else {
  // Fallback to mock/template system
  blocks = generateMockBlocks(prompt);
}
```

### Step 4: Install the OpenAI package

```bash
npm install openai
```

### Cost Estimation:
- GPT-4o-mini costs ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Each AI generation request uses roughly 500-1500 tokens
- Expected cost: ~$0.001-0.003 per request (very affordable)
- With 1000 users making 3 requests/day = ~$3-9/day

---

## Setting Up AI with Other Providers

### Google Gemini

1. Get API key from [ai.google.dev](https://ai.google.dev)
2. Install: `npm install @google/generative-ai`
3. Replace the OpenAI code block with:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const result = await model.generateContent(systemPrompt + "\n\nUser: " + prompt);
const responseText = result.response.text();
blocks = JSON.parse(responseText.match(/\[[\s\S]*\]/)?.[0] || "[]");
```

### Anthropic Claude

1. Get API key from [console.anthropic.com](https://console.anthropic.com)
2. Install: `npm install @anthropic-ai/sdk`
3. Replace with:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const message = await client.messages.create({
  model: "claude-3-5-haiku-20241022",
  max_tokens: 2000,
  system: systemPrompt,
  messages: [{ role: "user", content: prompt }],
});
const responseText = message.content[0].type === "text" ? message.content[0].text : "[]";
blocks = JSON.parse(responseText.match(/\[[\s\S]*\]/)?.[0] || "[]");
```

---

## Razorpay Payment Setup

### Step 1: Create Razorpay Account
1. Go to [razorpay.com](https://razorpay.com) and sign up
2. Complete KYC verification

### Step 2: Get API Keys
1. Go to **Settings > API Keys** in Razorpay Dashboard
2. Generate a new key pair
3. Copy the Key ID and Key Secret

### Step 3: Configure Environment
```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
```

### Step 4: Set Up Webhook (Optional)
1. In Razorpay Dashboard, go to **Settings > Webhooks**
2. Add webhook URL: `https://yourdomain.com/api/razorpay/webhook`
3. Select events: `payment.captured`, `payment.failed`
4. Copy the webhook secret and add to environment:
```env
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Test Mode:
- Use `rzp_test_` prefixed keys for testing
- Test card: 4111 1111 1111 1111
- The app works in mock mode without any Razorpay keys configured

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random string for session encryption (32+ chars) |
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `OPENAI_API_KEY` | No | OpenAI API key for real AI generation |
| `GEMINI_API_KEY` | No | Alternative: Google Gemini API key |
| `ANTHROPIC_API_KEY` | No | Alternative: Anthropic Claude API key |
| `RAZORPAY_KEY_ID` | No | Razorpay publishable key |
| `RAZORPAY_KEY_SECRET` | No | Razorpay secret key |
| `RAZORPAY_WEBHOOK_SECRET` | No | Razorpay webhook validation secret |

---

## Production Checklist

Before going live, ensure:

- [ ] **Environment variables** are all set (especially SESSION_SECRET)
- [ ] **Database** is properly configured and accessible
- [ ] **SSL/TLS** is enabled (HTTPS)
- [ ] **Session settings** use secure cookies in production
- [ ] **Admin account** is created: `UPDATE users SET role='admin' WHERE email='your@email.com';`
- [ ] **Razorpay** is configured with live keys (not test keys)
- [ ] **AI API key** is set if you want real AI generation
- [ ] **Backup strategy** is in place for the database
- [ ] **Rate limiting** is configured for API endpoints
- [ ] **CORS** settings are appropriate for your domain
- [ ] **Monitoring** is set up (error tracking, uptime monitoring)

### Security Notes:
- Never expose API keys in client-side code
- Use strong SESSION_SECRET (generate with `openssl rand -hex 32`)
- Enable HTTPS in production
- Keep dependencies updated
- Regularly backup your database

---

## Automation Scripts

Set up cron jobs for maintenance:

```bash
# Reset AI usage daily at midnight
0 0 * * * cd /path/to/app && JOB_NAME=reset-ai-usage npx tsx automation/index.ts

# Check expired subscriptions every hour
0 * * * * cd /path/to/app && JOB_NAME=check-subscriptions npx tsx automation/index.ts

# Clean up pending payments every 6 hours
0 */6 * * * cd /path/to/app && JOB_NAME=cleanup-pending-payments npx tsx automation/index.ts
```

---

## Support

For issues or questions:
- Check the support ticket system within the app
- Review `SETUP.md` for initial configuration
- Review `replit.md` for technical architecture details
