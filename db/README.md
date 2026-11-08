# Database migrations

Tiger Data is the shared server-side PostgreSQL database. Add every schema change
as a new timestamped SQL file under `migrations/`. Never edit a migration after
it has been shared or applied.

Run all pending migrations with:

```bash
npm run db:migrate
```

The runner records applied filenames in `schema_migrations` and executes each
new file in a transaction. `DATABASE_URL` must exist in `.env.local` locally and
in the Vercel project environment for deployed code.

The catalog owner supplies a separate `*_catalog.sql` migration for stores,
foods, products, and the price-observations hypertable. Keep that file unchanged.
