INSERT INTO public.users (id, username, password)
VALUES (
  'e1a9c1e0-827b-4573-b391-7f8f9e68c5b1',
  'pemilik',
  '$2b$10$fUDDuAPo9dObo/LQfz4oA.i8WpGr0xnL3NLJRqyg2BkHfFhzQ8cVC'
);

NOTIFY pgrst, 'reload schema';
