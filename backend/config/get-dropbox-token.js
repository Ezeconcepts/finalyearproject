/**
 * Run this script ONCE to get your Dropbox refresh token.
 * Usage:
 *   node config/get-dropbox-token.js
 *
 * Steps:
 *  1. It will print an authorization URL — open it in your browser
 *  2. Approve access in Dropbox
 *  3. Paste the code shown in the browser back into this terminal
 *  4. Copy the refresh_token printed at the end into config/.env
 */

require("dotenv").config({ path: "./config/.env" });
const readline = require("readline");

const APP_KEY = process.env.DROPBOX_APP_KEY;
const APP_SECRET = process.env.DROPBOX_APP_SECRET;

if (!APP_KEY || !APP_SECRET) {
  console.error(
    "❌ DROPBOX_APP_KEY and DROPBOX_APP_SECRET must be set in config/.env first."
  );
  process.exit(1);
}

const authUrl =
  `https://www.dropbox.com/oauth2/authorize` +
  `?client_id=${APP_KEY}` +
  `&response_type=code` +
  `&token_access_type=offline`;

console.log("\n👉 Open this URL in your browser and approve access:\n");
console.log(authUrl);
console.log();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("📋 Paste the authorization code here: ", async (code) => {
  rl.close();

  const credentials = Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString(
    "base64"
  );

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error("❌ Error:", data.error_description || data.error);
    process.exit(1);
  }

  console.log("\n✅ Success! Add these to your config/.env:\n");
  console.log(`DROPBOX_REFRESH_TOKEN=${data.refresh_token}`);
  console.log(
    "\nThe refresh token never expires. You won't need to do this again."
  );
});
