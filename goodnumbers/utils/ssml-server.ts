import { JSDOM } from 'jsdom';

export interface SSMLValidationResult {
  correctedSsml?: string;
  warnings: string[];
  error?: string;
}

/**
 * Validates and fixes SSML for Google Text-to-Speech compatibility
 * @param ssml The SSML string to validate and fix
 * @returns ValidationResult containing corrected SSML (if fixable), warnings, and errors
 */
export function validateAndFixSsml(ssml: string): SSMLValidationResult {
  const warnings: string[] = [];

  // --- 1. Root <speak> Tag check & fix first ---
  let preprocessedSsml = fixSpeakTags(ssml, warnings);

  // Early return if we couldn't fix the basic structure
  if (!preprocessedSsml) {
    return {
      warnings,
      error: 'Could not create valid SSML structure. Check for malformed XML.',
    };
  }

  let dom: JSDOM;
  try {
    dom = new JSDOM(preprocessedSsml, { contentType: 'text/xml' });
  } catch (parseError: any) {
    return {
      warnings,
      error: `XML parsing error: ${parseError.message}`,
    };
  }

  const document = dom.window.document;

  // --- 2. Now escape special characters in text nodes only ---
  escapeTextNodesRecursively(document.documentElement);

  const issues: Issue[] = [];

  // First pass: identify all issues without modifying the DOM
  identifyIssues(document.documentElement, issues);

  // Sort issues to process removals last (to avoid modifying the DOM while traversing)
  issues.sort((a, b) => {
    if (a.type === 'remove' && b.type !== 'remove') return 1;
    if (a.type !== 'remove' && b.type === 'remove') return -1;
    return 0;
  });

  // Apply fixes
  for (const issue of issues) {
    applyFix(issue, warnings);
  }

  // Perform final validation
  const finalValidation = validateFinalStructure(document);
  if (finalValidation.error) {
    return {
      warnings: [...warnings, ...finalValidation.warnings],
      error: finalValidation.error,
    };
  }

  return {
    correctedSsml: document.documentElement.outerHTML,
    warnings,
  };
}

/**
 * Recursively escape special characters in text nodes only
 */
function escapeTextNodesRecursively(element: Element): void {
  // Process text nodes that are direct children of this element
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) {
      // Node.TEXT_NODE = 3
      const textContent = node.textContent || '';
      const escapedText = escapeSpecialCharacters(textContent);
      if (textContent !== escapedText) {
        node.textContent = escapedText;
      }
    } else if (node.nodeType === 1) {
      // Node.ELEMENT_NODE = 1
      // Recursively process child elements
      escapeTextNodesRecursively(node as Element);
    }
  }
}

// Helper Types
type IssueType = 'remove' | 'removeAttribute' | 'warn';

interface Issue {
  type: IssueType;
  element: Element;
  message: string;
  attributeName?: string;
}

/**
 * Pre-processing: Escape special XML characters
 */
function escapeSpecialCharacters(text: string): string {
  return text
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Fix issues with <speak> tags
 */
function fixSpeakTags(ssml: string, warnings: string[]): string {
  // Check if speak tags are balanced
  const hasOpenTag = ssml.includes('<speak');
  const hasCloseTag = ssml.includes('</speak>');

  // Handle missing speak tags
  if (!hasOpenTag && !hasCloseTag) {
    warnings.push('Missing <speak> root element. Wrapping content.');
    return `<speak>${ssml}</speak>`;
  } else if (hasOpenTag && !hasCloseTag) {
    warnings.push('Missing </speak> closing tag. Adding.');
    return `${ssml}</speak>`;
  } else if (!hasOpenTag && hasCloseTag) {
    warnings.push('Missing <speak> opening tag. Adding.');
    return `<speak>${ssml}`;
  }

  // Handle multiple speak tags or other structural issues with regex-based approach
  // Count opening and closing speak tags
  const openTagMatches = ssml.match(/<speak[^>]*>/g) || [];
  const closeTagMatches = ssml.match(/<\/speak>/g) || [];

  if (openTagMatches.length > 1 || closeTagMatches.length > 1) {
    warnings.push('Multiple <speak> tags detected. Attempting to consolidate.');

    // Extract content from the first opening tag to the last closing tag
    const startIdx = ssml.indexOf(openTagMatches[0]!) + openTagMatches[0]!.length;
    const endIdx = ssml.lastIndexOf('</speak>');

    if (endIdx > startIdx) {
      // Get content between first opening and last closing tag
      const content = ssml.substring(startIdx, endIdx);
      return `<speak>${content}</speak>`;
    }
  }

  return ssml;
}

// Configuration - Valid tags and attributes
const validTags = new Set([
  'speak',
  'break',
  'say-as',
  'audio',
  'p',
  's',
  'sub',
  'mark',
  'prosody',
  'emphasis',
  'par',
  'seq',
  'media',
  'phoneme',
  'voice',
  'lang',
  'desc', // Added as valid child for audio
  'google:style', // Added support for Google's style tag
]);

const tagAttributes: Record<string, Set<string>> = {
  speak: new Set([]),
  break: new Set(['time', 'strength']),
  'say-as': new Set(['interpret-as', 'format', 'detail', 'google:style', 'language']),
  audio: new Set(['src', 'clipBegin', 'clipEnd', 'speed', 'repeatCount', 'repeatDur', 'soundLevel']),
  p: new Set([]),
  s: new Set([]),
  sub: new Set(['alias']),
  mark: new Set(['name']),
  prosody: new Set(['rate', 'pitch', 'volume']),
  emphasis: new Set(['level']),
  par: new Set([]),
  seq: new Set([]),
  media: new Set(['xml:id', 'begin', 'end', 'repeatCount', 'repeatDur', 'soundLevel', 'fadeInDur', 'fadeOutDur']),
  phoneme: new Set(['alphabet', 'ph']),
  voice: new Set(['name', 'gender', 'variant', 'language', 'required', 'ordering']),
  lang: new Set(['xml:lang']),
  desc: new Set([]),
  'google:style': new Set(['name']),
};

// Valid attribute values
const sayAsInterpretAsValues = new Set([
  'currency',
  'telephone',
  'verbatim',
  'spell-out',
  'date',
  'characters',
  'cardinal',
  'ordinal',
  'fraction',
  'expletive',
  'bleep',
  'unit',
  'time',
  'duration',
]);

const breakStrengthValues = new Set(['x-weak', 'weak', 'medium', 'strong', 'x-strong', 'none']);
const emphasisLevelValues = new Set(['strong', 'moderate', 'none', 'reduced']);
const phonemeAlphabetValues = new Set(['ipa', 'x-sampa', 'yomigana', 'pinyin', 'jyutping']);
const voiceGenderValues = new Set(['male', 'female', 'neutral']);
const googleStyleValues = new Set(['apologetic', 'calm', 'empathetic', 'firm', 'lively']);
const prosodyRateValues = new Set(['x-slow', 'slow', 'medium', 'fast', 'x-fast']);
const prosodyPitchValues = new Set(['x-low', 'low', 'medium', 'high', 'x-high']);
const prosodyVolumeValues = new Set(['silent', 'x-soft', 'soft', 'medium', 'loud', 'x-loud']);

// Container tag validation rules
const containerChildRules: Record<string, Set<string>> = {
  par: new Set(['par', 'seq', 'media']),
  seq: new Set(['par', 'seq', 'media']),
  media: new Set(['speak', 'audio']),
  audio: new Set(['desc']),
};

/**
 * Validate attribute values
 * @param tagName The name of the tag
 * @param attributeName The name of the attribute to validate
 * @param attributeValue The value of the attribute to validate
 * @param element The DOM element that contains this attribute
 */
function isValidAttributeValue(
  tagName: string,
  attributeName: string,
  attributeValue: string,
  element: Element,
): boolean {
  switch (tagName) {
    case 'break':
      if (attributeName === 'time') {
        return isValidTime(attributeValue);
      } else if (attributeName === 'strength') {
        return breakStrengthValues.has(attributeValue);
      }
      break;

    case 'say-as':
      if (attributeName === 'interpret-as') {
        return sayAsInterpretAsValues.has(attributeValue);
      } else if (attributeName === 'format') {
        // Basic validation for format attribute based on interpret-as value
        const interpretAs = element.getAttribute('interpret-as');
        if (interpretAs === 'date') {
          return /^[ymd]+$/.test(attributeValue);
        } else if (interpretAs === 'time') {
          return /^(h|m|s|Z|12|24)+$/.test(attributeValue);
        }
        return true;
      } else if (attributeName === 'detail') {
        return ['1', '2'].includes(attributeValue);
      }
      break;

    case 'audio':
      if (attributeName === 'src') {
        return isValidHttpsUrl(attributeValue);
      } else if (['clipBegin', 'clipEnd', 'repeatDur'].includes(attributeName)) {
        return isValidTime(attributeValue);
      } else if (attributeName === 'speed') {
        const percentage = parseFloat(attributeValue.replace('%', ''));
        return !isNaN(percentage) && percentage >= 50 && percentage <= 200 && attributeValue.endsWith('%');
      } else if (attributeName === 'soundLevel') {
        return /^[+-]?(\d+(\.\d+)?|\.\d+)dB$/.test(attributeValue);
      } else if (attributeName === 'repeatCount') {
        const count = parseFloat(attributeValue);
        return !isNaN(count) && count > 0;
      }
      break;

    case 'prosody':
      if (attributeName === 'rate') {
        return prosodyRateValues.has(attributeValue) || /^\d+(\.\d+)?%$/.test(attributeValue);
      } else if (attributeName === 'pitch') {
        return prosodyPitchValues.has(attributeValue) || /^[+-]\d+(\.\d+)?(st|%)$/.test(attributeValue);
      } else if (attributeName === 'volume') {
        return prosodyVolumeValues.has(attributeValue) || /^[+-]?(\d+(\.\d+)?|\.\d+)dB$/.test(attributeValue);
      }
      break;

    case 'emphasis':
      if (attributeName === 'level') {
        return emphasisLevelValues.has(attributeValue);
      }
      break;

    case 'phoneme':
      if (attributeName === 'alphabet') {
        return phonemeAlphabetValues.has(attributeValue);
      }
      break;

    case 'voice':
      if (attributeName === 'gender') {
        return voiceGenderValues.has(attributeValue);
      } else if (attributeName === 'language') {
        return isValidBcp47LanguageCode(attributeValue);
      }
      break;

    case 'media':
      if (['begin', 'end', 'fadeInDur', 'fadeOutDur'].includes(attributeName)) {
        return isValidTimeSpecification(attributeValue);
      } else if (attributeName === 'soundLevel') {
        return /^[+-]?(\d+(\.\d+)?|\.\d+)dB$/.test(attributeValue);
      } else if (attributeName === 'xml:id') {
        return isValidXmlId(attributeValue);
      } else if (attributeName === 'repeatCount') {
        const count = parseFloat(attributeValue);
        return !isNaN(count) && count > 0;
      }
      break;

    case 'lang':
      if (attributeName === 'xml:lang') {
        return isValidBcp47LanguageCode(attributeValue);
      }
      break;

    case 'google:style':
      if (attributeName === 'name') {
        return googleStyleValues.has(attributeValue);
      }
      break;
  }

  return true; // Default to true for unspecified validations
}

/**
 * Time format validation helper functions
 */
function isValidTime(time: string): boolean {
  return /^\s*(?:\+|-)?\s*(\d+(\.\d+)?)(h|min|s|ms)?\s*$/.test(time);
}

function isValidSyncbase(time: string): boolean {
  // Match ID.event+/-offset format without Unicode property escapes
  return /^[a-zA-Z0-9_\-#]+\.(begin|end)\s*(?:\+|-)\s*(\d+(\.\d+)?)(h|min|s|ms)?\s*$/.test(time);
}

function isValidTimeSpecification(time: string): boolean {
  return isValidTime(time) || isValidSyncbase(time);
}

/**
 * URL validation helper
 */
function isValidHttpsUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * XML ID validation helper
 */
function isValidXmlId(id: string): boolean {
  // XML IDs must start with a letter or underscore, followed by letters, digits, underscores, hyphens, or periods
  return /^[a-zA-Z_][\w\-\.]*$/.test(id);
}

/**
 * BCP-47 language code validation
 * This is a more comprehensive validation than the original
 */
function isValidBcp47LanguageCode(code: string): boolean {
  // Basic format: Primary language tag + optional subtags
  // Examples: en, en-US, zh-Hans-CN, etc.
  return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(code);
}

/**
 * First pass: identify issues without modifying the DOM
 */
function identifyIssues(element: Element, issues: Issue[]): void {
  const tagName = element.tagName.toLowerCase();

  // 1. Check if tag is valid
  if (!validTags.has(tagName)) {
    issues.push({
      type: 'remove',
      element,
      message: `Invalid tag: <${tagName}>. Removing.`,
    });
    return; // Don't process children of invalid tags
  }

  // 2. Check tag attributes
  const allowedAttributes = tagAttributes[tagName];
  if (allowedAttributes) {
    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase();
      if (!allowedAttributes.has(attributeName)) {
        issues.push({
          type: 'removeAttribute',
          element,
          attributeName: attribute.name,
          message: `Invalid attribute: ${attributeName} for tag <${tagName}>. Removing.`,
        });
      } else if (!isValidAttributeValue(tagName, attributeName, attribute.value, element)) {
        issues.push({
          type: 'removeAttribute',
          element,
          attributeName: attribute.name,
          message: `Invalid value for attribute ${attributeName} in tag <${tagName}>. Removing attribute.`,
        });
      }
    }
  }

  // 3. Special handling for container tags
  if (containerChildRules[tagName]) {
    const validChildren = containerChildRules[tagName];
    let hasValidChild = false;

    for (const child of Array.from(element.children)) {
      const childTagName = child.tagName.toLowerCase();
      if (!validChildren.has(childTagName)) {
        issues.push({
          type: 'remove',
          element: child,
          message: `Invalid child tag <${childTagName}> within <${tagName}>. Removing child.`,
        });
      } else {
        hasValidChild = true;
      }
    }

    if (!hasValidChild && element.children.length > 0) {
      issues.push({
        type: 'remove',
        element,
        message: `Container tag <${tagName}> has no valid children. Removing container.`,
      });
      return; // Don't process further
    }
  }

  // 4. Check for consecutive mark tags
  if (tagName === 'mark') {
    let prevElement = element.previousElementSibling;
    if (prevElement && prevElement.tagName.toLowerCase() === 'mark') {
      issues.push({
        type: 'remove',
        element,
        message: 'Consecutive <mark> tags. Removing this instance.',
      });
      return;
    }
  }

  // 5. Special handling for prosody, emphasis tags
  if (['prosody', 'emphasis'].includes(tagName)) {
    // Check if it wraps complete sentences
    const parentTagName = element.parentElement?.tagName.toLowerCase();
    if (parentTagName && !['speak', 's', 'p'].includes(parentTagName)) {
      issues.push({
        type: 'warn',
        element,
        message: `<${tagName}> should wrap complete sentences for best results.`,
      });
    }
  }

  // Process children recursively
  for (const child of Array.from(element.children)) {
    identifyIssues(child, issues);
  }
}

/**
 * Apply fixes for identified issues
 */
function applyFix(issue: Issue, warnings: string[]): void {
  warnings.push(issue.message);

  switch (issue.type) {
    case 'remove':
      if (issue.element.parentNode) {
        issue.element.parentNode.removeChild(issue.element);
      }
      break;

    case 'removeAttribute':
      if (issue.attributeName) {
        issue.element.removeAttribute(issue.attributeName);
      }
      break;

    case 'warn':
      // Just add warning, no DOM modification
      break;
  }
}

/**
 * Final validation of the document structure
 */
function validateFinalStructure(document: Document): SSMLValidationResult {
  const warnings: string[] = [];

  // Check if root element is <speak>
  const rootElement = document.documentElement;
  if (rootElement.tagName.toLowerCase() !== 'speak') {
    return {
      warnings,
      error: 'Root element is not <speak> after corrections.',
    };
  }

  // Check for any audio tags with missing src
  const audioElements = document.getElementsByTagName('audio');
  for (const audio of Array.from(audioElements)) {
    if (!audio.getAttribute('src')) {
      return {
        warnings: [...warnings, 'Audio tag is missing required src attribute.'],
        error: 'Unrecoverable audio tag without src attribute.',
      };
    }
  }

  // Check for empty container tags
  for (const tagName of ['par', 'seq', 'media']) {
    const elements = document.getElementsByTagName(tagName);
    for (const element of Array.from(elements)) {
      if (element.children.length === 0) {
        return {
          warnings: [...warnings, `Empty ${tagName} container found.`],
          error: `Unrecoverable empty ${tagName} container.`,
        };
      }
    }
  }

  return { warnings };
}
