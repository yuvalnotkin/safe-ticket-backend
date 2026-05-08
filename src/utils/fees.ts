export const BUYER_SERVICE_FEE_BPS = 1000; // 10% in basis points

// Integer agorot only. Truncates fractional agorot down (we never round up
// against the buyer). Matches PG's integer-division formula in
// migration 0003 (listings_search view: face_value_agorot / 10).
export const calculateServiceFeeAgorot = (faceValueAgorot: number): number => {
  if (!Number.isInteger(faceValueAgorot) || faceValueAgorot < 0) {
    throw new Error(
      `faceValueAgorot must be a non-negative integer, got ${faceValueAgorot}`,
    );
  }
  return Math.floor((faceValueAgorot * BUYER_SERVICE_FEE_BPS) / 10000);
};
