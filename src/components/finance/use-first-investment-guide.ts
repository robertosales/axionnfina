import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useAccounts,
  useGoals,
  useInvestments,
  useLatestInvestmentGuidance,
  usePayables,
  useSaveInvestmentGuidance,
  useTransactions,
} from "@/lib/finance-data";
import { analyzeFinancialReadiness } from "@/lib/financial-next-step";
import {
  buildFirstInvestmentGuidance,
  type FirstInvestmentAnswers,
} from "@/lib/first-investment-guide";

const DEFAULT_ANSWERS: FirstInvestmentAnswers = {
  objective: "reserve",
  horizonMonths: 24,
  liquidityPreference: "daily",
  fluctuationTolerance: "avoid",
  knowledgeLevel: "none",
};

function answerForStep(answers: FirstInvestmentAnswers, step: number): string {
  if (step === 0) return answers.objective;
  if (step === 1) return String(answers.horizonMonths);
  if (step === 2) return answers.liquidityPreference;
  if (step === 3) return answers.fluctuationTolerance;
  return answers.knowledgeLevel;
}

function updateAnswer(
  answers: FirstInvestmentAnswers,
  step: number,
  value: string,
): FirstInvestmentAnswers {
  if (step === 0) return { ...answers, objective: value as FirstInvestmentAnswers["objective"] };
  if (step === 1) return { ...answers, horizonMonths: Number(value) };
  if (step === 2)
    return {
      ...answers,
      liquidityPreference: value as FirstInvestmentAnswers["liquidityPreference"],
    };
  if (step === 3)
    return {
      ...answers,
      fluctuationTolerance: value as FirstInvestmentAnswers["fluctuationTolerance"],
    };
  return { ...answers, knowledgeLevel: value as FirstInvestmentAnswers["knowledgeLevel"] };
}

export function useFirstInvestmentGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);
  const [submittedAnswers, setSubmittedAnswers] = useState<FirstInvestmentAnswers | null>(null);
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts();
  const { data: transactions = [], isLoading: loadingTransactions } = useTransactions(1000);
  const { data: bills = [], isLoading: loadingBills } = usePayables();
  const { data: goals = [], isLoading: loadingGoals } = useGoals();
  const investments = useInvestments();
  const latest = useLatestInvestmentGuidance();
  const save = useSaveInvestmentGuidance();

  const openBills = useMemo(() => bills.filter((bill) => bill.dbStatus !== "paid"), [bills]);
  const financial = useMemo(
    () =>
      analyzeFinancialReadiness({
        accounts,
        transactions,
        bills: openBills,
        goals,
        investmentTotal: investments.total,
      }),
    [accounts, transactions, openBills, goals, investments.total],
  );
  const loading =
    loadingAccounts || loadingTransactions || loadingBills || loadingGoals || investments.isLoading;
  const activeAnswers = submittedAnswers ?? latest.data?.answers ?? null;
  const guidance = activeAnswers ? buildFirstInvestmentGuidance(financial, activeAnswers) : null;
  const gate = buildFirstInvestmentGuidance(financial, answers);

  useEffect(() => {
    if (latest.data?.answers && !submittedAnswers) setAnswers(latest.data.answers);
  }, [latest.data, submittedAnswers]);

  const begin = () => {
    setAnswers(latest.data?.answers ?? DEFAULT_ANSWERS);
    setStep(0);
    setOpen(true);
  };

  const finish = () => {
    const result = buildFirstInvestmentGuidance(financial, answers);
    save.mutate(
      {
        answers,
        guidance: result,
        financial: {
          stage: financial.stage,
          confidence: financial.confidence.score,
          metrics: financial.metrics,
        },
      },
      {
        onSuccess: () => {
          setSubmittedAnswers(answers);
          setOpen(false);
          toast.success("Caminhos atualizados com suas respostas");
        },
        onError: () =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  return {
    open,
    setOpen,
    step,
    setStep,
    answers,
    setAnswers,
    loading,
    financial,
    guidance,
    gate,
    begin,
    finish,
    answerForStep,
    updateAnswer,
    save,
  };
}
