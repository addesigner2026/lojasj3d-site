/**
 * API PÚBLICA DE CONFIGURAÇÃO DE AMBIENTE — LOJA SJ 3D
 * ============================================================================
 * Expõe apenas configurações públicas seguras (ex.: número oficial do WhatsApp
 * configurado na Vercel em WHATSAPP_NUMBER ou NEXT_PUBLIC_WHATSAPP_NUMBER).
 * NUNCA expõe chaves secretas (service_role).
 */
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const rawWhatsapp =
    process.env.WHATSAPP_NUMBER ||
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
    process.env.VITE_WHATSAPP_NUMBER ||
    "5544991351318";

  const whatsappNumber = String(rawWhatsapp).replace(/\D/g, "") || "5544991351318";

  return res.status(200).json({
    ok: true,
    whatsappNumber,
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null
  });
};
