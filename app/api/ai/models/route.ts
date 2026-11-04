import { getModelCatalog } from "@/lib/ai/provider";
import { chooseSelection } from "@/lib/ai/catalog";
export const dynamic = "force-dynamic";
export async function GET() {
  const providers = await getModelCatalog();
  let selection = null;
  try {
    selection = chooseSelection(providers, {}, process.env);
  } catch {
    /* Setup required. */
  }
  return Response.json(
    { providers, selection, configured: providers.some((p) => p.models.length > 0) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
