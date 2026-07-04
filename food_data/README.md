# CoFID Food Nutrition Database Package

Generated from: `McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx`  
Generated at UTC: 2026-07-04T02:07:43Z

## Main files

- `cofid_food_database.sqlite` — the main app-ready database.
- `foods_core_app.csv` — simple table for calorie/macro tracking.
- `foods.csv` — food identity and source metadata.
- `nutrient_definitions.csv` — every nutrient column definition.
- `nutrient_values.csv` — complete long-form nutrient values.
- `foods_wide_all_nutrients_numeric.csv` — every nutrient as a wide numeric column.
- `factor_definitions.csv` / `factor_values.csv` — CoFID factor data.
- `schema_and_app_notes.json` — field mapping and app notes.
- `schema.sql` — SQL schema.

## Counts

- Foods: 2,887
- Original duplicate food codes preserved: 1 code(s): 13-669
- Nutrient definitions: 275
- Nonblank nutrient values: 235,152
- Food groups: 121
- Factor definitions: 5
- Nonblank factor values: 5,188

## Important

Use `food_id` as the unique primary key in your app. `food_code` is the original CoFID code and is preserved, but at least one source code appears more than once, so it should not be treated as unique.

## Value rules

- `Tr` = trace. Stored as `numeric_value = 0`, `value_qualifier = trace`, `is_trace = 1`.
- `N` = present but no reliable amount. Stored as `numeric_value = NULL`, `value_qualifier = present_amount_unknown`.
- Blank cells are omitted from the long `nutrient_values` table.

## Quick SQL

```sql
SELECT food_id, food_name, energy_kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g
FROM foods_core
WHERE food_name LIKE '%chicken%'
ORDER BY protein_g_per_100g DESC
LIMIT 25;
```
