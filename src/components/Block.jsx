import React, { useState } from "react";

const COLORS = [
  "bg-red-500",
  "bg-yellow-400",
  "bg-green-500",
  "bg-blue-500", 
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
];

function Block({ shape, onDragStart, isSmall = false }) {
  const [isDragging, setIsDragging] = useState(false);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const cellSize = isSmall ? "w-5 h-5" : "w-10 h-10";

  const handleDragStart = (e) => {
    setIsDragging(true);
    onDragStart(e, shape);
    e.dataTransfer.setDragImage(new Image(), 0, 0); // Hide default drag image
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDragging(false)}
      className={`cursor-grab active:cursor-grabbing transition-transform duration-200 ${
        isDragging ? "transform scale-200" : "" // Membesar 125% saat di-drag
      } ${isSmall ? "scale-100" : ""}`} // Kecil (75%) saat di area pilihan
    >
      <div className="flex flex-col gap-0.5">
        {shape.map((row, i) => (
          <div key={i} className="flex gap-0.5">
            {row.map((cell, j) => (
              <div
                key={j}
                className={`${cellSize} rounded ${cell ? `${color} shadow-inner` : 'bg-transparent'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Block;