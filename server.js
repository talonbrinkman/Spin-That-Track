const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { json } = require('stream/consumers');
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://spinthattrack.asuscomm.com",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
    }
});
app.use(cors());
app.use(express.static('public'));

const users = [];
const games = [];

function updateGameData(game, updateType){
    for(let j = 0; j < game.gameUsers.length; j++){
        io.to(game.gameUsers[j].userSocketId).emit('updateGameData', {
            gameWinner: game.gameWinner,
            gameWinnerImageIndex: game.gameWinnerImageIndex,
            gameCode: game.gameCode,
            gameHost: game.gameHost,
            gameHost: {
                userId: game.gameHost.userId,
                userName: game.gameHost.userName,
            },
            gameUsers: game.gameUsers.map(user => ({
                userId: user.userId,
                userName: user.userName,
                userSocketId: user.userSocketId,
                userScore: user.userScore,
                userGuess: user.userGuess,
                userTracks: user.userTracks
            })),
            gameStartTime: game.gameStartTime,
            gameCurrentTrackId: game.gameCurrentTrackId,
            gameCurrentTrackName: game.gameCurrentTrackName,
            gameCurrentTrackArtist: game.gameCurrentTrackArtist,
            gameState: game.gameState,
            playersWithTrack: game.playersWithTrack,
            playersWhoveVoted: game.playersWhoveVoted,
            updateType: updateType,
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
            }
            else if(user.userScore == highestScore){
                highestScorers.push(user);
            }
        }
    }
    if(highestScorers.length == 1){
        game.gameCurrentTrackId = "";
        game.gameState = "winner";
        game.gameWinner = highestScorers[0].userName;
        game.gameWinnerImageIndex = Math.floor(Math.random() * 17);
        return highestScorers[0].userName;
    }
}
function processGuesses(game){
    // Get the base track name and artist by removing common version indicators
    const baseTrackName = game.gameCurrentTrackName
        .toLowerCase()
        .replace(/\s*\(.*?\)/g, '') // Remove anything in parentheses
        .replace(/\s*\[.*?\]/g, '') // Remove anything in brackets
        .replace(/\s*[-–—].*$/g, '') // Remove anything after a dash
        .replace(/\s*feat\..*$/i, '') // Remove "feat." and anything after
        .replace(/\s*ft\..*$/i, '') // Remove "ft." and anything after
        .replace(/\s*with.*$/i, '') // Remove "with" and anything after
        .replace(/\s*\(remix\)/gi, '') // Remove "(remix)"
        .replace(/\s*\(live version\)/gi, '') // Remove "(live version)"
        .replace(/\s*\(live\)/gi, '') // Remove "(live)"
        .replace(/\s*\(version\)/gi, '') // Remove "(version)"
        .replace(/\s*\(edit\)/gi, '') // Remove "(edit)"
        .trim();

    const baseArtist = game.gameCurrentTrackArtist ? game.gameCurrentTrackArtist.toLowerCase() : '';

    console.log(baseTrackName + " - " + baseArtist);

    for(let i = 0; i < game.gameUsers.length; i++){
        const player = game.gameUsers[i];
        for(let j = 0; j < player.userGuess.length; j++){
            const guessedUserId = player.userGuess[j];
            const guessedUser = game.gameUsers.find(user => user.userId == guessedUserId);
            if(guessedUser){
                const trackFound = guessedUser.userTracks.some(track => {
                    const userTrackBaseName = track.name
                        .toLowerCase()
                        .replace(/\s*\(.*?\)/g, '')
                        .replace(/\s*\[.*?\]/g, '')
                        .replace(/\s*[-–—].*$/g, '')
                        .replace(/\s*feat\..*$/i, '')
                        .replace(/\s*ft\..*$/i, '')
                        .replace(/\s*with.*$/i, '')
                        .replace(/\s*\(remix\)/gi, '')
                        .replace(/\s*\(live version\)/gi, '')
                        .replace(/\s*\(live\)/gi, '')
                        .replace(/\s*\(version\)/gi, '')
                        .replace(/\s*\(edit\)/gi, '')
                        .trim();

                    const userTrackBaseArtist = track.artist ? track.artist.toLowerCase() : '';

                    return userTrackBaseName === baseTrackName && userTrackBaseArtist === baseArtist;
                });
                if (trackFound) {
                    player.userScore += 3;
                }
                else{
                    player.userScore -= 1;
                }
            }
        }
    }
    game.currentTrackId = "continue";
}
function getPlayersWithCurrentTrack(game){
    // Get the base track name and artist by removing common version indicators
    const baseTrackName = game.gameCurrentTrackName
        .toLowerCase()
        .replace(/\s*\(.*?\)/g, '') // Remove anything in parentheses
        .replace(/\s*\[.*?\]/g, '') // Remove anything in brackets
        .replace(/\s*[-–—].*$/g, '') // Remove anything after a dash
        .replace(/\s*feat\..*$/i, '') // Remove "feat." and anything after
        .replace(/\s*ft\..*$/i, '') // Remove "ft." and anything after
        .replace(/\s*with.*$/i, '') // Remove "with" and anything after
        .replace(/\s*\(remix\)/gi, '') // Remove "(remix)"
        .replace(/\s*\(live version\)/gi, '') // Remove "(live version)"
        .replace(/\s*\(live\)/gi, '') // Remove "(live)"
        .replace(/\s*\(version\)/gi, '') // Remove "(version)"
        .replace(/\s*\(edit\)/gi, '') // Remove "(edit)"
        .trim();

    const baseArtist = game.gameCurrentTrackArtist ? game.gameCurrentTrackArtist.toLowerCase() : '';

    game.playersWithTrack = game.gameUsers
        .filter(user => 
            user.userTracks.some(track => {
                const userTrackBaseName = track.name
                    .toLowerCase()
                    .replace(/\s*\(.*?\)/g, '')
                    .replace(/\s*\[.*?\]/g, '')
                    .replace(/\s*[-–—].*$/g, '')
                    .replace(/\s*feat\..*$/i, '')
                    .replace(/\s*ft\..*$/i, '')
                    .replace(/\s*with.*$/i, '')
                    .replace(/\s*\(remix\)/gi, '')
                    .replace(/\s*\(live version\)/gi, '')
                    .replace(/\s*\(live\)/gi, '')
                    .replace(/\s*\(version\)/gi, '')
                    .replace(/\s*\(edit\)/gi, '')
                    .trim();

                const userTrackBaseArtist = track.artist ? track.artist.toLowerCase() : '';

                return userTrackBaseName === baseTrackName && userTrackBaseArtist === baseArtist;
            })
        )
        .map(user => user.userId);
}
function resetGame(game){
    game.gameState = "lobby";
    game.gameWinner = "",
    game.gameCurrentTrackId = "";
    for(let j = 0; j < game.gameUsers.length; j++){
        game.gameUsers[j].userScore = 0;
        game.gameUsers[j].userGuess = [];
    }
    game.playedTracks = [];
}

io.on('connection', (socket) => {
    console.clear();
    users.push(socket.id);
    console.log("Users: " + users.length + "\nGames: " + games.length);
    socket.on('joinGame', (data) => {
        let gameFound = false;
        for(let i = 0; i < games.length; i++){
            if(data.gameCode == games[i].gameCode){
                gameFound = true;
                data.user.userSocketId = socket.id
                data.user.userScore = 0
                games[i].gameUsers.push(data.user);
                updateGameData(games[i], "hard");
                break;
            }
        }
        if(!gameFound){
            socket.emit('invalidGameCode', {});
        }
    });
    socket.on('createGame', (data) => {
        data.user.userSocketId = socket.id
        data.user.userScore = 0
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
            gameWinnerImageIndex: 0,
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
    });
    socket.on('disconnect', () => {
        for(let i = 0; i < games.length; i++){
            if(games[i].gameHost.userSocketId == socket.id){
                deleteGame(games[i]);
                games.splice(i, 1);
                break;
            }
            for(let j = 0; j < games[i].gameUsers.length; j++){
                if(games[i].gameUsers[j].userSocketId == socket.id){
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});