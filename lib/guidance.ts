import type { Language } from './types';

/** Shared by the chat reply and the spoken scheme summary. */
export const guidance: Record<Language, string> = {
  en: 'Review the suggested fields, fill any other details you want to share, and confirm your profile. Scheme guidance is based on official references; incomplete rules stay undetermined.',
  hi: 'सुझाए गए विवरण जाँचें, अन्य जानकारी भरें और अपनी प्रोफ़ाइल की पुष्टि करें। अधूरे नियमों पर पात्रता तय नहीं की जाती।',
  kn: 'ಸೂಚಿಸಿದ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ಅಗತ್ಯ ಮಾಹಿತಿಯನ್ನು ಭರ್ತಿ ಮಾಡಿ ಮತ್ತು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ದೃಢೀಕರಿಸಿ. ಅಪೂರ್ಣ ನಿಯಮಗಳಿಂದ ಅರ್ಹತೆಯನ್ನು ನಿರ್ಧರಿಸಲಾಗುವುದಿಲ್ಲ.',
  ta: 'பரிந்துரைக்கப்பட்ட விவரங்களைச் சரிபார்த்து, உங்கள் சுயவிவரத்தை உறுதிப்படுத்துங்கள். முழுமையற்ற விதிகளால் தகுதியைத் தீர்மானிக்க இயலாது.',
  ml: 'നിർദേശിച്ച വിവരങ്ങൾ പരിശോധിച്ച് നിങ്ങളുടെ പ്രൊഫൈൽ സ്ഥിരീകരിക്കുക. അപൂർണ്ണമായ നിയമങ്ങളിൽനിന്ന് യോഗ്യത നിർണ്ണയിക്കാനാവില്ല.',
};
