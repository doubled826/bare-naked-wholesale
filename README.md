# Bare Naked Pet Co. - Wholesale Portal

A modern wholesale portal for Bare Naked Pet Co. retailers, featuring a responsive sidebar navigation, product catalog, order management, and account settings.

## Features

- **Dashboard** - Overview of orders, analytics, and quick actions
- **Product Catalog** - Browse products with search/filter, add to cart, checkout
- **Order History** - View past orders with expandable details and profit analytics
- **Account Settings** - Manage business profile and security settings

## Design

- Mobile-first responsive design with collapsible sidebar
- Bare Naked Pet Co. brand colors (warm cream backgrounds, dark brown accents)
- Clean, modern UI with smooth animations

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Database**: Supabase
- **Authentication**: Supabase Auth
- **Email**: Nodemailer

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd bare-naked-wholesale-portal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your Supabase and SMTP credentials.

4. Set up the database:
   - Create a new Supabase project
   - Run the SQL in `supabase-schema.sql` in the Supabase SQL editor

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/
│   ├── (auth)/           # Auth pages (login, signup, forgot-password)
│   ├── (dashboard)/      # Dashboard pages with sidebar
│   │   ├── dashboard/    # Main dashboard
│   │   ├── catalog/      # Product catalog & cart
│   │   ├── orders/       # Order history
│   │   └── account/      # Account settings
│   ├── api/              # API routes
│   ├── globals.css       # Global styles
│   └── layout.tsx        # Root layout
├── components/
│   └── layout/
│       └── Sidebar.tsx   # Sidebar & mobile header
├── lib/
│   ├── store.ts          # Zustand store
│   ├── supabase.ts       # Supabase client
│   └── utils.ts          # Utility functions
├── types/
│   └── index.ts          # TypeScript types
└── ...config files
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `ORDER_EMAIL_TO` | Email for order notifications |
| `NEXT_PUBLIC_LOGO_URL` | Optional logo URL |

## Deployment

Deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## License

Private - Bare Naked Pet Co.
