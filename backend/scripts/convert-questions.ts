/**
 * One-time converter script for Feature 2 (Question Bank & Authoring).
 *
 * Reads the two legacy question source files and converts them into the
 * unified upload JSON schema expected by POST /api/v1/admin/questions/upload:
 *
 *   - .planning/reference/questions/01-analogies.md
 *     A markdown table of Verbal & Symbolic / Analogies questions.
 *   - .planning/reference/questions/reasoning_practice_question_bank.html
 *     A `const QUESTION_REPOSITORY = [...]` JS array literal (mixed domains/topics).
 *
 * Output: .planning/reference/questions/converted-questions.json as `{ "questions": [...] }`,
 * ready to POST directly to the upload endpoint.
 *
 * Run with: npm run convert:questions
 */
import * as fs from 'fs';
import * as path from 'path';

interface UploadOption {
  id: string;
  text: string;
}

interface UploadQuestion {
  domain: string;
  topic: string;
  subpattern: string | null;
  difficulty: string;
  question_type: string;
  question_text: string;
  options: UploadOption[];
  correct_option_ids: string[];
  explanation: string;
}

const REFERENCE_DIR = path.resolve(__dirname, '../../.planning/reference/questions');
const ANALOGIES_MD_PATH = path.join(REFERENCE_DIR, '01-analogies.md');
const HTML_BANK_PATH = path.join(REFERENCE_DIR, 'reasoning_practice_question_bank.html');
const ANALOGY_EXPLORER_PATH = path.join(REFERENCE_DIR, 'competitive_exam_analogy_item_bank_explorer.html');
const OUTPUT_PATH = path.join(REFERENCE_DIR, 'converted-questions.json');

const LETTER_TO_ID: Record<string, string> = { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' };

function letterToOptionId(letter: string): string {
  const id = LETTER_TO_ID[letter.toUpperCase()];
  if (!id) {
    throw new Error(`Unrecognized option letter "${letter}"`);
  }
  return id;
}

/**
 * Parses "(A) Angry (B) Excited (C) Sorrowful (D) Calm" style option strings
 * from the markdown table into [{id: 'a', text: 'Angry'}, ...].
 */
function parseMarkdownOptions(raw: string): UploadOption[] {
  const options: UploadOption[] = [];
  const matches = [...raw.matchAll(/\(([A-E])\)\s*(.*?)(?=\s*\([A-E]\)|$)/g)];
  for (const match of matches) {
    const letter = match[1];
    const text = match[2].trim();
    if (text.length > 0) {
      options.push({ id: letterToOptionId(letter), text });
    }
  }
  return options;
}

function convertAnalogiesMarkdown(): UploadQuestion[] {
  const content = fs.readFileSync(ANALOGIES_MD_PATH, 'utf-8');
  const lines = content.split(/\r?\n/);

  const questions: UploadQuestion[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      continue;
    }

    // Split a markdown table row into cells, dropping the leading/trailing empty cells.
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length !== 7) {
      continue;
    }

    const [num, difficulty, subpattern, question, optionsRaw, answer, explanation] = cells;

    // Skip header row ("# | Difficulty | ...") and the separator row ("---|---|...").
    if (num === '#' || /^-+$/.test(num)) {
      continue;
    }

    const options = parseMarkdownOptions(optionsRaw);
    if (options.length === 0) {
      continue;
    }

    questions.push({
      domain: 'Verbal & Symbolic',
      topic: 'Analogies',
      subpattern: subpattern || null,
      difficulty: difficulty.toLowerCase(),
      question_type: 'single_choice',
      question_text: question,
      options,
      correct_option_ids: [letterToOptionId(answer.trim())],
      explanation,
    });
  }

  return questions;
}

interface RepositoryQuestion {
  id: number;
  domain: string;
  topic: string;
  subpattern: string;
  difficulty: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

/**
 * Extracts and evaluates the `const QUESTION_REPOSITORY = [...]` JS array
 * literal embedded in the HTML file. The array is trusted, local, hand-authored
 * content (not user input), so evaluating it as JS (rather than fighting a
 * regex/JSON parser against unquoted keys and embedded LaTeX escapes) is the
 * simplest reliable way to get the real values back out.
 */
/**
 * Finds the index of the bracket that closes the '[' at `openIndex`, respecting
 * string literals (so a "];" or stray bracket inside quoted question/explanation
 * text doesn't get mistaken for the real end of the array).
 */
function findMatchingBracket(content: string, openIndex: number): number {
  let depth = 0;
  let inString: string | null = null;
  for (let i = openIndex; i < content.length; i++) {
    const char = content[i];
    if (inString) {
      if (char === '\\') {
        i++; // skip the escaped character
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      continue;
    }
    if (char === '[') {
      depth++;
    } else if (char === ']') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  throw new Error('Could not find the matching closing bracket for QUESTION_REPOSITORY.');
}

/**
 * Generic extractor: finds `const <startMarker>[` in `filePath`, then slices out
 * the full array literal using bracket-depth-aware matching (see
 * findMatchingBracket) and evaluates it as JS. These source files are trusted,
 * local, hand-authored content (not user input), so `new Function` eval is the
 * simplest reliable way to get real values back out without fighting a
 * regex/JSON parser against unquoted keys and embedded LaTeX escapes.
 */
function extractArrayLiteral<T>(filePath: string, constName: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const startMarker = `const ${constName} = [`;
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`Could not find "${startMarker}" in ${filePath}.`);
  }

  const arrayStart = startIndex + startMarker.length - 1; // include the opening '['
  const endIndex = findMatchingBracket(content, arrayStart);

  const arrayLiteral = content.slice(arrayStart, endIndex + 1);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(`return (${arrayLiteral});`);
  return factory() as T[];
}

function extractRepositoryArray(): RepositoryQuestion[] {
  return extractArrayLiteral<RepositoryQuestion>(HTML_BANK_PATH, 'QUESTION_REPOSITORY');
}

interface AnalogyExplorerItem {
  id: number;
  sub: string;
  diff: string;
  dom: string;
  q: string;
  opts: string[];
  ans: string;
  exp: string;
}

/**
 * Parses "(A) Cub" style option strings (paren before the letter, unlike the
 * "A) Cub" style used elsewhere) into [{id: 'a', text: 'Cub'}, ...].
 */
function parseParenLetterOptions(raw: string[]): UploadOption[] {
  return raw.map((entry) => {
    const match = /^\(([A-E])\)\s*(.*)$/.exec(entry.trim());
    if (!match) {
      throw new Error(`Unrecognized option format "${entry}"`);
    }
    return { id: letterToOptionId(match[1]), text: match[2].trim() };
  });
}

function convertAnalogyExplorer(): UploadQuestion[] {
  const items = extractArrayLiteral<AnalogyExplorerItem>(ANALOGY_EXPLORER_PATH, 'ITEM_BANK');

  return items.map((item) => ({
    domain: 'Verbal & Symbolic',
    topic: 'Analogies',
    subpattern: item.sub || null,
    difficulty: item.diff.toLowerCase(),
    question_type: 'single_choice',
    question_text: item.q,
    options: parseParenLetterOptions(item.opts),
    correct_option_ids: [letterToOptionId(item.ans)],
    explanation: item.exp,
  }));
}

function parseHtmlOptions(raw: string[]): UploadOption[] {
  return raw.map((entry) => {
    const match = /^([A-E])\)\s*(.*)$/.exec(entry.trim());
    if (!match) {
      throw new Error(`Unrecognized option format "${entry}"`);
    }
    return { id: letterToOptionId(match[1]), text: match[2].trim() };
  });
}

function convertHtmlRepository(): UploadQuestion[] {
  const repository = extractRepositoryArray();

  return repository.map((item) => {
    const options = parseHtmlOptions(item.options);
    return {
      domain: item.domain,
      topic: item.topic,
      subpattern: item.subpattern || null,
      difficulty: item.difficulty.toLowerCase(),
      question_type: 'single_choice',
      question_text: item.question,
      options,
      correct_option_ids: [letterToOptionId(item.answer)],
      explanation: item.explanation,
    };
  });
}

function main(): void {
  const fromAnalogiesMd = convertAnalogiesMarkdown();
  const fromHtmlBank = convertHtmlRepository();
  const fromAnalogyExplorer = convertAnalogyExplorer();
  const allQuestions = [...fromAnalogiesMd, ...fromHtmlBank, ...fromAnalogyExplorer];

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ questions: allQuestions }, null, 2), 'utf-8');

  console.log('Question conversion complete.');
  console.log(`  01-analogies.md:                                     ${fromAnalogiesMd.length} questions`);
  console.log(`  reasoning_practice_question_bank.html:               ${fromHtmlBank.length} questions`);
  console.log(`  competitive_exam_analogy_item_bank_explorer.html:    ${fromAnalogyExplorer.length} questions`);
  console.log(`  Total:                                               ${allQuestions.length} questions`);
  console.log(`Output written to: ${OUTPUT_PATH}`);
}

main();
