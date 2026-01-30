const http = require("http");
const WebSocket = require("ws");

const port = process.env.PORT || 3000;

// Create HTTP server (required by Render)
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket server is running");
});

// Attach WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server });

// Lobby storage
const lobbies = new Map();

function joinLobby(code, ws) {
  if (!lobbies.has(code)) {
    lobbies.set(code, { clients: new Set() });
  }
  const lobby = lobbies.get(code);

  if (lobby.clients.size >= 2) {
    ws.send(JSON.stringify({ type: "error", message: "Lobby full" }));
    return;
  }

  lobby.clients.add(ws);
  ws.lobbyCode = code;

  ws.send(JSON.stringify({ type: "joined", code, players: lobby.clients.size }));

  for (const client of lobby.clients) {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "peer_joined" }));
    }
  }
}

function leaveLobby(ws) {
  const code = ws.lobbyCode;
  if (!code || !lobbies.has(code)) return;

  const lobby = lobbies.get(code);
  lobby.clients.delete(ws);

  for (const client of lobby.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "peer_left" }));
    }
  }

  if (lobby.clients.size === 0) {
    lobbies.delete(code);
  }
}

wss.on("connection", ws => {
  ws.on("message", msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    if (data.type === "join") {
      const code = String(data.code || "").trim();
      if (!/^\d{6}$/.test(code)) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid code" }));
        return;
      }
      joinLobby(code, ws);
      return;
    }

    const code = ws.lobbyCode;
    if (!code || !lobbies.has(code)) return;

    const lobby = lobbies.get(code);
    for (const client of lobby.clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    }
  });

  ws.on("close", () => leaveLobby(ws));
});

server.listen(port, () => {
  console.log("Server running on port", port);
});
