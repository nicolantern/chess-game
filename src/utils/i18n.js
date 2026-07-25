// Lightweight internationalization. A `t(key)` lookup over a string catalog,
// with the active language held in a module-global (set from settings on boot).
// English is the complete base; a few languages are translated and everything
// else falls back to English until more translations are added.
//
// t(key, params) supports {placeholder} interpolation, e.g.
//   t('over.wins', { name: 'White' }) -> "White wins."

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

// Rules-and-controls reference, kept as one HTML blob per language so the
// HowToPlay screen can drop it in directly.
const HOWTO_EN = `
  <h3>Goal</h3>
  <p>Checkmate the opponent's king — attack it so it cannot escape capture.</p>
  <h3>Moving pieces</h3>
  <ul>
    <li><strong>Pawn</strong> — forward one square (two from its start); captures diagonally.</li>
    <li><strong>Knight</strong> — an L-shape; the only piece that jumps over others.</li>
    <li><strong>Bishop</strong> — any distance diagonally.</li>
    <li><strong>Rook</strong> — any distance in straight lines.</li>
    <li><strong>Queen</strong> — any distance in straight lines or diagonals.</li>
    <li><strong>King</strong> — one square in any direction.</li>
  </ul>
  <h3>Special moves</h3>
  <ul>
    <li><strong>Castling</strong> — king and rook move together for safety, if neither has
        moved, the path is clear, and the king is not moving through check.</li>
    <li><strong>En passant</strong> — capture a pawn that just advanced two squares as if it
        had moved one.</li>
    <li><strong>Promotion</strong> — a pawn reaching the far rank becomes a queen, rook,
        bishop, or knight (you choose).</li>
  </ul>
  <h3>Ending the game</h3>
  <ul>
    <li><strong>Checkmate</strong> — the king is in check and cannot escape: the game is won.</li>
    <li><strong>Stalemate</strong> — no legal move but not in check: it is a draw.</li>
    <li><strong>Draws</strong> — also by threefold repetition, the fifty-move rule, or
        insufficient material.</li>
  </ul>
  <h3>Using this app</h3>
  <ul>
    <li><strong>Move</strong> — drag a piece, or click it and then click a highlighted square.</li>
    <li>Legal moves, the last move, and a king in check are highlighted.</li>
    <li><strong>Annotate</strong> — right-click a square to highlight it, or right-drag between
        two squares to draw an arrow. Left-click clears annotations.</li>
    <li><strong>Review</strong> — click any move in the history, or use ← / → to step through
        the game (Home = start, End = latest).</li>
    <li>Use <strong>Flip</strong> to rotate the board, <strong>Undo</strong> to take back a move,
        and the clocks for timed play.</li>
    <li>Toggle sound, highlights, animations, and the board theme in <strong>Settings</strong>.</li>
  </ul>
  <h3>Keyboard shortcuts</h3>
  <ul>
    <li><strong>← / →</strong> — step back / forward through moves; <strong>Home / End</strong> — jump to start / latest.</li>
    <li><strong>F</strong> — flip board · <strong>Shift+F</strong> — fullscreen · <strong>U</strong> — undo · <strong>N</strong> — new game · <strong>Esc</strong> — exit review.</li>
  </ul>`;

const HOWTO_ES = `
  <h3>Objetivo</h3>
  <p>Da jaque mate al rey rival — atácalo de modo que no pueda evitar la captura.</p>
  <h3>Movimiento de las piezas</h3>
  <ul>
    <li><strong>Peón</strong> — una casilla hacia delante (dos desde su inicio); captura en diagonal.</li>
    <li><strong>Caballo</strong> — en forma de L; la única pieza que salta sobre otras.</li>
    <li><strong>Alfil</strong> — cualquier distancia en diagonal.</li>
    <li><strong>Torre</strong> — cualquier distancia en línea recta.</li>
    <li><strong>Dama</strong> — cualquier distancia en línea recta o diagonal.</li>
    <li><strong>Rey</strong> — una casilla en cualquier dirección.</li>
  </ul>
  <h3>Movimientos especiales</h3>
  <ul>
    <li><strong>Enroque</strong> — el rey y la torre se mueven juntos por seguridad, si ninguno se
        ha movido, el camino está libre y el rey no pasa por jaque.</li>
    <li><strong>Al paso</strong> — captura un peón que acaba de avanzar dos casillas como si
        hubiera avanzado una.</li>
    <li><strong>Promoción</strong> — un peón que llega a la última fila se convierte en dama, torre,
        alfil o caballo (tú eliges).</li>
  </ul>
  <h3>Fin de la partida</h3>
  <ul>
    <li><strong>Jaque mate</strong> — el rey está en jaque y no puede escapar: se gana la partida.</li>
    <li><strong>Ahogado</strong> — sin jugada legal pero sin estar en jaque: es tablas.</li>
    <li><strong>Tablas</strong> — también por triple repetición, la regla de las cincuenta jugadas o
        material insuficiente.</li>
  </ul>
  <h3>Uso de la aplicación</h3>
  <ul>
    <li><strong>Mover</strong> — arrastra una pieza, o haz clic en ella y luego en una casilla resaltada.</li>
    <li>Se resaltan las jugadas legales, la última jugada y el rey en jaque.</li>
    <li><strong>Anotar</strong> — haz clic derecho en una casilla para resaltarla, o arrastra con el
        botón derecho entre dos casillas para dibujar una flecha. El clic izquierdo borra las anotaciones.</li>
    <li><strong>Revisar</strong> — haz clic en cualquier jugada del historial, o usa ← / → para
        recorrer la partida (Inicio = principio, Fin = última).</li>
    <li>Usa <strong>Girar</strong> para rotar el tablero, <strong>Deshacer</strong> para retirar una
        jugada, y los relojes para partidas con tiempo.</li>
    <li>Activa o desactiva sonido, resaltados, animaciones y el tema del tablero en <strong>Ajustes</strong>.</li>
  </ul>
  <h3>Atajos de teclado</h3>
  <ul>
    <li><strong>← / →</strong> — retroceder / avanzar entre jugadas; <strong>Inicio / Fin</strong> — ir al principio / a la última.</li>
    <li><strong>F</strong> — girar tablero · <strong>Mayús+F</strong> — pantalla completa · <strong>U</strong> — deshacer · <strong>N</strong> — partida nueva · <strong>Esc</strong> — salir de la revisión.</li>
  </ul>`;

const HOWTO_FR = `
  <h3>Objectif</h3>
  <p>Faites échec et mat au roi adverse — attaquez-le pour qu'il ne puisse pas échapper à la prise.</p>
  <h3>Déplacement des pièces</h3>
  <ul>
    <li><strong>Pion</strong> — une case en avant (deux depuis sa case de départ) ; capture en diagonale.</li>
    <li><strong>Cavalier</strong> — en forme de L ; la seule pièce qui saute par-dessus les autres.</li>
    <li><strong>Fou</strong> — n'importe quelle distance en diagonale.</li>
    <li><strong>Tour</strong> — n'importe quelle distance en ligne droite.</li>
    <li><strong>Dame</strong> — n'importe quelle distance en ligne droite ou en diagonale.</li>
    <li><strong>Roi</strong> — une case dans n'importe quelle direction.</li>
  </ul>
  <h3>Coups spéciaux</h3>
  <ul>
    <li><strong>Roque</strong> — le roi et la tour se déplacent ensemble pour la sécurité, si aucun
        n'a bougé, la voie est libre et le roi ne traverse pas d'échec.</li>
    <li><strong>Prise en passant</strong> — capturez un pion qui vient d'avancer de deux cases comme
        s'il n'avait avancé que d'une.</li>
    <li><strong>Promotion</strong> — un pion atteignant la dernière rangée devient dame, tour, fou
        ou cavalier (à votre choix).</li>
  </ul>
  <h3>Fin de la partie</h3>
  <ul>
    <li><strong>Échec et mat</strong> — le roi est en échec et ne peut s'échapper : la partie est gagnée.</li>
    <li><strong>Pat</strong> — aucun coup légal mais pas en échec : c'est nulle.</li>
    <li><strong>Nulles</strong> — aussi par triple répétition, la règle des cinquante coups ou
        matériel insuffisant.</li>
  </ul>
  <h3>Utiliser l'application</h3>
  <ul>
    <li><strong>Déplacer</strong> — glissez une pièce, ou cliquez dessus puis sur une case surlignée.</li>
    <li>Les coups légaux, le dernier coup et un roi en échec sont surlignés.</li>
    <li><strong>Annoter</strong> — clic droit sur une case pour la surligner, ou glisser-droit entre
        deux cases pour tracer une flèche. Le clic gauche efface les annotations.</li>
    <li><strong>Revoir</strong> — cliquez sur n'importe quel coup de l'historique, ou utilisez ← / →
        pour parcourir la partie (Début = départ, Fin = dernier).</li>
    <li>Utilisez <strong>Retourner</strong> pour pivoter l'échiquier, <strong>Annuler</strong> pour
        reprendre un coup, et les pendules pour le jeu chronométré.</li>
    <li>Activez le son, les surlignages, les animations et le thème de l'échiquier dans <strong>Paramètres</strong>.</li>
  </ul>
  <h3>Raccourcis clavier</h3>
  <ul>
    <li><strong>← / →</strong> — reculer / avancer dans les coups ; <strong>Début / Fin</strong> — aller au départ / au dernier.</li>
    <li><strong>F</strong> — retourner l'échiquier · <strong>Maj+F</strong> — plein écran · <strong>U</strong> — annuler · <strong>N</strong> — nouvelle partie · <strong>Échap</strong> — quitter la revue.</li>
  </ul>`;

const HOWTO_DE = `
  <h3>Ziel</h3>
  <p>Setze den gegnerischen König matt — greife ihn so an, dass er der Eroberung nicht entkommen kann.</p>
  <h3>Figuren ziehen</h3>
  <ul>
    <li><strong>Bauer</strong> — ein Feld vorwärts (zwei vom Startfeld); schlägt diagonal.</li>
    <li><strong>Springer</strong> — in L-Form; die einzige Figur, die über andere springt.</li>
    <li><strong>Läufer</strong> — beliebig weit diagonal.</li>
    <li><strong>Turm</strong> — beliebig weit in geraden Linien.</li>
    <li><strong>Dame</strong> — beliebig weit in geraden Linien oder Diagonalen.</li>
    <li><strong>König</strong> — ein Feld in jede Richtung.</li>
  </ul>
  <h3>Besondere Züge</h3>
  <ul>
    <li><strong>Rochade</strong> — König und Turm ziehen gemeinsam zur Sicherheit, wenn beide noch
        nicht gezogen haben, der Weg frei ist und der König nicht durch ein Schach zieht.</li>
    <li><strong>En passant</strong> — schlage einen Bauern, der gerade zwei Felder vorgerückt ist, so
        als wäre er nur eines gezogen.</li>
    <li><strong>Umwandlung</strong> — ein Bauer, der die letzte Reihe erreicht, wird zu Dame, Turm,
        Läufer oder Springer (deine Wahl).</li>
  </ul>
  <h3>Ende der Partie</h3>
  <ul>
    <li><strong>Schachmatt</strong> — der König steht im Schach und kann nicht entkommen: die Partie ist gewonnen.</li>
    <li><strong>Patt</strong> — kein legaler Zug, aber kein Schach: es ist ein Remis.</li>
    <li><strong>Remis</strong> — auch durch dreifache Stellungswiederholung, die Fünfzig-Züge-Regel oder
        ungenügendes Material.</li>
  </ul>
  <h3>Diese App verwenden</h3>
  <ul>
    <li><strong>Ziehen</strong> — ziehe eine Figur, oder klicke sie an und dann auf ein hervorgehobenes Feld.</li>
    <li>Legale Züge, der letzte Zug und ein König im Schach werden hervorgehoben.</li>
    <li><strong>Markieren</strong> — Rechtsklick auf ein Feld, um es zu markieren, oder mit rechts
        zwischen zwei Feldern ziehen, um einen Pfeil zu zeichnen. Linksklick löscht die Markierungen.</li>
    <li><strong>Nachspielen</strong> — klicke auf einen Zug im Verlauf, oder nutze ← / →, um die
        Partie durchzugehen (Pos1 = Anfang, Ende = neuester).</li>
    <li>Nutze <strong>Drehen</strong>, um das Brett zu drehen, <strong>Zurück</strong>, um einen Zug
        zurückzunehmen, und die Uhren für Partien mit Bedenkzeit.</li>
    <li>Schalte Ton, Hervorhebungen, Animationen und das Brettdesign in den <strong>Einstellungen</strong> um.</li>
  </ul>
  <h3>Tastenkürzel</h3>
  <ul>
    <li><strong>← / →</strong> — Zug zurück / vor; <strong>Pos1 / Ende</strong> — zum Anfang / neuesten springen.</li>
    <li><strong>F</strong> — Brett drehen · <strong>Umschalt+F</strong> — Vollbild · <strong>U</strong> — zurücknehmen · <strong>N</strong> — neue Partie · <strong>Esc</strong> — Nachspielen beenden.</li>
  </ul>`;

// String catalog. `en` is the complete base; other locales may be partial and
// fall back to English per-key.
const STRINGS = {
  en: {
    'nav.play': 'Play', 'nav.learn': 'Learn', 'nav.stats': 'Stats', 'nav.settings': 'Settings',
    'account.login': 'Log In', 'account.signup': 'Sign Up', 'account.logout': 'Log out',
    'home.opponent': 'Opponent', 'home.player': 'Player',
    'play.title': 'Play Chess',
    'card.online.title': 'Play Online', 'card.online.sub': 'Play vs a person', 'card.online.hint': '(log in)',
    'card.bots.title': 'Play Bots', 'card.bots.sub': 'Challenge the computer',
    'card.friend.title': 'Play a Friend', 'card.friend.sub': 'Invite a friend to a game',
    'card.pvp.title': 'Pass & Play', 'card.pvp.sub': 'Two players, one device',
    'card.resume.title': 'Resume Game', 'card.resume.sub': 'Pick up where you left off',
    'home.gameHistory': 'Game History',
    'lang.title': 'Choose Your Preferred Language',

    'common.back': 'Back', 'common.backToMenu': 'Back to Menu', 'common.startGame': 'Start Game',
    'common.menu': 'Menu', 'common.cancel': 'Cancel', 'common.close': 'Close',
    'common.accept': 'Accept', 'common.decline': 'Decline',

    'settings.title': 'Settings', 'settings.sound': 'Sound effects', 'settings.music': 'Background music',
    'settings.highlights': 'Move highlights', 'settings.animations': 'Animations',
    'settings.boardTheme': 'Board theme', 'settings.language': 'Language',
    'theme.wood': 'Wood', 'theme.marble': 'Marble', 'theme.green': 'Green',
    'theme.blue': 'Blue', 'theme.coral': 'Coral', 'theme.slate': 'Slate',

    'bots.title': 'Play Bots', 'bots.difficulty': 'Difficulty', 'bots.youPlay': 'You play',
    'color.white': 'White', 'color.black': 'Black', 'color.random': 'Random',
    'diff.easy': 'Easy', 'diff.medium': 'Medium', 'diff.hard': 'Hard', 'diff.expert': 'Expert',
    'time.control': 'Time control', 'time.unlimited': 'Unlimited', 'time.custom': 'Custom…',
    'time.other': 'Other', 'time.minutes': 'Minutes', 'time.increment': 'Increment (s)',
    'time.delay': 'Delay (s)', 'time.noClock': 'No clock', 'time.min': '{n} min',
    'tc.bullet': 'Bullet', 'tc.blitz': 'Blitz', 'tc.rapid': 'Rapid', 'tc.classical': 'Classical',

    'pvp.title': 'Pass & Play', 'pvp.subtitle': 'Two players, one device. White moves first.',

    'ctl.hint': '💡 Hint', 'ctl.hintTitle': 'Show best move',
    'ctl.analyze': '🔬 Analyze', 'ctl.analyzeTitle': 'Analyze game',
    'ctl.undo': '↶ Undo', 'ctl.undoTitle': 'Undo (←/U)',
    'ctl.flip': '⇅ Flip', 'ctl.flipTitle': 'Flip board (F)',
    'ctl.draw': '½ Draw', 'ctl.resign': '⚑ Resign',
    'ctl.fullscreen': '⛶ Fullscreen', 'ctl.fullscreenTitle': 'Fullscreen (Shift+F)',
    'ctl.new': '↻ New Game', 'ctl.newTitle': 'New game (N)',
    'ctl.menu': '☰ Menu', 'ctl.menuTitle': 'Menu',

    'side.white': 'White', 'side.black': 'Black',
    'status.check': 'Check!', 'status.checkmate': 'Checkmate', 'status.stalemate': 'Stalemate — draw',
    'status.drawInsufficient': 'Draw — insufficient material', 'status.drawFifty': 'Draw — fifty-move rule',
    'status.drawRepetition': 'Draw — threefold repetition', 'status.timeout': 'Time out',
    'status.resign': 'Resignation', 'status.wins': '{name} wins',
    'ai.thinking': 'AI is thinking…', 'analysis.accuracy': 'Accuracy', 'analyze.progress': '🔬 Analyzing… {pct}%',

    'over.checkmate': 'Checkmate', 'over.stalemate': 'Stalemate', 'over.draw': 'Draw',
    'over.drawAgreed': 'Draw Agreed', 'over.timeout': 'Time Out', 'over.resign': 'Resignation',
    'over.abandoned': 'Opponent Left', 'over.gameOver': 'Game Over',
    'over.drawMsg': 'The game is a draw.', 'over.wins': '{name} wins.', 'over.youWin': 'You win!',
    'over.oppLeft': '{name} left — you win.',
    'over.meta': 'Duration {d} · {n} plies · avg {a}s/move', 'over.rating': 'Rating {r} ({sign}{delta})',
    'btn.menu': 'Menu', 'btn.save': '★ Save Game', 'btn.saved': '✓ Saved', 'btn.new': 'New Game',
    'btn.leave': 'Leave', 'btn.rematch': 'Rematch', 'btn.waitingOpp': 'Waiting for opponent…',
    'online.msg': '🌐 Online — vs {name}',
    'draw.offered': 'Draw offered…', 'draw.declined': 'Draw declined.', 'draw.offers': '{name} offers a draw',
    'rematch.wants': '{name} wants a rematch', 'rematch.playAgain': 'Play again', 'rematch.noThanks': 'No thanks',
    'ach.unlocked': 'Achievement unlocked',

    'stats.title': 'Profile & Stats', 'stats.playerName': 'Player name', 'stats.rating': 'Rating (Elo)',
    'stats.gamesPlayed': 'Games played', 'stats.winsAi': 'Wins vs AI', 'stats.lossesAi': 'Losses vs AI',
    'stats.drawsAi': 'Draws vs AI', 'stats.winRate': 'Win rate', 'stats.bestStreak': 'Best streak',
    'stats.flawlessWins': 'Flawless wins', 'stats.fastestMate': 'Fastest mate', 'stats.moves': '{n} moves',
    'stats.avgDuration': 'Avg duration', 'stats.avgMoves': 'Avg moves', 'stats.onlineWld': 'Online W/L/D',
    'stats.byDifficulty': 'By difficulty (vs AI)', 'stats.level': 'Level', 'stats.achievements': 'Achievements',
    'stats.savedGames': 'Saved games', 'stats.noSaved': 'No saved games yet. Finish a game and choose “Save Game”.',
    'stats.replay': 'Replay', 'stats.pgn': 'PGN', 'stats.reset': 'Reset stats',
    'stats.resetConfirm': 'Reset all statistics? Saved games are kept.', 'stats.plies': '{n} plies',
    'pgn.title': 'PGN', 'pgn.copy': 'Copy', 'pgn.copied': 'Copied', 'pgn.download': 'Download', 'pgn.close': 'Close',

    'howto.title': 'How to Play', 'howto.body': HOWTO_EN,

    'account.subtitle': 'Sync your stats, rating, achievements, and saved games across devices.',
    'account.username': 'Username', 'account.password': 'Password',
    'account.userPlaceholder': '3–24 letters, numbers, _', 'account.passPlaceholder': 'at least 6 characters',
    'account.createAccount': 'Create Account', 'account.pleaseWait': 'Please wait…',
    'account.genericError': 'Something went wrong.',

    'online.title': 'Play Online',
    'online.subtitle': "You'll be matched with another player choosing the same time control.",
    'online.find': 'Find Opponent', 'online.finding': 'Finding an opponent…',
    'online.waiting': 'Waiting for another player. This stays open until someone joins.',

    'friends.title': 'Friends', 'friends.addPlaceholder': 'Add friend by username', 'friends.add': 'Add',
    'friends.requests': 'Requests', 'friends.sent': 'Sent', 'friends.pending': 'pending',
    'friends.yours': 'Your friends', 'friends.none': 'No friends yet — add someone above.',
    'friends.play': 'Play', 'friends.remove': 'Remove', 'friends.challenges': 'Challenges',
    'friends.counter': 'Counter', 'friends.theirTurn': 'their turn', 'friends.yourTurn': 'your turn',
    'friends.waiting': 'waiting', 'friends.accepted': 'accepted',
    'challenge.pickPrompt': 'Choose a time control:',
  },

  es: {
    'nav.play': 'Jugar', 'nav.learn': 'Aprender', 'nav.stats': 'Estadísticas', 'nav.settings': 'Ajustes',
    'account.login': 'Iniciar sesión', 'account.signup': 'Registrarse', 'account.logout': 'Cerrar sesión',
    'home.opponent': 'Oponente', 'home.player': 'Jugador',
    'play.title': 'Jugar al ajedrez',
    'card.online.title': 'Jugar en línea', 'card.online.sub': 'Juega contra una persona', 'card.online.hint': '(inicia sesión)',
    'card.bots.title': 'Jugar contra bots', 'card.bots.sub': 'Desafía a la computadora',
    'card.friend.title': 'Jugar con un amigo', 'card.friend.sub': 'Invita a un amigo a jugar',
    'card.pvp.title': 'Pasar y jugar', 'card.pvp.sub': 'Dos jugadores, un dispositivo',
    'card.resume.title': 'Reanudar partida', 'card.resume.sub': 'Continúa donde lo dejaste',
    'home.gameHistory': 'Historial de partidas',
    'lang.title': 'Elige tu idioma preferido',

    'common.back': 'Atrás', 'common.backToMenu': 'Volver al menú', 'common.startGame': 'Empezar partida',
    'common.menu': 'Menú', 'common.cancel': 'Cancelar', 'common.close': 'Cerrar',
    'common.accept': 'Aceptar', 'common.decline': 'Rechazar',

    'settings.title': 'Ajustes', 'settings.sound': 'Efectos de sonido', 'settings.music': 'Música de fondo',
    'settings.highlights': 'Resaltar jugadas', 'settings.animations': 'Animaciones',
    'settings.boardTheme': 'Tema del tablero', 'settings.language': 'Idioma',
    'theme.wood': 'Madera', 'theme.marble': 'Mármol', 'theme.green': 'Verde',
    'theme.blue': 'Azul', 'theme.coral': 'Coral', 'theme.slate': 'Pizarra',

    'bots.title': 'Jugar contra bots', 'bots.difficulty': 'Dificultad', 'bots.youPlay': 'Tú juegas con',
    'color.white': 'Blancas', 'color.black': 'Negras', 'color.random': 'Al azar',
    'diff.easy': 'Fácil', 'diff.medium': 'Media', 'diff.hard': 'Difícil', 'diff.expert': 'Experto',
    'time.control': 'Control de tiempo', 'time.unlimited': 'Sin límite', 'time.custom': 'Personalizado…',
    'time.other': 'Otro', 'time.minutes': 'Minutos', 'time.increment': 'Incremento (s)',
    'time.delay': 'Retardo (s)', 'time.noClock': 'Sin reloj', 'time.min': '{n} min',
    'tc.bullet': 'Bullet', 'tc.blitz': 'Blitz', 'tc.rapid': 'Rápida', 'tc.classical': 'Clásica',

    'pvp.title': 'Pasar y jugar', 'pvp.subtitle': 'Dos jugadores, un dispositivo. Las blancas empiezan.',

    'ctl.hint': '💡 Pista', 'ctl.hintTitle': 'Mostrar la mejor jugada',
    'ctl.analyze': '🔬 Analizar', 'ctl.analyzeTitle': 'Analizar la partida',
    'ctl.undo': '↶ Deshacer', 'ctl.undoTitle': 'Deshacer (←/U)',
    'ctl.flip': '⇅ Girar', 'ctl.flipTitle': 'Girar el tablero (F)',
    'ctl.draw': '½ Tablas', 'ctl.resign': '⚑ Rendirse',
    'ctl.fullscreen': '⛶ Pantalla completa', 'ctl.fullscreenTitle': 'Pantalla completa (Mayús+F)',
    'ctl.new': '↻ Nueva partida', 'ctl.newTitle': 'Nueva partida (N)',
    'ctl.menu': '☰ Menú', 'ctl.menuTitle': 'Menú',

    'side.white': 'Blancas', 'side.black': 'Negras',
    'status.check': '¡Jaque!', 'status.checkmate': 'Jaque mate', 'status.stalemate': 'Ahogado — tablas',
    'status.drawInsufficient': 'Tablas — material insuficiente', 'status.drawFifty': 'Tablas — regla de 50 jugadas',
    'status.drawRepetition': 'Tablas — triple repetición', 'status.timeout': 'Tiempo agotado',
    'status.resign': 'Rendición', 'status.wins': 'Ganan las {name}',
    'ai.thinking': 'La IA está pensando…', 'analysis.accuracy': 'Precisión', 'analyze.progress': '🔬 Analizando… {pct}%',

    'over.checkmate': 'Jaque mate', 'over.stalemate': 'Ahogado', 'over.draw': 'Tablas',
    'over.drawAgreed': 'Tablas acordadas', 'over.timeout': 'Tiempo agotado', 'over.resign': 'Rendición',
    'over.abandoned': 'El rival se fue', 'over.gameOver': 'Fin de la partida',
    'over.drawMsg': 'La partida es tablas.', 'over.wins': 'Ganan las {name}.', 'over.youWin': '¡Ganas!',
    'over.oppLeft': '{name} se fue — ganas.',
    'over.meta': 'Duración {d} · {n} medios movimientos · media {a}s/jugada', 'over.rating': 'Puntuación {r} ({sign}{delta})',
    'btn.menu': 'Menú', 'btn.save': '★ Guardar partida', 'btn.saved': '✓ Guardada', 'btn.new': 'Nueva partida',
    'btn.leave': 'Salir', 'btn.rematch': 'Revancha', 'btn.waitingOpp': 'Esperando al rival…',
    'online.msg': '🌐 En línea — vs {name}',
    'draw.offered': 'Tablas ofrecidas…', 'draw.declined': 'Tablas rechazadas.', 'draw.offers': '{name} ofrece tablas',
    'rematch.wants': '{name} quiere la revancha', 'rematch.playAgain': 'Jugar otra vez', 'rematch.noThanks': 'No, gracias',
    'ach.unlocked': 'Logro desbloqueado',

    'stats.title': 'Perfil y estadísticas', 'stats.playerName': 'Nombre del jugador', 'stats.rating': 'Puntuación (Elo)',
    'stats.gamesPlayed': 'Partidas jugadas', 'stats.winsAi': 'Victorias vs IA', 'stats.lossesAi': 'Derrotas vs IA',
    'stats.drawsAi': 'Tablas vs IA', 'stats.winRate': '% de victorias', 'stats.bestStreak': 'Mejor racha',
    'stats.flawlessWins': 'Victorias impecables', 'stats.fastestMate': 'Mate más rápido', 'stats.moves': '{n} jugadas',
    'stats.avgDuration': 'Duración media', 'stats.avgMoves': 'Jugadas de media', 'stats.onlineWld': 'En línea V/D/T',
    'stats.byDifficulty': 'Por dificultad (vs IA)', 'stats.level': 'Nivel', 'stats.achievements': 'Logros',
    'stats.savedGames': 'Partidas guardadas', 'stats.noSaved': 'Aún no hay partidas guardadas. Termina una partida y elige “Guardar partida”.',
    'stats.replay': 'Reproducir', 'stats.pgn': 'PGN', 'stats.reset': 'Reiniciar estadísticas',
    'stats.resetConfirm': '¿Reiniciar todas las estadísticas? Las partidas guardadas se conservan.', 'stats.plies': '{n} medios movimientos',
    'pgn.title': 'PGN', 'pgn.copy': 'Copiar', 'pgn.copied': 'Copiado', 'pgn.download': 'Descargar', 'pgn.close': 'Cerrar',

    'howto.title': 'Cómo jugar', 'howto.body': HOWTO_ES,

    'account.subtitle': 'Sincroniza tus estadísticas, puntuación, logros y partidas guardadas entre dispositivos.',
    'account.username': 'Nombre de usuario', 'account.password': 'Contraseña',
    'account.userPlaceholder': '3–24 letras, números, _', 'account.passPlaceholder': 'al menos 6 caracteres',
    'account.createAccount': 'Crear cuenta', 'account.pleaseWait': 'Espera…',
    'account.genericError': 'Algo salió mal.',

    'online.title': 'Jugar en línea',
    'online.subtitle': 'Te emparejaremos con otro jugador que elija el mismo control de tiempo.',
    'online.find': 'Buscar rival', 'online.finding': 'Buscando un rival…',
    'online.waiting': 'Esperando a otro jugador. Esto permanece abierto hasta que alguien se una.',

    'friends.title': 'Amigos', 'friends.addPlaceholder': 'Añadir amigo por nombre de usuario', 'friends.add': 'Añadir',
    'friends.requests': 'Solicitudes', 'friends.sent': 'Enviadas', 'friends.pending': 'pendiente',
    'friends.yours': 'Tus amigos', 'friends.none': 'Aún no tienes amigos — añade a alguien arriba.',
    'friends.play': 'Jugar', 'friends.remove': 'Quitar', 'friends.challenges': 'Desafíos',
    'friends.counter': 'Contraofertar', 'friends.theirTurn': 'su turno', 'friends.yourTurn': 'tu turno',
    'friends.waiting': 'esperando', 'friends.accepted': 'aceptado',
    'challenge.pickPrompt': 'Elige un control de tiempo:',
  },

  fr: {
    'nav.play': 'Jouer', 'nav.learn': 'Apprendre', 'nav.stats': 'Statistiques', 'nav.settings': 'Paramètres',
    'account.login': 'Se connecter', 'account.signup': "S'inscrire", 'account.logout': 'Déconnexion',
    'home.opponent': 'Adversaire', 'home.player': 'Joueur',
    'play.title': 'Jouer aux échecs',
    'card.online.title': 'Jouer en ligne', 'card.online.sub': 'Jouer contre une personne', 'card.online.hint': '(connexion)',
    'card.bots.title': 'Jouer contre des bots', 'card.bots.sub': "Défier l'ordinateur",
    'card.friend.title': 'Jouer avec un ami', 'card.friend.sub': 'Inviter un ami à jouer',
    'card.pvp.title': 'Jouer à tour de rôle', 'card.pvp.sub': 'Deux joueurs, un appareil',
    'card.resume.title': 'Reprendre la partie', 'card.resume.sub': 'Reprenez où vous en étiez',
    'home.gameHistory': 'Historique des parties',
    'lang.title': 'Choisissez votre langue préférée',

    'common.back': 'Retour', 'common.backToMenu': 'Retour au menu', 'common.startGame': 'Commencer la partie',
    'common.menu': 'Menu', 'common.cancel': 'Annuler', 'common.close': 'Fermer',
    'common.accept': 'Accepter', 'common.decline': 'Refuser',

    'settings.title': 'Paramètres', 'settings.sound': 'Effets sonores', 'settings.music': 'Musique de fond',
    'settings.highlights': 'Surligner les coups', 'settings.animations': 'Animations',
    'settings.boardTheme': "Thème de l'échiquier", 'settings.language': 'Langue',
    'theme.wood': 'Bois', 'theme.marble': 'Marbre', 'theme.green': 'Vert',
    'theme.blue': 'Bleu', 'theme.coral': 'Corail', 'theme.slate': 'Ardoise',

    'bots.title': 'Jouer contre des bots', 'bots.difficulty': 'Difficulté', 'bots.youPlay': 'Vous jouez',
    'color.white': 'Blancs', 'color.black': 'Noirs', 'color.random': 'Aléatoire',
    'diff.easy': 'Facile', 'diff.medium': 'Moyen', 'diff.hard': 'Difficile', 'diff.expert': 'Expert',
    'time.control': 'Cadence', 'time.unlimited': 'Illimité', 'time.custom': 'Personnalisé…',
    'time.other': 'Autre', 'time.minutes': 'Minutes', 'time.increment': 'Incrément (s)',
    'time.delay': 'Délai (s)', 'time.noClock': 'Sans pendule', 'time.min': '{n} min',
    'tc.bullet': 'Bullet', 'tc.blitz': 'Blitz', 'tc.rapid': 'Rapide', 'tc.classical': 'Classique',

    'pvp.title': 'Jouer à tour de rôle', 'pvp.subtitle': 'Deux joueurs, un appareil. Les blancs commencent.',

    'ctl.hint': '💡 Indice', 'ctl.hintTitle': 'Montrer le meilleur coup',
    'ctl.analyze': '🔬 Analyser', 'ctl.analyzeTitle': 'Analyser la partie',
    'ctl.undo': '↶ Annuler', 'ctl.undoTitle': 'Annuler (←/U)',
    'ctl.flip': "⇅ Retourner", 'ctl.flipTitle': "Retourner l'échiquier (F)",
    'ctl.draw': '½ Nulle', 'ctl.resign': '⚑ Abandonner',
    'ctl.fullscreen': '⛶ Plein écran', 'ctl.fullscreenTitle': 'Plein écran (Maj+F)',
    'ctl.new': '↻ Nouvelle partie', 'ctl.newTitle': 'Nouvelle partie (N)',
    'ctl.menu': '☰ Menu', 'ctl.menuTitle': 'Menu',

    'side.white': 'Blancs', 'side.black': 'Noirs',
    'status.check': 'Échec !', 'status.checkmate': 'Échec et mat', 'status.stalemate': 'Pat — nulle',
    'status.drawInsufficient': 'Nulle — matériel insuffisant', 'status.drawFifty': 'Nulle — règle des cinquante coups',
    'status.drawRepetition': 'Nulle — triple répétition', 'status.timeout': 'Temps écoulé',
    'status.resign': 'Abandon', 'status.wins': 'Les {name} gagnent',
    'ai.thinking': "L'IA réfléchit…", 'analysis.accuracy': 'Précision', 'analyze.progress': '🔬 Analyse… {pct}%',

    'over.checkmate': 'Échec et mat', 'over.stalemate': 'Pat', 'over.draw': 'Nulle',
    'over.drawAgreed': 'Nulle convenue', 'over.timeout': 'Temps écoulé', 'over.resign': 'Abandon',
    'over.abandoned': "L'adversaire est parti", 'over.gameOver': 'Partie terminée',
    'over.drawMsg': 'La partie est nulle.', 'over.wins': 'Les {name} gagnent.', 'over.youWin': 'Vous gagnez !',
    'over.oppLeft': '{name} est parti — vous gagnez.',
    'over.meta': 'Durée {d} · {n} demi-coups · moy. {a}s/coup', 'over.rating': 'Classement {r} ({sign}{delta})',
    'btn.menu': 'Menu', 'btn.save': '★ Enregistrer', 'btn.saved': '✓ Enregistrée', 'btn.new': 'Nouvelle partie',
    'btn.leave': 'Quitter', 'btn.rematch': 'Revanche', 'btn.waitingOpp': "En attente de l'adversaire…",
    'online.msg': '🌐 En ligne — vs {name}',
    'draw.offered': 'Nulle proposée…', 'draw.declined': 'Nulle refusée.', 'draw.offers': '{name} propose la nulle',
    'rematch.wants': '{name} veut une revanche', 'rematch.playAgain': 'Rejouer', 'rematch.noThanks': 'Non merci',
    'ach.unlocked': 'Succès débloqué',

    'stats.title': 'Profil et statistiques', 'stats.playerName': 'Nom du joueur', 'stats.rating': 'Classement (Elo)',
    'stats.gamesPlayed': 'Parties jouées', 'stats.winsAi': 'Victoires vs IA', 'stats.lossesAi': 'Défaites vs IA',
    'stats.drawsAi': 'Nulles vs IA', 'stats.winRate': 'Taux de victoire', 'stats.bestStreak': 'Meilleure série',
    'stats.flawlessWins': 'Victoires parfaites', 'stats.fastestMate': 'Mat le plus rapide', 'stats.moves': '{n} coups',
    'stats.avgDuration': 'Durée moyenne', 'stats.avgMoves': 'Coups en moyenne', 'stats.onlineWld': 'En ligne V/D/N',
    'stats.byDifficulty': 'Par difficulté (vs IA)', 'stats.level': 'Niveau', 'stats.achievements': 'Succès',
    'stats.savedGames': 'Parties enregistrées', 'stats.noSaved': 'Aucune partie enregistrée. Terminez une partie et choisissez « Enregistrer ».',
    'stats.replay': 'Revoir', 'stats.pgn': 'PGN', 'stats.reset': 'Réinitialiser les stats',
    'stats.resetConfirm': 'Réinitialiser toutes les statistiques ? Les parties enregistrées sont conservées.', 'stats.plies': '{n} demi-coups',
    'pgn.title': 'PGN', 'pgn.copy': 'Copier', 'pgn.copied': 'Copié', 'pgn.download': 'Télécharger', 'pgn.close': 'Fermer',

    'howto.title': 'Comment jouer', 'howto.body': HOWTO_FR,

    'account.subtitle': 'Synchronisez vos statistiques, votre classement, vos succès et vos parties enregistrées entre appareils.',
    'account.username': "Nom d'utilisateur", 'account.password': 'Mot de passe',
    'account.userPlaceholder': '3–24 lettres, chiffres, _', 'account.passPlaceholder': 'au moins 6 caractères',
    'account.createAccount': 'Créer un compte', 'account.pleaseWait': 'Veuillez patienter…',
    'account.genericError': "Une erreur s'est produite.",

    'online.title': 'Jouer en ligne',
    'online.subtitle': 'Vous serez associé à un autre joueur choisissant la même cadence.',
    'online.find': 'Trouver un adversaire', 'online.finding': "Recherche d'un adversaire…",
    'online.waiting': "En attente d'un autre joueur. Cela reste ouvert jusqu'à ce que quelqu'un rejoigne.",

    'friends.title': 'Amis', 'friends.addPlaceholder': "Ajouter un ami par nom d'utilisateur", 'friends.add': 'Ajouter',
    'friends.requests': 'Demandes', 'friends.sent': 'Envoyées', 'friends.pending': 'en attente',
    'friends.yours': 'Vos amis', 'friends.none': "Aucun ami pour l'instant — ajoutez quelqu'un ci-dessus.",
    'friends.play': 'Jouer', 'friends.remove': 'Retirer', 'friends.challenges': 'Défis',
    'friends.counter': 'Contre-proposer', 'friends.theirTurn': 'leur tour', 'friends.yourTurn': 'votre tour',
    'friends.waiting': 'en attente', 'friends.accepted': 'accepté',
    'challenge.pickPrompt': 'Choisissez une cadence :',
  },

  de: {
    'nav.play': 'Spielen', 'nav.learn': 'Lernen', 'nav.stats': 'Statistiken', 'nav.settings': 'Einstellungen',
    'account.login': 'Anmelden', 'account.signup': 'Registrieren', 'account.logout': 'Abmelden',
    'home.opponent': 'Gegner', 'home.player': 'Spieler',
    'play.title': 'Schach spielen',
    'card.online.title': 'Online spielen', 'card.online.sub': 'Gegen eine Person spielen', 'card.online.hint': '(anmelden)',
    'card.bots.title': 'Gegen Bots spielen', 'card.bots.sub': 'Fordere den Computer heraus',
    'card.friend.title': 'Gegen einen Freund spielen', 'card.friend.sub': 'Lade einen Freund zum Spiel ein',
    'card.pvp.title': 'Abwechselnd spielen', 'card.pvp.sub': 'Zwei Spieler, ein Gerät',
    'card.resume.title': 'Spiel fortsetzen', 'card.resume.sub': 'Mach dort weiter, wo du aufgehört hast',
    'home.gameHistory': 'Partieverlauf',
    'lang.title': 'Wähle deine bevorzugte Sprache',

    'common.back': 'Zurück', 'common.backToMenu': 'Zurück zum Menü', 'common.startGame': 'Spiel starten',
    'common.menu': 'Menü', 'common.cancel': 'Abbrechen', 'common.close': 'Schließen',
    'common.accept': 'Annehmen', 'common.decline': 'Ablehnen',

    'settings.title': 'Einstellungen', 'settings.sound': 'Soundeffekte', 'settings.music': 'Hintergrundmusik',
    'settings.highlights': 'Zughervorhebungen', 'settings.animations': 'Animationen',
    'settings.boardTheme': 'Brettdesign', 'settings.language': 'Sprache',
    'theme.wood': 'Holz', 'theme.marble': 'Marmor', 'theme.green': 'Grün',
    'theme.blue': 'Blau', 'theme.coral': 'Koralle', 'theme.slate': 'Schiefer',

    'bots.title': 'Gegen Bots spielen', 'bots.difficulty': 'Schwierigkeit', 'bots.youPlay': 'Du spielst',
    'color.white': 'Weiß', 'color.black': 'Schwarz', 'color.random': 'Zufällig',
    'diff.easy': 'Leicht', 'diff.medium': 'Mittel', 'diff.hard': 'Schwer', 'diff.expert': 'Experte',
    'time.control': 'Bedenkzeit', 'time.unlimited': 'Unbegrenzt', 'time.custom': 'Benutzerdefiniert…',
    'time.other': 'Andere', 'time.minutes': 'Minuten', 'time.increment': 'Inkrement (s)',
    'time.delay': 'Verzögerung (s)', 'time.noClock': 'Ohne Uhr', 'time.min': '{n} Min.',
    'tc.bullet': 'Bullet', 'tc.blitz': 'Blitz', 'tc.rapid': 'Schnell', 'tc.classical': 'Klassisch',

    'pvp.title': 'Abwechselnd spielen', 'pvp.subtitle': 'Zwei Spieler, ein Gerät. Weiß beginnt.',

    'ctl.hint': '💡 Tipp', 'ctl.hintTitle': 'Besten Zug zeigen',
    'ctl.analyze': '🔬 Analysieren', 'ctl.analyzeTitle': 'Partie analysieren',
    'ctl.undo': '↶ Zurück', 'ctl.undoTitle': 'Zurücknehmen (←/U)',
    'ctl.flip': '⇅ Drehen', 'ctl.flipTitle': 'Brett drehen (F)',
    'ctl.draw': '½ Remis', 'ctl.resign': '⚑ Aufgeben',
    'ctl.fullscreen': '⛶ Vollbild', 'ctl.fullscreenTitle': 'Vollbild (Umschalt+F)',
    'ctl.new': '↻ Neue Partie', 'ctl.newTitle': 'Neue Partie (N)',
    'ctl.menu': '☰ Menü', 'ctl.menuTitle': 'Menü',

    'side.white': 'Weiß', 'side.black': 'Schwarz',
    'status.check': 'Schach!', 'status.checkmate': 'Schachmatt', 'status.stalemate': 'Patt — Remis',
    'status.drawInsufficient': 'Remis — ungenügendes Material', 'status.drawFifty': 'Remis — Fünfzig-Züge-Regel',
    'status.drawRepetition': 'Remis — dreifache Wiederholung', 'status.timeout': 'Zeit abgelaufen',
    'status.resign': 'Aufgabe', 'status.wins': '{name} gewinnt',
    'ai.thinking': 'Die KI denkt nach…', 'analysis.accuracy': 'Genauigkeit', 'analyze.progress': '🔬 Analysiere… {pct}%',

    'over.checkmate': 'Schachmatt', 'over.stalemate': 'Patt', 'over.draw': 'Remis',
    'over.drawAgreed': 'Remis vereinbart', 'over.timeout': 'Zeit abgelaufen', 'over.resign': 'Aufgabe',
    'over.abandoned': 'Gegner hat verlassen', 'over.gameOver': 'Partie beendet',
    'over.drawMsg': 'Die Partie endet remis.', 'over.wins': '{name} gewinnt.', 'over.youWin': 'Du gewinnst!',
    'over.oppLeft': '{name} hat verlassen — du gewinnst.',
    'over.meta': 'Dauer {d} · {n} Halbzüge · Ø {a}s/Zug', 'over.rating': 'Wertung {r} ({sign}{delta})',
    'btn.menu': 'Menü', 'btn.save': '★ Partie speichern', 'btn.saved': '✓ Gespeichert', 'btn.new': 'Neue Partie',
    'btn.leave': 'Verlassen', 'btn.rematch': 'Revanche', 'btn.waitingOpp': 'Warte auf Gegner…',
    'online.msg': '🌐 Online — vs {name}',
    'draw.offered': 'Remis angeboten…', 'draw.declined': 'Remis abgelehnt.', 'draw.offers': '{name} bietet Remis an',
    'rematch.wants': '{name} möchte eine Revanche', 'rematch.playAgain': 'Nochmal spielen', 'rematch.noThanks': 'Nein danke',
    'ach.unlocked': 'Erfolg freigeschaltet',

    'stats.title': 'Profil & Statistiken', 'stats.playerName': 'Spielername', 'stats.rating': 'Wertung (Elo)',
    'stats.gamesPlayed': 'Gespielte Partien', 'stats.winsAi': 'Siege vs KI', 'stats.lossesAi': 'Niederlagen vs KI',
    'stats.drawsAi': 'Remis vs KI', 'stats.winRate': 'Siegquote', 'stats.bestStreak': 'Beste Serie',
    'stats.flawlessWins': 'Makellose Siege', 'stats.fastestMate': 'Schnellstes Matt', 'stats.moves': '{n} Züge',
    'stats.avgDuration': 'Ø Dauer', 'stats.avgMoves': 'Ø Züge', 'stats.onlineWld': 'Online S/N/R',
    'stats.byDifficulty': 'Nach Schwierigkeit (vs KI)', 'stats.level': 'Stufe', 'stats.achievements': 'Erfolge',
    'stats.savedGames': 'Gespeicherte Partien', 'stats.noSaved': 'Noch keine gespeicherten Partien. Beende eine Partie und wähle „Partie speichern“.',
    'stats.replay': 'Nachspielen', 'stats.pgn': 'PGN', 'stats.reset': 'Statistiken zurücksetzen',
    'stats.resetConfirm': 'Alle Statistiken zurücksetzen? Gespeicherte Partien bleiben erhalten.', 'stats.plies': '{n} Halbzüge',
    'pgn.title': 'PGN', 'pgn.copy': 'Kopieren', 'pgn.copied': 'Kopiert', 'pgn.download': 'Herunterladen', 'pgn.close': 'Schließen',

    'howto.title': 'Spielanleitung', 'howto.body': HOWTO_DE,

    'account.subtitle': 'Synchronisiere Statistiken, Wertung, Erfolge und gespeicherte Partien über Geräte hinweg.',
    'account.username': 'Benutzername', 'account.password': 'Passwort',
    'account.userPlaceholder': '3–24 Buchstaben, Zahlen, _', 'account.passPlaceholder': 'mindestens 6 Zeichen',
    'account.createAccount': 'Konto erstellen', 'account.pleaseWait': 'Bitte warten…',
    'account.genericError': 'Etwas ist schiefgelaufen.',

    'online.title': 'Online spielen',
    'online.subtitle': 'Du wirst mit einem anderen Spieler zusammengebracht, der dieselbe Bedenkzeit wählt.',
    'online.find': 'Gegner finden', 'online.finding': 'Suche einen Gegner…',
    'online.waiting': 'Warte auf einen anderen Spieler. Bleibt offen, bis jemand beitritt.',

    'friends.title': 'Freunde', 'friends.addPlaceholder': 'Freund per Benutzername hinzufügen', 'friends.add': 'Hinzufügen',
    'friends.requests': 'Anfragen', 'friends.sent': 'Gesendet', 'friends.pending': 'ausstehend',
    'friends.yours': 'Deine Freunde', 'friends.none': 'Noch keine Freunde — füge oben jemanden hinzu.',
    'friends.play': 'Spielen', 'friends.remove': 'Entfernen', 'friends.challenges': 'Herausforderungen',
    'friends.counter': 'Gegenangebot', 'friends.theirTurn': 'am Zug (Gegner)', 'friends.yourTurn': 'du bist dran',
    'friends.waiting': 'wartet', 'friends.accepted': 'angenommen',
    'challenge.pickPrompt': 'Wähle eine Bedenkzeit:',
  },
};

let current = 'en';

/** Set the active language (called on boot and when the user picks one). */
export function initLanguage(code) {
  current = LANGUAGES.some((l) => l.code === code) ? code : 'en';
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

/**
 * Translate a key, falling back to English, then to the key itself.
 * Optional `params` fill {placeholder} tokens, e.g. t('time.min', { n: 5 }).
 */
export function t(key, params) {
  const loc = STRINGS[current];
  let s = loc && key in loc ? loc[key] : key in STRINGS.en ? STRINGS.en[key] : key;
  if (params) {
    for (const k in params) s = s.replaceAll(`{${k}}`, params[k]);
  }
  return s;
}
