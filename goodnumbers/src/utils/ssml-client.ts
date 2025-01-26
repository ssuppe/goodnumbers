'use client';

export function ssmlToMarkdown(ssml: string): string {
  if (!ssml) return '';

  return (
    ssml
      // Remove speak tags
      .replace(/<\/?speak[^>]*>/g, '')

      // Convert voice tags to character dialogue format
      .replace(/<voice name="([^"]*)">(.*?)<\/voice>/gs, (match, voiceName, content) => {
        return `\n\n**${voiceName}:**\n${content.trim()}\n\n`;
      })

      // Convert break/pause elements to newlines
      // .replace(/<break[^>]*>/g, '\n\n')

      // Convert emphasis to italics
      .replace(/<emphasis[^>]*>(.*?)<\/emphasis>/g, '*$1*')

      // Convert prosody to plain text
      .replace(/<prosody[^>]*>(.*?)<\/prosody>/g, '$1')

      // Convert say-as to plain text
      .replace(/<say-as[^>]*>(.*?)<\/say-as>/g, '$1')

      // Add formatting for marks/bookmarks
      .replace(/<mark name="([^"]*)"\/>/g, '\n\n### $1\n\n')

      // Convert paragraphs to double newlines
      .replace(/<\/?p>/g, '\n\n')

      // Convert sentences to single newlines
      .replace(/<\/?s>/g, '\n')

      // Clean up multiple newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n')

      // Clean up whitespace
      .trim()
  );
}

// export { ssmlToMarkdown, checkGoogleTtsSSMLFormat };
