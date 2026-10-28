# Spin That Track 🎵

**Spin That Track** is a real-time multiplayer music party game powered by the [Spotify Web API](https://developer.spotify.com/documentation/web-api) and [Socket.IO](https://socket.io/). Friends join a shared room via a 6-digit game code, authenticate with Spotify, and listen as mystery songs are selected at random from the group's pooled music libraries. Players compete to identify whose playlist or liked songs the track belongs to, earning points for sharp music intuition and racing to be the first to reach 30 points.

---

## 🚀 Key Features

- **Spotify Library Aggregation**: Seamlessly connects to each player's Spotify account to pool Liked Songs, custom playlists, and recently played tracks into a single shared game roster.
- **Synchronized Playback Control**: Automatically commands Spotify Connect to trigger and synchronize playback across players' active devices (desktop, mobile, or smart speakers).
- **Customizable Song Offsets**: Choose track start offsets (**0s**, **30s**, or **60s**) so gameplay skips straight into the energetic core or chorus of each song.
- **Real-Time Multiplayer Rooms**: Built on WebSockets (`Socket.IO`) with dynamic lobby codes, live vote tracking, soft/hard state updates, and instantaneous score tallying.
- **Intelligent Song Matching**: Advanced regex normalization strips parentheticals, featured artist tags (`feat.`, `ft.`), remix labels, and remaster tags to ensure accurate cross-library track matches regardless of specific album editions.
- **Competitive Scoring Engine**: Strategic scoring rules award **+3 points** for each correctly identified track owner and apply a **-1 point** penalty for wrong guesses. First player to 30 points wins!
- **Spotify-Inspired UI**: Responsive dark-mode interface designed with custom typography, fluid animations, and celebratory winner reaction screens.

---

## 🛠️ Tech Stack

- **Backend**: [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [Socket.IO](https://socket.io/)
- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, CSS3, [Axios](https://axios-http.com/)
- **APIs & Protocols**: [Spotify Web API](https://developer.spotify.com/documentation/web-api), Spotify Connect, WebSockets, HTTPS / SSL
- **Typography & Assets**: Spotify Mix font family, custom UI animations

---

## 🎮 How It Works

```
  [ 🎵 Player 1 ]       [ 🎵 Player 2 ]       [ 🎵 Player 3 ]
   Liked Songs           Playlists             Recent Tracks
        │                     │                     │
        └──────────────┬──────┴─────────────────────┘
                       │
                       ▼
           [ 🎲 Mystery Track Selection ]
           Picks a random song from player pools
                       │
                       ▼
        [ 🔊 Synchronized Spotify Playback ]
         Triggers on chosen playback devices
            (Offset: 0s, 30s, or 60s)
                       │
                       ▼
           [ 🤔 "Whose Track Is This?" ]
          Players select suspected track owners
                       │
                       ▼
           [ 🏆 Scoring & Reveal Phase ]
            • Correct Guess:   +3 pts
            • Incorrect Guess: -1 pt
                       │
                       ▼
            [ First to 30 Points Wins! ]
```

### Gameplay Loop:
1. **Lobby & Setup**: The host generates a game code. Friends join using their display names, authorize with Spotify, and select their preferred playback device from the dropdown.
2. **Mystery Spin**: When the host starts the game, the server picks an unplayed track from any connected player's library and cues it up.
3. **Voting**: Players listen along and vote on who they believe saved or listens to the song.
4. **Reveal**: Once all votes are in, the song title, artist, album art, and true owner(s) are revealed.
5. **Next Round**: Players vote to continue to the next track until someone crosses the 30-point threshold for victory!

---

## ⚙️ Installation & Setup

### Prerequisites

- **Node.js** (v16.0.0 or higher) & **npm**
- A **Spotify Premium** account (required by Spotify's Web API for automated playback control)
- A **Spotify Developer Application** (free to create)

### 1. Spotify App Configuration

1. Visit the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
2. Click **Create an App**.
3. Set your **Redirect URI** (e.g., `https://your-domain.com/callback/callback.html` or `http://localhost:3000/callback.html`).
4. Note your **Client ID** and **Client Secret**.

### 2. Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/talonbrinkman/spin-that-track.git
   cd spin-that-track
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   Navigate to `http://localhost:3000` (or `https://localhost:3443` if SSL certificates are present in `/ssl`).

---

## 📁 Repository Structure

```
spin-that-track/
├── fonts/                    # Spotify Mix typography
├── images/                   # Favicons and winner celebration reaction images
├── ssl/                      # HTTPS certificates (git-ignored for security)
├── index.html                # Main single-page application interface
├── main.css                  # Spotify-themed dark styling and responsive layout
├── script.js                 # Client-side Spotify API handler & UI controller
├── server.js                 # Express server & Socket.IO multiplayer game engine
├── startServer.bat           # Windows quick-launch script
├── package.json              # Project dependencies and npm scripts
├── .gitignore                # Security rules ignoring node_modules and SSL keys
└── README.md                 # Project documentation
```

---

## 🔮 Upcoming Improvements

- [ ] **Spotify Web Playback SDK**: In-browser audio streaming directly in the tab without needing an external Spotify client open.
- [ ] **Custom Game Modes**: "Guilty Pleasures" mode, genre filters, and playlist-only restrictions.
- [ ] **Audio Preview Fallback**: 30-second MP3 preview snippets for players without active Spotify Premium subscriptions.
- [ ] **OAuth PKCE Migration**: Transition client authorization fully to Authorization Code with PKCE.

---

## 📄 License & Disclaimer

This project is an independent creation and is not affiliated with, endorsed by, or sponsored by Spotify AB.
Distributed under the ISC License.
