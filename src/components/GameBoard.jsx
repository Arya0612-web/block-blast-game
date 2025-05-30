import React, { useState, useEffect } from "react";
import Block from "./Block";
import { blockShapes } from "../utils/blockShapes";

const BOARD_SIZE = 10;

function GameBoard() {
  const [board, setBoard] = useState(
    Array(BOARD_SIZE)
      .fill(0)
      .map(() => Array(BOARD_SIZE).fill(0))
  );
  const [score, setScore] = useState(0);
  const [highlighted, setHighlighted] = useState([]);

  const placeSound = new Audio("/sounds/place.mp3");
  const clearSound = new Audio("/sounds/clear.mp3");

  const canPlaceBlock = (shape, row, col) => {
    for (let i = 0; i < shape.length; i++) {
      for (let j = 0; j < shape[i].length; j++) {
        if (shape[i][j]) {
          const y = row + i;
          const x = col + j;
          if (
            y >= BOARD_SIZE ||
            x >= BOARD_SIZE ||
            board[y][x] !== 0
          ) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const clearFullLines = async (board) => {
    const newBoard = board.map((row) => [...row]);
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

    // Tandai baris/kolom yang akan dihapus
    const toHighlight = [];
    fullRows.forEach((y) => {
      for (let x = 0; x < BOARD_SIZE; x++) toHighlight.push([y, x]);
    });
    fullCols.forEach((x) => {
      for (let y = 0; y < BOARD_SIZE; y++) toHighlight.push([y, x]);
    });

    setHighlighted(toHighlight);

    // Tunggu sejenak sebelum menghapus (untuk efek warna)
    await new Promise((r) => setTimeout(r, 300));

    // Bersihkan
    toHighlight.forEach(([y, x]) => (newBoard[y][x] = 0));
    setHighlighted([]);
    clearSound.play();
    setScore((prev) => prev + toHighlight.length);
    return newBoard;
  };

  const handleDrop = async (e, row, col) => {
    const shape = JSON.parse(e.dataTransfer.getData("block"));
    if (!canPlaceBlock(shape, row, col)) {
      alert("Tidak bisa menaruh block di sini!");
      return;
    }

    const newBoard = board.map((r) => [...r]);
    const color = getRandomColor();

    for (let i = 0; i < shape.length; i++) {
      for (let j = 0; j < shape[i].length; j++) {
        if (shape[i][j]) {
          newBoard[row + i][col + j] = color;
        }
      }
    }

    placeSound.play();
    const cleared = await clearFullLines(newBoard);
    setBoard(cleared);
  };

  const handleDragStart = (e, shape) => {
    e.dataTransfer.setData("block", JSON.stringify(shape));
  };

  const getRandomColor = () => {
    const COLORS = [
      "bg-red-500",
      "bg-yellow-400",
      "bg-green-500",
      "bg-blue-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-orange-500",
    ];
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-white text-xl font-bold mb-4">Skor: {score}</div>

      <div className="grid grid-cols-10 gap-1 p-4 bg-gray-300 rounded-md shadow-lg">
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
                className={`w-10 h-10 border border-gray-400 rounded-md transition-all duration-200
                  ${cell && isHighlighted ? "bg-white animate-glow animate-shake" :
                  cell ? `${cell} animate-appear` :
                  "bg-white"}
                `}
              />

            );
          })
        )}
      </div>

      <div className="flex gap-4 mt-4 flex-wrap justify-center">
        {blockShapes.map((shape, idx) => (
          <Block key={idx} shape={shape} onDragStart={handleDragStart} />
        ))}
      </div>
    </div>
  );
}

export default GameBoard;
