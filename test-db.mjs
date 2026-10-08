import db from "./db.js";

try {
  await db.connect(); 
  const result = await db.query("SELECT NOW()");
  console.log("PostgreSQL connected!");
  console.log("Database time:", result.rows[0].now);
} catch (error) {
  console.error("PostgreSQL connection failed:");
  console.error(error.message);
} finally {
  await db.end();
}