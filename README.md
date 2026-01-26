# Bare Naked Pet Co. - Wholesale Portal Deployment Guide

## Quick Start (30 minutes to deploy)

### Prerequisites
- Node.js 18+ installed
- Git installed
- GitHub account
- Vercel account (free)
- Supabase account (free)

---

## Step 1: Set Up Supabase (10 minutes)

### 1.1 Create Supabase Project
1. Go to https://supabase.com
2. Click "Start your project"
3. Create new organization (or use existing)
4. Click "New Project"
   - Name: `bare-naked-wholesale`
   - Database Password: (generate strong password - save this!)
   - Region: Choose closest to you
5. Wait 2-3 minutes for project to provision

### 1.2 Run Database Schema
1. In your Supabase project, go to "SQL Editor" (left sidebar)
2. Click "New Query"
3. Copy entire contents of `supabase-schema.sql`
4. Paste into editor
5. Click "Run" (bottom right)
6. You should see "Success. No rows returned"

### 1.3 Set Up Authentication
1. Go to "Authentication" > "Providers" (left sidebar)
2. Enable "Email" provider (should be on by default)
3. Go to "Authentication" > "URL Configuration"
4. Site URL: `http://localhost:3000` (we'll update this after Vercel deployment)

### 1.4 Get API Keys
1. Go to "Project Settings" > "API" (left sidebar)
2. Copy these values (you'll need them for Vercel):
   - Project URL (looks like: `https://xxxxx.supabase.co`)
   - `anon` `public` key
   - `service_role` `secret` key (⚠️ keep this secret!)

---

## Step 2: Set Up Email (5 minutes)

### Option A: Using Gmail (Recommended for testing)
1. Go to your Google Account settings
2. Enable 2-factor authentication (if not already)
3. Go to Security > 2-Step Verification > App passwords
4. Generate new app password for "Mail"
5. Save this password - you'll need it for Vercel

### Option B: Using SendGrid (Better for production)
1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Create API key
3. Verify sender email (info@barenakedpet.com)

---

## Step 3: Deploy to Vercel (10 minutes)

### 3.1 Prepare Code
1. Download this entire `wholesale-portal-deploy` folder
2. Create new GitHub repository:
   ```bash
   cd wholesale-portal-deploy
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/bare-naked-wholesale.git
   git push -u origin main
   ```

### 3.2 Deploy to Vercel
1. Go to https://vercel.com
2. Click "Add New" > "Project"
3. Import your GitHub repository
4. Framework Preset: "Next.js" (should auto-detect)
5. **Before clicking Deploy**, add Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_from_supabase
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_supabase
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_gmail_app_password
ORDER_EMAIL_TO=info@barenakedpet.com
ORDER_EMAIL_FROM=noreply@barenakedpet.com
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

6. Click "Deploy"
7. Wait 2-3 minutes for build to complete

### 3.3 Update Supabase URL Configuration
1. Once deployed, copy your Vercel URL (e.g., `https://bare-naked-wholesale.vercel.app`)
2. Go back to Supabase > Authentication > URL Configuration
3. Update Site URL to your Vercel URL
4. Add to Redirect URLs: `https://your-app.vercel.app/**`

---

## Step 4: Create First User Account (5 minutes)

### Option A: Via Supabase Dashboard (Easiest)
1. Go to Supabase > Authentication > Users
2. Click "Add user" > "Create new user"
3. Email: test@petstore.com
4. Password: (create one)
5. Click "Create user"
6. Go to SQL Editor, run:
```sql
INSERT INTO retailers (id, business_name, business_address, phone, account_number)
VALUES (
  'USER_ID_FROM_AUTH_TABLE',
  'Test Pet Store',
  '123 Main St, City, ST 12345',
  '555-1234',
  'WHL-0001'
);
```

### Option B: Via Email Signup (Production)
- When ready for real users, enable email confirmation
- Users apply via mailto link on login page
- You manually create accounts via Supabase dashboard

---

## Step 5: Test Everything (5 minutes)

1. Go to your Vercel URL
2. Login with test account
3. Try adding products to cart
4. Submit test order
5. Check:
   - ✅ Order appears in Order History
   - ✅ Email sent to info@barenakedpet.com
   - ✅ Confirmation email sent to customer
   - ✅ Order saved in Supabase database

---

## Custom Domain Setup (Optional)

### Point wholesale.barenakedpet.com to Vercel

1. In Vercel project settings > Domains
2. Add domain: `wholesale.barenakedpet.com`
3. Add DNS records to your domain registrar:
   ```
   Type: CNAME
   Name: wholesale
   Value: cname.vercel-dns.com
   ```
4. Wait for DNS propagation (5-60 minutes)

---

## Troubleshooting

### Login not working
- Check Supabase Site URL matches your Vercel URL
- Verify email/password are correct
- Check browser console for errors

### Images not loading
- Images currently use Shopify CDN (should work)
- To use uploaded images: Upload to Supabase Storage > Update product image URLs

### Emails not sending
- Verify SMTP credentials in Vercel env vars
- Check Gmail app password is correct
- Look at Vercel logs for error messages

### Orders not saving
- Check Supabase logs (Logs & Extensions > Logs)
- Verify RLS policies are correct
- Check user is authenticated

---

## Next Steps

### Production Checklist
- [ ] Update all test credentials to production values
- [ ] Enable email confirmation for new signups
- [ ] Set up proper domain (wholesale.barenakedpet.com)
- [ ] Upload product images to Supabase Storage
- [ ] Create real retailer accounts
- [ ] Set up monitoring/alerts for failed orders
- [ ] Configure backup email service (SendGrid)
- [ ] Add Google Analytics (optional)

### Maintenance
- Monitor Supabase dashboard for new orders
- Check email delivery regularly
- Backup database monthly (Supabase auto-backs up daily)
- Update product prices/catalog as needed

---

## Support

**Need help?** Common issues:
- Environment variables not set correctly
- Supabase RLS policies blocking queries
- Email authentication failing
- DNS not propagating

Check Vercel logs and Supabase logs for specific error messages.

---

## Files Overview

```
wholesale-portal-deploy/
├── app/
│   ├── api/orders/route.ts    # Order submission & email API
│   ├── page.tsx                # Main portal UI
│   └── layout.tsx              # Root layout
├── supabase-schema.sql         # Database schema
├── package.json                # Dependencies
├── next.config.js              # Next.js config
├── .env.example                # Environment variables template
└── README.md                   # This file
```

---

## Cost Breakdown

- **Supabase Free Tier**: 500MB database, 1GB file storage, 2GB bandwidth
- **Vercel Free Tier**: 100GB bandwidth, unlimited deployments
- **Total**: $0/month for up to moderate usage

When you exceed free tier:
- Supabase Pro: $25/month
- Vercel Pro: $20/month
