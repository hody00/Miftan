import { writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log("Existing .env preserved");
  process.exit(0);
}
const secret = () => randomBytes(32).toString("hex");
writeFileSync(
  ".env",
  `POSTGRES_PASSWORD=${secret()}\nADMIN_EMAIL=admin@localhost\nADMIN_PASSWORD=${secret()}\nAPP_URL=http://localhost:3000\nFACEBOOK_EMAIL=\nFACEBOOK_PASSWORD=\nCRAWL_INTERVAL_MINUTES=30\nMAX_SCROLLS=1000\nPORT=3000\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Created ignored .env with unique database and admin passwords. Add Facebook credentials locally.",
);
