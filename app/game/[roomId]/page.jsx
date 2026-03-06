"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Chess } from "chess.js";
import {
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import Footer from "@/components/Footer";
import styles from "../game.module.css";

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId;
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const chessRef = useRef(new Chess());
  const [board, setBoard] = useState([]);
  const [playerRole, setPlayerRole] = useState(null);
  const [opponentName, setOpponentName] = useState("Waiting...");
  const [opponentStatus, setOpponentStatus] = useState("Connecting");
  const [turnDisplay, setTurnDisplay] = useState("White to move");
  const [gameStatus, setGameStatus] = useState("Waiting for players");
  const [gameStatusColor, setGameStatusColor] = useState("#666");
  const [timerDisplay, setTimerDisplay] = useState("00:00");
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [highlightedMoves, setHighlightedMoves] = useState([]);
  const dragState = useRef({ piece: null, source: null });
  const gameStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [user, loading, router]);

  // Timer
  const startGameTimer = useCallback((createdAt) => {
    if (createdAt && createdAt.toDate) {
      gameStartTimeRef.current = createdAt.toDate();
    } else {
      gameStartTimeRef.current = new Date();
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const updateTimer = () => {
      if (!gameStartTimeRef.current) return;
      const elapsed = Math.floor(
        (new Date() - gameStartTimeRef.current) / 1000
      );
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setTimerDisplay(
        `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };
    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 1000);
  }, []);

  // Update game UI
  const updateGameUI = useCallback(
    (gameData) => {
      const chess = chessRef.current;
      let role = null;

      // Start timer
      if (
        gameData.status === "active" &&
        gameData.player1 &&
        gameData.player2 &&
        !gameStartTimeRef.current
      ) {
        startGameTimer(gameData.gameStartedAt || gameData.createdAt);
      }

      // Determine player role
      if (gameData.player1 && gameData.player1.uid === user.uid) {
        role = gameData.player1.color;
        if (gameData.player2 && gameData.player2.uid && gameData.status === "active") {
          setOpponentName(gameData.player2.name || "Player 2");
          setOpponentStatus("Connected");
        } else {
          setOpponentName("Waiting for opponent...");
          setOpponentStatus("Connecting");
        }
      } else if (gameData.player2 && gameData.player2.uid === user.uid) {
        role = gameData.player2.color;
        if (gameData.player1 && gameData.player1.uid && gameData.status === "active") {
          setOpponentName(gameData.player1.name || "Player 1");
          setOpponentStatus("Connected");
        } else {
          setOpponentName("Connecting to opponent...");
          setOpponentStatus("Connecting");
        }
      } else {
        role = "spectator";
        setOpponentName("Spectating");
        setOpponentStatus("Observer");
      }
      setPlayerRole(role);

      // Turn display
      try {
        const currentTurn = chess.turn() === "w" ? "White" : "Black";
        setTurnDisplay(`${currentTurn} to move`);
      } catch {
        setTurnDisplay("White to move");
      }

      // Game status
      try {
        if (chess.isCheckmate()) {
          const winner = chess.turn() === "w" ? "black" : "white";
          const winnerName =
            winner === role
              ? "You"
              : winner === "white"
                ? gameData.player1?.name
                : gameData.player2?.name;
          setGameStatus(`Checkmate! ${winnerName} wins!`);
          setGameStatusColor(winner === role ? "#28a745" : "#dc3545");
          if (gameData.status === "active") {
            updateGameResult(winner, "checkmate");
          }
        } else if (chess.isStalemate()) {
          setGameStatus("Stalemate - Draw!");
          setGameStatusColor("#ffc107");
          if (gameData.status === "active") updateGameResult("draw", "stalemate");
        } else if (chess.isThreefoldRepetition()) {
          setGameStatus("Draw - Threefold Repetition!");
          setGameStatusColor("#ffc107");
          if (gameData.status === "active") updateGameResult("draw", "threefold");
        } else if (chess.isInsufficientMaterial()) {
          setGameStatus("Draw - Insufficient Material!");
          setGameStatusColor("#ffc107");
          if (gameData.status === "active") updateGameResult("draw", "insufficient");
        } else if (chess.isCheck()) {
          setGameStatus("Check!");
          setGameStatusColor("#dc3545");
        } else if (gameData.status === "finished") {
          if (gameData.result === "draw") {
            setGameStatus(`Draw - ${gameData.endReason || "Game ended"}`);
            setGameStatusColor("#ffc107");
          } else {
            const winnerName =
              gameData.winner === role
                ? "You"
                : gameData.winner === "white"
                  ? gameData.player1?.name
                  : gameData.player2?.name;
            setGameStatus(`${winnerName} wins!`);
            setGameStatusColor(gameData.winner === role ? "#28a745" : "#dc3545");
          }
        } else if (
          gameData.status === "active" &&
          gameData.player1 &&
          gameData.player2
        ) {
          setGameStatus("In Progress");
          setGameStatusColor("#28a745");
        } else {
          setGameStatus("Waiting for players");
          setGameStatusColor("#666");
        }
      } catch {
        if (
          gameData.status === "active" &&
          gameData.player1 &&
          gameData.player2
        ) {
          setGameStatus("In Progress");
          setGameStatusColor("#28a745");
        } else {
          setGameStatus("Waiting for players");
          setGameStatusColor("#666");
        }
      }

      // Update board
      setBoard(chess.board());
    },
    [user, startGameTimer]
  );

  // Listen for game updates
  useEffect(() => {
    if (!user || !roomId) return;

    const unsubscribe = onSnapshot(
      doc(db, "gameRooms", roomId),
      (docSnap) => {
        if (docSnap.exists()) {
          const gameData = docSnap.data();
          if (gameData.fen) {
            chessRef.current.load(gameData.fen);
          }
          setTimeout(() => updateGameUI(gameData), 100);
        } else {
          alert("Game room not found!");
          router.push("/lobby");
        }
      },
      (error) => {
        console.error("Error listening to game updates:", error);
      }
    );

    return () => {
      unsubscribe();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [user, roomId, updateGameUI, router]);

  // Make move
  async function makeMove(move) {
    const chess = chessRef.current;
    try {
      setSelectedSquare(null);
      setHighlightedMoves([]);

      const testChess = new Chess(chess.fen());
      const result = testChess.move(move);
      if (!result) return;

      const isPlayerTurn =
        (chess.turn() === "w" && playerRole === "white") ||
        (chess.turn() === "b" && playerRole === "black");
      if (!isPlayerTurn) {
        alert("It's not your turn!");
        return;
      }

      const updateData = {
        fen: testChess.fen(),
        lastMove: move,
        lastMoveBy: user.uid,
        lastMoveAt: serverTimestamp(),
      };

      if (testChess.isCheckmate()) {
        const winner = testChess.turn() === "w" ? "black" : "white";
        Object.assign(updateData, {
          status: "finished",
          winner,
          result: "checkmate",
          endReason: "checkmate",
          endedAt: serverTimestamp(),
        });
      } else if (testChess.isStalemate()) {
        Object.assign(updateData, {
          status: "finished",
          result: "draw",
          endReason: "stalemate",
          endedAt: serverTimestamp(),
        });
      } else if (testChess.isThreefoldRepetition()) {
        Object.assign(updateData, {
          status: "finished",
          result: "draw",
          endReason: "threefold repetition",
          endedAt: serverTimestamp(),
        });
      } else if (testChess.isInsufficientMaterial()) {
        Object.assign(updateData, {
          status: "finished",
          result: "draw",
          endReason: "insufficient material",
          endedAt: serverTimestamp(),
        });
      }

      await updateDoc(doc(db, "gameRooms", roomId), updateData);
    } catch (error) {
      console.error("Error making move:", error);
      alert("Failed to make move: " + error.message);
    }
  }

  async function updateGameResult(winner, endReason) {
    try {
      const updateData = {
        status: "finished",
        endedAt: serverTimestamp(),
        endReason,
      };
      if (winner === "draw") {
        updateData.result = "draw";
      } else {
        updateData.winner = winner;
        updateData.result = "win";
      }
      await updateDoc(doc(db, "gameRooms", roomId), updateData);
    } catch (error) {
      console.error("Error updating game result:", error);
    }
  }

  // Piece Unicode
  function getPieceUnicode(type, color) {
    const pieces = {
      p: color === "w" ? "♙" : "♟",
      r: color === "w" ? "♖" : "♜",
      n: color === "w" ? "♘" : "♞",
      b: color === "w" ? "♗" : "♝",
      q: color === "w" ? "♕" : "♛",
      k: color === "w" ? "♔" : "♚",
    };
    return pieces[type] || "";
  }

  // Click to select & move
  function handleSquareClick(row, col, piece) {
    const chess = chessRef.current;

    if (selectedSquare) {
      // Attempt move
      const fromSquare = `${String.fromCharCode(97 + selectedSquare.col)}${8 - selectedSquare.row}`;
      const toSquare = `${String.fromCharCode(97 + col)}${8 - row}`;
      makeMove({ from: fromSquare, to: toSquare });
      setSelectedSquare(null);
      setHighlightedMoves([]);
      return;
    }

    if (piece) {
      const isPlayerPiece =
        (piece.color === "w" && playerRole === "white") ||
        (piece.color === "b" && playerRole === "black");
      if (isPlayerPiece && playerRole !== "spectator") {
        const sq = `${String.fromCharCode(97 + col)}${8 - row}`;
        const moves = chess.moves({ square: sq, verbose: true });
        setSelectedSquare({ row, col });
        setHighlightedMoves(
          moves.map((m) => ({
            row: 8 - parseInt(m.to[1]),
            col: m.to.charCodeAt(0) - 97,
          }))
        );
      }
    }
  }

  // Drag handlers
  function handleDragStart(e, row, col) {
    dragState.current = { piece: true, source: { row, col } };
    e.dataTransfer.effectAllowed = "move";
    setSelectedSquare(null);
    setHighlightedMoves([]);
  }

  function handleDrop(e, targetRow, targetCol) {
    e.preventDefault();
    const source = dragState.current.source;
    if (!source) return;

    const fromSquare = `${String.fromCharCode(97 + source.col)}${8 - source.row}`;
    const toSquare = `${String.fromCharCode(97 + targetCol)}${8 - targetRow}`;
    makeMove({ from: fromSquare, to: toSquare });
    dragState.current = { piece: null, source: null };
  }

  // Touch handlers
  function handleTouchStart(e, row, col) {
    e.preventDefault();
    dragState.current = { piece: true, source: { row, col } };
  }

  function handleTouchEnd(e, sourceRow, sourceCol) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    let targetSquare = el;
    while (targetSquare && !targetSquare.dataset.row) {
      targetSquare = targetSquare.parentElement;
    }
    if (targetSquare && targetSquare.dataset.row != null) {
      const targetRow = parseInt(targetSquare.dataset.row);
      const targetCol = parseInt(targetSquare.dataset.col);
      if (targetRow === sourceRow && targetCol === sourceCol) return;

      const fromSq = `${String.fromCharCode(97 + sourceCol)}${8 - sourceRow}`;
      const toSq = `${String.fromCharCode(97 + targetCol)}${8 - targetRow}`;

      const testChess = new Chess(chessRef.current.fen());
      if (testChess.move({ from: fromSq, to: toSq })) {
        makeMove({ from: fromSq, to: toSq });
      }
    }
    dragState.current = { piece: null, source: null };
  }

  function goToLobby() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    router.push("/lobby");
  }

  function isHighlighted(row, col) {
    return highlightedMoves.some((m) => m.row === row && m.col === col);
  }

  if (loading || !user) {
    return (
      <div className={styles.loadingContainer}>
        <h1>♔ Loading Game... ♛</h1>
      </div>
    );
  }

  const isBlackPlayer = playerRole === "black";

  return (
    <>
      <div className={styles.gameHeader}>
        <h2>♔ Chesso ♛</h2>
        <div className={styles.gameControls}>
          <button onClick={toggleTheme} className={styles.themeBtn}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button onClick={goToLobby} className={styles.controlBtn}>
            Back to Lobby
          </button>
          <span className={styles.userDisplay}>
            {user.displayName || user.email}
          </span>
        </div>
      </div>

      <div className={styles.gameContainer}>
        <div className={styles.gameSidebar}>
          <div className={`${styles.playerCard} ${styles.opponent}`}>
            <div className={styles.playerAvatar}>♛</div>
            <div className={styles.playerNameText}>{opponentName}</div>
            <div className={styles.playerStatusText}>{opponentStatus}</div>
          </div>

          <div className={styles.gameInfo}>
            <div className={styles.turnIndicator}>
              <span>{turnDisplay}</span>
            </div>
            <div className={styles.gameTimer}>
              <span>{timerDisplay}</span>
            </div>
            <div className={styles.gameStatusDisplay}>
              <span style={{ color: gameStatusColor }}>{gameStatus}</span>
            </div>
          </div>

          <div className={`${styles.playerCard} ${styles.current}`}>
            <div className={styles.playerAvatar}>♔</div>
            <div className={styles.playerNameText}>
              {user.displayName || user.email}
            </div>
            <div className={styles.playerRole}>
              {playerRole ? `Playing as ${playerRole}` : "Connecting..."}
            </div>
          </div>
        </div>

        <div className={styles.boardContainer}>
          <div className={styles.chessboard}>
            {Array.from({ length: 8 }, (_, row) =>
              Array.from({ length: 8 }, (_, col) => {
                const actualRow = isBlackPlayer ? 7 - row : row;
                const actualCol = isBlackPlayer ? 7 - col : col;
                const piece = board[actualRow]?.[actualCol];
                const isLight = (actualRow + actualCol) % 2 === 0;
                const isSelected =
                  selectedSquare &&
                  selectedSquare.row === actualRow &&
                  selectedSquare.col === actualCol;
                const isPossibleMove = isHighlighted(actualRow, actualCol);
                const isPlayerPiece =
                  piece &&
                  ((piece.color === "w" && playerRole === "white") ||
                    (piece.color === "b" && playerRole === "black"));
                const isDraggable =
                  isPlayerPiece && playerRole !== "spectator";

                return (
                  <div
                    key={`${row}-${col}`}
                    className={`${styles.square} ${isLight ? styles.light : styles.dark} ${isSelected ? styles.selected : ""} ${isPossibleMove ? styles.possibleMove : ""}`}
                    data-row={actualRow}
                    data-col={actualCol}
                    onClick={() =>
                      handleSquareClick(actualRow, actualCol, piece)
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, actualRow, actualCol)}
                  >
                    {piece && (
                      <div
                        className={`${styles.piece} ${piece.color === "w" ? styles.whitePiece : styles.blackPiece}`}
                        draggable={isDraggable}
                        onDragStart={(e) =>
                          isDraggable
                            ? handleDragStart(e, actualRow, actualCol)
                            : e.preventDefault()
                        }
                        onTouchStart={(e) =>
                          isDraggable &&
                          handleTouchStart(e, actualRow, actualCol)
                        }
                        onTouchEnd={(e) =>
                          isDraggable &&
                          handleTouchEnd(e, actualRow, actualCol)
                        }
                        style={{
                          cursor: isDraggable ? "grab" : "not-allowed",
                        }}
                      >
                        {getPieceUnicode(piece.type, piece.color)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
