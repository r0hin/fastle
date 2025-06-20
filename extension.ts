import words from "./words";

// Discord webhook URL
const RECIEVER_URL = "http://localhost:8081/draw";
const PREDICTION_RECIEVER_URL = "http://localhost:8082/draw";
const MODE = "reciever";
const DISCORD_WEBHOOK_URL = "";

const getLetterMap = (rows: NodeListOf<Element>) => {
  const letters: number[][] = [];

  rows.forEach(function (row) {
    const cols = row.querySelectorAll(".Row-letter");
    const rowLetters: number[] = [];
    cols.forEach(function (col) {
      if (col.classList.contains("letter-absent")) {
        rowLetters.push(0);
      } else if (col.classList.contains("letter-correct")) {
        rowLetters.push(2);
      } else if (col.classList.contains("letter-elsewhere")) {
        rowLetters.push(1);
      }
    });
    letters.push(rowLetters);
  });

  return letters;
};

const getGuesses = (rows: NodeListOf<Element>) => {
  const guesses: string[] = [];

  rows.forEach(function (row) {
    const cols = row.querySelectorAll(".Row-letter");
    const rowLetters: string[] = [];
    cols.forEach(function (col) {
      rowLetters.push(col.textContent || "");
    });
    if (rowLetters.join("").length === 5) {
      guesses.push(rowLetters.join(""));
    }
  });

  return guesses;
};

const getValidWords = (
  map: string,
  lettersIn: string,
  lettersOut: string,
  yellowPositions: { [letter: string]: number[] }
) => {
  return words.filter((word) => {
    // Filter out words that have excluded letters, but allow if the letter is in a known position
    for (const letter of lettersOut) {
      if (word.includes(letter)) {
        // Check if this letter is also in map (known positions)
        let isInMap = false;
        for (let i = 0; i < map.length; i++) {
          if (map[i] === letter) {
            isInMap = true;
            break;
          }
        }
        // Also check if it's in lettersIn (could be in multiple positions)
        const isInLettersIn = lettersIn.includes(letter);

        // Only filter out if it's not in map or lettersIn
        if (!isInMap && !isInLettersIn) {
          return false;
        }
      }
    }

    // Filter out words that doesn't have the included letters
    for (const letter of lettersIn) {
      if (!word.includes(letter)) {
        return false;
      }
    }

    // Filter based on known positions
    for (let i = 0; i < map.length; i++) {
      const knownLetter = map[i];
      if (knownLetter !== "0" && word[i] !== knownLetter) {
        return false;
      }
    }

    // Filter out words that have yellow letters in positions where they were yellow
    for (const [letter, positions] of Object.entries(yellowPositions)) {
      for (const position of positions) {
        if (word[position] === letter) {
          return false; // Letter can't be in this position if it was yellow here
        }
      }
    }

    return true;
  });
};

const evaluateForCombo = (rows: NodeListOf<Element>, combo: string[]) => {
  const guessAtLine = (line: number) => {
    return combo[line] || "";
  };

  const letters = getLetterMap(rows);

  let map = "00000";
  let lettersIn = "";
  let lettersOut = "";
  // Track positions of yellow letters
  let yellowPositions: { [letter: string]: number[] } = {};

  for (let i = 0; i < combo.length; i++) {
    // ROW i
    const guess = guessAtLine(i);
    for (let j = 0; j < 5; j++) {
      // COLUMN j
      if (letters[i][j] === 2) {
        map = map.substring(0, j) + guess[j] + map.substring(j + 1);
      }
      if (letters[i][j] === 0) {
        lettersOut += guess[j];
      }
      if (letters[i][j] === 1) {
        lettersIn += guess[j];
        // Track position of yellow letter
        if (!yellowPositions[guess[j]]) {
          yellowPositions[guess[j]] = [];
        }
        yellowPositions[guess[j]].push(j);
      }
    }
  }

  const validWords = getValidWords(map, lettersIn, lettersOut, yellowPositions);

  return validWords;
};

const randomize = (arr: string[]) => {
  return arr.sort(() => Math.random() - 0.5);
};

let lastSentContent = {
  false: "",
  true: "",
};

/**
 * Send a message to Discord webhook
 * @param title The title/match info
 * @param content The content/results
 */
const sendDiscordWebhook = async (
  title: string,
  content: string,
  predictionMode: boolean = false
) => {
  try {
    if (lastSentContent[`${predictionMode}`] === `${title}`) return;
    lastSentContent[`${predictionMode}`] = title;

    if (MODE === "reciever") {
      const textToSend = `${content}`;
      let success = false;
      try {
        const USE_RECIEVER_URL = predictionMode
          ? PREDICTION_RECIEVER_URL
          : RECIEVER_URL;
        await fetch(
          USE_RECIEVER_URL + "?text=" + encodeURIComponent(textToSend),
          {
            method: "GET",
          }
        );
        success = true;
      } catch {
        // Do nothing
      }
      if (success) {
        return;
      }
    }
    // Check if content exceeds 1000 characters
    const fullContent = `**${title}**\n${content}`;
    if (fullContent.length > 1000 || !DISCORD_WEBHOOK_URL) {
      console.log(
        `No webhook URL provided or too long (${fullContent.length} chars)`
      );
      return;
    }

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: fullContent,
      }),
    });

    if (!response.ok) {
      console.error("Failed to send Discord webhook:", await response.text());
    }
  } catch (error) {
    console.error("Error sending Discord webhook:", error);
  }
};

const evaluateKnownBoard = (board: Element) => {
  const rows = board.querySelectorAll(".Row");
  const guesses = getGuesses(rows);
  const evaluation = evaluateForCombo(rows, guesses);
  if (evaluation.length && evaluation.length > 0 && evaluation.length < 50) {
    sendDiscordWebhook(
      `Match for ${guesses.join(", ")}`,
      randomize(evaluation)
        .join(", ")
        .split(",")
        .map((w) => w.trim())
        .slice(0, 2)
        .join(" ")
    );
  }

  return evaluation;
};

window.setTimeout(() => {
  // Send 'connected' message on initial load

  sendDiscordWebhook("Initial Connection", "connected");

  // evaluateBoard(other);

  window.setInterval(() => {
    const boards = document.querySelectorAll(".board-item");
    const mine = boards[0];
    evaluateKnownBoard(mine);
  }, 299);
}, 2999);

window.setTimeout(() => {
  // Send 'connected' message on initial load

  sendDiscordWebhook("Initial Connection", "connected", true);

  window.setInterval(() => {
    const boards = document.querySelectorAll(".board-item");
    const other = boards[1];
    const rows = other.querySelectorAll(".Row");

    const map = getLetterMap(rows);

    if (map[0].length == 5 && map[1].length == 5 && map[2].length == 5) {
      // The first 3 rows must be filled
      const combo1 = evaluateForCombo(rows, ["stare", "cloud", "pinky"]);
      console.log("Combo 1 results:", combo1);

      const combo2 = evaluateForCombo(rows, ["saice", "lordy", "twang"]);
      console.log("Combo 2 results:", combo2);

      const combo3 = evaluateForCombo(rows, ["taper", "child", "swung"]);
      console.log("Combo 3 results:", combo3);

      const combo4 = evaluateForCombo(rows, ["tubes", "fling", "champ"]);
      console.log("Combo 4 results:", combo4);

      const combo5 = evaluateForCombo(rows, ["stern", "aloud", "chimp"]);
      console.log("Combo 5 results:", combo5);

      const combo6 = evaluateForCombo(rows, ["thorn", "scaly", "guide"]);
      console.log("Combo 6 results:", combo6);

      const combo7 = evaluateForCombo(rows, ["crane", "south", "milky"]);
      console.log("Combo 7 results:", combo7);

      const combo8 = evaluateForCombo(rows, ["stare", "mound", "picky"]);
      console.log("Combo 8 results:", combo8);

      const combo9 = evaluateForCombo(rows, ["adieu", "story", "champ"]);
      console.log("Combo 9 results:", combo9);

      const combo10 = evaluateForCombo(rows, ["house", "cling", "party"]);
      console.log("Combo 10 results:", combo10);

      const combo11 = evaluateForCombo(rows, ["point", "share", "lucky"]);
      console.log("Combo 11 results:", combo11);

      const combo12 = evaluateForCombo(rows, ["thorn", "guide", "scaly"]);
      console.log("Combo 12 results:", combo12);

      const combo13 = evaluateForCombo(rows, ["wavey", "prism", "cloud"]);
      console.log("Combo 13 results:", combo13);

      const combo14 = evaluateForCombo(rows, ["adieu", "sport", "glyph"]);
      console.log("Combo 14 results:", combo14);

      const unified = removeDuplicates([
        ...combo1,
        ...combo2,
        ...combo3,
        ...combo4,
        ...combo5,
        ...combo6,
        ...combo7,
        ...combo8,
        ...combo9,
        ...combo10,
        ...combo11,
        ...combo12,
        ...combo13,
        ...combo14,
      ]);

      sendDiscordWebhook("Prediction", unified.join(", "), true);
      sendDiscordWebhook(
        `Prediction for with ${map.flat()} mapping`,
        unified.slice(0, 4).join(", "),
        true
      );
    }
  }, 299);
}, 2999);

const removeDuplicates = (arr: string[]) => {
  return arr.filter((item, index, self) => self.indexOf(item) === index);
};
