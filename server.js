
// ✅ Import Required Modules
import path from "path";  // Ensure correct file path handling
import OpenAI from "openai";
import fs from "fs";
import { WebSocketServer } from "ws"; // WebSocket import
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
    instructions: "Du är en chatbot som svarar på användarens frågor genom att använda vector store files. Om användaren ställer en faktabaserad fråga, använd alltid File Search för att hitta svaret.",
    model: "gpt-4o",
    tools: [{ type: "file_search" }],
  });

  console.log("✅ Assistant Created:", assistant.id);
  return assistant.id;
}





async function uploadFiles() {
  const existingStores = await openai.beta.vectorStores.list();
  let vectorStoreId;

  if (existingStores.data.length > 0) {
    vectorStoreId = existingStores.data[0].id;
    console.log("🔍 Using Existing Vector Store:", vectorStoreId);

    // Fetch existing files **attached to the vector store**
    const files = await openai.beta.vectorStores.files.list(vectorStoreId);
    const existingFileIds = files.data.map(file => file.id);
    console.log("📜 Files in Vector Store BEFORE Upload:", existingFileIds);

    // ✅ If the file is already in the vector store, return early
    if (existingFileIds.length > 0) {
      console.log("✅ File already exists in Vector Store. No upload needed.");
      return vectorStoreId;
    }

    console.log("📂 File not found in vector store. Proceeding with upload...");
  } else {
    vectorStoreId = (await openai.beta.vectorStores.create({ name: "Knowledge Base" })).id;
    console.log("📂 Created new Vector Store:", vectorStoreId);
  }

  // ✅ Ensure the file exists on disk before uploading
  const filePath = path.resolve("vaccinationer_oformaterat.txt");
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

  // ✅ Attach uploaded file to Vector Store
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
const wss = new WebSocketServer({ server }); // 

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

  console.log("🔎 Run Details:", JSON.stringify(run, null, 2));

  // Check if file search was triggered
  if (run.step_details?.tool_calls?.length) {
    console.log("📂 File Search was triggered.");
  } else {
    console.warn("⚠️ File Search was NOT triggered!");
  }

  const messages = await openai.beta.threads.messages.list(threadId, {
    run_id: run.id,
  });

  return messages.data.pop().content[0].text.value;
}
