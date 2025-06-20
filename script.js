let player = null;
const boardDiv = document.getElementById("board");
const playerTilesDiv = document.getElementById("player-tiles");
const opponentCountSpan = document.getElementById("opponent-count");
const info = document.getElementById("info");
const boneyardCount = document.getElementById("boneyard-count");
const drawButton = document.getElementById("draw-button");
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

function drawTile() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    info.textContent = "Não conectado ao servidor. Tente recarregar.";
    return;
  }
  ws.send(JSON.stringify({ type: "draw", player }));
}

function render(game) {
  boardDiv.innerHTML = "";
  playerTilesDiv.innerHTML = "";
  const opponent = player === "Ewerton" ? "Hellen" : "Ewerton";
  opponentCountSpan.textContent = (game.hands[opponent] || []).length;
  boneyardCount.textContent = game.boneyard.length;

  // Show draw button if it's player's turn and no valid moves
  const canPlay = game.hands[player]?.some(tile => getValidPlacements(game.board, tile).length > 0);
  drawButton.style.display = game.turn === player && !canPlay && game.boneyard.length > 0 ? "block" : "none";

  // Render board with precise positions and animation
  game.board.forEach((tile, index) => {
    if (tile) {
      const tileDiv = document.createElement("div");
      tileDiv.className = `tile ${tile.color}`;
      tileDiv.textContent = `${tile.left}|${tile.right}`;
      tileDiv.style.left = `${tile.startX || tile.x}px`;
      tileDiv.style.top = `${tile.y}px`;
      tileDiv.style.transform = `rotate(${tile.rotation}deg)`;
      tileDiv.dataset.finalX = tile.x;
      tileDiv.dataset.finalY = tile.y;
      tileDiv.classList.add("animate-placement");
      boardDiv.appendChild(tileDiv);

      // Trigger animation
      setTimeout(() => {
        tileDiv.style.left = `${tile.x}px`;
        tileDiv.style.top = `${tile.y}px`;
      }, 10);
    }
  });

  // Render valid placement spots
  game.validPlacements.forEach(spot => {
    const spotDiv = document.createElement("div");
    spotDiv.className = "valid-spot";
    spotDiv.style.left = `${spot.x}px`;
    spotDiv.style.top = `${spot.y}px`;
    spotDiv.onclick = () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        info.textContent = "Não conectado ao servidor. Tente recarregar.";
        return;
      }
      ws.send(JSON.stringify({ type: "place", tileIndex: game.selectedTile, spotIndex: spot.index, player }));
    };
    boardDiv.appendChild(spotDiv);
  });

  // Render player's hand in fixed grid (7 slots)
  const playerHand = game.hands[player] || [];
  for (let i = 0; i < 7; i++) {
    const tile = playerHand[i];
    const tileDiv = document.createElement("div");
    tileDiv.className = `tile ${player === "Ewerton" ? "black" : "yellow"} ${game.selectedTile === i && game.turn === player ? "selected" : ""} ${tile && game.turn === player && getValidPlacements(game.board, tile).length > 0 ? "valid" : tile ? "invalid" : ""}`;
    tileDiv.style.left = `${i * 70 + 20}px`; // Fixed position: 20px offset + 70px per slot
    tileDiv.textContent = tile ? `${tile.left}|${tile.right}` : "";
    if (tile) {
      tileDiv.onclick = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          info.textContent = "Não conectado ao servidor. Tente recarregar.";
          return;
        }
        if (game.turn === player) {
          ws.send(JSON.stringify({ type: "select", index: i, player }));
        }
      };
    }
    playerTilesDiv.appendChild(tileDiv);
  }

  if (game.winner) {
    info.textContent = `${game.winner} venceu! Reiniciando...`;
    setTimeout(() => {
      ws.send(JSON.stringify({ type: "reset" }));
    }, 3000);
  } else {
    info.textContent = game.turn === player ? `Sua vez, ${player}` : `Vez de ${game.turn}`;
  }
}

function getValidPlacements(board, tile) {
  if (!board || board.length === 0) {
    return [{ index: 0, x: 300, y: 300, side: "left", flip: false }];
  }
  const placements = [];
  const leftEnd = board[0].left;
  const rightEnd = board[board.length - 1].right;
  if (tile.left === leftEnd || tile.right === leftEnd) {
    placements.push({ index: 0, x: board[0].x - 60, y: 300, side: "left", flip: tile.right === leftEnd });
  }
  if (tile.left === rightEnd || tile.right === rightEnd) {
    placements.push({ index: board.length, x: board[board.length - 1].x + 60, y: 300, side: "right", flip: tile.left === rightEnd });
  }
  return placements;
}