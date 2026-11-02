// Downloads the large reference files that used to live in the repo, so a
// normal clone stays small. None of them are needed to build or run the app.
//
//   node scripts/fetch-reference-assets.mjs          # everything
//   node scripts/fetch-reference-assets.mjs ai       # shot-tracking assets only
//   node scripts/fetch-reference-assets.mjs food     # full CoFID dataset only
//
// Files come from the last commit that still contained them, so the bytes are
// exactly what was removed. Existing files are left alone.
import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const SOURCE_COMMIT = "c26ddde674ff35911da511455faee9afb4d00efd";
const BASE_URL = `https://raw.githubusercontent.com/PinKing141/gymtrackerapp/${SOURCE_COMMIT}`;

const GROUPS = {
  // Test video and YOLOv8 weights from the Python prototype. The weights came
  // from github.com/avishah3/AI-Basketball-Shot-Detector-Tracker, which has no
  // licence, so they are for local experiments only — don't ship them.
  ai: [
    "ai/reference-python-detector/video_test_5.mp4",
    "ai/reference-python-detector/best.pt",
  ],
  // Full CoFID 2021 export. The app only needs foods_core_app.csv and
  // food_groups.csv (kept in the repo); these are the complete dataset.
  food: [
    "food_data/cofid_food_database.sqlite",
    "food_data/nutrient_values.csv",
    "food_data/foods_wide_all_nutrients_numeric.csv",
    "food_data/foods.csv",
    "food_data/nutrient_definitions.csv",
    "food_data/factor_values.csv",
    "food_data/factor_definitions.csv",
  ],
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requested = process.argv.slice(2);
const groups = requested.length ? requested : Object.keys(GROUPS);

for (const group of groups) {
  if (!GROUPS[group]) {
    console.error(`Unknown group "${group}". Use one of: ${Object.keys(GROUPS).join(", ")}`);
    process.exit(1);
  }
}

for (const file of groups.flatMap((group) => GROUPS[group])) {
  const target = path.join(repoRoot, file);
  const exists = await access(target).then(() => true, () => false);
  if (exists) {
    console.log(`skip  ${file} (already present)`);
    continue;
  }

  const response = await fetch(`${BASE_URL}/${file}`);
  if (!response.ok || !response.body) {
    console.error(`fail  ${file} (HTTP ${response.status})`);
    process.exitCode = 1;
    continue;
  }

  await mkdir(path.dirname(target), { recursive: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  console.log(`saved ${file}`);
}
