"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/components/Toast";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import styles from "../game.module.css";
import aiStyles from "./ai.module.css";

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const POSITION_BONUS = {
  p: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  n: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  b: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  r: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  k: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]],
};

function evaluateBoard(chess) {
  if (chess.isCheckmate()) return chess.turn() === "w" ? -99999 : 99999;
  if (chess.isDraw() || chess.isStalemate()) return 0;
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type] || 0;
      const posRow = piece.color === "w" ? r : 7 - r;
      const posBonus = POSITION_BONUS[piece.type]?.[posRow]?.[c] || 0;
      score += piece.color === "w" ? (value + posBonus) : -(value + posBonus);
    }
  }
  return score;
}

function minimax(chess, depth, alpha, beta, maximizing) {
  if (depth === 0 || chess.isGameOver()) return evaluateBoard(chess);
  const moves = chess.moves({ verbose: true });
  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move); const ev = minimax(chess, depth - 1, alpha, beta, false); chess.undo();
      maxEval = Math.max(maxEval, ev); alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move); const ev = minimax(chess, depth - 1, alpha, beta, true); chess.undo();
      minEval = Math.min(minEval, ev); beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getBestMoveMinimax(chess, depth) {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  const isMax = chess.turn() === "w";
  let bestMove = null, bestEval = isMax ? -Infinity : Infinity;
  moves.sort(() => Math.random() - 0.5);
  for (const move of moves) {
    chess.move(move);
    const ev = minimax(chess, depth - 1, -Infinity, Infinity, !isMax);
    chess.undo();
    if (isMax ? ev > bestEval : ev < bestEval) { bestEval = ev; bestMove = move; }
  }
  return bestMove;
}

function getRandomMove(chess) {
  const moves = chess.moves({ verbose: true });
  return moves.length === 0 ? null : moves[Math.floor(Math.random() * moves.length)];
}

const DIFFICULTY = {
  easy:   { label: "Easy",   emoji: "🟢", depth: 0,  useStockfish: false, description: "Random moves" },
  medium: { label: "Medium", emoji: "🟡", depth: 2,  useStockfish: false, description: "Depth-2 minimax" },
  hard:   { label: "Hard",   emoji: "🔴", depth: 4,  useStockfish: false, description: "Depth-4 minimax" },
  expert: { label: "Expert", emoji: "🟣", depth: 15, useStockfish: true,  description: "Stockfish engine" },
};

function SetupScreen({ onStart }) {
  const [side, setSide] = useState("white");
  const [difficulty, setDifficulty] = useState("medium");
  const sides = [{ key: "white", icon: "♔", label: "White" }, { key: "black", icon: "♚", label: "Black" }, { key: "random", icon: "🎲", label: "Random" }];
  return (
    <div className={aiStyles.setupOverlay}>
      <div className={aiStyles.setupCard}>
        <div className={aiStyles.setupHeader}>
          <div className={aiStyles.setupIcon}>🤖</div>
          <h1>Play vs Computer</h1>
          <p>Configure your game against the AI</p>
        </div>
        <div className={aiStyles.setupSection}>
          <label className={aiStyles.sectionLabel}>Choose Your Side</label>
          <div className={aiStyles.sideSelector}>
            {sides.map(({ key, icon, label }) => (
              <button key={key} className={`${aiStyles.sideBtn} ${side === key ? aiStyles.sideBtnActive : ""}`} onClick={() => setSide(key)}>
                <span className={aiStyles.sideIcon}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={aiStyles.setupSection}>
          <label className={aiStyles.sectionLabel}>Difficulty</label>
          <div className={aiStyles.difficultySelector}>
            {Object.entries(DIFFICULTY).map(([key, cfg]) => (
              <button key={key} className={`${aiStyles.diffBtn} ${difficulty === key ? aiStyles.diffBtnActive : ""}`} onClick={() => setDifficulty(key)}>
                <span className={aiStyles.diffEmoji}>{cfg.emoji}</span>
                <span className={aiStyles.diffLabel}>{cfg.label}</span>
                <span className={aiStyles.diffDesc}>{cfg.description}</span>
              </button>
            ))}
          </div>
        </div>
        <button className={aiStyles.startBtn} onClick={() => { const chosen = side === "random" ? (Math.random() < 0.5 ? "white" : "black") : side; onStart({ side: chosen, difficulty }); }}>
          ♟ Start Game
        </button>
      </div>
    </div>
  );
}

export default function AIGamePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  const [gameConfig, setGameConfig] = useState(null);
  const chessRef = useRef(new Chess());
  const [board, setBoard] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [highlightedMoves, setHighlightedMoves] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameStatus, setGameStatus] = useState("In Progress");
  const [gameStatusColor, setGameStatusColor] = useState("#28a745");
  const [turnDisplay, setTurnDisplay] = useState("White to move");
  const [timerDisplay, setTimerDisplay] = useState("00:00");
  const [isThinking, setIsThinking] = useState(false);
  const [lastMove, setLastMove] = useState(null);

  const stockfishRef = useRef(null);
  const stockfishReady = useRef(false);
  const stockfishMoveResolveRef = useRef(null);
  const gameStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const dragState = useRef({ piece: null, source: null });
  const hasAnnouncedResult = useRef(false);
  const isAIMoving = useRef(false);

  useEffect(() => { if (!loading && !user) router.replace("/auth"); }, [user, loading, router]);

  useEffect(() => {
    if (!gameConfig) return;
    gameStartTimeRef.current = new Date();
    timerIntervalRef.current = setInterval(() => {
      if (!gameStartTimeRef.current) return;
      const elapsed = Math.floor((new Date() - gameStartTimeRef.current) / 1000);
      setTimerDisplay(`${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timerIntervalRef.current);
  }, [gameConfig]);

  useEffect(() => {
    if (!gameConfig || !DIFFICULTY[gameConfig.difficulty].useStockfish) return;
    let sf = null;
    try { sf = new Worker("/stockfish.js"); } catch { toast.warning("Stockfish unavailable, using minimax."); return; }
    sf.onmessage = (e) => {
      const line = typeof e.data === "string" ? e.data : String(e.data);
      if (line === "uciok") sf.postMessage("isready");
      else if (line === "readyok") stockfishReady.current = true;
      else if (line.startsWith("bestmove")) {
        const move = line.split(" ")[1];
        if (stockfishMoveResolveRef.current) { stockfishMoveResolveRef.current(move && move !== "(none)" ? move : null); stockfishMoveResolveRef.current = null; }
      }
    };
    sf.postMessage("uci");
    stockfishRef.current = sf;
    return () => { sf.terminate(); stockfishRef.current = null; stockfishReady.current = false; };
  }, [gameConfig, toast]);

  const refreshUI = useCallback(() => {
    const chess = chessRef.current;
    setBoard(chess.board());
    setTurnDisplay(`${chess.turn() === "w" ? "White" : "Black"} to move`);
  }, []);

  function checkGameEnd(chess) {
    if (chess.isCheckmate()) return { ended: true, winner: chess.turn() === "w" ? "black" : "white", reason: "checkmate" };
    if (chess.isStalemate()) return { ended: true, winner: "draw", reason: "stalemate" };
    if (chess.isThreefoldRepetition()) return { ended: true, winner: "draw", reason: "threefold repetition" };
    if (chess.isInsufficientMaterial()) return { ended: true, winner: "draw", reason: "insufficient material" };
    if (chess.isDraw()) return { ended: true, winner: "draw", reason: "50-move rule" };
    if (chess.isCheck()) return { ended: false, inCheck: true };
    return { ended: false };
  }

  const updateStatus = useCallback((chess) => {
    const info = checkGameEnd(chess);
    if (info.ended) {
      setIsGameOver(true);
      clearInterval(timerIntervalRef.current);
      if (info.winner === "draw") {
        setGameStatus(`Draw — ${info.reason}`); setGameStatusColor("#ffc107");
        if (!hasAnnouncedResult.current) { hasAnnouncedResult.current = true; toast.warning(`Game drawn (${info.reason})`); }
      } else {
        const humanWon = info.winner === gameConfig?.side;
        setGameStatus(humanWon ? "🎉 You win!" : "🤖 Computer wins!"); setGameStatusColor(humanWon ? "#28a745" : "#dc3545");
        if (!hasAnnouncedResult.current) { hasAnnouncedResult.current = true; humanWon ? toast.success("🎉 Checkmate! You win!") : toast.error("🤖 Computer wins! Better luck next time."); }
      }
    } else if (info.inCheck) { setGameStatus("⚠️ Check!"); setGameStatusColor("#dc3545"); }
    else { setGameStatus("In Progress"); setGameStatusColor("#28a745"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameConfig, toast]);

  function getStockfishMove(fen, depth) {
    return new Promise((resolve) => {
      if (!stockfishRef.current || !stockfishReady.current) { resolve(null); return; }
      stockfishMoveResolveRef.current = resolve;
      stockfishRef.current.postMessage(`position fen ${fen}`);
      stockfishRef.current.postMessage(`go depth ${depth}`);
    });
  }

  const triggerAIMove = useCallback(async () => {
    if (isAIMoving.current) return;
    isAIMoving.current = true; setIsThinking(true);
    const chess = chessRef.current;
    const diff = DIFFICULTY[gameConfig.difficulty];
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
    let move = null;
    try {
      if (diff.useStockfish) {
        const sfMove = await Promise.race([getStockfishMove(chess.fen(), diff.depth), new Promise((r) => setTimeout(() => r(null), 5000))]);
        if (sfMove) { const from = sfMove.slice(0, 2); const to = sfMove.slice(2, 4); const promotion = sfMove.length > 4 ? sfMove[4] : undefined; move = promotion ? { from, to, promotion } : { from, to }; }
        else { move = getBestMoveMinimax(chess, 4); }
      } else if (diff.depth === 0) { move = getRandomMove(chess); }
      else { move = getBestMoveMinimax(chess, diff.depth); }
      if (move) { const result = chess.move(move); if (result) { setLastMove({ from: result.from, to: result.to }); refreshUI(); updateStatus(chess); } }
    } catch (err) { console.error("AI move error:", err); }
    finally { setIsThinking(false); isAIMoving.current = false; }
  }, [gameConfig, refreshUI, updateStatus]);

  useEffect(() => {
    if (!gameConfig || isGameOver) return;
    const chess = chessRef.current;
    const isAITurn = (chess.turn() === "w" && gameConfig.side === "black") || (chess.turn() === "b" && gameConfig.side === "white");
    if (isAITurn && !isAIMoving.current) triggerAIMove();
  }, [board, gameConfig, isGameOver, triggerAIMove]);

  useEffect(() => {
    if (gameConfig) {
      chessRef.current = new Chess(); setBoard(chessRef.current.board()); setIsGameOver(false);
      setGameStatus("In Progress"); setGameStatusColor("#28a745"); setTurnDisplay("White to move");
      setLastMove(null); hasAnnouncedResult.current = false; isAIMoving.current = false;
    }
  }, [gameConfig]);

  function buildMoveObj(fromSq, toSq) {
    const chess = chessRef.current; const piece = chess.get(fromSq); const obj = { from: fromSq, to: toSq };
    if (piece?.type === "p") { const rank = toSq[1]; if ((piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1")) obj.promotion = "q"; }
    return obj;
  }

  function makePlayerMove(moveObj) {
    if (isGameOver || isThinking || isAIMoving.current) return;
    const chess = chessRef.current; const playerColor = gameConfig.side === "white" ? "w" : "b";
    if (chess.turn() !== playerColor) { toast.warning("It is not your turn!"); return; }
    const testChess = new Chess(chess.fen()); const result = testChess.move(moveObj);
    if (!result) { toast.warning("Invalid move"); return; }
    chess.move(moveObj); setLastMove({ from: result.from, to: result.to });
    setSelectedSquare(null); setHighlightedMoves([]); refreshUI(); updateStatus(chess);
  }

  function handleSquareClick(row, col, piece) {
    if (isGameOver || isThinking) return;
    const chess = chessRef.current; const playerColor = gameConfig.side === "white" ? "w" : "b";
    if (selectedSquare) {
      if (selectedSquare.row === row && selectedSquare.col === col) { setSelectedSquare(null); setHighlightedMoves([]); return; }
      if (piece && piece.color === playerColor) {
        const sq = `${String.fromCharCode(97 + col)}${8 - row}`;
        const moves = chess.moves({ square: sq, verbose: true });
        if (moves.length > 0) { setSelectedSquare({ row, col }); setHighlightedMoves(moves.map((m) => ({ row: 8 - parseInt(m.to[1]), col: m.to.charCodeAt(0) - 97 }))); return; }
      }
      const fromSq = `${String.fromCharCode(97 + selectedSquare.col)}${8 - selectedSquare.row}`;
      const toSq = `${String.fromCharCode(97 + col)}${8 - row}`;
      makePlayerMove(buildMoveObj(fromSq, toSq)); setSelectedSquare(null); setHighlightedMoves([]); return;
    }
    if (piece && piece.color === playerColor && chess.turn() === playerColor) {
      const sq = `${String.fromCharCode(97 + col)}${8 - row}`;
      const moves = chess.moves({ square: sq, verbose: true });
      if (moves.length === 0) { toast.info("No legal moves for this piece"); return; }
      setSelectedSquare({ row, col }); setHighlightedMoves(moves.map((m) => ({ row: 8 - parseInt(m.to[1]), col: m.to.charCodeAt(0) - 97 })));
    }
  }

  function handleDragStart(e, row, col) {
    if (isGameOver || isThinking) { e.preventDefault(); return; }
    dragState.current = { piece: true, source: { row, col } }; e.dataTransfer.effectAllowed = "move";
    setSelectedSquare(null); setHighlightedMoves([]);
  }
  function handleDrop(e, targetRow, targetCol) {
    e.preventDefault(); const source = dragState.current.source; if (!source) return;
    makePlayerMove(buildMoveObj(`${String.fromCharCode(97 + source.col)}${8 - source.row}`, `${String.fromCharCode(97 + targetCol)}${8 - targetRow}`));
    dragState.current = { piece: null, source: null };
  }
  function handleTouchStart(e, row, col) { if (isGameOver || isThinking) return; e.preventDefault(); dragState.current = { piece: true, source: { row, col } }; }
  function handleTouchEnd(e, sourceRow, sourceCol) {
    e.preventDefault(); const touch = e.changedTouches[0]; const el = document.elementFromPoint(touch.clientX, touch.clientY);
    let target = el; while (target && !target.dataset.row) target = target.parentElement;
    if (target?.dataset.row != null) { const tr = parseInt(target.dataset.row); const tc = parseInt(target.dataset.col); if (tr !== sourceRow || tc !== sourceCol) makePlayerMove(buildMoveObj(`${String.fromCharCode(97 + sourceCol)}${8 - sourceRow}`, `${String.fromCharCode(97 + tc)}${8 - tr}`)); }
    dragState.current = { piece: null, source: null };
  }

  function getPieceUnicode(type, color) {
    const m = { p: color === "w" ? "♙" : "♟", r: color === "w" ? "♖" : "♜", n: color === "w" ? "♘" : "♞", b: color === "w" ? "♗" : "♝", q: color === "w" ? "♕" : "♛", k: color === "w" ? "♔" : "♚" };
    return m[type] || "";
  }

  function isHighlighted(row, col) { return highlightedMoves.some((m) => m.row === row && m.col === col); }
  function isLastMoveSqFn(squareName) { return lastMove && (squareName === lastMove.from || squareName === lastMove.to); }

  function resetGame() { clearInterval(timerIntervalRef.current); setGameConfig(null); setTimerDisplay("00:00"); gameStartTimeRef.current = null; isAIMoving.current = false; }

  if (loading || !user) return <div className={styles.loadingContainer}><h1>♔ Loading... ♛</h1></div>;
  if (!gameConfig) return <><SetupScreen onStart={setGameConfig} /><Footer /></>;

  const playerColor = gameConfig.side;
  const isBlackPlayer = playerColor === "black";
  const diffCfg = DIFFICULTY[gameConfig.difficulty];

  return (
    <main>
      <div className={styles.gameHeader}>
        <Logo size="sm" linkToLobby={true} />
        <div className={styles.gameControls}>
          <button onClick={toggleTheme} className={styles.themeBtn}>{theme === "dark" ? "☀️" : "🌙"}</button>
          <button onClick={resetGame} className={styles.controlBtn}>🔄 New Game</button>
          <button onClick={() => router.push("/lobby")} className={styles.controlBtn}>← Lobby</button>
          <span className={styles.userDisplay}>{user.displayName || user.email}</span>
        </div>
      </div>
      <div className={styles.gameContainer}>
        <div className={styles.gameSidebar}>
          <div className={`${styles.playerCard} ${styles.opponent}`}>
            <div className={styles.playerAvatar}>{diffCfg.emoji}</div>
            <div className={styles.playerNameText}>Computer ({diffCfg.label})</div>
            <div className={styles.playerStatusText}>{isThinking ? <span className={aiStyles.thinkingBadge}>🤔 Thinking…</span> : diffCfg.description}</div>
          </div>
          <div className={styles.gameInfo}>
            <div className={styles.turnIndicator}>{turnDisplay}</div>
            <div className={styles.gameTimer}>{timerDisplay}</div>
            <div className={styles.gameStatusDisplay}><span style={{ color: gameStatusColor }}>{gameStatus}</span></div>
            {isGameOver && <button className={aiStyles.rematchBtn} onClick={resetGame}>♟ Play Again</button>}
          </div>
          <div className={`${styles.playerCard} ${styles.current}`}>
            <div className={styles.playerAvatar}>{playerColor === "white" ? "♔" : "♚"}</div>
            <div className={styles.playerNameText}>{user.displayName || user.email}</div>
            <div className={styles.playerRole}>Playing as {playerColor}</div>
          </div>
        </div>
        <div className={styles.boardContainer}>
          <div className={`${styles.chessboard} ${isThinking ? aiStyles.boardThinking : ""}`}>
            {Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => {
              const actualRow = isBlackPlayer ? 7 - row : row;
              const actualCol = isBlackPlayer ? 7 - col : col;
              const piece = board[actualRow]?.[actualCol];
              const isLight = (actualRow + actualCol) % 2 === 0;
              const squareName = `${String.fromCharCode(97 + actualCol)}${8 - actualRow}`;
              const isSelected = selectedSquare?.row === actualRow && selectedSquare?.col === actualCol;
              const isPossibleMove = isHighlighted(actualRow, actualCol);
              const isLast = isLastMoveSqFn(squareName);
              const playerColorCode = playerColor === "white" ? "w" : "b";
              const isPlayerPiece = piece && piece.color === playerColorCode;
              const isDraggable = isPlayerPiece && !isGameOver && !isThinking;
              return (
                <div key={`${row}-${col}`}
                  className={`${styles.square} ${isLight ? styles.light : styles.dark} ${isSelected ? styles.selected : ""} ${isPossibleMove ? styles.possibleMove : ""} ${isLast ? aiStyles.lastMove : ""}`}
                  data-row={actualRow} data-col={actualCol}
                  onClick={() => handleSquareClick(actualRow, actualCol, piece)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, actualRow, actualCol)}>
                  {piece && (
                    <div className={`${styles.piece} ${piece.color === "w" ? styles.whitePiece : styles.blackPiece}`}
                      draggable={isDraggable}
                      onDragStart={(e) => isDraggable ? handleDragStart(e, actualRow, actualCol) : e.preventDefault()}
                      onTouchStart={(e) => isDraggable && handleTouchStart(e, actualRow, actualCol)}
                      onTouchEnd={(e) => isDraggable && handleTouchEnd(e, actualRow, actualCol)}
                      style={{ cursor: isDraggable ? "grab" : "default" }}>
                      {getPieceUnicode(piece.type, piece.color)}
                    </div>
                  )}
                </div>
              );
            }))}
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
