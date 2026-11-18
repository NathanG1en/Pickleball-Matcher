import postgres from "postgres";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run auth:reset-email <email>");
  process.exit(1);
}

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(connectionString);

async function run() {
  console.log(`Resetting auth connection for ${email}...`);
  const deletedAuth = await sql`
    DELETE FROM neon_auth.user WHERE lower(email) = ${email} RETURNING id, email
  `;
  const updatedAccounts = await sql`
    UPDATE public.player_accounts 
    SET email = NULL, email_verified = false 
    WHERE lower(email) = ${email} 
    RETURNING id, username
  `;
  await sql`
    DELETE FROM public.email_verification_tokens WHERE lower(email) = ${email}
  `;

  console.log(`✅ Removed ${deletedAuth.length} Neon Auth user record(s).`);
  if (updatedAccounts.length > 0) {
    console.log(
      `✅ Unlinked ${updatedAccounts.length} player account(s): ${updatedAccounts.map((a) => `@${a.username}`).join(", ")}`
    );
  } else {
    console.log("ℹ️ No player accounts were linked to this email.");
  }

  await sql.end();
}

run().catch((err) => {
  console.error("Error resetting auth connection:", err);
  process.exit(1);
});
