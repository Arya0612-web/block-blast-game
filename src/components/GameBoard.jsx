import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Block from "./Block";
import { blockShapes } from "../utils/blockShapes";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { updateHighScore, subscribeLeaderboard } from "../authService";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import confetti from "canvas-confetti";

const BOARD_SIZE = 8;
const LEADERBOARD_LIMIT = 10;

// Fungsi generate blockChoices di luar komponen agar tidak dibuat ulang setiap render
const generateBlockChoices = () => {
  const shuffled = [...blockShapes].sort(() => Math.random() - 0.5);

  return shuffled.slice(0, 3).map((block, index) => ({
    ...block,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]
  }));
};

const COLORS = [
  "bg-red-500",
  "bg-yellow-400",
  "bg-green-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
];

const RANK_COLORS = {
  1: "from-yellow-400 to-yellow-600 border-yellow-300",
  2: "from-gray-300 to-gray-500 border-gray-200",
  3: "from-amber-600 to-amber-800 border-amber-500",
};

const RANK_ICONS = {
  1: "👑",
  2: "🥈",
  3: "🥉",
};

function GameBoard() {
  // State utama
  const [board, setBoard] = useState(
    Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0))
  );
  const [score, setScore] = useState(0);
  const [highlighted, setHighlighted] = useState([]);
  const [blockChoices, setBlockChoices] = useState(generateBlockChoices());
  const [isGameOver, setIsGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [draggedBlockId, setDraggedBlockId] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // State user & leaderboard
  const [user, setUser] = useState(null);
  const [highScore, setHighScore] = useState(0);
  const [username, setUsername] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardType, setLeaderboardType] = useState("global"); // "global" or "weekly"
  const [prevRank, setPrevRank] = useState(null);
  const [currentRank, setCurrentRank] = useState(null);
  const [showRankUp, setShowRankUp] = useState(false);
  const [rankUpMessage, setRankUpMessage] = useState("");
  
  // Sound refs
  const placeSound = useRef(new Audio("/sounds/stone.mp3"));
  const clearSound = useRef(new Audio("/sounds/finish.mp3"));
  const rankUpSound = useRef(new Audio("/sounds/rankup.mp3"));
  
  // Confetti trigger untuk rank 1
  const [showFireGlow, setShowFireGlow] = useState(false);

  // Track mouse position untuk drag preview
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Fungsi memilih warna random untuk block yang ditempatkan
  const getRandomColor = useCallback(() => {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }, []);

  // Cek apakah block bisa ditempatkan di posisi (row, col)
  const canPlaceBlock = useCallback((shape, row, col, customBoard = board) => {
    for (let i = 0; i < shape.length; i++) {
      for (let j = 0; j < shape[i].length; j++) {
        if (shape[i][j]) {
          const y = row + i;
          const x = col + j;
          if (
            y >= BOARD_SIZE ||
            x >= BOARD_SIZE ||
            customBoard[y][x] !== 0
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }, [board]);

  // Cek apakah ada minimal satu move valid di board dengan block choices yang diberikan
  const hasValidMove = useCallback((blocks, boardToCheck) => {
    for (const block of blocks) {
      const shape = block.shape;
      for (let row = 0; row <= BOARD_SIZE - shape.length; row++) {
        for (let col = 0; col <= BOARD_SIZE - shape[0].length; col++) {
          if (canPlaceBlock(shape, row, col, boardToCheck)) {
            return true;
          }
        }
      }
    }
    return false;
  }, [canPlaceBlock]);

  // Clear row dan kolom penuh
  const clearFullLines = useCallback(async (currentBoard) => {
    const newBoard = currentBoard.map((row) => [...row]);
    const fullRows = [];
    const fullCols = [];

    // Cari baris penuh
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (newBoard[y].every((cell) => cell !== 0)) fullRows.push(y);
    }

    // Cari kolom penuh
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (newBoard.every((row) => row[x] !== 0)) fullCols.push(x);
    }

    // Kumpulkan sel yang perlu dihighlight
    const toHighlight = [];
    fullRows.forEach((y) => {
      for (let x = 0; x < BOARD_SIZE; x++) toHighlight.push([y, x]);
    });
    fullCols.forEach((x) => {
      for (let y = 0; y < BOARD_SIZE; y++) toHighlight.push([y, x]);
    });

    setHighlighted(toHighlight);

    if (toHighlight.length > 0) {
      // Tunggu animasi highlight
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Clear cell penuh
      const clearedBoard = newBoard.map((row) => [...row]);
      toHighlight.forEach(([y, x]) => (clearedBoard[y][x] = 0));

      setHighlighted([]);
      if (clearSound.current) {
        clearSound.current.currentTime = 0;
        clearSound.current.play().catch(() => {});
      }

      const pointsEarned = toHighlight.length;
      setScore((prev) => prev + pointsEarned);

      if (pointsEarned > 0) {
        setCombo((prev) => {
          const newCombo = prev + 1;
          if (newCombo > maxCombo) {
            setMaxCombo(newCombo);
          }
          return newCombo;
        });
      }

      return clearedBoard;
    } else {
      setCombo(0);
      return newBoard;
    }
  }, [maxCombo]);

  // Handler saat drop block di papan
  const handleDrop = useCallback(async (e, row, col) => {
    if (isGameOver) return;

    const blockData = e.dataTransfer.getData("block");
    if (!blockData) return;
    const block = JSON.parse(blockData);
    const shape = block.shape;
    

    if (!canPlaceBlock(shape, row, col)) return;

    // Tempatkan block di board baru
    const newBoard = board.map((r) => [...r]);
    const color = block.color;

    for (let i = 0; i < shape.length; i++) {
      for (let j = 0; j < shape[i].length; j++) {
        if (shape[i][j]) {
          newBoard[row + i][col + j] = color;
        }
      }
    }

    // Play place sound
    if (placeSound.current) {
      placeSound.current.currentTime = 0;
      placeSound.current.play().catch(() => {});
    }

    // Clear lines jika ada
    const clearedBoard = await clearFullLines(newBoard);
    setBoard(clearedBoard);

    // Update blockChoices
    const newChoices = blockChoices.filter((b) => b.id !== block.id);
    const remainingBlocks = newChoices.length === 0 ? generateBlockChoices() : newChoices;

    // Cek game over
    if (!hasValidMove(remainingBlocks, clearedBoard)) {
      setIsGameOver(true);
    } else {
      setBlockChoices(remainingBlocks);
    }
    
    setDraggedBlockId(null);
  }, [isGameOver, board, blockChoices, canPlaceBlock, getRandomColor, clearFullLines, hasValidMove]);

  // Handler drag start
  const handleDragStart = useCallback((e, shape, blockId) => {
    const block = blockChoices.find((b) => b.id === blockId);
    if (block) {
      setDraggedBlockId(blockId);
      e.dataTransfer.setData("block", JSON.stringify({ id: block.id, shape: block.shape, color: block.color }));
      e.dataTransfer.effectAllowed = "move";
      
      // Buat elemen preview custom
      const dragPreview = document.createElement("div");
      dragPreview.className = "fixed pointer-events-none opacity-90";
      dragPreview.style.transform = "scale(1)";
      
      // Render block preview dengan warna random
      const color = block.color;
      shape.forEach((row, i) => {
        row.forEach((cell, j) => {
          if (cell) {
            const blockCell = document.createElement("div");
            blockCell.className = `absolute w-10 h-10 ${color} rounded shadow-inner border border-white/20`;
            blockCell.style.left = `${j * 40}px`;
            blockCell.style.top = `${i * 40}px`;
            dragPreview.appendChild(blockCell);
          }
        });
      });
      
      document.body.appendChild(dragPreview);
      e.dataTransfer.setDragImage(dragPreview, 20, 20);
      
      setTimeout(() => {
        document.body.removeChild(dragPreview);
      }, 0);
    }
  }, [blockChoices]);

  // Restart game
  const restartGame = useCallback(() => {
    setBoard(Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)));
    setScore(0);
    setBlockChoices(generateBlockChoices());
    setHighlighted([]);
    setIsGameOver(false);
    setCombo(0);
    setMaxCombo(0);
    setDraggedBlockId(null);
  }, []);

  // Fungsi trigger confetti
  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ffd700', '#ffa500', '#ff4500']
    });
    
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#00ff00', '#00ffff', '#ff00ff']
    });
    
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#ff0000', '#ffff00', '#ff8c00']
    });
  }, []);

  // Efek untuk rank changes
  useEffect(() => {
    if (prevRank !== null && currentRank !== null) {
      if (currentRank < prevRank) {
        // Rank naik (angka lebih kecil = rank lebih bagus)
        const rankDiff = prevRank - currentRank;
        setRankUpMessage(`🎉 You moved up ${rankDiff} rank${rankDiff > 1 ? 's' : ''}!`);
        setShowRankUp(true);
        
        if (rankUpSound.current) {
          rankUpSound.current.currentTime = 0;
          rankUpSound.current.play().catch(() => {});
        }
        
        setTimeout(() => setShowRankUp(false), 3000);
      }
      
      // Jika jadi rank 1, trigger fire glow dan confetti
      if (currentRank === 1) {
        setShowFireGlow(true);
        triggerConfetti();
        
        // Fire glow animation selama 3 detik
        setTimeout(() => setShowFireGlow(false), 3000);
      }
    }
  }, [currentRank, prevRank, triggerConfetti]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        if (snap.exists()) {
          setHighScore(snap.data().highScore || 0);
          setUsername(snap.data().username || "Player");
        }
      } else {
        setUser(null);
        setUsername("");
      }
    });

    return () => unsubscribe();
  }, []);

  // Leaderboard subscription
  useEffect(() => {
    const unsubscribe = subscribeLeaderboard(
      (data) => {
        setLeaderboard(data);
        
        // Cari rank user saat ini
        if (user) {
          const userIndex = data.findIndex(entry => entry.userId === user.uid);
          setPrevRank(currentRank);
          setCurrentRank(userIndex !== -1 ? userIndex + 1 : null);
        }
      },
      leaderboardType
    );
    
    return () => unsubscribe();
  }, [user, leaderboardType, currentRank]);

  // Update high score saat game over
  useEffect(() => {
    if (isGameOver && user && score > highScore) {
      setHighScore(score);
      updateHighScore(user.uid, score);
    }
  }, [isGameOver, user, score, highScore]);

  // Cari data user di leaderboard
  const userLeaderboardEntry = useMemo(() => {
    return leaderboard.find(entry => entry.userId === user?.uid);
  }, [leaderboard, user]);

  const handleDragEnd = useCallback(() => {
    setDraggedBlockId(null);
  }, []);

  // Calculate cell size based on screen width
  const getCellSize = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) return 32; // Mobile
      if (window.innerWidth < 1024) return 36; // Tablet
      return 40; // Desktop
    }
    return 40;
  };

  const [cellSize, setCellSize] = useState(40);

  useEffect(() => {
    const handleResize = () => {
      setCellSize(getCellSize());
    };
    
    handleResize(); // Set initial value
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-purple-900">
      
      {/* Fire Glow Animation untuk Rank 1 */}
      {showFireGlow && (
        <div className="fixed inset-0 pointer-events-none z-20">
          <div className="absolute inset-0 bg-gradient-to-t from-orange-500/30 via-red-500/20 to-transparent animate-pulse"></div>
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-yellow-500/40 to-transparent animate-bounce"></div>
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute bottom-0 w-2 h-2 bg-orange-500 rounded-full animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Rank Up Notification */}
      {showRankUp && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-30 animate-bounce">
          <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white px-6 py-3 rounded-full shadow-lg font-bold text-lg whitespace-nowrap">
            {rankUpMessage}
          </div>
        </div>
      )}

      {/* Drag Preview - Block yang mengikuti mouse */}
      {draggedBlockId && (
        <div 
          className="fixed pointer-events-none z-50 opacity-80"
          style={{ 
            left: mousePosition.x - (cellSize * 0.5), 
            top: mousePosition.y - (cellSize * 0.5),
            transform: 'scale(0.8)'
          }}
        >
          {blockChoices.find(b => b.id === draggedBlockId) && (
            <Block 
              shape={blockChoices.find(b => b.id === draggedBlockId).shape}
              onDragStart={() => {}}
              isDragging={true}
              cellSize={cellSize}
            />
          )}
        </div>
      )}

      {/* Main Content Container - Responsive layout */}
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Desktop: Flex row, Mobile: Flex column */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start justify-center">
          
          {/* Game Board Section - Takes full width on mobile, fixed width on desktop */}
          <div className="w-full lg:w-auto bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl p-4 sm:p-6 backdrop-blur-sm mx-auto">
            {/* Header - Responsive layout */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                  BLOCK BLAST
                </h1>
              </div>

              <div className="text-gray-300 text-xs sm:text-sm font-semibold bg-gray-700 px-3 py-1 rounded-full order-first sm:order-none">
                {username ? `👤 ${username}` : "Guest"}
              </div>

              <div className="flex gap-2 sm:gap-4">
                <div className="bg-gray-700 rounded-lg p-2 sm:p-3 text-center min-w-[70px] sm:min-w-24">
                  <div className="text-gray-300 text-xs sm:text-sm font-medium">SCORE</div>
                  <div className="text-xl sm:text-2xl font-bold text-white">{score}</div>
                </div>

                <div className="bg-gray-700 rounded-lg p-2 sm:p-3 text-center min-w-[70px] sm:min-w-24">
                  <div className="text-gray-300 text-xs sm:text-sm font-medium">BEST</div>
                  <div className="text-xl sm:text-2xl font-bold text-yellow-400">{highScore}</div>
                </div>
              </div>
            </div>

            {/* Game Over Modal */}
            {isGameOver && (
              <div className="fixed inset-0 flex items-center justify-center z-40 bg-black bg-opacity-70 px-4">
                <div className="bg-gray-800 rounded-xl p-6 sm:p-8 max-w-md w-full text-center animate-pop-in">
                  <h2 className="text-2xl sm:text-3xl font-bold text-red-500 mb-4">GAME OVER!</h2>
                  <div className="text-white mb-6 space-y-2">
                    <p className="text-lg sm:text-xl">
                      Final Score: <span className="font-bold">{score}</span>
                    </p>
                    <p>
                      Max Combo: <span className="font-bold text-yellow-400">{maxCombo}x</span>
                    </p>
                    {userLeaderboardEntry && (
                      <p className="text-green-400">
                        Rank: #{userLeaderboardEntry.rank} {RANK_ICONS[userLeaderboardEntry.rank]}
                      </p>
                    )}
                  </div>
                  <button
                    className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-full hover:opacity-90 transition-all transform hover:scale-105 shadow-lg"
                    onClick={restartGame}
                  >
                    PLAY AGAIN
                  </button>
                </div>
              </div>
            )}

            {/* Combo Indicator */}
            {combo > 1 && (
              <div className="absolute top-20 left-1/2 transform -translate-x-1/2 animate-bounce pointer-events-none z-10">
                <div className="text-yellow-400 text-2xl sm:text-3xl font-bold select-none drop-shadow-lg whitespace-nowrap">
                  🔥 COMBO {combo}x!
                </div>
              </div>
            )}

            {/* Game Board - Responsive grid with dynamic cell size */}
            <div className="flex justify-center mb-4 sm:mb-6 overflow-x-auto">
              <div className="grid bg-gray-700 rounded-lg shadow-lg"
                style={{
                  gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
                  width: 'fit-content'
                }}>
                {board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => {
                    const isHighlighted = highlighted.some(
                      ([y, x]) => y === rowIndex && x === colIndex
                    );
                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                        className={`flex items-center justify-center
                          bg-gray-800
                          border border-gray-700
                          transition-all duration-150
                          ${cell ? cell : ""}
                        `}
                        style={{ width: cellSize, height: cellSize }}
                      >
                        {cell && !isHighlighted && (
                          <div className="w-1/2 h-1/2 rounded-full bg-white bg-opacity-20"></div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Block Choices */}
            <div className="bg-gray-800/80 rounded-xl p-3 sm:p-4 border-2 border-gray-700 shadow-lg mb-3 sm:mb-4">
              <h3 className="text-white font-medium mb-2 sm:mb-3 text-center text-xs sm:text-sm">BLOCK PILIHAN</h3>
              <div className="flex gap-2 sm:gap-4 justify-center items-center p-2 bg-gray-900/50 rounded-lg flex-wrap">
                {blockChoices.map((block, idx) => (
                  <div 
                    key={idx}
                    className={`relative transition-opacity ${
                      draggedBlockId === block.id ? 'opacity-0' : 'opacity-100'
                    }`}
                    onDragStart={(e) => handleDragStart(e, block.shape, block.id)}
                  >
                    <Block
                      shape={block.shape}
                      color={block.color}
                      onDragEnd={handleDragEnd}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => signOut(auth)}
                className="bg-red-500 hover:bg-red-600 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-white text-xs sm:text-sm font-semibold transition-all"
              >
                Logout
              </button>
              
              <div className="text-gray-400 text-xs sm:text-sm hidden sm:block">
                Drag blocks • Fill rows/columns
              </div>
            </div>
          </div>

          {/* Leaderboard Section - Full width on mobile, fixed width on desktop */}
          <div className="w-full lg:w-80 bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl p-4 sm:p-6 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                LEADERBOARD
              </h2>
              
              {/* Toggle Global/Weekly */}
              <div className="flex bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setLeaderboardType("global")}
                  className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    leaderboardType === "global" 
                      ? "bg-blue-500 text-white" 
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  Global
                </button>
                <button
                  onClick={() => setLeaderboardType("weekly")}
                  className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    leaderboardType === "weekly" 
                      ? "bg-blue-500 text-white" 
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Leaderboard List */}
            <div className="space-y-2 max-h-[300px] sm:max-h-96 overflow-y-auto custom-scrollbar">
              {leaderboard.slice(0, 10).map((entry, index) => {
                const isCurrentUser = entry.userId === user?.uid;
                const rank = index + 1;
                
                return (
                  <div
                    key={entry.userId}
                    className={`relative p-2 sm:p-3 rounded-lg transition-all transform hover:scale-105 ${
                      isCurrentUser ? "ring-2 ring-blue-400 bg-blue-500/20" : ""
                    } ${
                      rank <= 3 
                        ? `bg-gradient-to-r ${RANK_COLORS[rank]} bg-opacity-20 border` 
                        : "bg-gray-700/50"
                    }`}
                  >
                    {/* Fire glow untuk rank 1 */}
                    {rank === 1 && (
                      <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400/30 to-orange-500/30 rounded-lg blur animate-pulse"></div>
                    )}
                    
                    <div className="relative flex items-center gap-2 sm:gap-3">
                      {/* Rank with medal */}
                      <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8">
                        {rank <= 3 ? (
                          <span className="text-xl sm:text-2xl">{RANK_ICONS[rank]}</span>
                        ) : (
                          <span className="text-gray-400 font-bold text-sm sm:text-base">#{rank}</span>
                        )}
                      </div>
                      
                      {/* Username */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className={`font-semibold truncate text-sm sm:text-base ${
                            rank === 1 ? "text-yellow-300" :
                            rank === 2 ? "text-gray-300" :
                            rank === 3 ? "text-amber-600" :
                            "text-white"
                          }`}>
                            {entry.username || "Anonymous"}
                          </span>
                          {isCurrentUser && (
                            <span className="text-xs bg-blue-500 px-1.5 sm:px-2 py-0.5 rounded-full text-white whitespace-nowrap">
                              You
                            </span>
                          )}
                        </div>
                        
                        {/* Score */}
                        <div className="text-xs sm:text-sm text-gray-400">
                          Score: <span className="font-bold text-yellow-400">{entry.highScore}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {leaderboard.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  No data yet
                </div>
              )}
            </div>
            
            {/* Current player stats */}
            {user && userLeaderboardEntry && (
              <div className="mt-4 p-2 sm:p-3 bg-gray-700 rounded-lg">
                <div className="text-xs sm:text-sm text-gray-300">Your Position</div>
                <div className="flex items-center justify-between">
                  <span className="text-lg sm:text-xl font-bold text-white">
                    #{userLeaderboardEntry.rank}
                  </span>
                  <span className="text-yellow-400 font-bold text-sm sm:text-base">
                    {userLeaderboardEntry.highScore} pts
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.8);
        }
        
        @keyframes pop-in {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .animate-pop-in {
          animation: pop-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default GameBoard;