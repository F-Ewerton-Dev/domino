let player = null;
const boardDiv = document.getElementById("board");
const handDiv = document.getElementById("player-hand");
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
  handDiv.innerHTML = "";

  // Render board
  game.board.forEach((tile, index) => {
    if (tile) {
      const tileDiv = document.createElement("div");
      tileDiv.className = `tile ${tile.color}`;
      tileDiv.textContent = `${tile.left}|${tile.right}`;
      tileDiv.style.left = `${tile.x}px`;
      tileDiv.style.top = `${tile.y}px`;
      tileDiv.style.transform = `rotate(${tile.rotation}deg)`;
      boardDiv.appendChild(tileDiv);
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

  // Render player's hand
  const playerHand = game.hands[player];
  playerHand.forEach((tile, index) => {
    const tileDiv = document.createElement("div");
    tileDiv.className = `tile ${player === "Ewerton" ? "black" : "yellow"} ${game.selectedTile === index && game.turn === player ? "selected" : ""}`;
    tileDiv.textContent = `${tile.left}|${tile.right}`;
    tileDiv.onclick = () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        info.textContent = "Não conectado ao servidor. Tente recarregar.";
        return;
      }
      if (game.turn === player) {
        ws.send(JSON.stringify({ type: "select", index, player }));
      }
    };
    handDiv.appendChild(tileDiv);
  });

  if (game.winner) {
    info.textContent = `${game.winner} venceu! Reiniciando...`;
    setTimeout(() => {
      ws.send(JSON.stringify({ type: "reset" }));
    }, 3000);
  } else {
    info.textContent = game.turn === player ? `Sua vez, ${player}` : `Vez de ${game.turn}`;
  }
}