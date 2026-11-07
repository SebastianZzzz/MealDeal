# Database changes

Add every database change as a new, timestamped file under `migrations/`. Never
edit a migration after it has been shared. Apply migrations in filename order in
the Supabase SQL editor, or with the Supabase CLI once the project is linked.

Feature owners should use separate migrations:

- B: stores, foods, products and Storage policies
- C: meal plans
- D: food resources, merchants, surplus listings and reservations
