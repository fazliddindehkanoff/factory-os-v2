# Factory OS v2

Factory OS v2 is a multilingual operations workspace for managing factory requests, procurement, suppliers, warehouses, users, roles, and permissions.

## Features

- Uzbek, Russian, and Turkish interfaces
- Role-based access control with configurable multi-role users
- Order creation and operational order tracking
- Procurement quotation comparison and supplier selection
- Supplier directory management
- Responsive desktop and mobile layouts

## Getting Started

Install dependencies and start the development server:

```bash
npm ci
npm run db:setup
npm run dev
```

Open [http://localhost:3000/uz/dashboard](http://localhost:3000/uz/dashboard).

## Database

Local development uses SQLite through Drizzle ORM and libSQL. The default database is created at `data/factory-os.sqlite` and is intentionally ignored by Git.

Copy `.env.example` to `.env.local` if you want to override the database location:

```bash
DATABASE_URL=file:data/factory-os.sqlite
SEED_DEFAULT_PASSWORD=FactoryOS123!
```

Database commands:

```bash
npm run db:generate  # Generate a migration after schema changes
npm run db:migrate   # Apply pending migrations
npm run db:seed      # Insert missing demo and workflow records
npm run db:check     # Verify the expected seed and workflow structure
npm run db:studio    # Open Drizzle Studio
```

The seed command is idempotent and can be run repeatedly. Cloudflare D1 and PostgreSQL adapters will be added in later backend phases; domain and workflow code should not depend directly on a deployment provider.

The development seed assigns the password configured by `SEED_DEFAULT_PASSWORD` to users that do not have a password yet. The fallback development password is `FactoryOS123!`; set a private value before seeding any shared or production environment. For example, sign in with `admin` and the configured seed password.

## Validation

```bash
npm test
npm run lint
npm run build
```
