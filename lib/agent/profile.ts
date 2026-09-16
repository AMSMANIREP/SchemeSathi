import { fields, validateProfile } from '../rules.ts';
import { questionFor } from '../questions.ts';
import type { Language, Profile, Provenance } from '../types';

/** Read only an unambiguous answer in the units actually asked. */
export function coerceAnswer(field: string, text: string, prompt: string) {
  const spec = fields.find((f) => f.key === field);
  if (!spec) return null;
  const value = text.trim().toLowerCase();
  if (spec.type === 'number') {
    if (field === 'income') {
      const canonical = (['en', 'hi', 'kn', 'ta', 'ml'] as Language[]).some(
        (language) =>
          prompt.trim().endsWith(questionFor('income', language).text),
      );
      // A monthly personal salary is not annual household income. Never guess
      // the household total or silently use the same number in different units.
      if (
        !canonical ||
        /monthly|per month|a month|salary|मासिक|महीन|ತಿಂಗಳ|மாத|மாச|മാസ/i.test(value)
      )
        return null;
    }
    if (
      /lakh|crore|thousand|million|लाख|करोड़|ஆயிர|லட்ச|ಸಾವಿರ|ಲಕ್ಷ|ലക്ഷ|ആയിര/i.test(
        value,
      )
    )
      return null;
    if (field === 'land' && /acre|एकड़|ಎಕರೆ|ஏக்கர்|ഏക്കർ/i.test(value)) return null;
    if (field === 'age' && /month|மாத|மहीन|ತಿಂಗಳ|മാസ/i.test(value)) return null;
    const normalized = value
      .replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 2406))
      .replace(/[೦-೯]/g, (c) => String(c.charCodeAt(0) - 3302))
      .replace(/[௦-௯]/g, (c) => String(c.charCodeAt(0) - 3046))
      .replace(/[൦-൯]/g, (c) => String(c.charCodeAt(0) - 3430));
    const numbers = normalized.match(/-?\d[\d,]*(?:\.\d+)?/g);
    if (numbers?.length !== 1) return null;
    const number = Number(numbers[0].replace(/,/g, ''));
    try {
      validateProfile({ [field]: number });
      return number;
    } catch {
      return null;
    }
  }
  const exact = (spec.values || []).find((v) => v.toLowerCase() === value);
  if (exact) return exact;
  if (
    /^(yes|y|haan|हाँ|हां|ಹೌದು|ஆம்|ஆமாம்|അതെ)[.!]?$/i.test(value) &&
    spec.values?.includes('yes')
  )
    return 'yes';
  if (
    /^(no|n|nahi|नहीं|ಇಲ್ಲ|இல்லை|ഇല്ല)[.!]?$/i.test(value) &&
    spec.values?.includes('no')
  )
    return 'no';
  return (
    (spec.values || []).find((v) => {
      const escaped = v
        .replace(/_/g, ' ')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|\\s)${escaped}(?:$|[\\s.!?,])`, 'i').test(value);
    }) ?? null
  );
}

/** Corrections replace stale values but must be reviewed again for eligibility. */
export function mergeExtractedProfile(
  profile: Profile,
  provenance: Record<string, Provenance>,
  extracted: Profile,
) {
  const merged = { ...profile };
  const sources = { ...provenance };
  const changed: { field: string; provenance: Provenance }[] = [];
  for (const [field, value] of Object.entries(extracted)) {
    if (value == null || value === merged[field]) continue;
    try {
      Object.assign(merged, validateProfile({ [field]: value }));
      sources[field] = 'inferred';
      changed.push({ field, provenance: 'inferred' });
    } catch {
      // One unusable value must not erase the rest of the statement.
    }
  }
  return { profile: merged, provenance: sources, changed };
}
