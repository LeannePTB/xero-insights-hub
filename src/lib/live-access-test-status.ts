export const LIVE_ACCESS_SIGN_IN_COUNTS = {
  steadyState: 4,
  firstRunWithTotpEnrollment: 7,
} as const;

export type LiveAccessHttpFailure = {
  incomplete: boolean;
  message: string;
};

export function classifyLiveAccessHttpFailure(
  status: number,
  text: string,
): LiveAccessHttpFailure {
  if (status === 429) {
    return {
      incomplete: true,
      message: `live access tests: INCONCLUSIVE — run did not complete (429 rate limited). ${text.slice(0, 300)}`,
    };
  }
  return {
    incomplete: false,
    message: `live access tests: FAILED to trigger (${status}) ${text.slice(0, 300)}`,
  };
}