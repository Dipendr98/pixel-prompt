import pg from "pg";

export async function checkSubscriptions() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(
      "UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE status = 'active' AND current_period_end < NOW()"
    );
    const count = result.rowCount || 0;
    console.log(`Subscription check completed. Expired: ${count}`);
    if (count > 10) {
      console.warn(`WARNING: ${count} subscriptions expired in one run!`);
    }
  } catch (err) {
    console.error("Error checking subscriptions:", err);
    throw err;
  } finally {
    await pool.end();
  }
}
