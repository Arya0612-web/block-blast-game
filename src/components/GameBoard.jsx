import React, { useState, useRef, useEffect } from "react";
import Block from "./Block";
import { blockShapes } from "../utils/blockShapes";

const BOARD_SIZE = 8;

// Fungsi generate blockChoices di luar komponen agar tidak dibuat ulang setiap render
function generateBlockChoices() {
  const shuffled = [...blockShapes].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

const COLORS = [
  "bg-red-500",
  "bg-yellow-400",
  "bg-green-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
];

function GameBoard() {
  const [board, setBoard] = useState(
    Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0))
  );
  const [score, setScore] = useState(0);
  const [highlighted, setHighlighted] = useState([]);
  const [blockChoices, setBlockChoices] = useState(generateBlockChoices());
  const [isGameOver, setIsGameOver] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem("highScore") || "0");
  });
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  const placeSound = useRef(new Audio("/sounds/stone.mp3"));
  const clearSound = useRef(new Audio("/sounds/finish.mp3"));

  // Fungsi memilih warna random untuk block yang ditempatkan
  const getRandomColor = () => {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  };

  // Cek apakah block bisa ditempatkan di posisi (row, col)
  const canPlaceBlock = (shape, row, col, customBoard = board) => {
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
  };

  // Cek apakah ada minimal satu move valid di board dengan block choices yang diberikan
  const hasValidMove = (blocks, boardToCheck) => {
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
  };

  // Clear row dan kolom penuh, update score, combo, dan highlight animasi
  const clearFullLines = async (currentBoard) => {
    const newBoard = currentBoard.map((row) => [...row]);
    let fullRows = [];
    let fullCols = [];

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
        clearSound.current.play();
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
  };

  // Handler saat drop block di papan
  const handleDrop = async (e, row, col) => {
    if (isGameOver) return;

    const blockData = e.dataTransfer.getData("block");
    if (!blockData) return;
    const block = JSON.parse(blockData);
    const shape = block.shape;

    if (!canPlaceBlock(shape, row, col)) return;

    // Tempatkan block di board baru
    const newBoard = board.map((r) => [...r]);
    const color = getRandomColor();

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
      placeSound.current.play();
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
  };

  // Di dalam handleDragStart:
  const handleDragStart = (e, shape) => {
    const block = blockChoices.find((b) => 
      JSON.stringify(b.shape) === JSON.stringify(shape)
    );
    if (block) {
      e.dataTransfer.setData("block", JSON.stringify({ id: block.id, shape: block.shape }));
      
      // Buat elemen preview custom
      const dragPreview = document.createElement("div");
      dragPreview.className = "fixed pointer-events-none opacity-80";
      
      // Render block dalam ukuran besar
      shape.forEach((row, i) => {
        row.forEach((cell, j) => {
          if (cell) {
            const blockCell = document.createElement("div");
            blockCell.className = `absolute w-10 h-10 bg-${color.split('-')[1]}-500 rounded shadow-inner`;
            blockCell.style.left = `${j * 40}px`;
            blockCell.style.top = `${i * 40}px`;
            dragPreview.appendChild(blockCell);
          }
        });
      });
      
      document.body.appendChild(dragPreview);
      e.dataTransfer.setDragImage(dragPreview, 0, 0);
      
      setTimeout(() => document.body.removeChild(dragPreview), 0);
    }
  };

  // Restart game
  const restartGame = () => {
    setBoard(Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)));
    setScore(0);
    setBlockChoices(generateBlockChoices());
    setHighlighted([]);
    setIsGameOver(false);
    setCombo(0);
    setMaxCombo(0);
  };

  // Update high score di localStorage saat game over dan score lebih tinggi
  useEffect(() => {
    if (isGameOver && score > highScore) {
      setHighScore(score);
      localStorage.setItem("highScore", score.toString());
    }
  }, [isGameOver, score, highScore]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-purple-900 flex flex-col items-center justify-center p-4 relative">
      <div className="w-full max-w-2xl bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl p-6 backdrop-blur-sm">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              BLOCK BLAST
            </h1>
          </div>

          <div className="flex gap-4">
            <div className="bg-gray-700 rounded-lg p-3 text-center min-w-24">
              <div className="text-gray-300 text-sm font-medium">SCORE</div>
              <div className="text-2xl font-bold text-white">{score}</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-3 text-center min-w-24">
              <div className="text-gray-300 text-sm font-medium">HIGH SCORE</div>
              <div className="text-2xl font-bold text-yellow-400">{highScore}</div>
            </div>
          </div>
        </div>

        {/* Game Over Modal */}
        {isGameOver && (
          <div className="fixed inset-0 flex items-center justify-center z-10 bg-black bg-opacity-70">
            <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center animate-pop-in">
              <h2 className="text-3xl font-bold text-red-500 mb-4">GAME OVER!</h2>
              <div className="text-white mb-6 space-y-2">
                <p className="text-xl">
                  Final Score: <span className="font-bold">{score}</span>
                </p>
                <p>
                  Max Combo: <span className="font-bold text-yellow-400">{maxCombo}x</span>
                </p>
              </div>
              <button
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-full hover:opacity-90 transition-all transform hover:scale-105 shadow-lg"
                onClick={restartGame}
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}

        {/* Combo Indicator */}
        {combo > 0 && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 animate-bounce pointer-events-none">
            <div className="text-yellow-400 text-2xl font-bold select-none">
              COMBO {combo}x!
            </div>
          </div>
        )}

        {/* Game Board */}
        <div className="grid grid-cols-8 gap-1.5 p-4 bg-gray-900 rounded-lg mb-6 border-2 border-gray-700">
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
                className={`w-10 h-10 rounded transition-all duration-200 flex items-center justify-center
                  ${cell && isHighlighted ? "bg-white animate-pulse scale-110" :
                  cell ? `${cell} shadow-inner` :
                  "bg-gray-800 hover:bg-gray-700"}`}
              >
                {cell && !isHighlighted && (
                  <div className="w-6 h-6 rounded-full bg-white bg-opacity-20"></div>
                )}
              </div>
              );
            })
          )}
        </div>

        {/* Block Choices */}
        <div className="bg-gray-800/80 rounded-xl p-4 border-2 border-gray-700 shadow-lg">
          <h3 className="text-white font-medium mb-3 text-center text-sm">BLOCK PILIHAN</h3>
          <div className="flex gap-4 justify-center items-center p-2 bg-gray-900/50 rounded-lg">
            {blockChoices.map((block, idx) => (
              <div 
                key={idx}
                className="p-1 hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <Block 
                  shape={block.shape}
                  onDragStart={handleDragStart}
                  isSmall={true}
                />
              </div>
            ))}
          </div>
        </div>


        {/* Footer */}
        <div className="mt-6 text-center text-gray-400 text-sm select-none">
          <p>Drag and drop blocks to fill rows or columns</p>
        </div>
      </div>
    </div>
  );
}

export default GameBoard;
