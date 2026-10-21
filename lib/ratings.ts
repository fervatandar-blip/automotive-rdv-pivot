export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

export function formatRating(
  ratings: number[],
  noReviewsLabel = "No reviews yet"
): string {
  const average = averageRating(ratings);
  if (average === null) return noReviewsLabel;
  return `★ ${average.toFixed(1)} (${ratings.length})`;
}
