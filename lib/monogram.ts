/**
 * Up to two initials for a workshop's monogram: "Garage Muller" -> "GM",
 * "Auto-Service Kirchberg (test)" -> "AS". Parenthesised notes are ignored.
 */
export function monogram(name: string) {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .split(/[\s&+-]+/)
    .filter((word) => /\p{L}/u.test(word));
  const letters = (words.length > 1 ? [words[0], words[1]] : [words[0] ?? name]).map((word) =>
    (word.match(/\p{L}/u)?.[0] ?? "").toUpperCase()
  );
  return letters.join("") || "?";
}
