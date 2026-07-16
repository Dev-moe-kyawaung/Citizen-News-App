import { useMemo } from "react";
import { TextStyle } from "react-native";

// Myanmar Unicode block range
const MYANMAR_REGEX = /[\u1000-\u109F\uAA60-\uAA7F]/;

export type ScriptStyleOptions = {
  baseFontSize?: number;
  weight?: TextStyle["fontWeight"];
};

/**
 * Detects whether a given string is predominantly Myanmar script and returns
 * the correct font family + line-height for readable rendering.
 *
 * Myanmar script stacks vowels/tone marks vertically around the base
 * consonant, so it needs noticeably more line-height than Latin text at the
 * same font size, or ascenders/descenders from adjacent lines visually
 * collide. This lets article bodies mix EN and MY content in the same feed
 * without a global stylesheet compromise between the two scripts.
 */
export function useScriptAwareStyle(text: string, opts: ScriptStyleOptions = {}): TextStyle {
  const { baseFontSize = 16, weight = "400" } = opts;

  return useMemo(() => {
    const isMyanmar = MYANMAR_REGEX.test(text);
    return {
      fontFamily: isMyanmar ? "NotoSansMyanmar-Regular" : "Outfit-Regular",
      fontSize: isMyanmar ? baseFontSize + 1 : baseFontSize, // MY glyphs read slightly smaller at same px
      lineHeight: isMyanmar ? baseFontSize * 1.65 : baseFontSize * 1.3,
      fontWeight: weight,
    };
  }, [text, baseFontSize, weight]);
}

/** Quick boolean check, useful outside of style contexts (e.g. choosing a truncation length) */
export function isMyanmarScript(text: string): boolean {
  return MYANMAR_REGEX.test(text);
}
