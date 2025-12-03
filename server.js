const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const HTTP_PORT = 8082;
const WS_PORT = 8085;

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end("Not found");
        } else {
            const ext = path.extname(filePath);
            let contentType = ext === ".css" ? "text/css" : "text/html";
            res.writeHead(200, { "Content-Type": contentType });
            res.end(content);
        }
    });
});

server.listen(HTTP_PORT, () => {
    console.log(`HTTP server running on http://localhost:${HTTP_PORT}`);
});

const wss = new WebSocket.Server({ port: WS_PORT, host: "0.0.0.0" });
console.log(`WebSocket server running on ws://0.0.0.0:${WS_PORT}`);

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
                score: 0,
                color: "#" + Math.floor(Math.random()*16777215).toString(16)
            };
            ws.send(JSON.stringify({ type: "welcome", id }));
        }
        if (data.type === "click" && players[id]) {
            players[id].score++;
        }
    });
    ws.on("close", () => {
        delete players[id];
    });
});

startGameLoop();
