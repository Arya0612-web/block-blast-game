import React from "react";

const COLORS = [
  "bg-red-500",
  "bg-yellow-400",
  "bg-green-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
];

function Block({ shape, onDragStart }) {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, shape)}
      className="cursor-move p-1 bg-gray-100 rounded-md"
    >
      {shape.map((row, i) => (
        <div key={i} className="flex gap-1">
          {row.map((cell, j) => (
            <div
              key={j}
              className={`w-10 h-10 rounded-md ${
                cell ? color : "bg-transparent"
              }`}
            ></div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default Block;
