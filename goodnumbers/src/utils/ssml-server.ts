'use server';

// app/utils/ssml.ts
import { DOMParser, XMLSerializer, Element, Node } from '@xmldom/xmldom';

interface SSMLCheck {
  isCorrect: boolean;
  error?: string;
  processedSsml: string;
}

/**
 * Escapes special characters in SSML text content while preserving tags.
 * @param ssmlString The SSML markup string to process
 * @returns The processed SSML with special characters escaped in text nodes only
 */
export async function escapeSSMLText(ssmlString: string): Promise<string> {
  // Split on XML tags using regex
  const pattern = /(<[^>]*>)/;
  const parts = ssmlString.split(pattern);

  // Process each part - if it's not a tag, escape special characters
  const processedParts = parts.map((part) => {
    if (!part.startsWith('<') || !part.endsWith('>')) {
      return part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    return part;
  });

  const escapedString = processedParts.join('');

  try {
    // Parse and format properly
    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const doc = parser.parseFromString(escapedString, 'text/xml');

    // Check for parsing errors
    const parseError = doc.getElementsByTagName('parsererror')[0];
    if (parseError) {
      console.warn(`Warning: Could not parse XML after escaping: ${parseError.textContent}`);
      return escapedString;
    }

    return serializer.serializeToString(doc);
  } catch (e) {
    console.warn(`Warning: XML processing error: ${e instanceof Error ? e.message : String(e)}`);
    return escapedString;
  }
}

export async function checkGoogleTtsSSMLFormat(ssmlString: string, escape: boolean = true): Promise<SSMLCheck> {
  if (escape) {
    ssmlString = await escapeSSMLText(ssmlString);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ssmlString, 'text/xml');

    // Check for parsing errors
    const errors = Array.from(doc.getElementsByTagName('parsererror'));
    if (errors.length > 0) {
      return {
        isCorrect: false,
        error: `Invalid SSML: ${errors[0].textContent}`,
        processedSsml: ssmlString,
      };
    }

    if (!doc.documentElement) {
      return {
        isCorrect: false,
        error: 'Invalid SSML: No root element found',
        processedSsml: ssmlString,
      };
    }

    const validInterpretAsValues = [
      'date',
      'time',
      'telephone',
      'cardinal',
      'ordinal',
      'digits',
      'fraction',
      'unit',
      'verbatim',
      'spell-out',
      'currency',
    ];

    // Process all elements
    const processNode = (node: Element): SSMLCheck | null => {
      const nodeName = node.nodeName;

      if (nodeName === 'break') {
        if (!node.hasAttribute('time')) {
          return {
            isCorrect: false,
            error: "Invalid SSML: <break> tag is missing 'time' attribute.",
            processedSsml: ssmlString,
          };
        }

        const timeValue = node.getAttribute('time') || '';
        let number: string;
        let unit: string;

        if (timeValue.endsWith('ms')) {
          number = timeValue.slice(0, -2);
          unit = 'ms';
        } else if (timeValue.endsWith('s')) {
          number = timeValue.slice(0, -1);
          unit = 's';
        } else {
          return {
            isCorrect: false,
            error: `Invalid SSML: <break> tag time value '${timeValue}' must end with 'ms' or 's'`,
            processedSsml: ssmlString,
          };
        }

        if (isNaN(parseFloat(number))) {
          return {
            isCorrect: false,
            error: `Invalid SSML: <break> tag has invalid time number '${number}'`,
            processedSsml: ssmlString,
          };
        }

        if (unit !== 'ms' && unit !== 's') {
          return {
            isCorrect: false,
            error: `Invalid SSML: <break> tag has invalid time unit '${unit}'`,
            processedSsml: ssmlString,
          };
        }
      } else if (nodeName === 'say-as') {
        if (!node.hasAttribute('interpret-as')) {
          // Set default interpret-as attribute to "verbatim"
          node.setAttribute('interpret-as', 'verbatim');
        } else {
          const interpretAsValue = node.getAttribute('interpret-as');
          if (!validInterpretAsValues.includes(interpretAsValue || '')) {
            return {
              isCorrect: false,
              error: `Invalid SSML: <say-as> tag has invalid 'interpret-as' value '${interpretAsValue}'`,
              processedSsml: ssmlString,
            };
          }
        }
      }

      // Process child nodes
      const childNodes = node.childNodes;
      for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i];
        if (child.nodeType === 1) {
          // ELEMENT_NODE
          const result = processNode(child as Element);
          if (result) {
            return result; // Return first error encountered
          }
        }
      }

      return null; // No errors found in this branch
    };

    // Start processing from root
    const validationResult = processNode(doc.documentElement);
    if (validationResult) {
      return validationResult;
    }

    // If we get here, the SSML is valid
    const serializer = new XMLSerializer();
    const processedSsml = serializer.serializeToString(doc);

    return {
      isCorrect: true,
      processedSsml,
    };
  } catch (error) {
    return {
      isCorrect: false,
      error: `Invalid SSML: ${(error as Error).message}`,
      processedSsml: ssmlString,
    };
  }
}

// export { ssmlToMarkdown, checkGoogleTtsSSMLFormat };
