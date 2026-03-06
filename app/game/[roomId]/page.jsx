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
import { useToast } from "@/components/Toast";
import Footer from "@/components/Footer";
import styles from "../game.module.css";

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId;
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

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
  const [isGameOver, setIsGameOver] = useState(false);
  const dragState = useRef({ piece: null, source: null });
  const gameStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const hasAnnouncedResult = useRef(false);
  const lastProcessedFen = useRef(null);

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

  // Check for any game-ending condition using chess.js
  function getGameEndInfo(chess) {
    if (chess.isCheckmate()) {
      const winner = chess.turn() === "w" ? "black" : "white";
      return { ended: true, winner, result: "checkmate", endReason: "checkmate" };
    }
    if (chess.isStalemate()) {
      return { ended: true, winner: "draw", result: "draw", endReason: "stalemate" };
    }
    if (chess.isThreefoldRepetition()) {
      return { ended: true, winner: "draw", result: "draw", endReason: "threefold repetition" };
    }
    if (chess.isInsufficientMaterial()) {
      return { ended: true, winner: "draw", result: "draw", endReason: "insufficient material" };
    }
    if (chess.isDraw()) {
      // Catches 50-move rule and other draw conditions
      return { ended: true, winner: "draw", result: "draw", endReason: "50-move rule" };
    }
    return { ended: false };
  }

  // Update game UI — DISPLAY ONLY, no Firestore writes
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
      const currentTurn = chess.turn() === "w" ? "White" : "Black";
      setTurnDisplay(`${currentTurn} to move`);

      // Game status — display only
      const endInfo = getGameEndInfo(chess);

      if (endInfo.ended) {
        setIsGameOver(true);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        if (endInfo.winner === "draw") {
          setGameStatus(`Draw - ${endInfo.endReason}!`);
          setGameStatusColor("#ffc107");
          if (!hasAnnouncedResult.current) {
            hasAnnouncedResult.current = true;
            toast.warning(`Game ended in a draw — ${endInfo.endReason}!`);
          }
        } else {
          const winnerName =
            endInfo.winner === role
              ? "You"
              : endInfo.winner === "white"
                ? gameData.player1?.name
                : gameData.player2?.name;
          setGameStatus(`${endInfo.endReason === "checkmate" ? "Checkmate! " : ""}${winnerName} wins!`);
          setGameStatusColor(endInfo.winner === role ? "#28a745" : "#dc3545");
          if (!hasAnnouncedResult.current) {
            hasAnnouncedResult.current = true;
            if (endInfo.winner === role) {
              toast.success(`🎉 ${endInfo.endReason === "checkmate" ? "Checkmate! " : ""}You win!`);
            } else {
              toast.error(`😔 ${endInfo.endReason === "checkmate" ? "Checkmate! " : ""}You lose.`);
            }
          }
        }
      } else if (gameData.status === "finished") {
        // Game was marked finished in Firestore (e.g., resignation, timeout)
        setIsGameOver(true);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
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
        if (!hasAnnouncedResult.current) {
          hasAnnouncedResult.current = true;
          if (gameData.result === "draw") {
            toast.warning("Game ended in a draw!");
          } else if (gameData.winner === role) {
            toast.success("🎉 You win!");
          } else {
            toast.error("😔 You lose.");
          }
        }
      } else if (chess.isCheck()) {
        setGameStatus("Check!");
        setGameStatusColor("#dc3545");
        setIsGameOver(false);
      } else if (
        gameData.status === "active" &&
        gameData.player1 &&
        gameData.player2
      ) {
        setGameStatus("In Progress");
        setGameStatusColor("#28a745");
        setIsGameOver(false);
      } else {
        setGameStatus("Waiting for players");
        setGameStatusColor("#666");
        setIsGameOver(false);
      }

      // Update board
      setBoard(chess.board());
    },
    [user, startGameTimer, toast]
  );

  // Listen for game updates
  useEffect(() => {
    if (!user || !roomId) return;

    const unsubscribe = onSnapshot(
      doc(db, "gameRooms", roomId),
      (docSnap) => {
        if (docSnap.exists()) {
          const gameData = docSnap.data();
          if (gameData.fen && gameData.fen !== lastProcessedFen.current) {
            lastProcessedFen.current = gameData.fen;
            chessRef.current.load(gameData.fen);
          }
          updateGameUI(gameData);
        } else {
          toast.error("Game room not found!");
          router.push("/lobby");
        }
      },
      (error) => {
        console.error("Error listening to game updates:", error);
        toast.error("Connection error. Trying to reconnect...");
      }
    );

    return () => {
      unsubscribe();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [user, roomId, updateGameUI, router, toast]);

  // Make move — single source of truth for game ending writes
  async function makeMove(move) {
    const chess = chessRef.current;

    if (isGameOver) {
      toast.info("This game is over");
      return;
    }

    // Check turn
    const isPlayerTurn =
      (chess.turn() === "w" && playerRole === "white") ||
      (chess.turn() === "b" && playerRole === "black");
    if (!isPlayerTurn) {
      toast.warning("It's not your turn!");
      return;
    }

    if (playerRole === "spectator") {
      toast.info("You are spectating this game");
      return;
    }

    // Validate move on a copy first
    const testChess = new Chess(chess.fen());
    const result = testChess.move(move);
    if (!result) {
      toast.warning("Invalid move");
      return;
    }

    try {
      setSelectedSquare(null);
      setHighlightedMoves([]);

      const updateData = {
        fen: testChess.fen(),
        lastMove: { from: result.from, to: result.to, promotion: result.promotion || null },
        lastMoveBy: user.uid,
        lastMoveAt: serverTimestamp(),
      };

      // Check for game-ending conditions after the move
      const endInfo = getGameEndInfo(testChess);
      if (endInfo.ended) {
        updateData.status = "finished";
        updateData.endReason = endInfo.endReason;
        updateData.endedAt = serverTimestamp();
        if (endInfo.winner === "draw") {
          updateData.result = "draw";
        } else {
          updateData.winner = endInfo.winner;
          updateData.result = "checkmate";
        }
      }

      await updateDoc(doc(db, "gameRooms", roomId), updateData);
    } catch (error) {
      console.error("Error making move:", error);
      toast.error("Failed to make move. Please try again.");
    }
  }

  // Build a move object with auto-promotion for pawns
  function buildMoveObj(fromSquare, toSquare) {
    const chess = chessRef.current;
    const piece = chess.get(fromSquare);

    const moveObj = { from: fromSquare, to: toSquare };

    // Auto-promote to queen if pawn reaches last rank
    if (piece && piece.type === "p") {
      const targetRank = toSquare[1];
      if (
        (piece.color === "w" && targetRank === "8") ||
        (piece.color === "b" && targetRank === "1")
      ) {
        moveObj.promotion = "q";
      }
    }

    return moveObj;
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

    if (isGameOver) return;

    if (selectedSquare) {
      // Clicking the same square again — deselect
      if (selectedSquare.row === row && selectedSquare.col === col) {
        setSelectedSquare(null);
        setHighlightedMoves([]);
        return;
      }

      // Clicking a different friendly piece — re-select it
      if (piece) {
        const isPlayerPiece =
          (piece.color === "w" && playerRole === "white") ||
          (piece.color === "b" && playerRole === "black");
        if (isPlayerPiece) {
          const sq = `${String.fromCharCode(97 + col)}${8 - row}`;
          const moves = chess.moves({ square: sq, verbose: true });
          if (moves.length > 0) {
            setSelectedSquare({ row, col });
            setHighlightedMoves(
              moves.map((m) => ({
                row: 8 - parseInt(m.to[1]),
                col: m.to.charCodeAt(0) - 97,
              }))
            );
            return;
          }
        }
      }

      // Attempt move from selected square to clicked square
      const fromSquare = `${String.fromCharCode(97 + selectedSquare.col)}${8 - selectedSquare.row}`;
      const toSquare = `${String.fromCharCode(97 + col)}${8 - row}`;
      makeMove(buildMoveObj(fromSquare, toSquare));
      setSelectedSquare(null);
      setHighlightedMoves([]);
      return;
    }

    // No square selected — select a piece
    if (piece) {
      const isPlayerPiece =
        (piece.color === "w" && playerRole === "white") ||
        (piece.color === "b" && playerRole === "black");
      if (isPlayerPiece && playerRole !== "spectator") {
        const sq = `${String.fromCharCode(97 + col)}${8 - row}`;
        const moves = chess.moves({ square: sq, verbose: true });
        if (moves.length === 0) {
          toast.info("This piece has no legal moves");
          return;
        }
        setSelectedSquare({ row, col });
        setHighlightedMoves(
          moves.map((m) => ({
            row: 8 - parseInt(m.to[1]),
            col: m.to.charCodeAt(0) - 97,
          }))
        );
      } else if (playerRole === "spectator") {
        toast.info("You are spectating this game");
      }
    }
  }

  // Drag handlers
  function handleDragStart(e, row, col) {
    if (isGameOver) { e.preventDefault(); return; }
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
    makeMove(buildMoveObj(fromSquare, toSquare));
    dragState.current = { piece: null, source: null };
  }

  // Touch handlers
  function handleTouchStart(e, row, col) {
    if (isGameOver) return;
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
      makeMove(buildMoveObj(fromSq, toSq));
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
    <main>
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
                  isPlayerPiece && playerRole !== "spectator" && !isGameOver;

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
    </main>
  );
}
