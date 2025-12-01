const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

let players = {};        
let playerHistory = {}; 
const roundTime = 30;
let timeLeft = roundTime;

function broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (let client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
}

function startGameLoop() {
    setInterval(() => {
        timeLeft--;

        broadcast({
            type: "state",
            players: Object.values(players),
            timeLeft
        });

        if (timeLeft <= 0) {
            Object.values(players).forEach(p => {
                playerHistory[p.name] = (playerHistory[p.name] || 0) + p.score;
            });

            const winner = Object.values(players).sort((a,b)=>b.score-a.score)[0];

            broadcast({
                type: "game_over",
                winner: winner ? winner.name : "Nobody",
                scores: playerHistory
            });

            for (let id in players) players[id].score = 0;
            timeLeft = roundTime;
        }
    }, 1000);
}

wss.on("connection", (ws) => {
    const id = Math.random().toString(36).substr(2, 9);

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.type === "join") {
            players[id] = {
                id,
                name: data.name,
                score: 0
            };

            ws.send(JSON.stringify({ type: "welcome", id }));
            ws.send(JSON.stringify({
                type: "state",
                players: Object.values(players),
                timeLeft
            }));
        }

        if (data.type === "click" && players[id]) {
            players[id].score++;
        }
    });

    ws.on("close", () => {
        delete players[id];
    });
});

console.log("Server running on ws://localhost:8080");
startGameLoop();
