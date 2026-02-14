import pg from "pg";

export async function resetAIUsage() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query("DELETE FROM ai_usage WHERE day < CURRENT_DATE");
    console.log(`AI usage reset completed. Rows deleted: ${result.rowCount}`);
  } catch (err) {
    console.error("Error resetting AI usage:", err);
    throw err;
  } finally {
    await pool.end();
  }
}
