const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");

// Carregar estado inicial do data.json
const initialGameState = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json")));

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ path: "/ws", server });

// Estado do jogo inicializado com data.json
let gameState = { ...initialGameState, players: [] };

app.use(express.static(path.join(__dirname, ".")));

// Função para gerar dominós
function generateDominoes() {
  const tiles = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push({ left: i, right: j });
    }
  }
  return tiles.sort(() => Math.random() - 0.5);
}

// Função para obter posições válidas de colocação
function getValidPlacements(board, tile) {
  if (board.length === 0) {
    return [{ index: 0, x: 300, y: 300, side: "left", flip: false }];
  }
  const placements = [];
  const leftEnd = board[0].left;
  const rightEnd = board[board.length - 1].right;
  if (tile.left === leftEnd || tile.right === leftEnd) {
    placements.push({ index: 0, x: board[0].x - 60, y: board[0].y, side: "left", flip: tile.right === leftEnd });
  }
  if (tile.left === rightEnd || tile.right === rightEnd) {
    placements.push({ index: board.length, x: board[board.length - 1].x + 60, y: board[board.length - 1].y, side: "right", flip: tile.left === rightEnd });
  }
  return placements;
}

// Verificar vencedor
function checkWinner(hands, board, boneyard) {
  if (hands.Ewerton.length === 0) return "Ewerton";
  if (hands.Hellen.length === 0) return "Hellen";
  const ewertonCanPlay = hands.Ewerton.some(tile => getValidPlacements(board, tile).length > 0);
  const hellenCanPlay = hands.Hellen.some(tile => getValidPlacements(board, tile).length > 0);
  if (!ewertonCanPlay && !hellenCanPlay && boneyard.length === 0) {
    const ewertonSum = hands.Ewerton.reduce((sum, tile) => sum + tile.left + tile.right, 0);
    const hellenSum = hands.Hellen.reduce((sum, tile) => sum + tile.left + tile.right, 0);
    return ewertonSum < hellenSum ? "Ewerton" : hellenSum < ewertonSum ? "Hellen" : null;
  }
  return null;
}

// Função para resetar o jogo
function resetGame() {
  const nextStarter = gameState.turn === "Ewerton" ? "Hellen" : "Ewerton";
  const tiles = generateDominoes();
  gameState = {
    board: [],
    hands: {
      Ewerton: tiles.slice(0, 6),
      Hellen: tiles.slice(6, 12)
    },
    boneyard: tiles.slice(12),
    turn: nextStarter,
    winner: null,
    selectedTile: null,
    validPlacements: [],
    players: gameState.players
  };
}

// Enviar estado do jogo para todos os clientes
function broadcastGameState() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "gameState", game: gameState }));
    }
  });
}

// WebSocket: lidar com conexões
wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === "login") {
      if (["Ewerton", "Hellen"].includes(data.player) && !gameState.players.includes(data.player)) {
        gameState.players.push(data.player);
        ws.player = data.player;
        if (gameState.players.length === 2 && !gameState.hands.Ewerton.length) {
          resetGame(); // Distribute tiles when both players are connected
        }
        broadcastGameState();
      } else {
        ws.send(JSON.stringify({ type: "error", message: "Jogador já conectado ou inválido." }));
        ws.close();
      }
    }

    if (data.type === "select" && !gameState.winner && data.player === gameState.turn) {
      const tile = gameState.hands[data.player][data.index];
      if (tile) {
        gameState.selectedTile = data.index;
        gameState.validPlacements = getValidPlacements(gameState.board, tile);
        broadcastGameState();
      }
    }

    if (data.type === "place" && !gameState.winner && data.player === gameState.turn) {
      const tile = gameState.hands[data.player][data.tileIndex];
      const placement = gameState.validPlacements.find(p => p.index === data.spotIndex);
      if (tile && placement) {
        const newTile = { ...tile, x: placement.x, y: placement.y, rotation: 0, color: data.player === "Ewerton" ? "black" : "yellow" };
        if (placement.flip) [newTile.left, newTile.right] = [newTile.right, newTile.left];
        if (placement.side === "left") {
          gameState.board.unshift(newTile);
        } else {
          gameState.board.push(newTile);
        }
        gameState.hands[data.player].splice(data.tileIndex, 1);
        gameState.turn = gameState.turn === "Ewerton" ? "Hellen" : "Ewerton";
        gameState.selectedTile = null;
        gameState.validPlacements = [];
        gameState.winner = checkWinner(gameState.hands, gameState.board, gameState.boneyard);
        broadcastGameState();
      }
    }

    if (data.type === "draw" && !gameState.winner && data.player === gameState.turn) {
      if (gameState.boneyard.length > 0) {
        const tile = gameState.boneyard.shift();
        gameState$hands[data.player].push(tile);
        // Check if the drawn tile can be played
        const canPlay = gameState.hands[data.player].some(t => getValidPlacements(gameState.board, t).length > 0);
        if (!canPlay && gameState.boneyard.length > 0) {
          // Player still can't play, keep their turn
        } else {
          gameState.turn = gameState.turn === "Ewerton" ? "Hellen" : "Ewerton";
        }
        gameState.selectedTile = null;
        gameState.validPlacements = [];
        gameState.winner = checkWinner(gameState.hands, gameState.board, gameState.boneyard);
        broadcastGameState();
      }
    }

    if (data.type === "reset") {
      resetGame();
      broadcastGameState();
    }
  });

  ws.on("close", () => {
    gameState.players = gameState.players.filter(p => p !== ws.player);
    broadcastGameState();
  });

  ws.send(JSON.stringify({ type: "gameState", game: gameState }));
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});