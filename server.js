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

// Função para verificar movimentos válidos
function getValidMoves(piece, board) {
  const moves = [];
  const captures = [];
  const { row, col, color, isKing } = piece;
  const directions = color === "purple" ? (isKing ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[-1, -1], [-1, 1]]) : (isKing ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[1, -1], [1, 1]]);

  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
      const target = board[newRow * 8 + newCol];
      if (!target) {
        moves.push({ row: newRow, col: newCol });
      }
      // Verificar captura
      const jumpRow = row + 2 * dr;
      const jumpCol = col + 2 * dc;
      if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
        const jumped = board[(row + dr) * 8 + (col + dc)];
        if (jumped && jumped.color !== color && !board[jumpRow * 8 + jumpCol]) {
          captures.push({ row: jumpRow, col: jumpCol, jumped: (row + dr) * 8 + (col + dc) });
        }
      }
    }
  }
  return { moves, captures };
}

// Verificar se há capturas disponíveis
function hasCaptures(board, color) {
  return board.some(piece => piece && piece.color === color && getValidMoves(piece, board).captures.length > 0);
}

// Verificar vencedor
function checkWinner(board) {
  const purplePieces = board.filter(piece => piece && piece.color === "purple").length;
  const blackPieces = board.filter(piece => piece && piece.color === "black").length;
  if (purplePieces === 0) return "Ewerton";
  if (blackPieces === 0) return "Hellen";
  if (!board.some(piece => piece && piece.color === "purple" && (getValidMoves(piece, board).moves.length > 0 || getValidMoves(piece, board).captures.length > 0))) return "Ewerton";
  if (!board.some(piece => piece && piece.color === "black" && (getValidMoves(piece, board).moves.length > 0 || getValidMoves(piece, board).captures.length > 0))) return "Hellen";
  return null;
}

// Função para resetar o jogo
function resetGame() {
  const nextStarter = gameState.turn === "Ewerton" ? "Hellen" : "Ewerton";
  gameState = {
    board: initialGameState.board.map(piece => piece ? { ...piece } : null),
    turn: nextStarter,
    winner: null,
    selectedPiece: null,
    validMoves: [],
    validCaptures: [],
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
        broadcastGameState();
      } else {
        ws.send(JSON.stringify({ type: "error", message: "Jogador já conectado ou inválido." }));
        ws.close();
      }
    }

    if (data.type === "select" && !gameState.winner && data.player === gameState.turn) {
      const piece = gameState.board[data.index];
      if (piece && piece.color === (data.player === "Ewerton" ? "black" : "purple")) {
        const { moves, captures } = getValidMoves(piece, gameState.board);
        if (hasCaptures(gameState.board, piece.color)) {
          gameState.validMoves = [];
          gameState.validCaptures = captures;
        } else {
          gameState.validMoves = moves;
          gameState.validCaptures = [];
        }
        gameState.selectedPiece = data.index;
        broadcastGameState();
      }
    }

    if (data.type === "move" && !gameState.winner && data.player === gameState.turn) {
      const { fromIndex, toIndex } = data;
      const piece = gameState.board[fromIndex];
      if (piece && piece.color === (data.player === "Ewerton" ? "black" : "purple")) {
        const { moves, captures } = getValidMoves(piece, gameState.board);
        const move = moves.find(m => m.row * 8 + m.col === toIndex);
        const capture = captures.find(c => c.row * 8 + c.col === toIndex);
        if (move || capture) {
          gameState.board[toIndex] = { ...piece, row: Math.floor(toIndex / 8), col: toIndex % 8 };
          gameState.board[fromIndex] = null;
          if (capture) {
            gameState.board[capture.jumped] = null;
          }
          // Verificar promoção para rei
          if (piece.color === "purple" && Math.floor(toIndex / 8) === 0) piece.isKing = true;
          if (piece.color === "black" && Math.floor(toIndex / 8) === 7) piece.isKing = true;
          gameState.turn = gameState.turn === "Ewerton" ? "Hellen" : "Ewerton";
          gameState.selectedPiece = null;
          gameState.validMoves = [];
          gameState.validCaptures = [];
          gameState.winner = checkWinner(gameState.board);
          broadcastGameState();
        }
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