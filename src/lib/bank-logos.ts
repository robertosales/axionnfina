/**
 * Mapeamento de código COMPE → ISPB para resolução de logos via CDN.
 * Fonte: logos-bancos-br (https://github.com/gabrielrfg/logos-bancos-br)
 * CDN: https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/{ispb}.svg
 */
const COMPE_TO_ISPB: Record<string, string> = {
  "001": "00000000", // Banco do Brasil
  "033": "90400888", // Santander
  "041": "92702067", // Banrisul
  "077": "00416968", // Banco Inter
  "102": "02332886", // XP Investimentos
  "104": "00360305", // Caixa Econômica Federal
  "208": "30306294", // BTG Pactual
  "212": "92894922", // Banco Original
  "237": "60746948", // Bradesco
  "260": "18236120", // Nu Pagamentos (Nubank)
  "290": "08561701", // PagSeguro (PagBank)
  "323": "10573521", // Mercado Pago
  "336": "31872495", // Banco C6
  "341": "60701190", // Itaú Unibanco
  "380": "22896431", // PicPay
  "422": "58160789", // Safra
  "623": "59285411", // Banco Pan
  "655": "59588111", // Banco BV (Votorantim)
  "748": "01181521", // Sicredi
  "756": "02038232", // Sicoob
};

const CDN_BASE = "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg";

/**
 * Resolve a URL do logo de um banco a partir do código COMPE.
 * Retorna null se o código não for encontrado.
 */
export function resolveBankLogoByCompe(compe: string): string | null {
  const ispb = COMPE_TO_ISPB[compe];
  if (!ispb) return null;
  return `${CDN_BASE}/${ispb}.svg`;
}

/**
 * Resolve a URL do logo a partir do nome da instituição (busca parcial case-insensitive).
 * Retorna null se nenhum banco for encontrado.
 */
export function resolveBankLogoByName(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [compe, ispb] of Object.entries(COMPE_TO_ISPB)) {
    if (lower.includes(compe)) {
      return `${CDN_BASE}/${ispb}.svg`;
    }
  }
  return null;
}
