const socket = io('put yours');

const clientId = "put yours";
const clientSecret = "put yours";
const redirectUri = "put yours";
let accessToken;

const user = {
    userId: "",
    userName: "",
    userPlaylists: [],
    userTracks: [],
    userAvailableDevices: [],
    userGuess: [],
}
let host = false;
let playersWithTrack = [];
let gameCode = "";
let chosenPlayBackDevice = {};

async function redirectToSpotifyLogin(clientId, redirectUri){
    const scopes = [
        'user-read-private',
        'user-read-email',
        'playlist-read-private',
        'user-read-playback-state',
        'user-library-read',
        'user-read-recently-played',
        'user-modify-playback-state',
    ];

    const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes.join(' '))}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
}
async function handleSpotifyCallback(){
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if(code){
        await fetchAccessToken(code);
    }
    else{
        console.error('Authorization code is missing in the callback.');
    }
}
async function fetchAccessToken(code){
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    try{
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        if(!response.ok){
            throw new Error('Failed to get access token');
        }

        const data = await response.json();
        accessToken = data.access_token;
        localStorage.setItem('access_token', accessToken);
        document.getElementById("spinningWheel").style.display = "block";
        await getData();
        document.getElementById("spinningWheel").style.display = "none";
    }
    catch(error){
        console.error('Error fetching access token:', error);
        redirectToSpotifyLogin(clientId, redirectUri);
    }
}
async function getData(){
    try{
        const response = await axios.get('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        user.userId = response.data.id;
        user.userName = response.data.display_name;
    }
    catch(error){
        if(error.response && error.response.status === 401){
            console.error('Access token is invalid or expired.');
            redirectToSpotifyLogin(clientId, redirectUri);
        }
        else{
            console.error('Failed to verify access token:', error.message);
        }
    }
    
    try{
        const response = await axios.get('https://api.spotify.com/v1/me/tracks', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        response.data.items.forEach(item => {
            user.userTracks.push({
                "name": item.track.name,
                "id": item.track.id,
            });
        });
    }
    catch(error){
        if(error.response && error.response.status === 401){
            console.error('Access token is invalid or expired.');
        }
        else{
            console.error('Failed to verify access token:', error.message);
        }
    }

    try{
        const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        response.data.items.forEach(item => {
            if(item.owner.id === user.userId){
                user.userPlaylists.push({
                    "name": item.name,
                    "id": item.id,
                });
            }
        });
    }
    catch(error){
        if(error.response && error.response.status === 401){
            console.error('Access token is invalid or expired.');
        }
        else{
            console.error('Failed to verify access token:', error.message);
        }
    }

    for(let i = 0; i < user.userPlaylists.length; i++){
        let nextUrl = `https://api.spotify.com/v1/playlists/${user.userPlaylists[i].id}/tracks`;
        try {
            while(nextUrl){
                const response = await axios.get(nextUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
                response.data.items.forEach(item => {
                    user.userTracks.push({
                        name: item.track.name,
                        id: item.track.id,
                    });
                });
                nextUrl = response.data.next;
            }
        }
        catch(error){
            if(error.response && error.response.status === 401){
                console.error('Access token is invalid or expired.');
            }
            else{
                console.error('Failed to fetch tracks for playlist:', user.userPlaylists[i].name, error.message);
            }
        }
    }

    try{
        const response = await axios.get('https://api.spotify.com/v1/me/player/recently-played', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        response.data.items.forEach(item => {
            user.userTracks.push({
                "name": item.track.name,
                "id": item.track.id,
            });
        });
    }
    catch(error){
        if(error.response && error.response.status === 401){
            console.error('Access token is invalid or expired.');
        }
        else{
            console.error('Failed to verify access token:', error.message);
        }
    }

    try{
        const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        response.data.devices.forEach(item => {
            user.userAvailableDevices.push({
                "name": item.name,
                "id": item.id,
            });
        });
    }
    catch(error){
        if(error.response && error.response.status === 401){
            console.error('Access token is invalid or expired.');
        }
        else{
            console.error('Failed to verify access token:', error.message);
        }
    }

    if(localStorage.getItem('displayName') && localStorage.getItem('gameCode')){
        socket.emit('checkGame', {
            id: localStorage.getItem('gameCode'),
        });
    }

    document.getElementById("displayName").style.display = "block"
    document.getElementById("gameCode").style.display = "block"

    if(user.userAvailableDevices){
        for(let i = 0; i < user.userAvailableDevices.length; i++){
            const option = document.createElement("option");
            option.value = user.userAvailableDevices[i].id;
            option.textContent = user.userAvailableDevices[i].name;
            document.getElementById("playBackDevices").appendChild(option);
        }
        document.getElementById("playBackDevices").style.display = "block";
    }
    else{
        document.getElementById("playBackDevices").style.display = "none";
    }

    document.getElementById("joinButton").style.display = "block";
    document.getElementById("createButton").style.display = "block";
    console.log(user);
}
async function getTrack(trackId){
    try{
        const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        const currentTrack = {
            "id": trackId,
            "name": response.data.name,
            "artists": response.data.artists,
            "images": response.data.album.images,
        };
        return currentTrack;
    }
    catch(error){
        if(error.response && error.response.status === 401){
            console.error('Access token is invalid or expired.');
            redirectToSpotifyLogin(clientId, redirectUri);
        }
        else{
            console.error('Failed to verify access token:', error.message);
        }
        return null;
    }
}
async function changeTrack(trackId){
    if(chosenPlayBackDevice.name && chosenPlayBackDevice.id){
        try{
            await axios.put(
                `https://api.spotify.com/v1/me/player/play?device_id=${chosenPlayBackDevice.id}`,
                {
                    uris: [`spotify:track:${trackId}`],
                    position_ms: 30000,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
        catch(error){
            if(error.response && error.response.status === 401){
                console.error('Access token is invalid or expired.');
                redirectToSpotifyLogin(clientId, redirectUri);
            }
            else{
                console.error('Error playing the track:', error.message);
            }
        }
    }
    else{
        try{
            await axios.put(
                `https://api.spotify.com/v1/me/player/play`,
                {
                    uris: [`spotify:track:${trackId}`],
                    position_ms: 30000,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
        catch(error){
            if(error.response && error.response.status === 401){
                console.error('Access token is invalid or expired.');
                redirectToSpotifyLogin(clientId, redirectUri);
            }
            else{
                console.error('Error playing the track:', error.message);
            }
            return null;
        }
    }
}
async function playTrack(){
    try{
        await axios.put(
            `https://api.spotify.com/v1/me/player/play`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    }
    catch(error){
        if(error.response && error.response.status === 401){
            console.error('Access token is invalid or expired.');
            redirectToSpotifyLogin(clientId, redirectUri);
        }
        else{
            console.error('Error playing the track:', error.message);
        }
        return null;
    }
}
async function pauseTrack(){
    try{
        const response = await axios.put(
            `https://api.spotify.com/v1/me/player/pause`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        if(response.status === 204){
            console.log('Track paused successfully');
        }
        else{
            console.error('Unexpected response status:', response.status);
        }
    }
    catch(error){
        if(error.response && error.response.status === 401){
            console.error('Access token is invalid or expired.');
            redirectToSpotifyLogin(clientId, redirectUri);
        }
        else{
            console.error('Error pausing the track:', error.message);
        }
    }
}

document.getElementById("reconnectButton").style.display = "none";
document.getElementById("gameInfo").style.display = "block";
document.getElementById("winnerGif").style.display = "none";
document.getElementById("currentTrack").style.display = "none";
document.getElementById("users").style.display = "none";
document.getElementById("displayName").style.display = "none";
document.getElementById("gameCode").style.display = "none";
document.getElementById("playBackDevices").style.display = "none";
document.getElementById("joinButton").style.display = "none";
document.getElementById("createButton").style.display = "none";
document.getElementById("startButton").style.display = "none";
document.getElementById("continueButton").style.display = "none";
document.getElementById("submitButton").style.display = "none";
document.getElementById("lobbyButton").style.display = "none";

if(window.location.search.includes('code=')){
    document.getElementById("loginButton").style.display = "none";
    await handleSpotifyCallback();
}
else if(localStorage.getItem('access_token')){
    document.getElementById("loginButton").style.display = "none";
    await getData(localStorage.getItem('access_token'));
}
else{
    document.getElementById("loginButton").style.display = "block";
    document.getElementById("loginButton").addEventListener('click', function(){
        document.getElementById("loginButton").style.display = "none";
        redirectToSpotifyLogin(clientId, redirectUri);
    });
}

document.getElementById("reconnectButton").addEventListener('click', function(){
    document.getElementById("reconnectButton").style.display = "none";
    document.getElementById("displayName").style.display = "none"
    document.getElementById("gameCode").style.display = "none"
    document.getElementById("joinButton").style.display = "none";
    document.getElementById("createButton").style.display = "none";
    
    socket.emit('joinGame', {
        id: localStorage.getItem('gameCode'),
        user: {
            id: user.id,
            displayName: localStorage.getItem('displayName'),
            tracks: user.tracks,
            availableDevices: user.availableDevices,
        },
    });
});
document.getElementById("playBackDevices").addEventListener("change", function(){
    const playBackDeviceId = this.value;
    const playBackDeviceName = this.options[this.selectedIndex].text;

    chosenPlayBackDevice.id = playBackDeviceId;
    chosenPlayBackDevice.name = playBackDeviceName;
});
document.getElementById("joinButton").addEventListener('click', function(){
    if(document.getElementById("gameCode").value != ""){
        localStorage.setItem('displayName', document.getElementById("displayName").value);
        localStorage.setItem('gameCode', document.getElementById("gameCode").value);
        gameCode = document.getElementById("gameCode").value;
        document.getElementById("displayName").style.display = "none"
        document.getElementById("gameCode").style.display = "none"
        document.getElementById("joinButton").style.display = "none";
        document.getElementById("createButton").style.display = "none";
        
        user.userName = document.getElementById("displayName").value || user.userName;
        socket.emit('joinGame', {
            gameCode: document.getElementById("gameCode").value,
            user: user,
        });
    }
    else{
        alert("Game Code Required");
    }
});
document.getElementById("createButton").addEventListener('click', function(){
    gameCode = "";
    for(let i = 0; i < 6; i++){
        gameCode += Math.floor(Math.random() * 10);
    }
    user.userName = document.getElementById("displayName").value || user.userName;
    socket.emit('createGame', {
        gameCode: gameCode,
        gameHost: user,
        user: user,
    });

    socket.on('gameCreated', (data) => {
        document.getElementById("displayName").style.display = "none"
        document.getElementById("gameCode").style.display = "none"
        document.getElementById("joinButton").style.display = "none";
        document.getElementById("createButton").style.display = "none";
        host = true;
        if(host == true){
            document.getElementById("startButton").style.display = "block";
        }
    });
});
document.getElementById("startButton").addEventListener('click', function(){
    socket.emit('startGame', {
        userId: user.userId,
    });
    document.getElementById("startButton").style.display = "none";
});
document.getElementById("submitButton").addEventListener('click', function(){
    if(user.userGuess.length > 0){
        socket.emit('submitGuess', {
            gameCode: gameCode,
            user: user,
        });
        document.getElementById("submitButton").style.display = "none";
    }
    else{
        alert("Must guess at least one player");
    }
});
document.getElementById("continueButton").addEventListener('click', function(){
    user.userGuess = 0;
    socket.emit('continueGame', {
        gameCode: gameCode,
    });
    document.getElementById("continueButton").style.display = "none";
});
document.getElementById("lobbyButton").addEventListener('click', function(){
    socket.emit('resetLobby', {
        gameCode: gameCode,
    });
    document.getElementById("lobbyButton").style.display = "none";
});

socket.on('updateGameData', async function(data){
    console.log(data);
    if(data.gameState == "lobby"){
        document.getElementById("gameInfo").style.display = "block";
        document.getElementById("gameInfo").style.fontSize = "150%";
        document.getElementById("gameInfo").innerHTML = data.gameHost.userName + "'s Game" + '<br>' + data.gameCode;

        document.getElementById("winnerGif").style.display = "none";

        document.getElementById("currentTrack").style.display = "none";

        document.getElementById("users").style.display = "flex";
        const usersDiv = document.getElementById("users");
        usersDiv.innerHTML = "";
        data.gameUsers.forEach(gameUser => {
            const userDiv = document.createElement('div');
            userDiv.style.pointerEvents = "none";
            userDiv.classList.add('user');
            userDiv.id = 'user-' + gameUser.userId;

            const userName = document.createElement('h1');
            userName.innerText = gameUser.userName;

            const userScore = document.createElement('h1');

            userDiv.appendChild(userName);
            userDiv.appendChild(userScore);
            usersDiv.appendChild(userDiv);
        });

        document.getElementById("playBackDevices").style.display = "none";

        if(user.userId == data.gameHost.userId){
            document.getElementById("startButton").style.display = "block";
        }
        else{
            document.getElementById("startButton").style.display = "none";
        }
        document.getElementById("continueButton").style.display = "none";
        document.getElementById("submitButton").style.display = "none";
        document.getElementById("lobbyButton").style.display = "none";
    }
    else if(data.gameState == "voting"){
        document.getElementById("gameInfo").style.display = "none";

        const track = await getTrack(data.gameCurrentTrackId);
        document.getElementById("currentTrack").style.display = "flex";
        document.getElementById("currentTrackImage").src = track.images[0].url;
        document.getElementById("currentTrackName").innerHTML = track.name;
        document.getElementById("currentTrackArtists").innerHTML = "";
        for(let i = 0; i < track.artists.length; i++){
            document.getElementById("currentTrackArtists").innerHTML += track.artists[i].name;
            if(i != track.artists.length - 1){
                document.getElementById("currentTrackArtists").innerHTML += ", ";
            }
        }
        await changeTrack(data.gameCurrentTrackId);

        document.getElementById("users").style.display = "flex";
        const usersDiv = document.getElementById("users");
        usersDiv.innerHTML = "";
        data.gameUsers.forEach(gameUser => {
            const userDiv = document.createElement('div');
            userDiv.classList.add('user');
            userDiv.id = 'user-' + gameUser.userId;
            user.userGuess = [];
            userDiv.onclick = function(){
                const element = document.getElementById('user-' + gameUser.userId);
                if(element.style.backgroundColor != 'var(--green)'){
                    element.style.backgroundColor = 'var(--green)';
                    user.userGuess.push(gameUser.userId);
                }
                else{
                    element.style.backgroundColor = 'var(--lightGrey)';
                    user.userGuess.splice(user.userGuess.indexOf(gameUser.userId), 1);
                }
            }

            const userName = document.createElement('h1');
            userName.innerText = gameUser.userName;

            const userScore = document.createElement('h1');
            userScore.innerText = gameUser.userScore;

            userDiv.appendChild(userName);
            userDiv.appendChild(userScore);
            usersDiv.appendChild(userDiv);
        });

        document.getElementById("continueButton").style.display = "none";
        document.getElementById("submitButton").style.display = "block";
        document.getElementById("lobbyButton").style.display = "none";
    }
    else if(data.gameState == "continuing"){
        document.getElementById("gameInfo").style.display = "none";

        document.getElementById("users").style.display = "flex";
        const usersDiv = document.getElementById("users");
        usersDiv.innerHTML = "";
        data.gameUsers.forEach(gameUser => {
            const userDiv = document.createElement('div');
            userDiv.style.pointerEvents = "none";
            userDiv.classList.add('user');
            userDiv.id = 'user-' + gameUser.userId;
            
            const userName = document.createElement('h1');
            const userGuesses = document.createElement('h1');
            const userScore = document.createElement('h1');

            userGuesses.style.whiteSpace = "nowrap";

            if(data.playersWithTrack.includes(gameUser.userId)){
                userName.innerText = "✓ " + gameUser.userName;
            }
            else{
                userName.innerText = gameUser.userName;
            }

            if(user.userGuess.includes(gameUser.userId)){
                if(user.userGuess.includes(gameUser.userId) && data.playersWithTrack.includes(gameUser.userId)){
                    userDiv.style.backgroundColor = 'var(--green)';
                }
                else{
                    userDiv.style.backgroundColor = 'var(--red)';
                }
            }
            else{
                userDiv.style.backgroundColor = 'var(--lightGrey)';
            }

            let guesses = [];
            for(let i = 0; i < gameUser.userGuess.length; i++){
                for(let j = 0; j < data.gameUsers.length; j++){
                    if(data.gameUsers[j].userId == gameUser.userGuess[i]){
                        guesses.push(data.gameUsers[j].userName);
                    }
                }
            }
            userGuesses.innerText = guesses.join(", ");
            
            userScore.innerText = gameUser.userScore;

            userDiv.appendChild(userName);
            userDiv.appendChild(userGuesses);
            userDiv.appendChild(userScore);
            usersDiv.appendChild(userDiv);
        });

        document.getElementById("continueButton").style.display = "block";
        document.getElementById("submitButton").style.display = "none";
        document.getElementById("lobbyButton").style.display = "none";
    }
    else if(data.gameState == "winner"){
        document.getElementById("gameInfo").style.display = "none";
        console.log(data.gameWinner);
        document.getElementById("winnerInfo").innerHTML = data.gameWinner + " Wins";
        const images = [
            "https://media.tenor.com/uKq1hhtm6xoAAAAM/ninja-hyper.gif",
            "https://media.tenor.com/y4x6gDa2MooAAAAM/mouth-open-meme.gif",
            "https://media.tenor.com/Q8KG0-6aTU0AAAAM/house-md-dr-house.gif",
            "https://media0.giphy.com/media/SG5paY6WxH6Ki2lWys/giphy.gif?cid=6c09b952t9bmm8vjyu3wp2eb4addc2r0ooghjale8x52il68&ep=v1_gifs_search&rid=giphy.gif&ct=g",
        ];
        const randomImage = images[Math.floor(Math.random() * images.length)];
        document.getElementById("winnerImage").src = randomImage;
        document.getElementById("winnerGif").style.display = "flex";

        document.getElementById("currentTrack").style.display = "none";

        document.getElementById("users").style.display = "flex";
        const usersDiv = document.getElementById("users");
        usersDiv.innerHTML = "";
        data.gameUsers.forEach(gameUser => {
            const userDiv = document.createElement('div');
            userDiv.style.pointerEvents = "none";
            userDiv.classList.add('user');
            userDiv.id = 'user-' + gameUser.userId;
            
            const userName = document.createElement('h1');
            const userGuesses = document.createElement('h1');
            const userScore = document.createElement('h1');

            userGuesses.style.whiteSpace = "nowrap";

            if(data.playersWithTrack.includes(gameUser.userId)){
                userName.innerText = "✓ " + gameUser.userName;
            }
            else{
                userName.innerText = gameUser.userName;
            }

            if(user.userGuess.includes(gameUser.userId)){
                if(user.userGuess.includes(gameUser.userId) && data.playersWithTrack.includes(gameUser.userId)){
                    userDiv.style.backgroundColor = 'var(--green)';
                }
                else{
                    userDiv.style.backgroundColor = 'var(--red)';
                }
            }
            else{
                userDiv.style.backgroundColor = 'var(--lightGrey)';
            }

            let guesses = [];
            for(let i = 0; i < gameUser.userGuess.length; i++){
                for(let j = 0; j < data.gameUsers.length; j++){
                    if(data.gameUsers[j].userId == gameUser.userGuess[i]){
                        guesses.push(data.gameUsers[j].userName);
                    }
                }
            }
            userGuesses.innerText = guesses.join(", ");
            
            userScore.innerText = gameUser.userScore;

            userDiv.appendChild(userName);
            userDiv.appendChild(userGuesses);
            userDiv.appendChild(userScore);
            usersDiv.appendChild(userDiv);
        });

        document.getElementById("continueButton").style.display = "none";
        document.getElementById("submitButton").style.display = "none";
        if(user.userId == data.gameHost.userId){
            document.getElementById("lobbyButton").style.display = "block";
        }
        else{
            document.getElementById("lobbyButton").style.display = "none";
        }
    }
});
socket.on('gameDeleted', async function(data){
    alert("Game has been deleted by host");
    window.location.href = redirectUri;
});
socket.on('invalidGameCode', function(){
    document.getElementById("displayName").style.display = "block"
    document.getElementById("gameCode").style.display = "block"
    document.getElementById("joinButton").style.display = "block";
    document.getElementById("createButton").style.display = "block";
    alert("That game doesn't exist");
    document.getElementById("gameCode").value = "";
});
socket.on('gameCodeVerification', (data) => {
    if(data.message === "true"){
        document.getElementById("reconnectButton").style.display = "block";
    }
    else{
        document.getElementById("reconnectButton").style.display = "none";
        localStorage.removeItem('displayName');
        localStorage.removeItem('gameCode');
    }
});