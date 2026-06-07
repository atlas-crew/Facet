export const shouldShowResearchBudgetBadge = (
  env: Pick<ImportMetaEnv, 'DEV'> = import.meta.env,
): boolean => env.DEV
