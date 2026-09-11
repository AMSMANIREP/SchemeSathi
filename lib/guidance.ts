import type { Language } from './types';

/** Shared by the chat reply and the spoken scheme summary. */
export const guidance: Record<Language, string> = {
  en: 'Review the suggested fields, fill any other details you want to share, and confirm your profile. Scheme guidance is based on official references; incomplete rules stay undetermined.',
  hi: 'सुझाए गए विवरण जाँचें, अन्य जानकारी भरें और अपनी प्रोफ़ाइल की पुष्टि करें। अधूरे नियमों पर पात्रता तय नहीं की जाती।',
  kn: 'ಸೂಚಿಸಿದ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ಅಗತ್ಯ ಮಾಹಿತಿಯನ್ನು ಭರ್ತಿ ಮಾಡಿ ಮತ್ತು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ದೃಢೀಕರಿಸಿ. ಅಪೂರ್ಣ ನಿಯಮಗಳಿಂದ ಅರ್ಹತೆಯನ್ನು ನಿರ್ಧರಿಸಲಾಗುವುದಿಲ್ಲ.',
};
