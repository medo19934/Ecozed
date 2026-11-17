// Runs in each e2e worker before modules load.
process.env.NODE_ENV = 'test';
process.env.SUPER_ADMIN_EMAILS = 'boss@latif.test';
process.env.AUTH_DEV_LOGIN = 'false';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://latif:latif@localhost:5432/latif_kids_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
