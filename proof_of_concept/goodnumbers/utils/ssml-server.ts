import { JSDOM } from 'jsdom';

/**
 * Defines the structure of the result returned by the validation function.
 */
export interface SSMLValidationResult {
  /** The corrected SSML string, if validation and fixing were successful. */
  correctedSsml?: string;
  /** An array of warnings encountered during validation and fixing. */
  warnings: string[];
  /** An error message string if a fatal error occurred, otherwise null. */
  error: string | null; // Changed to be non-optional, will be null on success
}

/**
 * Represents an issue found during SSML validation that needs fixing or reporting.
 */
interface Issue {
  type: 'remove' | 'removeAttribute' | 'warn';
  element: Element;
  message: string;
  attributeName?: string; // Only relevant for 'removeAttribute'
}

// --- Configuration: Valid SSML Elements and Attributes ---

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
  'desc', // Valid child for audio
  'google:style', // Google-specific extension
]);

const tagAttributes: Record<string, Set<string>> = {
  speak: new Set([]), // No standard attributes for <speak> itself
  break: new Set(['time', 'strength']),
  'say-as': new Set(['interpret-as', 'format', 'detail', 'google:style', 'language']),
  audio: new Set(['src', 'clipBegin', 'clipEnd', 'speed', 'repeatCount', 'repeatDur', 'soundLevel']),
  p: new Set([]),
  s: new Set([]),
  sub: new Set(['alias']),
  mark: new Set(['name']),
  prosody: new Set(['rate', 'pitch', 'volume']),
  emphasis: new Set(['level']),
  par: new Set([]), // Container tag
  seq: new Set([]), // Container tag
  media: new Set(['xml:id', 'begin', 'end', 'repeatCount', 'repeatDur', 'soundLevel', 'fadeInDur', 'fadeOutDur']), // Container tag
  phoneme: new Set(['alphabet', 'ph']),
  voice: new Set(['name', 'gender', 'variant', 'language', 'required', 'ordering']),
  lang: new Set(['xml:lang']),
  desc: new Set([]), // Child of audio
  'google:style': new Set(['name']),
};

// --- Configuration: Valid Attribute Values ---

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

// --- Configuration: Container Tag Rules ---

const containerChildRules: Record<string, Set<string>> = {
  par: new Set(['par', 'seq', 'media']),
  seq: new Set(['par', 'seq', 'media']),
  media: new Set(['speak', 'audio']), // Note: <speak> inside <media> is unusual but technically possible in some specs
  audio: new Set(['desc']),
};

// --- Main Validation Function ---
/**
 * Removes any trailing text content found after the final closing </speak> tag in an SSML string.
 * If the </speak> tag is not found, the original string is returned.
 * This is useful for cleaning up potential generator artifacts before full validation.
 *
 * @param ssmlInput The potentially malformed SSML string.
 * @returns The SSML string trimmed to the end of the last </speak> tag, or the original string if the tag isn't found.
 */
function removeTrailingTextAfterSpeak(ssmlInput: string | null | undefined): string {
  // Handle null, undefined, or non-string inputs gracefully
  if (typeof ssmlInput !== 'string') {
    return ssmlInput ?? ''; // Return empty string for null/undefined, or the input if it's not a string somehow
  }

  const closingTag = '</speak>';
  // Find the index where the *last* closing tag starts
  const lastClosingTagIndex = ssmlInput.lastIndexOf(closingTag);

  // If the closing tag wasn't found, return the original string
  if (lastClosingTagIndex === -1) {
    console.warn('removeTrailingTextAfterSpeak: Closing </speak> tag not found. Returning original string.');
    return ssmlInput;
  }

  // Calculate the index immediately *after* the closing tag
  const endIndex = lastClosingTagIndex + closingTag.length;

  // Extract the substring from the beginning up to the end of the closing tag
  const trimmedSsml = ssmlInput.substring(0, endIndex);

  // Optional: Log if trimming actually occurred
  if (trimmedSsml.length < ssmlInput.length) {
    console.log('removeTrailingTextAfterSpeak: Removed trailing text after </speak> tag.');
  }

  return trimmedSsml;
}

/**
 * Validates and attempts to fix SSML for Google Text-to-Speech compatibility.
 * @param ssml The SSML string to validate and fix.
 * @returns SSMLValidationResult containing corrected SSML (if fixable), warnings, and errors.
 */
export function validateAndFixSsml(ssml: string): SSMLValidationResult {
  const warnings: string[] = [];

  ssml = removeTrailingTextAfterSpeak(ssml);

  // --- 1. Attempt to Parse the SSML using JSDOM ---
  let dom: JSDOM;
  try {
    // Use text/xml content type for stricter parsing
    dom = new JSDOM(ssml.trim(), { contentType: 'text/xml' });
  } catch (parseError: any) {
    return {
      warnings,
      error: `XML parsing error: ${parseError.message}. Ensure the input is well-formed XML.`,
      correctedSsml: undefined, // Explicitly undefined on error
    };
  }

  const document = dom.window.document;
  const parseErrors = document.getElementsByTagName('parsererror');

  // JSDOM might create a document even with errors, check for <parsererror> tag
  if (parseErrors.length > 0) {
    // Try to extract a more specific error message
    const errorMessage = parseErrors[0]?.textContent?.split('\n')[1]?.trim() || 'Malformed XML detected.';
    return {
      warnings,
      error: `XML parsing error: ${errorMessage}`,
      correctedSsml: undefined,
    };
  }

  // --- 2. Validate Basic Document Structure ---
  // Check for a valid root element. It must be <speak>.
  const rootElement = document.documentElement;
  if (!rootElement) {
    // This can happen if the input was empty or just comments/processing instructions
    return {
      warnings,
      error: 'Invalid SSML: No root element found.',
      correctedSsml: undefined,
    };
  }

  // Check if there's more than one top-level element (JSDOM might wrap fragments, but documentElement should be the single root)
  // A robust check involves ensuring documentElement is the only Element child of the Document itself.
  // However, checking the tagName is usually sufficient after a successful XML parse.
  if (rootElement.tagName.toLowerCase() !== 'speak') {
    return {
      warnings,
      error: `Invalid SSML: Root element must be <speak>, but found <${rootElement.tagName}>.`,
      correctedSsml: undefined,
    };
  }

  // --- 3. Escape Special Characters in Text Nodes ---
  // This prevents text content from being misinterpreted as tags.
  // Must be done *after* parsing and *before* validation logic that reads text content.
  escapeTextNodesRecursively(rootElement);

  // --- 4. Identify All Issues (Validation Pass) ---
  // Traverse the DOM and collect all validation issues without modifying the structure yet.
  const issues: Issue[] = [];
  identifyIssues(rootElement, issues);

  // --- 5. Apply Fixes ---
  // Sort issues to process removals last. This prevents errors caused by removing an element
  // while its children or attributes are still scheduled for checks or modifications.
  issues.sort((a, b) => {
    if (a.type === 'remove' && b.type !== 'remove') return 1; // 'remove' comes last
    if (a.type !== 'remove' && b.type === 'remove') return -1;
    return 0; // Keep original order otherwise
  });

  // Apply the fixes based on the identified issues
  for (const issue of issues) {
    applyFix(issue, warnings); // Warnings are accumulated here
  }

  // --- 6. Perform Final Structure Validation ---
  // After fixes are applied, run checks that depend on the corrected structure.
  const finalValidation = validateFinalStructure(document);
  warnings.push(...finalValidation.warnings); // Add any final warnings

  if (finalValidation.error) {
    // If final validation fails, return the error.
    // The SSML might be partially corrected but is still invalid.
    return {
      warnings,
      error: finalValidation.error,
      correctedSsml: document.documentElement?.outerHTML || ssml, // Return the state after fixes, even if invalid
    };
  }

  // --- 7. Success ---
  // If all checks pass and fixes are applied, return the corrected SSML.
  return {
    correctedSsml: document.documentElement.outerHTML, // Serialize the final DOM back to string
    warnings,
    error: null, // Explicitly null indicates success
  };
}

// --- Helper Functions ---

/**
 * Recursively traverses the DOM starting from the given element and escapes
 * special XML characters (&, <, >, ", ') within direct text node children.
 * It avoids escaping characters within valid tags or attributes.
 * @param element The current element to process.
 */
function escapeTextNodesRecursively(element: Element): void {
  if (!element) return;

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) {
      // Node.TEXT_NODE
      const textContent = node.textContent || '';
      const escapedText = escapeSpecialCharacters(textContent);
      // Only update if changes were actually made
      if (textContent !== escapedText) {
        node.textContent = escapedText;
      }
    } else if (node.nodeType === 1) {
      // Node.ELEMENT_NODE
      // Recursively process child elements
      escapeTextNodesRecursively(node as Element);
    }
    // Other node types (comments, processing instructions) are ignored
  }
}

/**
 * Escapes special XML characters in a string.
 * Uses a negative lookahead `(?!...)` to avoid double-escaping existing entities.
 * @param text The text to escape.
 * @returns The escaped text.
 */
function escapeSpecialCharacters(text: string): string {
  if (!text) return '';
  return text
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&') // Escape '&' unless it's part of a known entity
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}

/**
 * First pass validation: Traverses the DOM and identifies all validation issues.
 * Does NOT modify the DOM; modification happens in the applyFix step.
 * @param element The current element to validate.
 * @param issues An array to collect the identified issues.
 */
function identifyIssues(element: Element, issues: Issue[]): void {
  if (!element) return;

  const tagName = element.tagName.toLowerCase();

  // 1. Check if the tag itself is valid
  if (!validTags.has(tagName)) {
    issues.push({
      type: 'remove',
      element,
      message: `Invalid SSML tag: <${tagName}>. Removing the tag and its content.`,
    });
    // If the tag is invalid, don't bother checking its attributes or children
    return;
  }

  // 2. Check tag attributes
  const allowedAttributes = tagAttributes[tagName];
  if (allowedAttributes) {
    const attributesToRemove: string[] = []; // Collect attributes to remove for this element
    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase();
      const attributeValue = attribute.value;

      if (!allowedAttributes.has(attributeName)) {
        // Attribute is not allowed for this tag
        issues.push({
          type: 'removeAttribute',
          element,
          attributeName: attribute.name, // Use original case for removal
          message: `Invalid attribute '${attribute.name}' for tag <${tagName}>. Removing attribute.`,
        });
        attributesToRemove.push(attribute.name);
      } else if (!isValidAttributeValue(tagName, attributeName, attributeValue, element)) {
        // Attribute is allowed, but its value is invalid
        issues.push({
          type: 'removeAttribute',
          element,
          attributeName: attribute.name, // Use original case for removal
          message: `Invalid value "${attributeValue}" for attribute '${attribute.name}' in tag <${tagName}>. Removing attribute.`,
        });
        attributesToRemove.push(attribute.name);
      }
    }
  } else if (element.attributes.length > 0) {
    // Tag is valid but doesn't support *any* attributes, yet some were found
    for (const attribute of Array.from(element.attributes)) {
      issues.push({
        type: 'removeAttribute',
        element,
        attributeName: attribute.name,
        message: `Invalid attribute '${attribute.name}' for tag <${tagName}> (tag supports no attributes). Removing attribute.`,
      });
    }
  }

  // 3. Special validation for container tags (par, seq, media, audio)
  if (containerChildRules[tagName]) {
    const validChildrenSet = containerChildRules[tagName];
    let hasAtLeastOneValidChild = false;

    for (const child of Array.from(element.children)) {
      const childTagName = child.tagName.toLowerCase();
      if (!validChildrenSet.has(childTagName)) {
        // This child element is not allowed within this container
        issues.push({
          type: 'remove',
          element: child,
          message: `Invalid child tag <${childTagName}> found within <${tagName}>. Removing child.`,
        });
      } else {
        hasAtLeastOneValidChild = true;
      }
    }

    // If a container tag has children, but *none* of them are valid according to the rules,
    // the container itself might be considered invalid or useless.
    // However, removing the container might be too aggressive if it contained text nodes
    // or valid children that were later removed for other reasons.
    // We'll rely on the `validateFinalStructure` check for *empty* containers later.
    // For now, we only remove invalid children.
  }

  // 4. Check for consecutive <mark> tags (often problematic)
  if (tagName === 'mark') {
    const prevSibling = element.previousElementSibling;
    if (prevSibling && prevSibling.tagName.toLowerCase() === 'mark') {
      issues.push({
        type: 'remove',
        element, // Remove the current (second consecutive) mark tag
        message: 'Consecutive <mark> tags detected. Removing the second instance.',
      });
      // If we remove this element, don't process its children
      return;
    }
  }

  // 5. Best practice warnings (not strictly errors)
  if (['prosody', 'emphasis'].includes(tagName)) {
    // Check if the parent is a structural element (speak, p, s). If not, issue a warning.
    const parentTagName = element.parentElement?.tagName.toLowerCase();
    if (parentTagName && !['speak', 's', 'p', 'par', 'seq', 'media'].includes(parentTagName)) {
      // Added container tags here as valid parents too
      issues.push({
        type: 'warn',
        element,
        message: `<${tagName}> is recommended to wrap complete sentences or phrases within <p> or <s> tags for better synthesis control.`,
      });
    }
  }

  // 6. Recursively process child elements
  // Use Array.from to avoid issues if children are removed during the process (though removals happen later now)
  for (const child of Array.from(element.children)) {
    // Check if the child itself is already marked for removal
    const childIsMarkedForRemoval = issues.some((issue) => issue.type === 'remove' && issue.element === child);
    if (!childIsMarkedForRemoval) {
      identifyIssues(child, issues);
    }
  }
}

/**
 * Applies the fixes identified in the `identifyIssues` pass.
 * Modifies the DOM based on the issue type.
 * @param issue The issue to fix.
 * @param warnings An array to accumulate warning messages generated by fixes.
 */
function applyFix(issue: Issue, warnings: string[]): void {
  // Always add the issue message as a warning when a fix is applied (or for 'warn' type)
  warnings.push(issue.message);

  try {
    switch (issue.type) {
      case 'remove':
        // Remove the element from its parent
        if (issue.element.parentNode) {
          issue.element.parentNode.removeChild(issue.element);
        }
        break;

      case 'removeAttribute':
        // Remove the specified attribute from the element
        if (issue.attributeName) {
          issue.element.removeAttribute(issue.attributeName);
        }
        break;

      case 'warn':
        // No DOM modification needed, the warning is already added above.
        break;
    }
  } catch (e: any) {
    // Catch potential errors during DOM manipulation, though unlikely with the sorted approach
    warnings.push(`Error applying fix for "${issue.message}": ${e.message}`);
  }
}

/**
 * Performs final validation checks on the DOM structure *after* fixes have been applied.
 * Checks for conditions that might arise from the fixing process (e.g., empty containers).
 * @param document The JSDOM document object.
 * @returns A partial SSMLValidationResult containing warnings and a potential final error.
 */
function validateFinalStructure(document: Document): Pick<SSMLValidationResult, 'warnings' | 'error'> {
  const warnings: string[] = [];
  let error: string | null = null;

  const rootElement = document.documentElement;

  // This check should technically be redundant due to initial checks, but serves as a safeguard.
  if (!rootElement || rootElement.tagName.toLowerCase() !== 'speak') {
    return {
      warnings,
      error: 'Fatal Error: Document structure corrupted. Root element is missing or not <speak> after processing.',
    };
  }

  // Check for <audio> tags missing the mandatory 'src' attribute
  const audioElements = rootElement.getElementsByTagName('audio');
  for (const audio of Array.from(audioElements)) {
    if (!audio.getAttribute('src')) {
      // If src was removed due to invalid value, or was never present, this is fatal.
      warnings.push(
        `Found <audio> tag without a 'src' attribute after fixes. This tag will likely be ignored by the TTS engine.`,
      );
      error = 'Invalid SSML: One or more <audio> tags are missing the required "src" attribute.';
      // We report the first fatal error found.
      break;
    }
  }
  if (error) return { warnings, error };

  // Check for container tags that might have become empty after invalid children were removed
  for (const tagName of ['par', 'seq', 'media']) {
    const elements = rootElement.getElementsByTagName(tagName);
    for (const element of Array.from(elements)) {
      // Check if the element has neither element children nor non-empty text content
      const hasElementChildren = element.children.length > 0;
      const hasNonEmptyText = (element.textContent || '').trim().length > 0;

      if (!hasElementChildren && !hasNonEmptyText) {
        // Empty containers are usually invalid or pointless.
        warnings.push(`Empty <${tagName}> container tag found after fixes. It might be invalid or ignored.`);
        // Depending on strictness, this could be an error. Let's keep it as a warning for now,
        // unless specific requirements dictate it must be an error.
        // error = `Invalid SSML: Empty <${tagName}> container tag found.`;
        // break; // Remove this break if treating as just a warning
      }
    }
    // if (error) break; // Remove this break if treating as just a warning
  }
  // if (error) return { warnings, error }; // Remove this if treating as just a warning

  // Add more final checks here if needed...

  // If no fatal errors were found in this final pass
  return { warnings, error: null };
}

// --- Attribute Value Validation Helpers ---

/**
 * Checks if a given attribute value is valid for the specific tag and attribute name.
 * @param tagName The lowercase name of the tag.
 * @param attributeName The lowercase name of the attribute.
 * @param attributeValue The value of the attribute.
 * @param element The element node (useful for context-dependent validation like say-as format).
 * @returns True if the value is valid, false otherwise.
 */
function isValidAttributeValue(
  tagName: string,
  attributeName: string,
  attributeValue: string,
  element: Element,
): boolean {
  // Trim whitespace from value before validation, as leading/trailing spaces are often ignored or invalid.
  const value = attributeValue.trim();
  if (value === '') return false; // Generally, empty attribute values are not valid unless specified otherwise.

  switch (tagName) {
    case 'break':
      if (attributeName === 'time') return isValidTime(value);
      if (attributeName === 'strength') return breakStrengthValues.has(value);
      break;

    case 'say-as':
      if (attributeName === 'interpret-as') return sayAsInterpretAsValues.has(value);
      if (attributeName === 'format') {
        // Format validation depends on interpret-as. If interpret-as is missing or invalid,
        // format validation might be meaningless, but we check basic patterns.
        const interpretAs = element.getAttribute('interpret-as')?.trim();
        if (interpretAs === 'date') return /^[ymd]+$/.test(value); // Basic check: y, m, d chars only
        if (interpretAs === 'time') return /^(h|m|s|Z|12|24)+$/.test(value); // Basic check: h, m, s, Z, 12, 24
        // Other interpret-as types might have specific format requirements.
        // For simplicity, we allow format for others unless specified.
        return true;
      }
      if (attributeName === 'detail') return ['1', '2'].includes(value); // '1' or '2'
      if (attributeName === 'language') return isValidBcp47LanguageCode(value);
      // google:style handled below
      break;

    case 'audio':
      if (attributeName === 'src') return isValidHttpsUrl(value);
      if (['clipBegin', 'clipEnd', 'repeatDur'].includes(attributeName)) return isValidTime(value);
      if (attributeName === 'speed') {
        // Allow percentage like "150%"
        if (value.endsWith('%')) {
          const percentage = parseFloat(value.slice(0, -1));
          // Google specific range might be different, check their docs. Assuming 50% to 200% is reasonable.
          return !isNaN(percentage) && percentage >= 50 && percentage <= 200;
        }
        return false; // Require percentage for speed? Or allow factors? Assume % for now.
      }
      if (attributeName === 'soundLevel') return isValidSoundLevel(value);
      if (attributeName === 'repeatCount') {
        // Must be a positive number (can be float like 2.5)
        const count = parseFloat(value);
        return !isNaN(count) && count > 0;
      }
      break;

    case 'prosody':
      if (attributeName === 'rate') {
        // Predefined values or percentage (e.g., "120%")
        return prosodyRateValues.has(value) || /^\d+(\.\d+)?%$/.test(value);
      }
      if (attributeName === 'pitch') {
        // Predefined values or relative change (e.g., "+5%", "-10st")
        return prosodyPitchValues.has(value) || /^[+-]\d+(\.\d+)?(st|%)$/.test(value);
      }
      if (attributeName === 'volume') {
        // Predefined values or dB change (e.g., "+6dB", "-2.5dB")
        return prosodyVolumeValues.has(value) || isValidSoundLevel(value);
      }
      break;

    case 'emphasis':
      if (attributeName === 'level') return emphasisLevelValues.has(value);
      break;

    case 'phoneme':
      if (attributeName === 'alphabet') return phonemeAlphabetValues.has(value);
      if (attributeName === 'ph') return value.length > 0; // Basic check: must not be empty
      break;

    case 'voice':
      if (attributeName === 'gender') return voiceGenderValues.has(value);
      if (attributeName === 'language') return isValidBcp47LanguageCode(value);
      // Other attributes like name, variant, required, ordering often depend on the specific TTS engine capabilities.
      // Basic check: ensure they are not empty.
      return value.length > 0;
      break;

    case 'media':
      if (['begin', 'end', 'fadeInDur', 'fadeOutDur', 'repeatDur'].includes(attributeName)) {
        // Allows time values or syncbase values (e.g., "markName.end+1s")
        return isValidTimeSpecification(value);
      }
      if (attributeName === 'soundLevel') return isValidSoundLevel(value);
      if (attributeName === 'xml:id') return isValidXmlId(value);
      if (attributeName === 'repeatCount') {
        const count = parseFloat(value);
        return !isNaN(count) && count > 0; // Positive number
      }
      break;

    case 'lang':
      if (attributeName === 'xml:lang') return isValidBcp47LanguageCode(value);
      break;

    case 'google:style': // Attribute on say-as
      if (attributeName === 'name') return googleStyleValues.has(value);
      break;

    case 'mark':
      if (attributeName === 'name') return value.length > 0 && !/\s/.test(value); // Name should likely not contain whitespace
      break;

    case 'sub':
      if (attributeName === 'alias') return value.length > 0; // Alias should not be empty
      break;

    // Tags with no attributes ('speak', 'p', 's', 'par', 'seq', 'desc') are handled by the check in identifyIssues
  }

  // Default assumption: If the tag/attribute combination is known but has no specific validation rule here,
  // assume the value is acceptable as long as it's not empty.
  // This might be too permissive for some cases. Consider adding more specific checks or defaulting to false if unsure.
  return value.length > 0;
}

/** Checks for SSML time format (e.g., "1s", "250ms", "+1.5s"). */
function isValidTime(time: string): boolean {
  // Allows optional sign, digits (with optional decimal), and unit (h, min, s, ms)
  // Allows whitespace around the value.
  return /^\s*(?:\+|-)?\s*\d+(\.\d+)?(h|min|s|ms)?\s*$/.test(time);
}

/** Checks for SSML sound level format (e.g., "+6dB", "-2.5dB", "0dB"). */
function isValidSoundLevel(level: string): boolean {
  // Allows optional sign, digits (with optional decimal), and "dB" unit.
  return /^[+-]?(\d+(\.\d+)?|\.\d+)dB$/.test(level);
}

/** Checks for SSML syncbase time format (e.g., "someId.begin+1s", "marker.end-500ms"). */
function isValidSyncbase(time: string): boolean {
  // Matches ID (letters, numbers, _, -, #) followed by .begin or .end,
  // then an optional offset (sign, time value with unit).
  // Note: XML ID validation (isValidXmlId) is more complex than the regex here.
  // This regex assumes the ID part is reasonably formed.
  return /^[a-zA-Z0-9_\-#]+\.(begin|end)(\s*(?:\+|-)\s*\d+(\.\d+)?(h|min|s|ms)?)?\s*$/.test(time);
}

/** Checks if a string is a valid SSML time specification (either simple time or syncbase). */
function isValidTimeSpecification(time: string): boolean {
  return isValidTime(time) || isValidSyncbase(time);
}

/** Checks if a string is a valid HTTPS URL. */
function isValidHttpsUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:';
  } catch {
    return false; // Invalid URL format
  }
}

/** Checks if a string is a valid XML ID (Name). */
function isValidXmlId(id: string): boolean {
  // XML IDs (Name type) must start with a letter or underscore,
  // and can be followed by letters, digits, hyphens, underscores, or periods.
  // Colon (:) is technically allowed but often reserved for namespaces. Avoid if possible.
  // Based on XML 1.0 Name production: https://www.w3.org/TR/xml/#NT-Name
  // This regex is a common approximation.
  return /^[a-zA-Z_][\w.\-]*$/.test(id);
  // For stricter validation according to XML spec including Unicode ranges:
  // const nameStartChar = /[:A-Z_a-z\u{C0}-\u{D6}\u{D8}-\u{F6}\u{F8}-\u{2FF}\u{370}-\u{37D}\u{37F}-\u{1FFF}\u{200C}-\u{200D}\u{2070}-\u{218F}\u{2C00}-\u{2FEF}\u{3001}-\u{D7FF}\u{F900}-\u{FDCF}\u{FDF0}-\u{FFFD}\u{10000}-\u{EFFFF}]/u;
  // const nameChar = /[.:\-\dA-Z_a-z\u{B7}\u{C0}-\u{D6}\u{D8}-\u{F6}\u{F8}-\u{37D}\u{37F}-\u{1FFF}\u{200C}-\u{200D}\u{203F}-\u{2040}\u{2070}-\u{218F}\u{2C00}-\u{2FEF}\u{3001}-\u{D7FF}\u{F900}-\u{FDCF}\u{FDF0}-\u{FFFD}\u{10000}-\u{EFFFF}]/u;
  // return nameStartChar.test(id[0]) && Array.from(id.substring(1)).every(char => nameChar.test(char));
}

/** Checks if a string is a plausible BCP-47 language code. */
function isValidBcp47LanguageCode(code: string): boolean {
  // BCP-47 is complex (language[-script][-region][-variant][-extension][-privateuse])
  // This regex provides basic validation for common formats like "en", "en-US", "zh-Hans".
  // It checks for language (2-3 letters) followed by optional subtags (alphanumeric, 2-8 chars).
  // It does NOT validate if the specific code exists or is canonical.
  // See RFC 5646 for full details.
  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$/.test(code)) {
    return false;
  }
  // Optional: Add checks for specific common subtags if needed, e.g., script is 4 letters, region is 2 letters or 3 digits.
  // For most TTS purposes, the basic structure check is often sufficient.
  return true;
}
