import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Compass,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const DEFAULT_ANSWERS: FirstInvestmentAnswers = {
  objective: "reserve",
  horizonMonths: 24,
  liquidityPreference: "daily",
  fluctuationTolerance: "avoid",
  knowledgeLevel: "none",
};

type Choice = { value: string; label: string; description: string };

const QUESTIONS: Array<{ title: string; helper: string; choices: Choice[] }> = [
  {
    title: "Para que você quer guardar este dinheiro?",
    helper: "O objetivo vem antes do nome do investimento.",
    choices: [
      { value: "reserve", label: "Imprevistos", description: "Criar ou reforçar minha reserva." },
      { value: "growth", label: "Fazer o patrimônio crescer", description: "Sem uma data exata para usar." },
      { value: "retirement", label: "Aposentadoria", description: "Construir renda para o futuro." },
      { value: "education", label: "Educação", description: "Pagar estudos meus ou da família." },
    ],
  },
  {
    title: "Quando você pretende usar o dinheiro?",
    helper: "Escolha a faixa mais próxima; depois você poderá ajustar.",
    choices: [
      { value: "6", label: "Em até 6 meses", description: "Prazo muito curto." },
      { value: "24", label: "Entre 1 e 2 anos", description: "Prazo curto." },
      { value: "60", label: "Entre 3 e 5 anos", description: "Prazo médio." },
      { value: "120", label: "Mais de 5 anos", description: "Prazo longo." },
    ],
  },
  {
    title: "Você pode precisar retirar antes?",
    helper: "Liquidez é a facilidade de transformar o investimento em dinheiro disponível.",
    choices: [
      { value: "daily", label: "Sim, a qualquer momento", description: "Preciso de acesso rápido." },
      { value: "up_to_1_year", label: "Talvez dentro de um ano", description: "Aceito alguma espera." },
      { value: "long_term", label: "Não antes do prazo", description: "Posso manter até a data planejada." },
    ],
  },
  {
    title: "Como você reagiria ao ver o valor cair?",
    helper: "Não existe resposta certa. Considere como você realmente se sentiria.",
    choices: [
      { value: "avoid", label: "Quero evitar oscilações", description: "Uma queda me deixaria desconfortável." },
      { value: "some", label: "Aceito pequenas oscilações", description: "Se entender o motivo e o prazo." },
      { value: "high", label: "Aceito oscilações maiores", description: "Se fizer sentido para um prazo longo." },
    ],
  },
  {
    title: "Quanto você conhece sobre investimentos?",
    helper: "Isso define quanto detalhe e risco faz sentido apresentar agora.",
    choices: [
      { value: "none", label: "Estou começando", description: "Ainda não conheço os produtos." },
      { value: "basic", label: "Conheço o básico", description: "Entendo risco, prazo e liquidez." },
      { value: "experienced", label: "Já invisto", description: "Consigo comparar classes e custos." },
    ],
  },
];

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
    return { ...answers, liquidityPreference: value as FirstInvestmentAnswers["liquidityPreference"] };
  if (step === 3)
    return { ...answers, fluctuationTolerance: value as FirstInvestmentAnswers["fluctuationTolerance"] };
  return { ...answers, knowledgeLevel: value as FirstInvestmentAnswers["knowledgeLevel"] };
}

export function FirstInvestmentGuide() {
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

  const openBills = bills.filter((bill) => bill.dbStatus !== "paid");
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
    loadingAccounts ||
    loadingTransactions ||
    loadingBills ||
    loadingGoals ||
    investments.isLoading;
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
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const readyTone = gate.readiness === "ready";

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-elevation-1">
      <div className="grid gap-6 border-b border-border/60 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
              <Compass className="mr-1 size-3" aria-hidden /> Primeiro investimento guiado
            </Badge>
            <span className="text-xs text-muted-foreground">5 perguntas · cerca de 2 minutos</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
            Entenda por onde começar, antes de escolher um produto
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            O Axionn verifica sua base financeira e mostra até três caminhos para estudar. Nenhum
            investimento é contratado por aqui.
          </p>
        </div>

        <div
          className={cn(
            "rounded-xl border p-4",
            readyTone ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5",
          )}
        >
          <div className="flex items-start gap-3">
            {readyTone ? (
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Semáforo de prontidão
              </p>
              <p className="mt-1 font-semibold">
                {loading ? "Verificando seus dados…" : gate.title}
              </p>
              {!loading && <p className="mt-1 text-xs leading-5 text-muted-foreground">{gate.explanation}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b border-border/60 bg-muted/[0.18] px-5 py-4 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-xs text-muted-foreground">Sobra mensal estimada</p>
          <p className="numeric mt-1 text-sm font-semibold">{formatBRL(financial.metrics.monthlySurplus)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Reserva estimada</p>
          <p className="numeric mt-1 text-sm font-semibold">
            {financial.metrics.reserveMonths.toFixed(1).replace(".", ",")} meses
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Confiança dos dados</p>
          <p className="mt-1 text-sm font-semibold">{financial.confidence.label}</p>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {!loading && gate.readiness !== "ready" && gate.prerequisite && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Seu próximo passo vem antes dos produtos</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ao concluir esta etapa, volte aqui para responder ao guia.
              </p>
            </div>
            <Button asChild className="h-11 sm:w-auto">
              <Link to={gate.prerequisite.href}>
                {gate.prerequisite.label} <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        )}

        {!loading && gate.readiness === "ready" && !guidance && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Sua base permite explorar alternativas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                As respostas não executam aplicações nem substituem o perfil da sua instituição.
              </p>
            </div>
            <Button className="h-11" onClick={begin}>
              Começar avaliação <ArrowRight aria-hidden />
            </Button>
          </div>
        )}

        {!loading && gate.readiness === "ready" && guidance && (
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="size-4" aria-hidden />
                  <p className="text-sm font-semibold">Avaliação concluída</p>
                </div>
                <h3 className="mt-2 text-lg font-semibold">{guidance.title}</h3>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{guidance.explanation}</p>
              </div>
              <Button variant="outline" className="h-10 shrink-0" onClick={begin}>
                <RotateCcw aria-hidden /> Refazer respostas
              </Button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {guidance.paths.map((path, index) => (
                <article key={path.id} className="rounded-xl border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-primary">
                      Caminho {index + 1}
                    </p>
                    <BookOpen className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{path.eyebrow}</p>
                  <h4 className="mt-1 font-semibold leading-6">{path.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{path.reason}</p>
                  <Accordion type="single" collapsible className="mt-2">
                    <AccordionItem value="details" className="border-b-0">
                      <AccordionTrigger className="py-3 text-xs">Riscos, liquidez e custos</AccordionTrigger>
                      <AccordionContent className="space-y-3 text-xs leading-5 text-muted-foreground">
                        <p><strong className="text-foreground">Risco:</strong> {path.risk}</p>
                        <p><strong className="text-foreground">Liquidez:</strong> {path.liquidity}</p>
                        <p><strong className="text-foreground">Custos:</strong> {path.costs}</p>
                        <p><strong className="text-foreground">O que pode dar errado:</strong> {path.whatCanGoWrong}</p>
                        <p><strong className="text-foreground">Antes de decidir:</strong> {path.nextCheck}</p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <a
                    href={path.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {path.source.label} <ExternalLink className="size-3" aria-hidden />
                  </a>
                </article>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">{guidance.disclaimer}</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="border-b border-border/60 p-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Pergunta {step + 1} de {QUESTIONS.length}</span>
              <span>{Math.round(((step + 1) / QUESTIONS.length) * 100)}%</span>
            </div>
            <Progress value={((step + 1) / QUESTIONS.length) * 100} className="mt-2 h-1.5" />
            <DialogTitle className="pt-3 text-left text-xl">{QUESTIONS[step]!.title}</DialogTitle>
            <p className="text-left text-sm text-muted-foreground">{QUESTIONS[step]!.helper}</p>
          </DialogHeader>
          <div className="p-5 sm:p-6">
            <RadioGroup
              value={answerForStep(answers, step)}
              onValueChange={(value) => setAnswers((current) => updateAnswer(current, step, value))}
              className="gap-3"
            >
              {QUESTIONS[step]!.choices.map((choice) => (
                <label
                  key={choice.value}
                  className={cn(
                    "flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
                    answerForStep(answers, step) === choice.value
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value={choice.value} />
                  <span>
                    <span className="block text-sm font-semibold">{choice.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{choice.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={step === 0 || save.isPending}
                onClick={() => setStep((current) => current - 1)}
              >
                Voltar
              </Button>
              {step < QUESTIONS.length - 1 ? (
                <Button onClick={() => setStep((current) => current + 1)}>
                  Continuar <ArrowRight aria-hidden />
                </Button>
              ) : (
                <Button disabled={save.isPending} onClick={finish}>
                  {save.isPending ? "Salvando…" : "Ver meus caminhos"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
