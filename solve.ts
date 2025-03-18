import { readFileSync } from "fs";
import { readFile } from "fs/promises";

interface WordleConstraints {
  excludedLetters: string[];
  includedLetters: string[];
  knownPositions: (string | null)[];
}

/**
 * Solves a Wordle puzzle by finding words that match the given constraints
 */
export async function solveWordle(
  constraints: WordleConstraints
): Promise<string[]> {
  try {
    // Read words.txt file
    const content = await readFile("words.txt", "utf-8");
    const words = content.trim().split("\n");

    // Filter words based on constraints
    return words.filter((word) => {
      // Filter out words that have excluded letters
      for (const letter of constraints.excludedLetters) {
        if (word.includes(letter)) {
          return false;
        }
      }

      // Filter based on known positions
      for (let i = 0; i < constraints.knownPositions.length; i++) {
        const knownLetter = constraints.knownPositions[i];
        if (knownLetter !== null && word[i] !== knownLetter) {
          return false;
        }
      }

      return true;
    });
  } catch (error) {
    console.error("Error reading words file:", error);
    return [];
  }
}

/**
 * Synchronous version of solveWordle
 */
export function solveWordleSync(constraints: WordleConstraints): string[] {
  try {
    // Read words.txt file
    const content = readFileSync("words.txt", "utf-8");
    const words = content.trim().split("\n");

    // Filter words based on constraints
    return words.filter((word) => {
      // Filter out words that have excluded letters
      for (const letter of constraints.excludedLetters) {
        if (word.includes(letter)) {
          return false;
        }
      }

      // Filter out words than don't have included letters
      for (const letter of constraints.includedLetters) {
        if (!word.includes(letter)) {
          return false;
        }
      }

      // Filter based on known positions
      for (let i = 0; i < constraints.knownPositions.length; i++) {
        const knownLetter = constraints.knownPositions[i];
        if (knownLetter !== null && word[i] !== knownLetter) {
          return false;
        }
      }

      return true;
    });
  } catch (error) {
    console.error("Error reading words file:", error);
    return [];
  }
}
