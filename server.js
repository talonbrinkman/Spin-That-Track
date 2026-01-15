const express = require('express');
const path = require("path");
const fs = require('fs');
const https = require('https');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const SSL_KEY_PATH  = path.join(__dirname, "ssl", "server.key");
const SSL_CERT_PATH = path.join(__dirname, "ssl", "server.crt");

let server;
let PORT;

if (fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
    server = https.createServer({
        key: fs.readFileSync(SSL_KEY_PATH),
        cert: fs.readFileSync(SSL_CERT_PATH)
    }, app);
    PORT = 3443;
}
else{
    server = http.createServer(app);
    PORT = 3000;
}

const io = new socketIo.Server(server, {
    cors: {
        origin: "https://spinthattrack.asuscomm.com",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"]
    }
});

app.get('/', (req, res) => {
    res.send('Node server is running over HTTPS!');
});
app.get('/api', (req, res) => {
    res.json({ message: "API route works!" });
});
app.get('/home', (req, res) => {
    res.send("Home route works!");
});

const users = [];
const games = [];

function updateGameData(game, updateType){
    for(let j = 0; j < game.gameUsers.length; j++){
        io.to(game.gameUsers[j].userSocketId).emit('updateGameData', {
            gameWinner: game.gameWinner,
            gameWinnerImageIndex: game.gameWinnerImageIndex,
            gameCode: game.gameCode,
            gameHost: { userId: game.gameHost.userId, userName: game.gameHost.userName },
            gameUsers: game.gameUsers.map(u => ({
                userId: u.userId,
                userName: u.userName,
                userSocketId: u.userSocketId,
                userScore: u.userScore,
                userGuess: u.userGuess,
                userTracks: u.userTracks
            })),
            gameStartTime: game.gameStartTime,
            gameCurrentTrackId: game.gameCurrentTrackId,
            gameCurrentTrackName: game.gameCurrentTrackName,
            gameCurrentTrackArtist: game.gameCurrentTrackArtist,
            gameState: game.gameState,
            playersWithTrack: game.playersWithTrack,
            playersWhoveVoted: game.playersWhoveVoted,
            updateType
        });
    }
}

function deleteGame(game){
    for(let i = 0; i < game.gameUsers.length; i++){
        io.to(game.gameUsers[i].userSocketId).emit('gameDeleted', {});
    }
}

function nextTrack(game){
    let randomUserIndex = Math.floor(Math.random() * game.gameUsers.length);
    let randomUser = game.gameUsers[randomUserIndex];
    let randomTrackIndex = Math.floor(Math.random() * randomUser.userTracks.length);
    let randomTrack = randomUser.userTracks[randomTrackIndex];
    while(game.playedTracks.includes(randomTrack.id)){
        randomUserIndex = Math.floor(Math.random() * game.gameUsers.length);
        randomUser = game.gameUsers[randomUserIndex];
        randomTrackIndex = Math.floor(Math.random() * randomUser.userTracks.length);
        randomTrack = randomUser.userTracks[randomTrackIndex];
    }
    game.gameCurrentTrackId = randomTrack.id;
    game.gameCurrentTrackName = randomTrack.name;
    game.gameCurrentTrackArtist = randomTrack.artist;
    game.playedTracks.push(randomTrack.id);
}

function checkEndGame(game){
    let highestScore = 0;
    let highestScorers = [];
    for(let i = 0; i < game.gameUsers.length; i++){
        const user = game.gameUsers[i];
        if(user.userScore >= 30){
            if(user.userScore > highestScore){
                highestScore = user.userScore;
                highestScorers = [user];
            } else if(user.userScore === highestScore){
                highestScorers.push(user);
            }
        }
    }
    if(highestScorers.length === 1){
        game.gameCurrentTrackId = "";
        game.gameState = "winner";
        game.gameWinner = highestScorers[0].userName;
        game.gameWinnerImageIndex = Math.floor(Math.random() * 17);
        return highestScorers[0].userName;
    }
}

function processGuesses(game){
    const baseTrackName = game.gameCurrentTrackName
        .toLowerCase()
        .replace(/\s*\(.*?\)/g,'')
        .replace(/\s*\[.*?\]/g,'')
        .replace(/\s*[-–—].*$/g,'')
        .replace(/\s*feat\..*$/i,'')
        .replace(/\s*ft\..*$/i,'')
        .replace(/\s*with.*$/i,'')
        .replace(/\s*\(remix\)/gi,'')
        .replace(/\s*\(live version\)/gi,'')
        .replace(/\s*\(live\)/gi,'')
        .replace(/\s*\(version\)/gi,'')
        .replace(/\s*\(edit\)/gi,'')
        .trim();
    const baseArtist = game.gameCurrentTrackArtist ? game.gameCurrentTrackArtist.toLowerCase() : '';
    for(let i = 0; i < game.gameUsers.length; i++){
        const player = game.gameUsers[i];
        for(let j = 0; j < player.userGuess.length; j++){
            const guessedUserId = player.userGuess[j];
            const guessedUser = game.gameUsers.find(u => u.userId === guessedUserId);
            if(guessedUser){
                const trackFound = guessedUser.userTracks.some(track => {
                    const userTrackBaseName = track.name
                        .toLowerCase()
                        .replace(/\s*\(.*?\)/g,'')
                        .replace(/\s*\[.*?\]/g,'')
                        .replace(/\s*[-–—].*$/g,'')
                        .replace(/\s*feat\..*$/i,'')
                        .replace(/\s*ft\..*$/i,'')
                        .replace(/\s*with.*$/i,'')
                        .replace(/\s*\(remix\)/gi,'')
                        .replace(/\s*\(live version\)/gi,'')
                        .replace(/\s*\(live\)/gi,'')
                        .replace(/\s*\(version\)/gi,'')
                        .replace(/\s*\(edit\)/gi,'')
                        .trim();
                    const userTrackBaseArtist = track.artist ? track.artist.toLowerCase() : '';
                    return userTrackBaseName === baseTrackName && userTrackBaseArtist === baseArtist;
                });
                if(trackFound) player.userScore += 3;
                else player.userScore -= 1;
            }
        }
    }
    game.currentTrackId = "continue";
}

function getPlayersWithCurrentTrack(game){
    const baseTrackName = game.gameCurrentTrackName
        .toLowerCase()
        .replace(/\s*\(.*?\)/g,'')
        .replace(/\s*\[.*?\]/g,'')
        .replace(/\s*[-–—].*$/g,'')
        .replace(/\s*feat\..*$/i,'')
        .replace(/\s*ft\..*$/i,'')
        .replace(/\s*with.*$/i,'')
        .replace(/\s*\(remix\)/gi,'')
        .replace(/\s*\(live version\)/gi,'')
        .replace(/\s*\(live\)/gi,'')
        .replace(/\s*\(version\)/gi,'')
        .replace(/\s*\(edit\)/gi,'')
        .trim();
    const baseArtist = game.gameCurrentTrackArtist ? game.gameCurrentTrackArtist.toLowerCase() : '';
    game.playersWithTrack = game.gameUsers
        .filter(user => user.userTracks.some(track => {
            const userTrackBaseName = track.name
                .toLowerCase()
                .replace(/\s*\(.*?\)/g,'')
                .replace(/\s*\[.*?\]/g,'')
                .replace(/\s*[-–—].*$/g,'')
                .replace(/\s*feat\..*$/i,'')
                .replace(/\s*ft\..*$/i,'')
                .replace(/\s*with.*$/i,'')
                .replace(/\s*\(remix\)/gi,'')
                .replace(/\s*\(live version\)/gi,'')
                .replace(/\s*\(live\)/gi,'')
                .replace(/\s*\(version\)/gi,'')
                .replace(/\s*\(edit\)/gi,'')
                .trim();
            const userTrackBaseArtist = track.artist ? track.artist.toLowerCase() : '';
            return userTrackBaseName === baseTrackName && userTrackBaseArtist === baseArtist;
        }))
        .map(user => user.userId);
}

function resetGame(game){
    game.gameState = "lobby";
    game.gameWinner = "";
    game.gameCurrentTrackId = "";
    for(let j = 0; j < game.gameUsers.length; j++){
        game.gameUsers[j].userScore = 0;
        game.gameUsers[j].userGuess = [];
    }
    game.playedTracks = [];
}

io.on('connection', socket => {
    console.clear();
    users.push(socket.id);
    console.log("Users: " + users.length + "\nGames: " + games.length);

    socket.on('joinGame', data => {
        let gameFound = false;
        for (let i = 0; i < games.length; i++) {
            if (data.gameCode === games[i].gameCode) {
                gameFound = true;
                data.user.userSocketId = socket.id;
                data.user.userScore = 0;
                games[i].gameUsers.push(data.user);
                updateGameData(games[i], "hard");
                break;
            }
        }
        if (!gameFound) socket.emit('invalidGameCode', {});
    });
    socket.on('createGame', data => {
        data.user.userSocketId = socket.id;
        data.user.userScore = 0;
        games.push({
            gameCode: data.gameCode,
            gameHost: data.user,
            gameUsers: [data.user],
            gameStartTime: data.startTime,
            gameCurrentTrackId: "",
            gameCurrentTrackName: "",
            gameCurrentTrackArtist: "",
            gameState: "lobby",
            gameContinueVotes: 0,
            playersWhoveVoted: [],
            playersWithTrack: [],
            playedTracks: [],
            gameWinner: "",
            gameWinnerImageIndex: 0
        });
        socket.emit('gameCreated');
        updateGameData(games[games.length - 1], "hard");
        console.clear();
        console.log("Users: " + users.length + "\nGames: " + games.length);
    });
    socket.on('startGame', (data) => {
        for(let i = 0; i < games.length; i++){
            if(games[i].gameHost.userId == data.userId){
                games[i].gameState = "voting";
                nextTrack(games[i]);
                updateGameData(games[i], "hard");
                break;
            }
        }
    });
    socket.on('checkGame', (data) => {
        let gameExists = false;
        for (let i = 0; i < games.length; i++){
            if(games[i].id == data.id){
                gameExists = true;
                break;
            }
        }
        if(gameExists){
            socket.emit('gameCodeVerification', {
                message: "true",
            });
        }
        else{
            socket.emit('gameCodeVerification', {
                message: "false",
            });
        }
    });
    socket.on('submitGuess', (data) => {
        for(let i = 0; i < games.length; i++){
            if(games[i].gameCode == data.gameCode){
                for(let j = 0; j < games[i].gameUsers.length; j++){
                    if(games[i].gameUsers[j].userId == data.user.userId){
                        games[i].gameUsers[j].userGuess = [...data.user.userGuess];
                        break;
                    }
                }
            }
        }

        for(let i = 0; i < games.length; i++){
            if(games[i].gameCode == data.gameCode){
                let gameSubmitCount = 0;
                for(let j = 0; j < games[i].gameUsers.length; j++){
                    if(games[i].gameUsers[j].userGuess.length > 0){
                        gameSubmitCount = gameSubmitCount + 1;
                        games[i].playersWhoveVoted.push(games[i].gameUsers[j].userId);
                        updateGameData(games[i], "soft");
                    }
                }
                if(gameSubmitCount >= games[i].gameUsers.length){
                    games[i].playersWhoveVoted = [];
                    games[i].gameState = "continuing";
                    getPlayersWithCurrentTrack(games[i]);
                    processGuesses(games[i]);
                    checkEndGame(games[i]);
                    updateGameData(games[i], "hard");
                }
            }
        }
    });
    socket.on('continueGame', (data) => {
        for(let i = 0; i < games.length; i++){
            if(games[i].gameCode == data.gameCode){
                games[i].gameContinueVotes += 1;
                games[i].playersWhoveVoted.push(data.userId);
                updateGameData(games[i], "soft");
                if(games[i].gameContinueVotes >= games[i].gameUsers.length){
                    games[i].gameContinueVotes = 0;
                    games[i].gameState = "voting";
                    for(let j = 0; j < games[i].gameUsers.length; j++){
                        games[i].gameUsers[j].userGuess = [];
                    }
                    games[i].playersWhoveVoted = [];
                    nextTrack(games[i]);
                    updateGameData(games[i], "hard");
                }
            }
        }
    });
    socket.on('resetLobby', (data) => {
        for(let i = 0; i < games.length; i++){
            if(games[i].gameCode == data.gameCode){
                resetGame(games[i]);
                updateGameData(games[i], "hard");
            }
        }
    });;
    socket.on('disconnect', () => {
        for (let i = 0; i < games.length; i++) {
            if (games[i].gameHost.userSocketId === socket.id) {
                deleteGame(games[i]);
                games.splice(i, 1);
                break;
            }
            for (let j = 0; j < games[i].gameUsers.length; j++) {
                if (games[i].gameUsers[j].userSocketId === socket.id) {
                    games[i].gameUsers.splice(j, 1);
                    updateGameData(games[i], "hard");
                    break;
                }
            }
        }
        console.clear();
        users.splice(users.indexOf(socket.id), 1);
        console.log("Users: " + users.length + "\nGames: " + games.length);
    });
});

server.listen(PORT, () => console.log(`Server running on HTTPS port ${PORT}`));
