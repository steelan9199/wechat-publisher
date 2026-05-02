import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractData() {
  const args = process.argv.slice(2);
  const jsonFilePath = args[0];

  if (!jsonFilePath) {
    console.error("Please provide a JSON file path as an argument");
    process.exit(1);
  }

  const fileContent = await fs.readFile(jsonFilePath, "utf8");
  const data = JSON.parse(fileContent);
  const jsonFileDir = path.dirname(jsonFilePath);

  for (const [key, value] of Object.entries(data)) {
    const outputPath = path.join(jsonFileDir, `${key}.md`);
    await fs.writeFile(outputPath, value, "utf8");
    console.log(`Created: ${outputPath}`);
  }
}

extractData();
