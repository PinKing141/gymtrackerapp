import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(repoRoot, "food_data");
const outputDir = path.join(repoRoot, "public", "data");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function rowsToObjects(rows) {
  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildFood(row) {
  const groupCode = row.group_code || "";
  return {
    food_id: row.food_id,
    food_code: row.food_code,
    food_name: row.food_name,
    food_group: groupCode ? `CoFID group ${groupCode}` : "CoFID",
    food_group_code: groupCode,
    calories_per_100g: numberOrNull(row.energy_kcal_per_100g),
    protein_per_100g: numberOrNull(row.protein_g_per_100g),
    carbs_per_100g: numberOrNull(row.carbs_g_per_100g),
    fat_per_100g: numberOrNull(row.fat_g_per_100g),
    sugar_per_100g: numberOrNull(row.sugars_g_per_100g),
    fibre_per_100g: numberOrNull(row.fibre_g_per_100g),
    salt_per_100g: numberOrNull(row.salt_g_per_100g),
    sodium_per_100g: numberOrNull(row.sodium_mg_per_100g),
    sodium_mg_per_100g: numberOrNull(row.sodium_mg_per_100g),
    source: "cofid",
  };
}

async function main() {
  const [foodsCsv, groupsCsv] = await Promise.all([
    readFile(path.join(sourceDir, "foods_core_app.csv"), "utf8"),
    readFile(path.join(sourceDir, "food_groups.csv"), "utf8"),
  ]);

  const foods = rowsToObjects(parseCsv(foodsCsv)).map(buildFood);
  const foodGroups = rowsToObjects(parseCsv(groupsCsv)).map((row) => ({
    group_code: row.group_code,
    food_count: Number(row.food_count) || 0,
    example_foods: row.example_foods || "",
  }));

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "foods_core_app.json"), `${JSON.stringify(foods)}\n`),
    writeFile(path.join(outputDir, "food_groups.json"), `${JSON.stringify(foodGroups, null, 2)}\n`),
  ]);

  console.log(`Wrote ${foods.length} foods and ${foodGroups.length} food groups to public/data.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
