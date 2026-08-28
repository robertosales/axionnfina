import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verify } from 'https://deno.land/std@0.177.0/hash/hmac.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('PLUGGY_WEBHOOK_SECRET')!;

    const signature = req.headers.get('x-webhook-signature');
    const timestamp = req.headers.get('x-webhook-timestamp');
    const body = await req.text();

    if (!signature || !timestamp) {
      return new Response('Missing signature or timestamp', { status: 400, headers: corsHeaders });
    }

    // Verify timestamp (prevent replay attacks > 5 min)
    const ts = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) {
      return new Response('Timestamp too old', { status: 400, headers: corsHeaders });
    }

    // Verify HMAC signature
    const expectedSignature = await verify('SHA-256', new TextEncoder().encode(webhookSecret), new TextEncoder().encode(`${timestamp}.${body}`));
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== expectedHex) {
      return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }

    const payload: WebhookPayload = JSON.parse(body);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store webhook event
    const { error: eventError } = await supabase
      .from('provider_webhook_events')
      .insert({
        provider: 'pluggy',
        external_event_id: payload.data.id as string,
        event_type: payload.event,
        payload_hash: expectedHex,
        status: 'received',
      });

    if (eventError) {
      console.error('Failed to store webhook event:', eventError);
    }

    // Process event
    let result = { processed: false };

    switch (payload.event) {
      case 'item_updated':
      case 'item_login_succeeded':
        result = await handleItemUpdated(supabase, payload.data);
        break;
      case 'transactions_updated':
        result = await handleTransactionsUpdated(supabase, payload.data);
        break;
      case 'accounts_updated':
        result = await handleAccountsUpdated(supabase, payload.data);
        break;
      case 'investments_updated':
        result = await handleInvestmentsUpdated(supabase, payload.data);
        break;
      case 'consent_revoked':
        result = await handleConsentRevoked(supabase, payload.data);
        break;
      default:
        console.log('Unhandled event type:', payload.event);
    }

    // Update webhook event status
    await supabase
      .from('provider_webhook_events')
      .update({
        status: result.processed ? 'processed' : 'failed',
        processed_at: new Date().toISOString(),
        error_message: result.error || null,
      })
      .eq('provider', 'pluggy')
      .eq('external_event_id', payload.data.id as string);

    return new Response(JSON.stringify({ success: true, processed: result.processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleItemUpdated(supabase: any, data: Record<string, unknown>) {
  const itemId = data.id as string;
  const status = data.status as string;

  const { data: connection } = await supabase
    .from('account_connections')
    .select('id')
    .eq('provider_connection_id', itemId)
    .maybeSingle();

  if (!connection) {
    return { processed: false, error: 'Connection not found' };
  }

  const statusMap: Record<string, string> = {
    'UPDATED': 'active',
    'LOGIN_SUCCEEDED': 'active',
    'WAITING_USER_INPUT': 'pending',
    'ERROR': 'error',
  };

  await supabase
    .from('account_connections')
    .update({
      status: statusMap[status] || 'active',
      error_message: data.error_message || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  // Trigger sync if connection became active
  if (statusMap[status] === 'active') {
    await supabase.rpc('trigger_sync', { p_connection_id: connection.id });
  }

  return { processed: true };
}

async function handleTransactionsUpdated(supabase: any, data: Record<string, unknown>) {
  const itemId = data.item_id as string;

  const { data: connection } = await supabase
    .from('account_connections')
    .select('id')
    .eq('provider_connection_id', itemId)
    .maybeSingle();

  if (!connection) {
    return { processed: false, error: 'Connection not found' };
  }

  await supabase.rpc('trigger_sync', { p_connection_id: connection.id });

  return { processed: true };
}

async function handleAccountsUpdated(supabase: any, data: Record<string, unknown>) {
  const itemId = data.item_id as string;

  const { data: connection } = await supabase
    .from('account_connections')
    .select('id')
    .eq('provider_connection_id', itemId)
    .maybeSingle();

  if (!connection) {
    return { processed: false, error: 'Connection not found' };
  }

  await supabase.rpc('trigger_sync', { p_connection_id: connection.id });

  return { processed: true };
}

async function handleInvestmentsUpdated(supabase: any, data: Record<string, unknown>) {
  const itemId = data.item_id as string;

  const { data: connection } = await supabase
    .from('account_connections')
    .select('id')
    .eq('provider_connection_id', itemId)
    .maybeSingle();

  if (!connection) {
    return { processed: false, error: 'Connection not found' };
  }

  await supabase.rpc('trigger_sync', { p_connection_id: connection.id });

  return { processed: true };
}

async function handleConsentRevoked(supabase: any, data: Record<string, unknown>) {
  const itemId = data.item_id as string;

  await supabase
    .from('account_connections')
    .update({
      status: 'revoked',
      consent_status: 'revoked',
      updated_at: new Date().toISOString(),
    })
    .eq('provider_connection_id', itemId);

  await supabase
    .from('openfinance_consents')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    })
    .eq('provider_consent_id', itemId);

  return { processed: true };
}