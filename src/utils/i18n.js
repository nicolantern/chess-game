// Lightweight internationalization. A `t(key)` lookup over a string catalog,
// with the active language held in a module-global (set from settings on boot).
// English is the complete base; a few languages are translated and everything
// else falls back to English until more translations are added.

// Languages offered in the picker: { code, native, english }. Only codes present
// in STRINGS actually translate; the rest fall back to English.
export const LANGUAGES = [
  { code: 'af', native: 'Afrikaans', english: 'Afrikaans' },
  { code: 'az', native: 'Azərbaycanca', english: 'Azerbaijani' },
  { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian' },
  { code: 'ms', native: 'Bahasa Melayu', english: 'Malay' },
  { code: 'bs', native: 'Bosanski', english: 'Bosnian' },
  { code: 'ca', native: 'Català', english: 'Catalan' },
  { code: 'cs', native: 'Čeština', english: 'Czech' },
  { code: 'da', native: 'Dansk', english: 'Danish' },
  { code: 'de', native: 'Deutsch', english: 'German' },
  { code: 'et', native: 'Eesti', english: 'Estonian' },
  { code: 'en', native: 'English', english: 'English' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'fr', native: 'Français', english: 'French' },
  { code: 'gl', native: 'Galego', english: 'Galician' },
  { code: 'hr', native: 'Hrvatski', english: 'Croatian' },
  { code: 'is', native: 'Íslenska', english: 'Icelandic' },
  { code: 'it', native: 'Italiano', english: 'Italian' },
  { code: 'lv', native: 'Latviešu', english: 'Latvian' },
  { code: 'lt', native: 'Lietuvių', english: 'Lithuanian' },
  { code: 'hu', native: 'Magyar', english: 'Hungarian' },
  { code: 'nl', native: 'Nederlands', english: 'Dutch' },
  { code: 'no', native: 'Norsk', english: 'Norwegian' },
  { code: 'uz', native: 'Oʻzbekcha', english: 'Uzbek' },
  { code: 'fil', native: 'Pilipino', english: 'Filipino' },
  { code: 'pl', native: 'Polski', english: 'Polish' },
  { code: 'pt', native: 'Português', english: 'Portuguese' },
  { code: 'pt-BR', native: 'Português (BR)', english: 'Portuguese (BR)' },
  { code: 'ro', native: 'Română', english: 'Romanian' },
  { code: 'sq', native: 'Shqipe', english: 'Albanian' },
  { code: 'sk', native: 'Slovenčina', english: 'Slovak' },
  { code: 'sl', native: 'Slovenščina', english: 'Slovenian' },
  { code: 'fi', native: 'Suomi', english: 'Finnish' },
  { code: 'sv', native: 'Svenska', english: 'Swedish' },
  { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'tk', native: 'Türkmençe', english: 'Turkmen' },
  { code: 'tr', native: 'Türkçe', english: 'Turkish' },
  { code: 'nl-BE', native: 'Vlaams', english: 'Flemish' },
  { code: 'el', native: 'Ελληνικά', english: 'Greek' },
  { code: 'be', native: 'Беларуская', english: 'Belarusian' },
  { code: 'bg', native: 'Български', english: 'Bulgarian' },
  { code: 'ru', native: 'Русский', english: 'Russian' },
  { code: 'sr', native: 'Српски', english: 'Serbian' },
  { code: 'uk', native: 'Українська', english: 'Ukrainian' },
  { code: 'ka', native: 'ქართული', english: 'Georgian' },
  { code: 'hy', native: 'Հայերեն', english: 'Armenian' },
  { code: 'he', native: 'עברית', english: 'Hebrew' },
  { code: 'ur', native: 'اُردُو', english: 'Urdu' },
  { code: 'ar', native: 'العربية', english: 'Arabic' },
  { code: 'fa', native: 'فارسی', english: 'Persian' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'ko', native: '한국어', english: 'Korean' },
  { code: 'zh', native: '中文', english: 'Chinese (Simplified)' },
  { code: 'zh-HK', native: '中文（香港）', english: 'Chinese (HK)' },
  { code: 'zh-TW', native: '中文（台灣）', english: 'Chinese (Traditional)' },
  { code: 'ja', native: '日本語', english: 'Japanese' },
];

// String catalog. `en` is the complete base; other locales may be partial and
// fall back to English per-key.
const STRINGS = {
  en: {
    'nav.play': 'Play',
    'nav.learn': 'Learn',
    'nav.stats': 'Stats',
    'nav.settings': 'Settings',
    'account.login': 'Log In',
    'account.signup': 'Sign Up',
    'account.logout': 'Log out',
    'home.opponent': 'Opponent',
    'home.player': 'Player',
    'play.title': 'Play Chess',
    'card.online.title': 'Play Online',
    'card.online.sub': 'Play vs a person',
    'card.online.hint': '(log in)',
    'card.bots.title': 'Play Bots',
    'card.bots.sub': 'Challenge the computer',
    'card.friend.title': 'Play a Friend',
    'card.friend.sub': 'Invite a friend to a game',
    'card.pvp.title': 'Pass & Play',
    'card.pvp.sub': 'Two players, one device',
    'card.resume.title': 'Resume Game',
    'card.resume.sub': 'Pick up where you left off',
    'home.gameHistory': 'Game History',
    'lang.title': 'Choose Your Preferred Language',
  },
  es: {
    'nav.play': 'Jugar',
    'nav.learn': 'Aprender',
    'nav.stats': 'Estadísticas',
    'nav.settings': 'Ajustes',
    'account.login': 'Iniciar sesión',
    'account.signup': 'Registrarse',
    'account.logout': 'Cerrar sesión',
    'home.opponent': 'Oponente',
    'home.player': 'Jugador',
    'play.title': 'Jugar al ajedrez',
    'card.online.title': 'Jugar en línea',
    'card.online.sub': 'Juega contra una persona',
    'card.online.hint': '(inicia sesión)',
    'card.bots.title': 'Jugar contra bots',
    'card.bots.sub': 'Desafía a la computadora',
    'card.friend.title': 'Jugar con un amigo',
    'card.friend.sub': 'Invita a un amigo a jugar',
    'card.pvp.title': 'Pasar y jugar',
    'card.pvp.sub': 'Dos jugadores, un dispositivo',
    'card.resume.title': 'Reanudar partida',
    'card.resume.sub': 'Continúa donde lo dejaste',
    'home.gameHistory': 'Historial de partidas',
    'lang.title': 'Elige tu idioma preferido',
  },
  fr: {
    'nav.play': 'Jouer',
    'nav.learn': 'Apprendre',
    'nav.stats': 'Statistiques',
    'nav.settings': 'Paramètres',
    'account.login': 'Se connecter',
    'account.signup': "S'inscrire",
    'account.logout': 'Déconnexion',
    'home.opponent': 'Adversaire',
    'home.player': 'Joueur',
    'play.title': 'Jouer aux échecs',
    'card.online.title': 'Jouer en ligne',
    'card.online.sub': 'Jouer contre une personne',
    'card.online.hint': '(connexion)',
    'card.bots.title': 'Jouer contre des bots',
    'card.bots.sub': "Défier l'ordinateur",
    'card.friend.title': 'Jouer avec un ami',
    'card.friend.sub': 'Inviter un ami à jouer',
    'card.pvp.title': 'Jouer à tour de rôle',
    'card.pvp.sub': 'Deux joueurs, un appareil',
    'card.resume.title': 'Reprendre la partie',
    'card.resume.sub': 'Reprenez où vous en étiez',
    'home.gameHistory': 'Historique des parties',
    'lang.title': 'Choisissez votre langue préférée',
  },
  de: {
    'nav.play': 'Spielen',
    'nav.learn': 'Lernen',
    'nav.stats': 'Statistiken',
    'nav.settings': 'Einstellungen',
    'account.login': 'Anmelden',
    'account.signup': 'Registrieren',
    'account.logout': 'Abmelden',
    'home.opponent': 'Gegner',
    'home.player': 'Spieler',
    'play.title': 'Schach spielen',
    'card.online.title': 'Online spielen',
    'card.online.sub': 'Gegen eine Person spielen',
    'card.online.hint': '(anmelden)',
    'card.bots.title': 'Gegen Bots spielen',
    'card.bots.sub': 'Fordere den Computer heraus',
    'card.friend.title': 'Gegen einen Freund spielen',
    'card.friend.sub': 'Lade einen Freund zum Spiel ein',
    'card.pvp.title': 'Abwechselnd spielen',
    'card.pvp.sub': 'Zwei Spieler, ein Gerät',
    'card.resume.title': 'Spiel fortsetzen',
    'card.resume.sub': 'Mach dort weiter, wo du aufgehört hast',
    'home.gameHistory': 'Partieverlauf',
    'lang.title': 'Wähle deine bevorzugte Sprache',
  },
};

let current = 'en';

/** Set the active language (called on boot and when the user picks one). */
export function initLanguage(code) {
  current = STRINGS[code] || LANGUAGES.some((l) => l.code === code) ? code : 'en';
}

export function setLanguage(code) {
  initLanguage(code);
}

export function getLanguage() {
  return current;
}

/** Native label of the active language (for the picker button). */
export function currentLanguageLabel() {
  return (LANGUAGES.find((l) => l.code === current) || { native: 'English' }).native;
}

/** Translate a key, falling back to English, then to the key itself. */
export function t(key) {
  const loc = STRINGS[current];
  if (loc && key in loc) return loc[key];
  if (key in STRINGS.en) return STRINGS.en[key];
  return key;
}
