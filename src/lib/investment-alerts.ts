export type RadarAlertPreferences = {
  enabled: boolean;
  inAppEnabled: boolean;
  minimumScore: number;
  scoreChangeThreshold: number;
};

export type RadarAlertCandidate = {
  id: string;
  score: number;
};

export type PreviousRadarResult = {
  topOpportunityId: string | null;
  topScore: number | null;
} | null;

export function shouldCreateRadarAlert(
  preferences: RadarAlertPreferences,
  candidate: RadarAlertCandidate | undefined,
  previous: PreviousRadarResult,
): boolean {
  if (!preferences.enabled || !preferences.inAppEnabled || !candidate) return false;
  if (candidate.score < preferences.minimumScore) return false;
  if (!previous) return true;

  const topChanged = previous.topOpportunityId !== candidate.id;
  const scoreChanged =
    previous.topScore == null ||
    Math.abs(previous.topScore - candidate.score) >= preferences.scoreChangeThreshold;
  return topChanged || scoreChanged;
}
