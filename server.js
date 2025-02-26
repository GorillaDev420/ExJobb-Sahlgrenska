// Import Required Modules
import path from "path";
import OpenAI from "openai";
import fs from "fs";
import { WebSocketServer } from "ws"; // WebSocket import
import express from "express";
import * as dotenv from "dotenv";

// Load Environment Variables
dotenv.config();

// OpenAI API Setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let assistantId = null;

// ✅ Create an Assistant
async function createAssistant() {
  const assistant = await openai.beta.assistants.create({
    name: "Real-Time AI Assistant",
    instructions: "Du ska alltid förhålla dig till instructions_ai.txt , när du svarar på en fråga.",
    model: "gpt-4o-mini",
    tools: [{ type: "file_search" }],
  });

  console.log("✅ Assistant Created:", assistant.id);
  return assistant.id;
}

// ✅ Upload Files to Vector Store
async function uploadFiles() {
  const existingStores = await openai.beta.vectorStores.list();
  let vectorStoreId;

  if (existingStores.data.length > 0) {
    vectorStoreId = existingStores.data[0].id;
    console.log("🔍 Using Existing Vector Store:", vectorStoreId);

    // ✅ Fetch existing files attached to the vector store
    const files = await openai.beta.vectorStores.files.list(vectorStoreId);
    const existingFileIds = files.data.map(file => file.id);
    console.log("📜 Files in Vector Store BEFORE Upload:", existingFileIds);

    // ✅ Check if the file is already uploaded
    if (existingFileIds.length > 0) {
      console.log("✅ File already exists in Vector Store. No upload needed.");
      return vectorStoreId;
    }
  } else {
    // ✅ If no vector store exists, create a new one
    vectorStoreId = (await openai.beta.vectorStores.create({ name: "Knowledge Base" })).id;
    console.log("📂 Created new Vector Store:", vectorStoreId);
  }

  // ✅ Check if the file exists locally before uploading
  const filePath = path.resolve("sjukdomar-och-åtgärder.txt");
  if (!fs.existsSync(filePath)) {
    console.error("❌ File does not exist at path:", filePath);
    return vectorStoreId;
  }

  console.log("📂 Uploading file:", filePath);

  let uploadedFile;
  try {
    uploadedFile = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: "assistants",
    });
    console.log("✅ File uploaded to OpenAI storage:", uploadedFile.id);
  } catch (error) {
    console.error("❌ File upload to OpenAI failed:", error);
    return vectorStoreId;
  }

  // ✅ Attach the uploaded file to the Vector Store
  try {
    await openai.beta.vectorStores.files.createAndPoll(vectorStoreId, {
      file_id: uploadedFile.id,
    });
    console.log("✅ File successfully linked to Vector Store.");
  } catch (error) {
    console.error("❌ Failed to link file to Vector Store:", error);
    return vectorStoreId;
  }

  // ✅ Fetch updated file list after upload
  try {
    const updatedFiles = await openai.beta.vectorStores.files.list(vectorStoreId);
    const uploadedFileIds = updatedFiles.data.map(file => file.id);
    console.log("📜 Files in Vector Store AFTER Upload:", uploadedFileIds);
  } catch (error) {
    console.error("❌ Error fetching file list after upload:", error);
  }

  return vectorStoreId;
}


// ✅ Attach Vector Store to Assistant
async function updateAssistant(assistantId, vectorStoreId) {
  await openai.beta.assistants.update(assistantId, {
    tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
  });

  console.log("✅ Assistant Updated to Use Vector Store");
}

// ✅ Run Setup (Assistant + Vector Store)
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
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  ws.on("message", async (message) => {
    console.log("📩 Received from client:", message.toString());

    if (!assistantId) {
      console.log("⚠️ Assistant not ready yet.");
      ws.send("⚠️ Assistant is still initializing. Please wait...");
      return;
    }

    try {
      const threadId = await createThread(message.toString());
      const response = await runAssistant(threadId, assistantId);

      console.log("🤖 AI Response:", response);
      ws.send(response);
    } catch (error) {
      console.error("❌ Error processing AI request:", error);
      ws.send("⚠️ Error communicating with AI. Please try again.");
    }
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

// ✅ Run Assistant to Get AI Response
async function runAssistant(threadId, assistantId) {
  const run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId,
  });

  console.log("🔎 OpenAI API Response:", JSON.stringify(run, null, 2));

  const messages = await openai.beta.threads.messages.list(threadId, {
    run_id: run.id,
  });

  let aiResponse = messages.data.pop().content[0].text.value;

  // 🔹 Format references:
  aiResponse = aiResponse.replace(/【\d+:\d+†[a-zA-Z]+】/g, '');





  console.log("🤖 Final AI Response (formatted):", aiResponse);
  return aiResponse;
}


