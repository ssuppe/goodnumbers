# pylint: disable=no-member
from dataclasses import dataclass
from typing import Optional
import re
from lxml import etree

# pylint: disable=no-member
from dataclasses import dataclass
from typing import Optional
import re
from lxml import etree

def fix_unclosed_tags(ssml_string: str) -> str:
    """
    Fixes unclosed tags in SSML, particularly the <laughs> tag.
    
    Args:
        ssml_string (str): The SSML markup string to process
        
    Returns:
        str: The processed SSML with fixed tag closure
    """
    # Keep track of opened tags in order
    tag_stack = []
    # Regular expression to find all tags (opening and closing)
    pattern = r'</?[^>]+>'
    
    # Split the string into parts keeping the delimiters
    parts = []
    last_end = 0
    for match in re.finditer(pattern, ssml_string):
        start, end = match.span()
        if start > last_end:
            parts.append(ssml_string[last_end:start])
        parts.append(ssml_string[start:end])
        last_end = end
    if last_end < len(ssml_string):
        parts.append(ssml_string[last_end:])

    # Process each part
    result_parts = []
    for part in parts:
        if part.startswith('</'):
            # Closing tag
            tag_name = re.match(r'</([^>]+)>', part)
            if tag_name:
                tag_name = tag_name.group(1)
                # If this is closing a tag that's not the last opened tag,
                # we need to close intermediate tags first
                while tag_stack and tag_stack[-1] != tag_name:
                    result_parts.append(f'</{tag_stack.pop()}>')
                if tag_stack:
                    tag_stack.pop()  # Remove the matched tag
                result_parts.append(part)
        elif part.startswith('<') and not part.endswith('/>'):
            # Opening tag
            tag_name = re.match(r'<([^\s>]+)', part)
            if tag_name:
                tag_name = tag_name.group(1)
                tag_stack.append(tag_name)
                result_parts.append(part)
        else:
            # Text content or self-closing tag
            result_parts.append(part)

    # Close any remaining open tags in reverse order
    while tag_stack:
        result_parts.append(f'</{tag_stack.pop()}>')

    return ''.join(result_parts)

def escape_ssml_text(ssml_string: str) -> str:
    """
    Escapes special characters in SSML text content while preserving tags.
    
    Args:
        ssml_string (str): The SSML markup string to process
        
    Returns:
        str: The processed SSML with special characters escaped in text nodes only
    """
    # First fix any unclosed tags
    ssml_string = fix_unclosed_tags(ssml_string)
    
    # Now proceed with normal escaping
    pattern = r'(<[^>]*>)'
    parts = re.split(pattern, ssml_string)
    
    # Process each part - if it's not a tag, escape special characters
    for i in range(len(parts)):
        if not parts[i].startswith('<') or not parts[i].endswith('>'):
            parts[i] = (parts[i]
                       .replace('&', '&amp;')
                       .replace('<', '&lt;')
                       .replace('>', '&gt;'))
    
    # Rejoin the string
    escaped_string = ''.join(parts)
    
    # Now parse and format properly
    try:
        root = etree.fromstring(escaped_string.encode('utf-8'))  # pylint: disable=c-extension-no-member
        return etree.tostring(root, encoding='unicode')  # pylint: disable=c-extension-no-member
    except etree.XMLSyntaxError as e:  # pylint: disable=c-extension-no-member
        print(f"Warning: Could not parse XML after escaping: {e}")
        return escaped_string
    
from dataclasses import dataclass
from typing import Optional
from lxml import etree

@dataclass
class SSMLCheck:
    """
    Result of SSML validation check.
    
    Attributes:
        isCorrect (bool): Whether the SSML is valid
        reason (Optional[str]): Reason for failure if invalid, None if valid
        processedSSML (Optional[str]): The processed SSML with escapes and closed tags
    """
    isCorrect: bool
    reason: Optional[str] = None
    processedSSML: Optional[str] = None

    def __str__(self) -> str:
        if self.isCorrect:
            return f"SSML validation passed\nProcessed SSML: {self.processedSSML}"
        return f"SSML validation failed: {self.reason}"

    def __repr__(self) -> str:
        return f"SSMLCheck(isCorrect={self.isCorrect}, reason={repr(self.reason)}, processedSSML={repr(self.processedSSML)})"

def check_google_tts_ssml_format(ssml_string: str, escape: bool = True) -> SSMLCheck:
    """
    Checks if the SSML string meets Google TTS requirements.
    
    Args:
        ssml_string (str): The SSML markup string to check
        escape (bool): Whether to escape special characters first
        
    Returns:
        SSMLCheck: Object containing validation result, optional failure reason, and processed SSML
    """
    if escape:
        ssml_string = escape_ssml_text(ssml_string)
    
    try:
        root = etree.fromstring(ssml_string.encode('utf-8'), etree.XMLParser(resolve_entities=False))  # pylint: disable=c-extension-no-member
        
        for element in root.iter():
            if element.tag == "break":
                if "time" not in element.attrib:
                    return SSMLCheck(False, "Invalid SSML: <break> tag is missing 'time' attribute.")
                
                time_value = element.get("time", "")
                # Find the last occurrence of either 'ms' or 's'
                if time_value.endswith('ms'):
                    number = time_value[:-2]
                    unit = 'ms'
                elif time_value.endswith('s'):
                    number = time_value[:-1]
                    unit = 's'
                else:
                    return SSMLCheck(False, f"Invalid SSML: <break> tag time value '{time_value}' must end with 'ms' or 's'")
                
                try:
                    # Convert the number part to float
                    float(number)
                    if unit not in ["ms", "s"]:
                        return SSMLCheck(False, f"Invalid SSML: <break> tag has invalid time unit '{unit}'")
                except ValueError:
                    return SSMLCheck(False, f"Invalid SSML: <break> tag has invalid time number '{number}'")
                    
            elif element.tag == "say-as":
                if "interpret-as" not in element.attrib:
                    # Set default interpret-as attribute to "verbatim"
                    element.set("interpret-as", "verbatim")
                else:
                    interpret_as_value = element.get("interpret-as", "")
                    valid_interpretations = [
                        "date", "time", "telephone", "cardinal", "ordinal", "digits",
                        "fraction", "unit", "verbatim", "spell-out", "currency"
                    ]
                    if interpret_as_value not in valid_interpretations:
                        return SSMLCheck(False, f"Invalid SSML: <say-as> tag has invalid 'interpret-as' value '{interpret_as_value}'")
            # elif element.tag == "emphasis":
            #     if "level" not in element.attrib:
            #         return SSMLCheck(False, "Invalid SSML: <emphasis> tag is missing 'level' attribute.")
                
            #     level_value = element.get("level", "")
            #     if level_value not in ["strong", "moderate", "reduced", "none"]:
            #         return SSMLCheck(False, f"Invalid SSML: <emphasis> tag has invalid level value '{level_value}'")

        # Get the processed SSML with all modifications
        processed_ssml = etree.tostring(root, encoding='unicode')  # pylint: disable=c-extension-no-member
        return SSMLCheck(True, processedSSML=processed_ssml)
        
    except etree.XMLSyntaxError as e:  # pylint: disable=c-extension-no-member
        return SSMLCheck(False, f"Invalid SSML: {str(e)}")

if __name__ == "__main__":
    import sys
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        res = f.read()
        print(check_google_tts_ssml_format(res))