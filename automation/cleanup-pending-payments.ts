import pg from "pg";

export async function cleanupPendingPayments() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(
      "UPDATE subscriptions SET status = 'failed', updated_at = NOW() WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes'"
    );
    console.log(`Pending payments cleanup completed. Failed: ${result.rowCount || 0}`);
  } catch (err) {
    console.error("Error cleaning up pending payments:", err);
    throw err;
  } finally {
    await pool.end();
  }
}
