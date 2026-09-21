// ESM resolve hook for the LOCAL beta-feedback harness: the Edge Function imports supabase-js from esm.sh (Deno
// style). Map that one URL to the copy already in node_modules so the real function file runs unmodified in Node.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("https://esm.sh/@supabase/supabase-js")) {
    return nextResolve("@supabase/supabase-js", context);
  }
  return nextResolve(specifier, context);
}
