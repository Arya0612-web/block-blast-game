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

function Block({ shape, color, onDragStart, onDragEnd, isSmall = false, isDragging: externalDragging }) {
  const [internalDragging, setInternalDragging] = useState(false);
  const isDragging = externalDragging !== undefined ? externalDragging : internalDragging;
  
  // Ukuran cell yang konsisten untuk semua block
  const cellSize = "w-10 h-10"; // Ukuran tetap 10x10 untuk semua

  const handleDragStart = (e) => {
    setInternalDragging(true);
    onDragStart(e);
    
    // Buat elemen preview custom yang lebih besar
    
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}   
      className={`cursor-grab active:cursor-grabbing transition-transform ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex flex-col" style={{ gap: "0px" }}> {/* Hilangkan gap */}
        {shape.map((row, i) => (
          <div key={i} className="flex" style={{ gap: "0px" }}> {/* Hilangkan gap */}
            {row.map((cell, j) => (
              <div
                key={j}
                className={`${cellSize} ${cell ? `${color} shadow-inner border border-white/10` : 'bg-transparent'}`}
                style={{
                  // Tidak ada margin/gap
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Block;