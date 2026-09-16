import type { Language } from './types';

export const languages: Language[] = ['en', 'hi', 'kn', 'ta', 'ml'];
export const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'kn', label: 'ಕನ್ನಡ' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'ml', label: 'മലയാളം' },
];
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && languages.includes(value as Language);
}
export const languageIndex = (language: Language) =>
  languages.indexOf(language);

/** Once selected, mixed-script names and brief replies never change language. */
export function sessionLanguage(
  text: string,
  current: Language,
  selected: boolean,
): Language {
  return (
    languageCommand(text) ??
    (selected ? current : detectLanguage(text, current))
  );
}

export const voiceCopy = {
  en: {
    quota:
      'The voice service has reached its usage limit. Please type for now; the site owner needs to check ElevenLabs credits and the API key quota.',
    title: 'Welcome to Scheme Sathi',
    choose: 'Choose a language, type its name or say it using the microphone.',
    welcome:
      'Welcome to Scheme Sathi. Choose your language. You can type or speak to explore government schemes.',
    selected:
      'I will continue in English. Tell me your age, state and occupation, or fill in your profile.',
    guidance:
      'Review the suggested fields, add any details you want to share, and confirm your profile. Incomplete scheme rules cannot determine eligibility.',
    confirmed:
      'Your profile is confirmed. Explore the schemes and check their official sources before applying.',
    transcript:
      'Review your transcript. Send it when ready; profile details still need your confirmation.',
    play: 'Play welcome',
    replay: 'Play reply',
    stop: 'Stop audio',
    mute: 'Mute spoken replies',
    unmute: 'Enable spoken replies',
    loading: 'Preparing speech…',
    playing: 'Speaking…',
    blocked: 'Tap Play to hear the audio.',
    unavailable:
      'Voice is unavailable. Please continue by typing or using the form.',
    microphone:
      'Allow microphone access to record. You can also type your message.',
    disclosure:
      'AI voice by ElevenLabs. Recording starts only when you tap the microphone; audio is sent to ElevenLabs for transcription.',
    empty: 'No speech was detected. Please record again or type your message.',
    scheme:
      'This is an official programme reference. Open the official source for current benefits and application requirements. The eligibility rules in this app still need independent review.',
  },
  hi: {
    quota:
      'आवाज़ सेवा की उपयोग सीमा पूरी हो गई है। अभी लिखें। साइट के संचालक को ElevenLabs क्रेडिट और API कुंजी की सीमा जाँचनी होगी।',
    title: 'स्कीम साथी में आपका स्वागत है',
    choose: 'भाषा चुनें, उसका नाम लिखें या माइक्रोफ़ोन से बोलें।',
    welcome:
      'स्कीम साथी में आपका स्वागत है। अपनी भाषा चुनें। सरकारी योजनाएँ जानने के लिए लिखें या बोलें।',
    selected:
      'मैं अब हिन्दी में बात करूँगा। अपनी उम्र, राज्य और व्यवसाय बताएँ या प्रोफ़ाइल भरें।',
    guidance:
      'सुझाए गए विवरण जाँचें, अन्य जानकारी भरें और अपनी प्रोफ़ाइल की पुष्टि करें। अधूरे नियमों पर पात्रता तय नहीं की जाती।',
    confirmed:
      'आपकी प्रोफ़ाइल की पुष्टि हो गई है। योजनाएँ देखें और आवेदन से पहले आधिकारिक स्रोत जाँचें।',
    transcript:
      'अपने बोले हुए शब्दों का पाठ जाँचें और तैयार होने पर भेजें। प्रोफ़ाइल के विवरण की पुष्टि अभी बाकी है।',
    play: 'स्वागत सुनें',
    replay: 'उत्तर सुनें',
    stop: 'आवाज़ रोकें',
    mute: 'बोले गए उत्तर बंद करें',
    unmute: 'बोले गए उत्तर चालू करें',
    loading: 'आवाज़ तैयार हो रही है…',
    playing: 'बोल रहा है…',
    blocked: 'आवाज़ सुनने के लिए चलाएँ बटन दबाएँ।',
    unavailable: 'आवाज़ उपलब्ध नहीं है। कृपया लिखें या फ़ॉर्म भरें।',
    microphone: 'रिकॉर्ड करने के लिए माइक्रोफ़ोन की अनुमति दें। आप लिख भी सकते हैं।',
    disclosure:
      'ElevenLabs की AI आवाज़। माइक्रोफ़ोन दबाने पर ही रिकॉर्डिंग शुरू होगी। आवाज़ को पाठ बनाने के लिए ElevenLabs को भेजा जाता है।',
    empty: 'कोई आवाज़ नहीं मिली। फिर से रिकॉर्ड करें या लिखें।',
    scheme:
      'यह एक सरकारी कार्यक्रम का संदर्भ है। वर्तमान लाभ और आवेदन की आवश्यकताओं के लिए आधिकारिक स्रोत खोलें। इस ऐप के पात्रता नियमों की स्वतंत्र समीक्षा अभी बाकी है।',
  },
  kn: {
    quota:
      'ಧ್ವನಿ ಸೇವೆಯ ಬಳಕೆಯ ಮಿತಿ ತಲುಪಿದೆ. ಈಗ ಬರೆಯಿರಿ. ಸೈಟ್ ನಿರ್ವಾಹಕರು ElevenLabs ಕ್ರೆಡಿಟ್ ಮತ್ತು API ಕೀ ಮಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಬೇಕು.',
    title: 'ಸ್ಕೀಮ್ ಸಾಥಿಗೆ ಸ್ವಾಗತ',
    choose: 'ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ, ಅದರ ಹೆಸರು ಬರೆಯಿರಿ ಅಥವಾ ಮೈಕ್ರೋಫೋನ್ ಮೂಲಕ ಹೇಳಿ.',
    welcome:
      'ಸ್ಕೀಮ್ ಸಾಥಿಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ತಿಳಿಯಲು ಬರೆಯಿರಿ ಅಥವಾ ಮಾತನಾಡಿ.',
    selected:
      'ನಾನು ಕನ್ನಡದಲ್ಲಿ ಮುಂದುವರಿಸುತ್ತೇನೆ. ನಿಮ್ಮ ವಯಸ್ಸು, ರಾಜ್ಯ ಮತ್ತು ಉದ್ಯೋಗ ತಿಳಿಸಿ ಅಥವಾ ಪ್ರೊಫೈಲ್ ಭರ್ತಿ ಮಾಡಿ.',
    guidance:
      'ಸೂಚಿಸಿದ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ಅಗತ್ಯ ಮಾಹಿತಿಯನ್ನು ಭರ್ತಿ ಮಾಡಿ ಮತ್ತು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ದೃಢೀಕರಿಸಿ. ಅಪೂರ್ಣ ನಿಯಮಗಳಿಂದ ಅರ್ಹತೆಯನ್ನು ನಿರ್ಧರಿಸಲಾಗುವುದಿಲ್ಲ.',
    confirmed:
      'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ. ಯೋಜನೆಗಳನ್ನು ನೋಡಿ ಮತ್ತು ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಮೊದಲು ಅಧಿಕೃತ ಮೂಲಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.',
    transcript:
      'ನಿಮ್ಮ ಧ್ವನಿಯ ಪಠ್ಯವನ್ನು ಪರಿಶೀಲಿಸಿ ನಂತರ ಕಳುಹಿಸಿ. ಪ್ರೊಫೈಲ್ ವಿವರಗಳಿಗೆ ನಿಮ್ಮ ದೃಢೀಕರಣ ಇನ್ನೂ ಬೇಕು.',
    play: 'ಸ್ವಾಗತ ಕೇಳಿ',
    replay: 'ಉತ್ತರ ಕೇಳಿ',
    stop: 'ಧ್ವನಿ ನಿಲ್ಲಿಸಿ',
    mute: 'ಧ್ವನಿ ಉತ್ತರಗಳನ್ನು ನಿಲ್ಲಿಸಿ',
    unmute: 'ಧ್ವನಿ ಉತ್ತರಗಳನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ',
    loading: 'ಧ್ವನಿ ಸಿದ್ಧವಾಗುತ್ತಿದೆ…',
    playing: 'ಮಾತನಾಡುತ್ತಿದೆ…',
    blocked: 'ಧ್ವನಿ ಕೇಳಲು ಪ್ಲೇ ಬಟನ್ ಒತ್ತಿ.',
    unavailable: 'ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಬರೆಯಿರಿ ಅಥವಾ ಫಾರ್ಮ್ ಬಳಸಿ.',
    microphone: 'ದಾಖಲಿಸಲು ಮೈಕ್ರೋಫೋನ್ ಅನುಮತಿ ನೀಡಿ. ಸಂದೇಶವನ್ನು ಬರೆಯಬಹುದು.',
    disclosure:
      'ElevenLabs ನ AI ಧ್ವನಿ. ಮೈಕ್ರೋಫೋನ್ ಒತ್ತಿದಾಗ ಮಾತ್ರ ಧ್ವನಿ ದಾಖಲಾಗುತ್ತದೆ. ಪಠ್ಯಕ್ಕೆ ಪರಿವರ್ತಿಸಲು ಧ್ವನಿಯನ್ನು ElevenLabs ಗೆ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.',
    empty: 'ಮಾತು ಪತ್ತೆಯಾಗಿಲ್ಲ. ಮತ್ತೆ ದಾಖಲಿಸಿ ಅಥವಾ ಬರೆಯಿರಿ.',
    scheme:
      'ಇದು ಅಧಿಕೃತ ಯೋಜನೆಯ ಉಲ್ಲೇಖ. ಪ್ರಸ್ತುತ ಪ್ರಯೋಜನಗಳು ಮತ್ತು ಅರ್ಜಿಯ ಅಗತ್ಯಗಳಿಗಾಗಿ ಅಧಿಕೃತ ಮೂಲವನ್ನು ತೆರೆಯಿರಿ. ಈ ಆ್ಯಪ್ನ ಅರ್ಹತಾ ನಿಯಮಗಳ ಸ್ವತಂತ್ರ ಪರಿಶೀಲನೆ ಇನ್ನೂ ಬಾಕಿಯಿದೆ.',
  },
  ta: {
    quota:
      'குரல் சேவையின் பயன்பாட்டு வரம்பு முடிந்துவிட்டது. இப்போது தட்டச்சு செய்யவும். தள நிர்வாகி ElevenLabs கிரெடிட்களையும் API விசையின் வரம்பையும் சரிபார்க்க வேண்டும்.',
    title: 'ஸ்கீம் சாத்திக்கு வரவேற்கிறோம்',
    choose:
      'மொழியைத் தேர்ந்தெடுக்கவும், அதன் பெயரை எழுதவும் அல்லது ஒலிவாங்கியில் சொல்லவும்.',
    welcome:
      'ஸ்கீம் சாத்திக்கு வரவேற்கிறோம். உங்கள் மொழியைத் தேர்ந்தெடுக்கவும். அரசுத் திட்டங்களை அறிய எழுதலாம் அல்லது பேசலாம்.',
    selected:
      'இனி தமிழில் தொடர்கிறேன். உங்கள் வயது, மாநிலம், தொழில் ஆகியவற்றைக் கூறவும் அல்லது சுயவிவரத்தை நிரப்பவும்.',
    guidance:
      'பரிந்துரைக்கப்பட்ட விவரங்களைச் சரிபார்த்து, நீங்கள் பகிர விரும்பும் தகவல்களைச் சேர்த்து, சுயவிவரத்தை உறுதிப்படுத்தவும். முழுமையற்ற விதிகளால் தகுதியைத் தீர்மானிக்க முடியாது.',
    confirmed:
      'உங்கள் சுயவிவரம் உறுதிப்படுத்தப்பட்டது. திட்டங்களைப் பார்த்து, விண்ணப்பிக்கும் முன் அதிகாரப்பூர்வ ஆதாரங்களைச் சரிபார்க்கவும்.',
    transcript:
      'உங்கள் பேச்சின் எழுத்து வடிவத்தைச் சரிபார்த்து அனுப்பவும். சுயவிவரத் தகவல்களுக்கு உங்கள் உறுதிப்படுத்தல் தேவை.',
    play: 'வரவேற்பைக் கேட்கவும்',
    replay: 'பதிலைக் கேட்கவும்',
    stop: 'ஒலியை நிறுத்தவும்',
    mute: 'குரல் பதில்களை நிறுத்தவும்',
    unmute: 'குரல் பதில்களை இயக்கவும்',
    loading: 'குரல் தயாராகிறது…',
    playing: 'பேசுகிறது…',
    blocked: 'ஒலியைக் கேட்க இயக்கும் பொத்தானை அழுத்தவும்.',
    unavailable: 'குரல் வசதி கிடைக்கவில்லை. எழுதவும் அல்லது படிவத்தைப் பயன்படுத்தவும்.',
    microphone: 'பதிவு செய்ய ஒலிவாங்கி அனுமதியை வழங்கவும். செய்தியை எழுதவும் முடியும்.',
    disclosure:
      'ElevenLabs வழங்கும் AI குரல். ஒலிவாங்கியை அழுத்தும்போது மட்டுமே பதிவு தொடங்கும். எழுத்தாக மாற்ற ஒலிப்பதிவு ElevenLabs க்கு அனுப்பப்படும்.',
    empty: 'பேச்சு கண்டறியப்படவில்லை. மீண்டும் பதிவு செய்யவும் அல்லது எழுதவும்.',
    scheme:
      'இது அரசுத் திட்டத்திற்கான குறிப்பு. தற்போதைய பயன்கள் மற்றும் விண்ணப்பத் தேவைகளுக்கு அதிகாரப்பூர்வ ஆதாரத்தைத் திறக்கவும். இந்தச் செயலியின் தகுதி விதிகளுக்கு சுயாதீன ஆய்வு இன்னும் தேவை.',
  },
  ml: {
    quota:
      'ശബ്ദ സേവനത്തിന്റെ ഉപയോഗ പരിധി എത്തിയിരിക്കുന്നു. ഇപ്പോൾ ടൈപ്പ് ചെയ്യുക. സൈറ്റ് ഉടമ ElevenLabs ക്രെഡിറ്റുകളും API കീയുടെ പരിധിയും പരിശോധിക്കണം.',
    title: 'സ്കീം സാഥിയിലേക്ക് സ്വാഗതം',
    choose: 'ഭാഷ തിരഞ്ഞെടുക്കുക, അതിന്റെ പേര് എഴുതുക അല്ലെങ്കിൽ മൈക്രോഫോണിലൂടെ പറയുക.',
    welcome:
      'സ്കീം സാഥിയിലേക്ക് സ്വാഗതം. നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക. സർക്കാർ പദ്ധതികളെക്കുറിച്ച് അറിയാൻ എഴുതുകയോ സംസാരിക്കുകയോ ചെയ്യാം.',
    selected:
      'ഇനി മലയാളത്തിൽ തുടരാം. നിങ്ങളുടെ പ്രായം, സംസ്ഥാനം, തൊഴിൽ എന്നിവ പറയുക അല്ലെങ്കിൽ പ്രൊഫൈൽ പൂരിപ്പിക്കുക.',
    guidance:
      'നിർദേശിച്ച വിവരങ്ങൾ പരിശോധിക്കുക, പങ്കിടാൻ ആഗ്രഹിക്കുന്ന വിവരങ്ങൾ ചേർത്ത് പ്രൊഫൈൽ സ്ഥിരീകരിക്കുക. അപൂർണ്ണമായ നിയമങ്ങൾ ഉപയോഗിച്ച് യോഗ്യത നിർണ്ണയിക്കാനാവില്ല.',
    confirmed:
      'നിങ്ങളുടെ പ്രൊഫൈൽ സ്ഥിരീകരിച്ചു. പദ്ധതികൾ പരിശോധിച്ച് അപേക്ഷിക്കുന്നതിന് മുമ്പ് ഔദ്യോഗിക സ്രോതസ്സുകൾ നോക്കുക.',
    transcript:
      'നിങ്ങളുടെ സംസാരത്തിന്റെ എഴുത്തുരൂപം പരിശോധിച്ച് അയയ്ക്കുക. പ്രൊഫൈൽ വിവരങ്ങൾക്ക് നിങ്ങളുടെ സ്ഥിരീകരണം ഇനിയും ആവശ്യമാണ്.',
    play: 'സ്വാഗതം കേൾക്കുക',
    replay: 'മറുപടി കേൾക്കുക',
    stop: 'ശബ്ദം നിർത്തുക',
    mute: 'ശബ്ദ മറുപടികൾ നിർത്തുക',
    unmute: 'ശബ്ദ മറുപടികൾ പ്രവർത്തനക്ഷമമാക്കുക',
    loading: 'ശബ്ദം തയ്യാറാക്കുന്നു…',
    playing: 'സംസാരിക്കുന്നു…',
    blocked: 'ശബ്ദം കേൾക്കാൻ പ്ലേ ബട്ടൺ അമർത്തുക.',
    unavailable: 'ശബ്ദ സേവനം ലഭ്യമല്ല. എഴുതുകയോ ഫോം ഉപയോഗിക്കുകയോ ചെയ്യുക.',
    microphone: 'റെക്കോർഡ് ചെയ്യാൻ മൈക്രോഫോൺ അനുമതി നൽകുക. സന്ദേശം എഴുതാനും കഴിയും.',
    disclosure:
      'ElevenLabs നൽകുന്ന AI ശബ്ദം. മൈക്രോഫോൺ അമർത്തുമ്പോൾ മാത്രം റെക്കോർഡിംഗ് തുടങ്ങും. എഴുത്താക്കി മാറ്റാൻ ശബ്ദം ElevenLabs ലേക്ക് അയയ്ക്കും.',
    empty: 'സംസാരം കണ്ടെത്തിയില്ല. വീണ്ടും റെക്കോർഡ് ചെയ്യുക അല്ലെങ്കിൽ എഴുതുക.',
    scheme:
      'ഇത് ഒരു ഔദ്യോഗിക പദ്ധതിയുടെ വിവരണമാണ്. നിലവിലെ ആനുകൂല്യങ്ങൾക്കും അപേക്ഷാ ആവശ്യങ്ങൾക്കും ഔദ്യോഗിക സ്രോതസ്സ് തുറക്കുക. ഈ ആപ്പിലെ യോഗ്യതാ നിയമങ്ങൾക്ക് സ്വതന്ത്ര പരിശോധന ഇനിയും ആവശ്യമാണ്.',
  },
};

export const multilingualWelcome =
  'Welcome to Scheme Sathi. नमस्ते। ಸ್ಕೀಮ್ ಸಾಥಿಗೆ ಸ್ವಾಗತ. வணக்கம். സ്കീം സാഥിയിലേക്ക് സ്വാഗതം. Choose your language. अपनी भाषा चुनें। ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ. மொழியைத் தேர்ந்தெடுக்கவும். ഭാഷ തിരഞ്ഞെടുക്കുക.';
export type SpeechKind =
  | 'welcome'
  | 'selected'
  | 'guidance'
  | 'confirmed'
  | 'transcript'
  | 'scheme';
export const speechKinds: SpeechKind[] = [
  'welcome',
  'selected',
  'guidance',
  'confirmed',
  'transcript',
  'scheme',
];

const aliases: Record<Language, string> = {
  en: 'english|अंग्रेज़ी|ಇಂಗ್ಲಿಷ್|ஆங்கிலம்|ഇംഗ്ലീഷ്',
  hi: 'hindi|हिन्दी|हिंदी|ಹಿಂದಿ|இந்தி|ഹിന്ദി',
  kn: 'kannada|ಕನ್ನಡ|कन्नड़|கன்னடம்|കന്നഡ',
  ta: 'tamil|tamizh|தமிழ்|தமிழில்|तमिल|ತಮಿಳು|തമിഴ്',
  ml: 'malayalam|മലയാളം|മലയാളത്തിൽ|മലയാളത്തില്‍|मलयालम|ಮಲಯಾಳಂ|மலையாளம்',
};
// Only explicit language commands change a Latin-script conversation. A place
// such as Tamil Nadu or a list of languages must not be treated as a command.
export function languageCommand(text: string): Language | undefined {
  const value = text
    .trim()
    .replace(/[.!?।]+$/u, '')
    .trim();
  const matches = languages.filter((l) =>
    new RegExp(
      `^(?:(?:please\\s+)?(?:speak|use|switch(?: to)?|continue(?: in)?|reply(?: in)?|talk(?: in)?|i (?:prefer|choose|want))\\s+(?:in\\s+)?)?(?:${aliases[l]})(?:\\s+(?:please|language|பேசவும்|பேசுங்கள்|സംസാരിക്കൂ|സംസാരിക്കുക|में बोलें|ಮಾತನಾಡಿ))?$`,
      'iu',
    ).test(value),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export function detectLanguage(text: string, fallback: Language): Language {
  const command = languageCommand(text);
  if (command) return command;
  const scripts: [Language, RegExp][] = [
    ['hi', /[\u0900-\u097f]/gu],
    ['kn', /[\u0c80-\u0cff]/gu],
    ['ta', /[\u0b80-\u0bff]/gu],
    ['ml', /[\u0d00-\u0d7f]/gu],
  ];
  const counts = scripts
    .map(([language, pattern]) => ({
      language,
      count: (text.match(pattern) || []).length,
    }))
    .sort((a, b) => b.count - a.count);
  return counts[0].count >= 3 && counts[0].count > counts[1].count
    ? counts[0].language
    : fallback;
}
export function transcriptionLanguage(
  code: unknown,
  probability: unknown,
  fallback: Language,
): Language {
  const codes: Record<string, Language> = {
    en: 'en',
    eng: 'en',
    hi: 'hi',
    hin: 'hi',
    kn: 'kn',
    kan: 'kn',
    ta: 'ta',
    tam: 'ta',
    ml: 'ml',
    mal: 'ml',
  };
  return typeof code === 'string' &&
    typeof probability === 'number' &&
    probability >= 0.7
    ? codes[code] || fallback
    : fallback;
}
