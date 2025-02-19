// ✅ Import Required Modules
import OpenAI from "openai";
import fs from "fs";
import { WebSocketServer } from "ws"; // 🔥 Fixed WebSocket import
import express from "express";
import * as dotenv from "dotenv";

// ✅ Load Environment Variables
dotenv.config();

// ✅ OpenAI API Setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Make sure API key is stored in .env
});

let assistantId = null; // Stores Assistant ID

// ✅ Create an Assistant
async function createAssistant() {
  const assistant = await openai.beta.assistants.create({
    name: "Real-Time AI Assistant",
    instructions: "You are a chatbot that answers user questions using vector store files.",
    model: "gpt-4o",
    tools: [{ type: "file_search" }],
  });

  console.log("✅ Assistant Created:", assistant.id);
  return assistant.id;
}

// ✅ Upload Files to Vector Store
async function uploadFiles() {
  const existingStores = await openai.beta.vectorStores.list();
  if (existingStores.data.length > 0) {
    console.log("🔍 Using Existing Vector Store:", existingStores.data[0].id);
    return existingStores.data[0].id;
  }

  let vectorStore = await openai.beta.vectorStores.create({ name: "Knowledge Base" });
  const fileStreams = ["vacciner.txt"].map((path) =>
    fs.createReadStream(path)
  );

  await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, fileStreams);
  console.log("✅ Vector Store Created:", vectorStore.id);
  return vectorStore.id;
}

// ✅ Attach Vector Store to Assistant
async function updateAssistant(assistantId, vectorStoreId) {
  await openai.beta.assistants.update(assistantId, {
    tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
  });

  console.log("✅ Assistant Updated to Use Vector Store");
}

// ✅ Run Setup Sequence (Assistant + Vector Store)
async function setup() {
  assistantId = await createAssistant();
  const vectorStoreId = await uploadFiles();
  await updateAssistant(assistantId, vectorStoreId);
  console.log("✅ Assistant & Vector Store Ready!");
}

setup();

// ✅ WebSocket Server Setup
const app = express();
const server = app.listen(3000, () => console.log("✅ Server running on port 3000"));
const wss = new WebSocketServer({ server }); // 🔥 Fixed WebSocket Constructor Issue

wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  ws.on("message", async (message) => {
    if (!assistantId) {
      ws.send("⚠️ Assistant is still being initialized. Please wait...");
      return;
    }

    const userQuestion = message.toString();
    console.log("User:", userQuestion);

    const threadId = await createThread(userQuestion);
    const response = await runAssistant(threadId, assistantId);

    ws.send(response);
  });

  ws.on("close", () => console.log("❌ Client disconnected"));
});

// ✅ Create a Thread for Messages
async function createThread(userQuestion) {
  const thread = await openai.beta.threads.create({
    messages: [{ role: "user", content: userQuestion }],
  });

  console.log("✅ Thread Created:", thread.id);
  return thread.id;
}

// ✅ Run Assistant to Get Response
async function runAssistant(threadId, assistantId) {
  const run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId,
  });

  const messages = await openai.beta.threads.messages.list(threadId, {
    run_id: run.id,
  });

  return messages.data.pop().content[0].text.value;
}
