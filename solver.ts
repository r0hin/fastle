import words from "./words";

interface WordleConstraints {
  excludedLetters: string[];
  includedLetters: string[];
  knownPositions: (string | null)[];
}

const main = () => {
  console.log("Wordle Helper\n-------------");

  // Get command line arguments
  const args = process.argv.slice(2);

  // Default values
  let knownPositions = [null, null, null, null, null] as (string | null)[];
  let excludedLetters: string[] = [];
  let includedLetters: string[] = [];

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--known" || args[i] === "-k") {
      if (i + 1 < args.length) {
        // Parse the known positions string (e.g., "aXXcX")
        const knownStr = args[i + 1].toLowerCase();
        if (knownStr.length === 5) {
          for (let j = 0; j < 5; j++) {
            knownPositions[j] = knownStr[j] === "x" ? null : knownStr[j];
          }
        } else {
          console.error(
            "Error: Known positions must be exactly 5 characters long (use 'x' for unknown positions)"
          );
          return;
        }
      }
    } else if (args[i] === "--excluded" || args[i] === "-e") {
      if (i + 1 < args.length) {
        // Parse the excluded letters string
        excludedLetters = args[i + 1].toLowerCase().split("");
      }
    } else if (args[i] === "--included" || args[i] === "-i") {
      if (i + 1 < args.length) {
        // Parse the included letters string
        includedLetters = args[i + 1].toLowerCase().split("");
      }
    }
  }

  // If no arguments provided, prompt for input
  if (args.length === 0) {
    console.log("No arguments provided. Use the following format:");
    console.log("  bun run index.ts --known xxxxx --excluded abc");
    console.log("Where:");
    console.log(
      "  --known (-k): 5-letter pattern with 'x' for unknown positions"
    );
    console.log("  --excluded (-e): Letters known not to be in the word");
    console.log("\nExample: bun run index.ts --known axbxx --excluded defg");
    return;
  }

  // Display the parsed constraints
  console.log("\nWordle Constraints:");
  console.log(
    "- Known positions:",
    knownPositions.map((p) => p || "_").join(" ")
  );
  console.log("- Excluded letters:", excludedLetters.join(", "));
  console.log("- Included letters:", includedLetters.join(", "));

  // Solve the Wordle puzzle
  const matchingWords = solveWordleSync({
    knownPositions,
    excludedLetters,
    includedLetters,
  });

  // Output results
  console.log("\nPossible matching words:\n----------------------");
  if (matchingWords.length === 0) {
    console.log("No matching words found.");
  } else {
    if (matchingWords.length > 100) {
      console.log(
        `Found ${matchingWords.length} matching words. Showing first 100:`
      );
      matchingWords.slice(0, 100).forEach((word, index) => {
        console.log(`${index + 1}. ${word}`);
      });
    } else {
      matchingWords.forEach((word, index) => {
        console.log(`${index + 1}. ${word}`);
      });
      console.log(`\nFound ${matchingWords.length} matching words.`);
    }
  }
};

const solveWordleSync = (constraints: WordleConstraints): string[] => {
  try {
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
};

main();
