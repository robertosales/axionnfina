import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Cliente exclusivo para codigo executado no servidor.
 *
 * Ele usa service role e, portanto, toda chamada deve validar o usuario antes
 * de aceitar identificadores vindos da requisicao. Nunca importe este modulo
 * em componentes ou hooks do browser.
 */
export function createClient() {
  return supabaseAdmin;
}
