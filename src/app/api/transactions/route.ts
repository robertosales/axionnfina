import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { ledgerService } from "@/modules/transactions/ledger";
import { categorizationEngine } from "@/modules/transactions/categorization";

const createTransactionSchema = z.object({
  account_id: z.string().uuid(),
  amount: z.number().multipleOf(0.01),
  currency: z.string().default("BRL"),
  description: z.string().min(1).max(200),
  merchant_name: z.string().max(100).optional(),
  category_id: z.string().uuid().optional(),
  subcategory_id: z.string().uuid().optional(),
  posted_at: z.string().datetime(),
  authorized_at: z.string().datetime().optional(),
  is_recurring: z.boolean().default(false),
  metadata: z.record(z.unknown()).default({}),
});

const pairTransferSchema = z.object({
  debit_transaction_id: z.string().uuid(),
  credit_transaction_id: z.string().uuid(),
  is_manual: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    switch (action) {
      case "create": {
        const parsed = createTransactionSchema.parse(body);

        const { data: account } = await supabase
          .from("accounts")
          .select("id, user_id")
          .eq("id", parsed.account_id)
          .eq("user_id", user.id)
          .single();

        if (!account) {
          return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        // Auto-categorize if no category provided
        let categoryId = parsed.category_id;
        let subcategoryId = parsed.subcategory_id;

        if (!categoryId) {
          const tempTransaction = {
            id: "temp",
            user_id: user.id,
            account_id: parsed.account_id,
            amount: parsed.amount,
            currency: parsed.currency,
            description: parsed.description,
            merchant_name: parsed.merchant_name,
            category_id: null,
            subcategory_id: null,
            status: "settled" as const,
            posted_at: parsed.posted_at,
            authorized_at: parsed.authorized_at,
            is_recurring: parsed.is_recurring,
            is_transfer: false,
            transfer_pair_id: null,
            metadata: parsed.metadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const categorization = await categorizationEngine.categorize(tempTransaction, user.id);
          categoryId = categorization.category_id;
          subcategoryId = categorization.subcategory_id;
        }

        const { data: transaction, error } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            account_id: parsed.account_id,
            amount: parsed.amount,
            currency: parsed.currency,
            description: parsed.description,
            merchant_name: parsed.merchant_name,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            status: "settled",
            posted_at: parsed.posted_at,
            authorized_at: parsed.authorized_at,
            is_recurring: parsed.is_recurring,
            metadata: parsed.metadata,
          })
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Create journal entry
        await ledgerService.createTransactionJournalEntry(
          transaction.id,
          parsed.description,
          parsed.account_id,
          parsed.account_id, // Will be resolved to ledger accounts
          Math.abs(parsed.amount),
          parsed.currency,
          new Date(parsed.posted_at),
        );

        // Log enrichment if auto-categorized
        if (!parsed.category_id && categoryId) {
          await supabase.from("transaction_enrichments").insert({
            transaction_id: transaction.id,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            confidence: 0.7,
            source: "ml",
            reason: "Auto-categorized on manual creation",
          });
        }

        return NextResponse.json({ transaction });
      }

      case "pair-transfer": {
        const parsed = pairTransferSchema.parse(body);

        // Verify ownership
        const { data: debitTxn } = await supabase
          .from("transactions")
          .select("id, user_id, amount, currency")
          .eq("id", parsed.debit_transaction_id)
          .eq("user_id", user.id)
          .single();

        const { data: creditTxn } = await supabase
          .from("transactions")
          .select("id, user_id, amount, currency")
          .eq("id", parsed.credit_transaction_id)
          .eq("user_id", user.id)
          .single();

        if (!debitTxn || !creditTxn) {
          return NextResponse.json(
            { error: "One or both transactions not found" },
            { status: 404 },
          );
        }

        const { data: pairId, error } = await supabase.rpc("pair_transfer", {
          p_debit_transaction_id: parsed.debit_transaction_id,
          p_credit_transaction_id: parsed.credit_transaction_id,
          p_is_manual: parsed.is_manual,
        });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ pair_id: pairId });
      }

      case "categorize": {
        const { transaction_id, category_id, subcategory_id } = z
          .object({
            transaction_id: z.string().uuid(),
            category_id: z.string().uuid(),
            subcategory_id: z.string().uuid().optional(),
          })
          .parse(body);

        const { data: transaction } = await supabase
          .from("transactions")
          .select("id, user_id")
          .eq("id", transaction_id)
          .eq("user_id", user.id)
          .single();

        if (!transaction) {
          return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
        }

        await supabase
          .from("transactions")
          .update({ category_id, subcategory_id })
          .eq("id", transaction_id);

        await supabase.from("transaction_enrichments").insert({
          transaction_id,
          category_id,
          subcategory_id,
          confidence: 1.0,
          source: "manual",
          reason: "Manually categorized by user",
          applied_by: user.id,
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Transaction API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const accountId = url.searchParams.get("account_id");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const categoryId = url.searchParams.get("category_id");
    const search = url.searchParams.get("search");

    let query = supabase
      .from("transactions")
      .select(
        `
        *,
        category:transaction_categories!category_id(id, code, name, icon, color),
        subcategory:transaction_categories!subcategory_id(id, code, name),
        account:accounts(id, name, institution, type)
      `,
      )
      .eq("user_id", user.id)
      .order("posted_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (accountId) {
      query = query.eq("account_id", accountId);
    }
    if (startDate) {
      query = query.gte("posted_at", startDate);
    }
    if (endDate) {
      query = query.lte("posted_at", endDate);
    }
    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }
    if (search) {
      query = query.ilike("description", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      transactions: data,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Transaction GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
