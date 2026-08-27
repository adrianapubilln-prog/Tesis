/*
# Allow invited business users without an auth account yet

1. Changes
- `business_users.auth_user_id` is now nullable so the business owner can add
  employees/contador entries during onboarding before those people create their
  own auth account. When the person later signs up with the same email, the row
  can be linked (future work).
2. Security
- RLS policies already scope by business ownership, no policy changes needed.
- The unique constraint on `email` remains so each email is only listed once.
*/

ALTER TABLE business_users ALTER COLUMN auth_user_id DROP NOT NULL;
