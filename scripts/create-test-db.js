import postgres from "postgres";

const adminUrl = process.env.DATABASE_URL || "postgresql://postgres@127.0.0.1:54322/postgres";
const testDbName = "test_db";

const sql = postgres(adminUrl, { max: 1 });
try {
  await sql.unsafe(`CREATE DATABASE ${testDbName};`);
  console.log(`Created database ${testDbName}`);
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "42P04") {
    console.log(`Database ${testDbName} already exists`);
  } else {
    throw error;
  }
} finally {
  await sql.end();
}
