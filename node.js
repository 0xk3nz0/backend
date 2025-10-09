import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:3000/ws/game");

ws.on("open", () => {
  console.log("Connected!");
  ws.send(JSON.stringify({ type: "ping" }));
});

ws.on("message", (msg) => {
  console.log("Received:", msg.toString());
});

ws.on("error", (err) => console.error("Error:", err));

