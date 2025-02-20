import WebSocket from "ws";
import readline from "readline"; // ✅ Allows user input

const ws = new WebSocket("ws://localhost:3000");

ws.on("open", () => {
  console.log("✅ Connected to chatbot!");
  askQuestion();
});

ws.on("message", (data) => {
  console.log("🤖 Assistant:", data.toString());
  askQuestion(); // Ask again after receiving a response
});

ws.on("close", () => {
  console.log("❌ Disconnected from chatbot");
});

// ✅ Function to handle user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion() {
  rl.question("👤 You: ", (message) => {
    if (message.toLowerCase() === "exit") {
      ws.close(); // Close WebSocket on exit
      rl.close();
    } else {
      ws.send(message); // Send message to AI
    }
  });
}
