const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { json } = require('stream/consumers');
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "put yours",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
    }
});
app.use(cors());
app.use(express.static('public'));

const games = []

function updateGameData(game){
    for(let j = 0; j < game.gameUsers.length; j++){
        io.to(game.gameUsers[j].userSocketId).emit('updateGameData', {
            gameWinner: game.gameWinner,
            gameCode: game.gameCode,
            gameHost: game.gameHost,
            gameUsers: game.gameUsers,
            gameCurrentTrackId: game.gameCurrentTrackId,
            gameState: game.gameState,
            playersWithTrack: game.playersWithTrack,
        });
    }
}
function deleteGame(game){
    for(let i = 0; i < game.gameUsers.length; i++){
        io.to(game.gameUsers[i].userSocketId).emit('gameDeleted', {});
    }
}
function nextTrack(game){
    const randomUserIndex = Math.floor(Math.random() * game.gameUsers.length);
    const randomUser = game.gameUsers[randomUserIndex];
    const randomTrackIndex = Math.floor(Math.random() * randomUser.userTracks.length);
    const randomTrack = randomUser.userTracks[randomTrackIndex];
    game.gameCurrentTrackId = randomTrack.id;
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
        return highestScorers[0].userName;
    }
}
function processGuesses(game){
    for(let i = 0; i < game.gameUsers.length; i++){
        const player = game.gameUsers[i];
        for(let j = 0; j < player.userGuess.length; j++){
            const guessedUserId = player.userGuess[j];
            const guessedUser = game.gameUsers.find(user => user.userId == guessedUserId);
            if(guessedUser){
                const trackFound = guessedUser.userTracks.some(track => track.id == game.gameCurrentTrackId);
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
    game.playersWithTrack = game.gameUsers
        .filter(user => 
            user.userTracks.some(track => track.id == game.gameCurrentTrackId)
        )
        .map(user => user.userId);
}
function resetGame(game){
    game.gameState = "lobby";
    game.gameWinner = "",
    game.gameCurrentTrackId = "";
    for(let j = 0; j < game.gameUsers.length; j++){
        game.gameUsers[j].userScore = 0;
    }
}

io.on('connection', (socket) => {
    console.log("[USER CONNECTED: " + socket.id + "]");

    socket.on('joinGame', (data) => {
        let gameFound = false;
        for(let i = 0; i < games.length; i++){
            if(data.gameCode == games[i].gameCode){
                gameFound = true;
                data.user.userSocketId = socket.id
                data.user.userScore = 0
                games[i].gameUsers.push(data.user);
                updateGameData(games[i]);
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
            gameCurrentTrackId: "",
            gameState: "lobby",
            gameContinueVotes: 0,
            playersWithTrack: [],
            gameWinner: "",
        });
        socket.emit('gameCreated');
        updateGameData(games[games.length - 1]);
    });
    socket.on('startGame', (data) => {
        for(let i = 0; i < games.length; i++){
            if(games[i].gameHost.userId == data.userId){
                games[i].gameState = "voting";
                nextTrack(games[i]);
                updateGameData(games[i]);
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
                    }
                }
                if(gameSubmitCount >= games[i].gameUsers.length){
                    games[i].gameState = "continuing";
                    const playersWithTrack = 
                    getPlayersWithCurrentTrack(games[i]);
                    processGuesses(games[i]);
                    checkEndGame(games[i]);
                    updateGameData(games[i]);
                }
            }
        }
    });
    socket.on('continueGame', (data) => {
        for(let i = 0; i < games.length; i++){
            if(games[i].gameCode == data.gameCode){
                games[i].gameContinueVotes += 1;
                if(games[i].gameContinueVotes >= games[i].gameUsers.length){
                    games[i].gameContinueVotes = 0;
                    games[i].gameState = "voting";
                    for(let j = 0; j < games[i].gameUsers.length; j++){
                        games[i].gameUsers[j].userGuess = [];
                    }
                    nextTrack(games[i]);
                    updateGameData(games[i]);
                }
            }
        }
    });
    socket.on('resetLobby', (data) => {
        for(let i = 0; i < games.length; i++){
            if(games[i].gameCode == data.gameCode){
                resetGame(games[i]);
                updateGameData(games[i]);
            }
        }
    });
    socket.on('disconnect', () => {
        console.log("[USER DISCONNECTED: " + socket.id + "]");
        for(let i = 0; i < games.length; i++){
            if(games[i].gameHost.userSocketId == socket.id){
                deleteGame(games[i]);
                console.log(`Game with ID ${games[i].gameCode} hosted by ${socket.id} has been deleted.`);
                games.splice(i, 1);
                break;
            }
            for(let j = 0; j < games[i].gameUsers.length; j++){
                if(games[i].gameUsers[j].userSocketId == socket.id){
                    games[i].gameUsers.splice(j, 1);
                    updateGameData(games[i]);
                    break;
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});