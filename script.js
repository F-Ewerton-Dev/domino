let player = null;
const boardDiv = document.getElementById("board");
const info = document.getElementById("info");
let ws;

function login(name) {
  player = name;
  document.getElementById("login").style.display = "none";
  document.getElementById("game").style.display = "block";

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "login", player: name }));
    info.textContent = `Conectado! Escolhendo jogador ${name}...`;
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "gameState") {
      render(message.game);
    }
  };

  ws.onerror = () => {
    info.textContent = "Erro na conexão com o servidor. Tente recarregar a página.";
  };

  ws.onclose = () => {
    info.textContent = "Conexão perdida. Tente recarregar a página.";
  };
}

function render(game) {
  boardDiv.innerHTML = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const index = row * 8 + col;
      const div = document.createElement("div");
      div.className = `cell ${(row + col) % 2 === 1 ? "dark" : ""}`;
      if (game.selectedPiece === index) {
        div.classList.add("selected");
      }
      if (game.validMoves.some(m => m.row * 8 + m.col === index) || game.validCaptures.some(c => c.row * 8 + c.col === index)) {
        div.classList.add("valid-move");
      }
      const piece = game.board[index];
      if (piece) {
        const pieceDiv = document.createElement("div");
        pieceDiv.className = `piece ${piece.color}${piece.isKing ? " king" : ""}`;
        div.appendChild(pieceDiv);
      }
      div.onclick = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          info.textContent = "Não conectado ao servidor. Tente recarregar.";
          return;
        }
        if (game.selectedPiece != null && (game.validMoves.some(m => m.row * 8 + m.col === index) || game.validCaptures.some(c => c.row * 8 + c.col === index))) {
          ws.send(JSON.stringify({ type: "move", fromIndex: game.selectedPiece, toIndex: index, player }));
        } else if (game.board[index] && game.board[index].color === (player === "Ewerton" ? "black" : "purple") && game.turn === player) {
          ws.send(JSON.stringify({ type: "select", index, player }));
        }
      };
      boardDiv.appendChild(div);
    }
  }

  if (game.winner) {
    info.textContent = `${game.winner} venceu! Reiniciando...`;
    setTimeout(() => {
      ws.send(JSON.stringify({ type: "reset" }));
    }, 3000);
  } else {
    if (game.turn === player) {
      info.textContent = `Vez do ${player}`;
    } else {
      info.textContent = `Vez do ${game.turn}`;
    }
  }
}