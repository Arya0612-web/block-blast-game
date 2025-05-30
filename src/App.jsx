import { useState } from "react";
import GameBoard from "./components/GameBoard";

const App = () => {
  const [board, setBoard] = useState(Array(100).fill(0)); // 10x10 grid

  return (
    <div className="flex flex-col items-center gap-4 mt-10 text-white">
      <h1 className="text-2xl font-bold">Block Blast Clone</h1>
      <GameBoard board={board} />
    </div>
  );
};

export default App;
