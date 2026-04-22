import { createClient } from "@supabase/supabase-js";
import { withDefaults } from "./storage.js";

export const CLOUD_TABLE = "gym_tracker_data";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

let client = null;

export const isCloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getCloudClient() {
  if (!isCloudConfigured) {
    return null;
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}

export async function fetchRemoteApp(userId) {
  const supabase = getCloudClient();
  if (!supabase || !userId) {
    return null;
  }

  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.payload) {
    return null;
  }

  return {
    app: withDefaults(data.payload),
    updatedAt: data.updated_at || null,
  };
}

export async function saveRemoteApp(userId, app) {
  const supabase = getCloudClient();
  if (!supabase || !userId) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .upsert(
      {
        user_id: userId,
        payload: app,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    )
    .select("updated_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    updatedAt: data?.updated_at || nowIso,
  };
}
