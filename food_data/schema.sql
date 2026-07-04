CREATE INDEX idx_core_energy ON foods_core(energy_kcal_per_100g)

CREATE INDEX idx_core_group ON foods_core(group_code)

CREATE INDEX idx_core_name ON foods_core(food_name)

CREATE INDEX idx_core_protein ON foods_core(protein_g_per_100g)

CREATE INDEX idx_foods_code ON foods(food_code)

CREATE INDEX idx_foods_group ON foods(group_code)

CREATE INDEX idx_foods_name ON foods(food_name)

CREATE INDEX idx_nd_code ON nutrient_definitions(nutrient_code)

CREATE INDEX idx_nv_food ON nutrient_values(food_id)

CREATE INDEX idx_nv_numeric ON nutrient_values(numeric_value)

CREATE INDEX idx_nv_nutrient ON nutrient_values(nutrient_id)

CREATE TABLE app_custom_foods(id TEXT PRIMARY KEY,name TEXT NOT NULL,brand TEXT,barcode TEXT,serving_size REAL,serving_unit TEXT DEFAULT 'g',calories_per_100g REAL,protein_g_per_100g REAL,carbs_g_per_100g REAL,fat_g_per_100g REAL,sugars_g_per_100g REAL,fibre_g_per_100g REAL,salt_g_per_100g REAL,source TEXT DEFAULT 'custom',created_at TEXT,updated_at TEXT)

CREATE TABLE app_food_logs(id TEXT PRIMARY KEY,date TEXT NOT NULL,meal_type TEXT,food_source TEXT NOT NULL,food_id TEXT,custom_food_id TEXT,amount REAL NOT NULL,unit TEXT NOT NULL DEFAULT 'g',calories REAL,protein_g REAL,carbs_g REAL,fat_g REAL,notes TEXT,created_at TEXT)

CREATE TABLE app_meal_items(id TEXT PRIMARY KEY,meal_id TEXT NOT NULL,food_source TEXT NOT NULL,food_id TEXT,custom_food_id TEXT,amount REAL NOT NULL,unit TEXT DEFAULT 'g')

CREATE TABLE app_meals(id TEXT PRIMARY KEY,name TEXT NOT NULL,servings REAL DEFAULT 1,notes TEXT,created_at TEXT,updated_at TEXT)

CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT)

CREATE TABLE factor_definitions(factor_key TEXT PRIMARY KEY,factor_name TEXT NOT NULL,source_sheet TEXT,column_index INTEGER)

CREATE TABLE factor_values(food_id TEXT NOT NULL,factor_key TEXT NOT NULL,raw_value TEXT,numeric_value REAL,value_qualifier TEXT,PRIMARY KEY(food_id,factor_key))

CREATE TABLE food_groups(group_code TEXT PRIMARY KEY,food_count INTEGER NOT NULL,example_foods TEXT)

CREATE TABLE foods(food_id TEXT PRIMARY KEY,food_code TEXT NOT NULL,duplicate_code_sequence INTEGER,source_row_index INTEGER,food_name TEXT NOT NULL,search_name TEXT,description TEXT,group_code TEXT,previous_code TEXT,main_data_references TEXT,footnote TEXT,source TEXT DEFAULT 'CoFID 2021')

CREATE TABLE foods_core(food_id TEXT PRIMARY KEY,food_code TEXT NOT NULL,duplicate_code_sequence INTEGER,source_row_index INTEGER,food_name TEXT NOT NULL,description TEXT,group_code TEXT,previous_code TEXT,main_data_references TEXT,footnote TEXT,
water_g_per_100g REAL,energy_kcal_per_100g REAL,energy_kj_per_100g REAL,protein_g_per_100g REAL,fat_g_per_100g REAL,carbs_g_per_100g REAL,starch_g_per_100g REAL,sugars_g_per_100g REAL,glucose_g_per_100g REAL,fructose_g_per_100g REAL,sucrose_g_per_100g REAL,lactose_g_per_100g REAL,alcohol_g_per_100g REAL,fibre_nsp_g_per_100g REAL,fibre_aoac_g_per_100g REAL,fibre_g_per_100g REAL,saturated_fat_g_per_100g REAL,monounsaturated_fat_g_per_100g REAL,polyunsaturated_fat_g_per_100g REAL,trans_fat_g_per_100g REAL,cholesterol_mg_per_100g REAL,sodium_mg_per_100g REAL,salt_g_per_100g REAL,potassium_mg_per_100g REAL,calcium_mg_per_100g REAL,magnesium_mg_per_100g REAL,phosphorus_mg_per_100g REAL,iron_mg_per_100g REAL,copper_mg_per_100g REAL,zinc_mg_per_100g REAL,selenium_ug_per_100g REAL,iodine_ug_per_100g REAL,vitamin_a_retinol_ug_per_100g REAL,vitamin_d_ug_per_100g REAL,vitamin_e_mg_per_100g REAL,vitamin_k1_ug_per_100g REAL,thiamin_mg_per_100g REAL,riboflavin_mg_per_100g REAL,niacin_mg_per_100g REAL,vitamin_b6_mg_per_100g REAL,vitamin_b12_ug_per_100g REAL,folate_ug_per_100g REAL,vitamin_c_mg_per_100g REAL,source TEXT DEFAULT 'CoFID 2021')

CREATE VIRTUAL TABLE foods_fts USING fts5(food_id UNINDEXED, food_code UNINDEXED, food_name, description, group_code, content='')

CREATE TABLE 'foods_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID

CREATE TABLE 'foods_fts_data'(id INTEGER PRIMARY KEY, block BLOB)

CREATE TABLE 'foods_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB)

CREATE TABLE 'foods_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID

CREATE TABLE nutrient_definitions(nutrient_id INTEGER PRIMARY KEY,nutrient_key TEXT UNIQUE NOT NULL,nutrient_code TEXT,nutrient_name TEXT,display_header TEXT,unit TEXT,value_basis TEXT,source_sheet TEXT,source_sheet_no TEXT,column_index INTEGER,wide_column TEXT)

CREATE TABLE nutrient_values(food_id TEXT NOT NULL,nutrient_id INTEGER NOT NULL,raw_value TEXT,numeric_value REAL,value_qualifier TEXT,is_trace INTEGER DEFAULT 0,PRIMARY KEY(food_id,nutrient_id))

CREATE TABLE source_notes(note_id INTEGER PRIMARY KEY,note_text TEXT NOT NULL)

CREATE TABLE source_tables(table_id INTEGER PRIMARY KEY,table_no TEXT,title TEXT NOT NULL)